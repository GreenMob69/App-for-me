'use strict';

/**
 * routes/smartMobility.js
 * --------------------------------------------------------------------------
 * Suită completă Smart Mobility, GPS, Securitate & Salvare Urgențe:
 *   1. Sentinela de Parcare (Sentry Mode — Șoc, Înclinare, Furt Geofence)
 *   2. Găsește-mi Mașina + Cronometru Tichet Parcare cu Plată
 *   3. Modul Valet / Service / Împrumut (Limită Rază, Viteză, Turație)
 *   4. Harta Traseului cu Amprentă Telemetrică (GPS + OBD2 + Detecție Gropi)
 *   5. Detecție Accident & Salvare SOS (eCall inteligent)
 * --------------------------------------------------------------------------
 */

const express = require('express');

// Calculează distanța Haversine între două coordonate GPS în km
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const R = 6371; // raza Pământului în km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(3));
}

module.exports = function(db, io) {
    const router = express.Router();

    // =========================================================================
    // 1 & 2: PARCARE, SENTINELA & GĂSEȘTE-MI MAȘINA
    // =========================================================================

    // GET starea parcării, sentinelei și tichetului de parcare
    router.get('/vehicul/:vin/parcare', (req, res) => {
        const vin = req.params.vin.toUpperCase();

        db.get(`SELECT * FROM parcare_sentinela WHERE UPPER(vin) = ?`, [vin], async (err, row) => {
            if (err) return res.status(500).json({ eroare: err.message });

            const now = Math.floor(Date.now() / 1000);

            // Dacă nu există încă o înregistrare, facem fallback la ultima locație din telemetrie_flux
            if (!row) {
                const lastPoint = await new Promise((resolve) => {
                    db.get(`
                        SELECT tf.lat, tf.lon, tf.alt, tf.timestamp
                        FROM telemetrie_flux tf
                        JOIN calatorii c ON c.id_calatorie = tf.id_calatorie
                        WHERE UPPER(c.vin) = ? AND tf.lat IS NOT NULL
                        ORDER BY tf.timestamp DESC LIMIT 1
                    `, [vin], (e, r) => resolve(r));
                });

                const defaultLat = lastPoint?.lat ?? 44.4323;
                const defaultLon = lastPoint?.lon ?? 26.1063;
                const defaultParkedAt = lastPoint?.timestamp ? Math.floor(lastPoint.timestamp / 1000) : now;

                return res.json({
                    vin,
                    isArmed: true,
                    isParked: true,
                    lat: defaultLat,
                    lon: defaultLon,
                    alt: lastPoint?.alt ?? 85,
                    parkedAt: defaultParkedAt,
                    parkedMinutes: Math.max(0, Math.round((now - defaultParkedAt) / 60)),
                    parkingMeter: {
                        active: false,
                        expiresAt: null,
                        remainingMinutes: 0,
                    },
                    lastImpact: null,
                    lastTilt: null,
                    sentryEvents: [],
                    navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${defaultLat},${defaultLon}&travelmode=walking`,
                });
            }

            let sentryEvents = [];
            try {
                sentryEvents = JSON.parse(row.sentry_events_json || '[]');
            } catch (_) {
                sentryEvents = [];
            }

            const meterExpiresAt = row.parking_meter_expires_at;
            const meterActive = meterExpiresAt && meterExpiresAt > now;
            const remainingMinutes = meterActive ? Math.max(0, Math.round((meterExpiresAt - now) / 60)) : 0;
            const parkedAt = row.parked_at || (now - 1200);

            res.json({
                vin,
                isArmed: Boolean(row.is_armed),
                isParked: true,
                lat: row.lat ?? 44.4323,
                lon: row.lon ?? 26.1063,
                alt: row.alt ?? 85,
                parkedAt,
                parkedMinutes: Math.max(0, Math.round((now - parkedAt) / 60)),
                parkingMeter: {
                    active: meterActive,
                    expiresAt: meterExpiresAt,
                    totalMinutes: row.parking_meter_minutes || 0,
                    remainingMinutes,
                },
                lastImpact: row.last_impact_at ? {
                    at: row.last_impact_at,
                    forceG: row.last_impact_g,
                } : null,
                lastTilt: row.last_tilt_at ? {
                    at: row.last_tilt_at,
                    deg: row.last_tilt_deg,
                } : null,
                sentryEvents: sentryEvents.slice(-10).reverse(),
                navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${row.lat || 44.4323},${row.lon || 26.1063}&travelmode=walking`,
            });
        });
    });

    // POST configurare cronometru parcare cu plată (minute: 15, 30, 60, 120, etc.)
    router.post('/vehicul/:vin/parcare/meter', (req, res) => {
        const vin = req.params.vin.toUpperCase();
        const minutes = parseInt(req.body.minutes || '60', 10);
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + (minutes * 60);

        db.run(`
            INSERT INTO parcare_sentinela (vin, parking_meter_expires_at, parking_meter_minutes, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(vin) DO UPDATE SET
                parking_meter_expires_at = excluded.parking_meter_expires_at,
                parking_meter_minutes = excluded.parking_meter_minutes,
                updated_at = excluded.updated_at
        `, [vin, expiresAt, minutes, now], (err) => {
            if (err) return res.status(500).json({ eroare: err.message });

            io.emit('parcare_meter_actualizat', { vin, expiresAt, minutes });
            res.json({ ok: true, vin, expiresAt, minutes, remainingMinutes: minutes });
        });
    });

    // POST toggle armare sentinela parcare
    router.post('/vehicul/:vin/parcare/sentry/toggle', (req, res) => {
        const vin = req.params.vin.toUpperCase();
        const { isArmed } = req.body;
        const armedVal = isArmed !== undefined ? (isArmed ? 1 : 0) : 1;
        const now = Math.floor(Date.now() / 1000);

        db.run(`
            INSERT INTO parcare_sentinela (vin, is_armed, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(vin) DO UPDATE SET
                is_armed = excluded.is_armed,
                updated_at = excluded.updated_at
        `, [vin, armedVal, now], (err) => {
            if (err) return res.status(500).json({ eroare: err.message });
            io.emit('sentinela_status', { vin, isArmed: Boolean(armedVal) });
            res.json({ ok: true, vin, isArmed: Boolean(armedVal) });
        });
    });

    // =========================================================================
    // 3: MOD VALET / SERVICE / ÎMPRUMUT
    // =========================================================================

    // GET stare mod valet
    router.get('/vehicul/:vin/valet', (req, res) => {
        const vin = req.params.vin.toUpperCase();

        db.get(`SELECT * FROM valet_mode WHERE UPPER(vin) = ?`, [vin], (err, row) => {
            if (err) return res.status(500).json({ eroare: err.message });

            if (!row) {
                return res.json({
                    vin,
                    isActive: false,
                    centerLat: 44.4323,
                    centerLon: 26.1063,
                    maxRadiusKm: 3.0,
                    maxSpeedKmh: 80,
                    maxRpm: 3500,
                    activatedAt: null,
                    violationsCount: 0,
                    violations: [],
                });
            }

            let violations = [];
            try {
                violations = JSON.parse(row.violations_json || '[]');
            } catch (_) {
                violations = [];
            }

            res.json({
                vin,
                isActive: Boolean(row.is_active),
                centerLat: row.center_lat ?? 44.4323,
                centerLon: row.center_lon ?? 26.1063,
                maxRadiusKm: row.max_radius_km || 3.0,
                maxSpeedKmh: row.max_speed_kmh || 80,
                maxRpm: row.max_rpm || 3500,
                activatedAt: row.activated_at,
                violationsCount: row.violations_count || 0,
                violations: violations.slice(-20).reverse(),
            });
        });
    });

    // POST toggle mod valet & actualizare limite
    router.post('/vehicul/:vin/valet/toggle', async (req, res) => {
        const vin = req.params.vin.toUpperCase();
        const data = req.body || {};
        const isActive = data.isActive ? 1 : 0;
        const maxRadiusKm = parseFloat(data.maxRadiusKm) || 3.0;
        const maxSpeedKmh = parseInt(data.maxSpeedKmh) || 80;
        const maxRpm = parseInt(data.maxRpm) || 3500;
        const now = Math.floor(Date.now() / 1000);

        // Dacă nu a fost trimis un centru explicit, luăm ultima locație GPS a mașinii
        let centerLat = data.centerLat ? parseFloat(data.centerLat) : null;
        let centerLon = data.centerLon ? parseFloat(data.centerLon) : null;

        if (!centerLat || !centerLon) {
            const lastLoc = await new Promise((resolve) => {
                db.get(`
                    SELECT tf.lat, tf.lon FROM telemetrie_flux tf
                    JOIN calatorii c ON c.id_calatorie = tf.id_calatorie
                    WHERE UPPER(c.vin) = ? AND tf.lat IS NOT NULL
                    ORDER BY tf.timestamp DESC LIMIT 1
                `, [vin], (e, r) => resolve(r));
            });
            centerLat = lastLoc?.lat ?? 44.4323;
            centerLon = lastLoc?.lon ?? 26.1063;
        }

        db.run(`
            INSERT INTO valet_mode (vin, is_active, center_lat, center_lon, max_radius_km, max_speed_kmh, max_rpm, activated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(vin) DO UPDATE SET
                is_active = excluded.is_active,
                center_lat = excluded.center_lat,
                center_lon = excluded.center_lon,
                max_radius_km = excluded.max_radius_km,
                max_speed_kmh = excluded.max_speed_kmh,
                max_rpm = excluded.max_rpm,
                activated_at = excluded.activated_at
        `, [vin, isActive, centerLat, centerLon, maxRadiusKm, maxSpeedKmh, maxRpm, isActive ? now : null], (err) => {
            if (err) return res.status(500).json({ eroare: err.message });

            io.emit('valet_status', {
                vin,
                isActive: Boolean(isActive),
                centerLat,
                centerLon,
                maxRadiusKm,
                maxSpeedKmh,
                maxRpm,
            });

            res.json({
                ok: true,
                vin,
                isActive: Boolean(isActive),
                centerLat,
                centerLon,
                maxRadiusKm,
                maxSpeedKmh,
                maxRpm,
            });
        });
    });

    // =========================================================================
    // 4: HARTA TRASEULUI CU AMPRENTĂ TELEMETRICĂ & DETECȚIE GROPI
    // =========================================================================

    router.get('/calatorii/:id/harta-telemetrie', (req, res) => {
        const tripId = req.params.id;

        db.all(`
            SELECT timestamp, rpm, viteza_kmh, consum_lh, accel_g, temp_apa_c, gear, lat, lon, alt
            FROM telemetrie_flux
            WHERE id_calatorie = ?
            ORDER BY timestamp ASC
        `, [tripId], (err, rows) => {
            if (err) return res.status(500).json({ eroare: err.message });
            if (!rows || rows.length === 0) return res.json({ tripId, points: [], potholes: [] });

            // Identificare gropi / șocuri severe înregistrate în această cursă
            db.all(`
                SELECT timestamp, tip_eveniment, valoare_masurata, descriere
                FROM evenimente_alerte
                WHERE id_calatorie = ? AND tip_eveniment IN ('GROAPA_DETECTATA', 'FRANARE_BRUSCA', 'ACCIDENT_DETECTAT')
            `, [tripId], (alertErr, alertRows) => {
                const potholes = [];
                const hardBrakes = [];

                (alertRows || []).forEach(a => {
                    // Caută cel mai apropiat punct GPS după timestamp
                    const closest = rows.reduce((prev, curr) =>
                        Math.abs(curr.timestamp - a.timestamp) < Math.abs(prev.timestamp - a.timestamp) ? curr : prev, rows[0]);

                    if (a.tip_eveniment === 'GROAPA_DETECTATA') {
                        potholes.push({
                            timestamp: a.timestamp,
                            forceG: a.valoare_masurata,
                            descriere: a.descriere,
                            lat: closest?.lat ?? 44.4323,
                            lon: closest?.lon ?? 26.1063,
                        });
                    } else if (a.tip_eveniment === 'FRANARE_BRUSCA') {
                        hardBrakes.push({
                            timestamp: a.timestamp,
                            forceG: a.valoare_masurata,
                            lat: closest?.lat ?? 44.4323,
                            lon: closest?.lon ?? 26.1063,
                        });
                    }
                });

                // Eșantionare uniformă max 120 puncte pentru randare fluidă pe harta mobilă
                const step = Math.max(1, Math.floor(rows.length / 120));
                const sampled = [];

                for (let i = 0; i < rows.length; i += step) {
                    const r = rows[i];
                    // Categorie de consum / stil pentru colorarea traseului (verde / galben / roșu)
                    let color = '#10b981'; // verde
                    if (r.consum_lh > 14 || r.accel_g >= 0.3) color = '#ff453a'; // roșu intens
                    else if (r.consum_lh > 9 || r.viteza_kmh > 110) color = '#f59e0b'; // galben

                    sampled.push({
                        timestamp: r.timestamp,
                        lat: r.lat ?? (44.4323 + Math.sin(i / 15) * 0.01),
                        lon: r.lon ?? (26.1063 + Math.cos(i / 15) * 0.012),
                        speedKmh: r.viteza_kmh || 0,
                        rpm: r.rpm || 0,
                        consumLh: r.consum_lh || 0,
                        accelG: r.accel_g || 0,
                        color,
                    });
                }

                res.json({
                    tripId: Number(tripId),
                    totalPoints: rows.length,
                    points: sampled,
                    potholes,
                    hardBrakes,
                });
            });
        });
    });

    // =========================================================================
    // 5: DETECȚIE ACCIDENT & SALVARE SOS (eCall)
    // =========================================================================

    // GET contacte urgență
    router.get('/vehicul/:vin/sos/contacte', (req, res) => {
        const vin = req.params.vin.toUpperCase();

        db.get(`SELECT * FROM contacte_urgenta WHERE UPPER(vin) = ?`, [vin], (err, row) => {
            if (err) return res.status(500).json({ eroare: err.message });
            res.json({
                vin,
                nume: row?.nume || 'Contact de Urgență (Familie)',
                telefon: row?.telefon || '',
                mesajPersonalizat: row?.mesaj_personalizat || 'Posibil accident detectat! Verifică starea mea la coordonatele GPS atașate.',
                autoSendSos: row ? Boolean(row.auto_send_sos) : true,
            });
        });
    });

    // POST salvare contacte urgență
    router.post('/vehicul/:vin/sos/contacte', (req, res) => {
        const vin = req.params.vin.toUpperCase();
        const { nume, telefon, mesajPersonalizat, autoSendSos } = req.body;
        const now = Math.floor(Date.now() / 1000);

        db.run(`
            INSERT INTO contacte_urgenta (vin, nume, telefon, mesaj_personalizat, auto_send_sos, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(vin) DO UPDATE SET
                nume = excluded.nume,
                telefon = excluded.telefon,
                mesaj_personalizat = excluded.mesaj_personalizat,
                auto_send_sos = excluded.auto_send_sos,
                updated_at = excluded.updated_at
        `, [vin, nume || 'Contact Urgență', telefon || '', mesajPersonalizat || '', autoSendSos ? 1 : 0, now], (err) => {
            if (err) return res.status(500).json({ eroare: err.message });
            res.json({ ok: true, vin, nume, telefon, autoSendSos: Boolean(autoSendSos) });
        });
    });

    // POST testare simulare accident / trigger eCall
    router.post('/vehicul/:vin/sos/test', (req, res) => {
        const vin = req.params.vin.toUpperCase();
        const now = Date.now();
        const lat = req.body.lat || 44.4323;
        const lon = req.body.lon || 26.1063;
        const forceG = parseFloat(req.body.forceG) || 3.2;
        const speed = parseInt(req.body.speed) || 68;

        const googleMapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
        const alerta = {
            vin,
            timestamp: now,
            forceG,
            speed,
            lat,
            lon,
            googleMapsUrl,
            descriere: `💥 SIMULARE / IMPACT VIOLENT DETECTAT (${forceG}G la ${speed} km/h)!`,
        };

        io.emit('alerta_accident', alerta);
        res.json({ ok: true, alerta });
    });

    // POST testare simulare eveniment Sentinela (Șoc sau Înclinare)
    router.post('/vehicul/:vin/sentry/test', (req, res) => {
        const vin = req.params.vin.toUpperCase();
        const tip = req.body.tip === 'INCLINARE' ? 'INCLINARE' : 'IMPACT';
        const now = Date.now();
        const nowSec = Math.floor(now / 1000);
        const forceG = parseFloat(req.body.forceG) || 0.85;
        const tiltDeg = parseFloat(req.body.tiltDeg) || 4.2;

        const alerta = tip === 'INCLINARE' ? {
            vin,
            tip: 'INCLINARE',
            titlu: 'Tentativă Ridicare / Înclinare!',
            descriere: `Înclinare anormală la ${tiltDeg.toFixed(1)}° (simulare tentativă furt roți / platformă).`,
            valoare: tiltDeg,
            timestamp: now,
        } : {
            vin,
            tip: 'IMPACT',
            titlu: 'Tamponare / Șoc în Parcare!',
            descriere: `Senzorul de impact a înregistrat o forță de ${forceG.toFixed(2)}G. Verifică caroseria!`,
            valoare: forceG,
            timestamp: now,
        };

        db.get(`SELECT * FROM parcare_sentinela WHERE UPPER(vin) = ?`, [vin], (err, row) => {
            let events = [];
            try { events = JSON.parse(row?.sentry_events_json || '[]'); } catch (_) { events = []; }
            events.unshift(alerta);

            db.run(`
                INSERT INTO parcare_sentinela (vin, last_impact_at, last_impact_g, last_tilt_at, last_tilt_deg, sentry_events_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(vin) DO UPDATE SET
                    last_impact_at = excluded.last_impact_at,
                    last_impact_g = excluded.last_impact_g,
                    last_tilt_at = excluded.last_tilt_at,
                    last_tilt_deg = excluded.last_tilt_deg,
                    sentry_events_json = excluded.sentry_events_json,
                    updated_at = excluded.updated_at
            `, [vin, nowSec, forceG, nowSec, tiltDeg, JSON.stringify(events.slice(0, 30)), nowSec], () => {
                io.emit('alerta_sentinela', alerta);
                io.emit('alerta_live', { tip: 'ALERTA_SENTINELA', descriere: alerta.descriere, severitate: 'CRITICAL' });
                res.json({ ok: true, alerta });
            });
        });
    });

    // POST testare simulare violare Mod Valet
    router.post('/vehicul/:vin/valet/test', (req, res) => {
        const vin = req.params.vin.toUpperCase();
        const now = Date.now();
        const speed = parseInt(req.body.speed) || 94;
        const rpm = parseInt(req.body.rpm) || 3950;
        const descriere = `Simulare depășire viteză Mod Valet: ${speed} km/h (limită 80 km/h) & ${rpm} RPM!`;

        const newViolation = {
            tip: 'VITEZA',
            valoare: speed,
            limita: 80,
            timestamp: now,
            descriere,
            lat: 44.4323,
            lon: 26.1063,
        };

        db.get(`SELECT * FROM valet_mode WHERE UPPER(vin) = ?`, [vin], (err, row) => {
            let list = [];
            try { list = JSON.parse(row?.violations_json || '[]'); } catch (_) { list = []; }
            list.unshift(newViolation);

            db.run(`
                INSERT INTO valet_mode (vin, is_active, violations_count, violations_json)
                VALUES (?, 1, 1, ?)
                ON CONFLICT(vin) DO UPDATE SET
                    violations_count = violations_count + 1,
                    violations_json = excluded.violations_json
            `, [vin, JSON.stringify(list.slice(0, 50))], () => {
                io.emit('alerta_valet', newViolation);
                io.emit('alerta_live', { tip: 'ALERTA_VALET', descriere, severitate: 'WARNING' });
                res.json({ ok: true, violation: newViolation });
            });
        });
    });

    // POST testare simulare detecție groapă asfalt
    router.post('/vehicul/:vin/pothole/test', (req, res) => {
        const vin = req.params.vin.toUpperCase();
        const now = Date.now();
        const forceG = parseFloat(req.body.forceG) || 1.95;
        const speed = parseInt(req.body.speed) || 48;
        const descriere = `Groapă severă detectată (${forceG}G la ${speed} km/h)!`;

        db.get(`SELECT id_calatorie FROM calatorii WHERE UPPER(vin) = ? ORDER BY id_calatorie DESC LIMIT 1`, [vin], (err, trip) => {
            const tripId = trip?.id_calatorie || 1;
            db.run(`
                INSERT INTO evenimente_alerte (id_calatorie, timestamp, tip_eveniment, valoare_masurata, severitate, descriere)
                VALUES (?, ?, 'GROAPA_DETECTATA', ?, 'WARNING', ?)
            `, [tripId, now, forceG, descriere], () => {
                const potholeObj = {
                    tripId,
                    timestamp: now,
                    forceG,
                    speed,
                    lat: 44.4323 + (Math.random() * 0.005 - 0.0025),
                    lon: 26.1063 + (Math.random() * 0.005 - 0.0025),
                    descriere,
                };
                io.emit('groapa_detectata', potholeObj);
                io.emit('alerta_live', { tip: 'GROAPA_DETECTATA', g: forceG, descriere, severitate: 'WARNING' });
                res.json({ ok: true, pothole: potholeObj });
            });
        });
    });

    return router;
};
