'use strict';

const mqtt = require('mqtt');
const { createAnalysis, updateAnalyzer, finalizeTripAnalysis } = require('../backend/analyzers');
const { THRESHOLDS } = require('../backend/analyzers/config');
const { computeVirtualSensors } = require('../backend/analyzers/PhysicsEngine');
const { vehicleEventBus }  = require('../backend/vehicle-profile');
const { resolveVehiclePhysics } = require('../backend/vehicle-profile/VehiclePhysicsResolver');
const { buildTripInsights } = require('../services/tripInsights');
const calatoriiActive       = require('../services/activeTrips');
const dtcService            = require('../services/dtcService');
const { syncOdometer }       = require('../services/vehicleSyncService');

const TOPIC_TELEMETRIE = process.env.MQTT_TOPIC || 'telemetrie/obd2';
const MQTT_BROKER_URL  = process.env.MQTT_BROKER_URL || 'mqtt://84.235.164.52:1883';

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(3));
}

/**
 * Salvează un lot de pachete telemetrie_flux în SQLite folosind o singură tranzacție
 * multi-row INSERT, reducând ciclurile de I/O pe disc cu până la 80%.
 */
function flushPendingFlux(db, trip) {
    if (!trip || !trip.pendingFluxInserts || trip.pendingFluxInserts.length === 0) {
        return Promise.resolve();
    }
    const batch = trip.pendingFluxInserts;
    trip.pendingFluxInserts = [];
    trip.lastFluxFlush = Date.now();

    return new Promise((resolve) => {
        const CHUNK_SIZE = 20; // 20 rânduri x 21 parametri = 420 parametri (sub limita SQLite de 999)
        const chunks = [];
        for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
            chunks.push(batch.slice(i, i + CHUNK_SIZE));
        }

        db.serialize(() => {
            let pendingChunks = chunks.length;
            if (pendingChunks === 0) return resolve();

            chunks.forEach((chunk) => {
                const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
                const flatParams = chunk.flat();
                const sql = `INSERT INTO telemetrie_flux (id_calatorie, timestamp, rpm, viteza_kmh, sarcina_pct, maf_gs, map_kpa, voltaj_v, temp_apa_c, temp_ulei_c, accel_g, consum_lh, boost_bar, dpf_soot, gear, torque_nm, matrice_completa_json, lat, lon, alt, heading) VALUES ${placeholders}`;
                db.run(sql, flatParams, (err) => {
                    if (err) console.error('[FLUX BATCH INSERT ERROR]', err.message);
                    pendingChunks--;
                    if (pendingChunks === 0) resolve();
                });
            });
        });
    });
}

function createMqttClient(db, io) {
    const client = mqtt.connect(MQTT_BROKER_URL);

    client.on('connect', () => {
        console.log('[MQTT] Conectat la broker! Gata pentru receptia matricei OBD-II & UDS...');
        client.subscribe(TOPIC_TELEMETRIE);
    });
    client.on('error',     (err) => console.error('[MQTT] Eroare conexiune:', err.message));
    client.on('close',     ()    => console.warn('[MQTT] Conexiune închisă. Se reconectează automat...'));
    client.on('reconnect', ()    => console.log('[MQTT] Reconectare în curs...'));
    client.on('offline',   ()    => console.warn('[MQTT] Broker inaccesibil — mod offline.'));

    client.on('message', async (topic, message) => {
        let pachet;
        try {
            pachet = JSON.parse(message.toString());
        } catch (e) {
            console.error('[MQTT] Pachet invalid (nu este JSON valid):', e.message);
            return;
        }

        if (!pachet || typeof pachet !== 'object') {
            console.warn('[MQTT] Pachet ignorat — structura invalida.');
            return;
        }

        // Timestamp auto-corecție: dacă ESP32 trimite secunde în loc de ms
        if (pachet.timestamp && pachet.timestamp < 1e10) pachet.timestamp *= 1000;
        if (!pachet.timestamp) {
            console.warn('[MQTT] Pachet ignorat — lipseste timestamp.');
            return;
        }

        const vin            = pachet.ecu?.vin || 'WAUZZZ4A1RN000000';
        const eveniment_motor = pachet.stare_motor;

        // DTC-uri live
        if (Array.isArray(pachet.dtc) && pachet.dtc.length > 0) {
            const coduriNoi = pachet.dtc.map(d => ({
                cod:        d.cod       || d.code       || 'UNKNOWN',
                modul:      d.modul     || d.module     || 'ECU',
                severitate: d.severitate || d.severity  || 'WARNING',
                descriere:  d.descriere  || d.description || d.cod || '',
            }));
            coduriNoi.forEach(nou => {
                if (!dtcService.eroriActiveDTC.find(e => e.cod === nou.cod)) {
                    dtcService.eroriActiveDTC.push(nou);
                    io.emit('alerta_live', { tip: 'DTC_DETECTAT', cod: nou.cod, descriere: nou.descriere, severitate: nou.severitate });
                    console.log(`[DTC] Cod nou detectat: ${nou.cod} — ${nou.descriere}`);
                }
            });
        }

        // Auto-start dacă MERS vine fără PORNIRE prealabil
        if (eveniment_motor === 'MERS' && !calatoriiActive[vin]) {
            console.warn(`[TRIP] MERS fără PORNIRE prealabil pentru ${vin} — auto-start cursă.`);
            pachet.stare_motor = 'PORNIRE';
        }

        // ── PORNIRE ──────────────────────────────────────────────────────────
        if (pachet.stare_motor === 'PORNIRE' && !calatoriiActive[vin]) {
            const modelVehicul = pachet.ecu?.model || 'Audi A6 C4 2.5 TDI AEL';
            db.run(`INSERT OR IGNORE INTO vehicule (vin, model) VALUES (?, ?)`, [vin, modelVehicul], () => {
                db.get(`SELECT * FROM vehicles WHERE UPPER(vin) = ?`, [vin.toUpperCase()], (err, vRow) => {
                    const vehiclePhysics = resolveVehiclePhysics(vRow || { vin, model: modelVehicul }, vin);
                    db.run(`INSERT INTO calatorii (vin, timestamp_start) VALUES (?, ?)`, [vin, pachet.timestamp], function(tripErr) {
                        if (!tripErr) {
                            calatoriiActive[vin] = {
                                id_calatorie:       this.lastID,
                                timestamp_start:    pachet.timestamp,
                                km:                 0,
                                consum_l:           0,
                                penalizari_eco:     0,
                                ultimul_timestamp:  pachet.timestamp,
                                alerts:             0,
                                analysis:           createAnalysis(),
                                packetCount:        0,
                                sampledPackets:     [],
                                pendingFluxInserts: [],
                                lastFluxFlush:      Date.now(),
                                vehiclePhysics,
                            };
                            console.log(`[TRIP START] Sesiunea #${this.lastID} a început pentru ${vin}! (${vehiclePhysics.model} - ${vehiclePhysics.massKg}kg, Redline: ${vehiclePhysics.thresholds.redlineRpm} RPM)`);
                            io.emit('status_trip', { status: 'START', id_calatorie: this.lastID });
                        }
                    });
                });
            });
            return;
        }

        // ── MERS ─────────────────────────────────────────────────────────────
        if (eveniment_motor === 'MERS' && calatoriiActive[vin]) {
            const trip = calatoriiActive[vin];
            const m    = pachet.motor        || {};
            const t    = pachet.temperaturi  || {};
            const a    = pachet.aer          || {};
            const c    = pachet.combustibil  || {};
            const bat  = pachet.baterie      || {};
            const dpf  = pachet.dpf          || {};
            const trans = pachet.transmisie  || {};

            const gps = pachet.gps || {};
            if (gps.lat && gps.lon) {
                trip.lastGps = { lat: gps.lat, lon: gps.lon, alt: gps.alt ?? 80, heading: gps.heading ?? 0 };
            }

            // Batching scrieri telemetrie_flux (tampon 5 secunde / 5 rânduri)
            const fluxRow = [
                trip.id_calatorie, pachet.timestamp, m.rpm || 0, m.speed || 0, m.load || 0, a.maf || 0, a.map || 101,
                bat.ecu_volt || 14.1, t.coolant || 35, t.oil || 20, m.accel_g || 0, c.inst_cons || 0,
                a.boost_actual || 0, dpf.soot_load || 0, trans.gear || 1, m.torque_actual || 0, JSON.stringify(pachet),
                gps.lat ?? null, gps.lon ?? null, gps.alt ?? null, gps.heading ?? null
            ];
            if (!trip.pendingFluxInserts) {
                trip.pendingFluxInserts = [];
                trip.lastFluxFlush = Date.now();
            }
            trip.pendingFluxInserts.push(fluxRow);

            const acumFlux = Date.now();
            if (trip.pendingFluxInserts.length >= 5 || (acumFlux - (trip.lastFluxFlush || 0)) >= 5000) {
                flushPendingFlux(db, trip);
            }

            const timp_scurs_ore = (pachet.timestamp - trip.ultimul_timestamp) / 3_600_000;
            if (timp_scurs_ore > 0 && timp_scurs_ore < 0.1) {
                trip.km       += (m.speed      || 0) * timp_scurs_ore;
                trip.consum_l += (c.inst_cons  || 0) * timp_scurs_ore;
            }
            trip.ultimul_timestamp = pachet.timestamp;

            // Calcul senzori virtuali cu profilul fizic dinamic al vehiculului activ
            const activePhysics = trip.vehiclePhysics || resolveVehiclePhysics({ vin }, vin);
            pachet.virtual = computeVirtualSensors(pachet, activePhysics);

            // Eșantionare uniformă în RAM (max 600 pachete) pentru a evita blocarea Event Loop-ului la OPRIRE
            trip.packetCount = (trip.packetCount || 0) + 1;
            if (!trip.sampledPackets) trip.sampledPackets = [];
            if (trip.sampledPackets.length < 600) {
                trip.sampledPackets.push(pachet);
            } else {
                const sampleIdx = Math.floor(Math.random() * trip.packetCount);
                if (sampleIdx < 600) {
                    trip.sampledPackets[sampleIdx] = pachet;
                }
            }

            const hardBrakesInainte  = trip.analysis.events.hardBrakes;
            const overspeedsInainte  = trip.analysis.events.overspeeds;
            updateAnalyzer(trip, pachet, trip.vehiclePhysics);
            const tocmaiAFostFranare   = trip.analysis.events.hardBrakes  > hardBrakesInainte;
            const tocmaiAFostOverspeed = trip.analysis.events.overspeeds  > overspeedsInainte;

            if ((m.accel_g || 0) >= 0.35) trip.penalizari_eco += 3;

            if (tocmaiAFostFranare) {
                trip.alerts++;
                trip.penalizari_eco += 5;
                db.run(`INSERT INTO evenimente_alerte (id_calatorie, timestamp, tip_eveniment, valoare_masurata, severitate, descriere) VALUES (?,?,?,?,?,?)`,
                    [trip.id_calatorie, pachet.timestamp, 'FRANARE_BRUSCA', m.accel_g, 'WARNING', 'Frânare agresivă (-0.4G depășit)']);
                io.emit('alerta_live', { tip: 'FRANARE_BRUSCA', g: m.accel_g, scor_curent: Math.max(0, 100 - trip.penalizari_eco) });
            }

            if (tocmaiAFostOverspeed) {
                trip.alerts++;
                trip.penalizari_eco += 4;
                const speedRounded = Math.round(m.speed || 0);
                db.run(`INSERT INTO evenimente_alerte (id_calatorie, timestamp, tip_eveniment, valoare_masurata, severitate, descriere) VALUES (?,?,?,?,?,?)`,
                    [trip.id_calatorie, pachet.timestamp, 'OVERSPEED', m.speed, 'WARNING', `Viteză excesivă — ${speedRounded} km/h (>130 km/h)`]);
                io.emit('alerta_live', { tip: 'OVERSPEED', viteza: m.speed, descriere: `Viteză excesivă — ${speedRounded} km/h`, scor_curent: Math.max(0, 100 - trip.penalizari_eco) });
            }

            // ── 1. Detecție Gropi & Șocuri Verticale Asfalt ──────────────────────
            const accelZ = parseFloat(pachet.accelerometru?.accel_z ?? 1.0);
            const speedNow = m.speed || 0;
            const nowSec = Math.floor(pachet.timestamp / 1000);
            if (speedNow >= 15 && accelZ >= 1.75) {
                if (!trip.lastPotholeSec || (nowSec - trip.lastPotholeSec) >= 3) {
                    trip.lastPotholeSec = nowSec;
                    const descriereGroapa = `Groapă / denivelare violentă (${accelZ.toFixed(2)}G la ${Math.round(speedNow)} km/h)`;
                    db.run(`INSERT INTO evenimente_alerte (id_calatorie, timestamp, tip_eveniment, valoare_masurata, severitate, descriere) VALUES (?,?,?,?,?,?)`,
                        [trip.id_calatorie, pachet.timestamp, 'GROAPA_DETECTATA', accelZ, 'WARNING', descriereGroapa]);
                    io.emit('groapa_detectata', {
                        tripId: trip.id_calatorie,
                        timestamp: pachet.timestamp,
                        forceG: accelZ,
                        speed: Math.round(speedNow),
                        lat: gps.lat ?? 44.4323,
                        lon: gps.lon ?? 26.1063,
                        descriere: descriereGroapa
                    });
                    io.emit('alerta_live', { tip: 'GROAPA_DETECTATA', g: accelZ, descriere: descriereGroapa, severitate: 'WARNING' });
                }
            }

            // ── 2. Detecție Accident Sever & eCall SOS ──────────────────────────
            const accelX = parseFloat(m.accel_g ?? pachet.accelerometru?.accel_x ?? 0);
            const resultantImpactG = pachet.accelerometru ?
                Math.sqrt(Math.pow(pachet.accelerometru.accel_x || 0, 2) + Math.pow(pachet.accelerometru.accel_y || 0, 2)) :
                Math.abs(accelX);
            if (!trip.hasCrashed && speedNow >= 20 && (accelX <= -2.8 || resultantImpactG >= 2.8)) {
                trip.hasCrashed = true;
                const crashG = Number((resultantImpactG >= 2.8 ? resultantImpactG : Math.abs(accelX)).toFixed(2));
                const currentLat = gps.lat ?? trip.lastGps?.lat ?? 44.4323;
                const currentLon = gps.lon ?? trip.lastGps?.lon ?? 26.1063;
                const googleMapsUrl = `https://maps.google.com/?q=${currentLat},${currentLon}`;
                const descriereAccident = `Coliziune violentă detectată (${crashG}G la ${Math.round(speedNow)} km/h)!`;

                db.run(`INSERT INTO evenimente_alerte (id_calatorie, timestamp, tip_eveniment, valoare_masurata, severitate, descriere) VALUES (?,?,?,?,?,?)`,
                    [trip.id_calatorie, pachet.timestamp, 'ACCIDENT_DETECTAT', crashG, 'CRITICAL', descriereAccident]);

                io.emit('alerta_accident', {
                    vin,
                    tripId: trip.id_calatorie,
                    timestamp: pachet.timestamp,
                    forceG: crashG,
                    speed: Math.round(speedNow),
                    lat: currentLat,
                    lon: currentLon,
                    googleMapsUrl,
                    descriere: descriereAccident
                });
                io.emit('alerta_live', { tip: 'ACCIDENT_DETECTAT', g: crashG, descriere: descriereAccident, severitate: 'CRITICAL' });
                console.error(`🚨 [CRASH DETECTAT] ${descriereAccident} — Coordonate: ${googleMapsUrl}`);
            }

            // ── 3. Monitorizare Abuz Mod Valet / Mecanic / Împrumut ─────────────
            if (!trip.valetCheckTime || (pachet.timestamp - trip.valetCheckTime) > 8000) {
                trip.valetCheckTime = pachet.timestamp;
                db.get(`SELECT * FROM valet_mode WHERE UPPER(vin) = ? AND is_active = 1`, [vin.toUpperCase()], (vErr, vRow) => {
                    trip.valetConfig = vRow || null;
                });
            }
            if (trip.valetConfig && trip.valetConfig.is_active) {
                const cfg = trip.valetConfig;
                const currentLat = gps.lat ?? trip.lastGps?.lat ?? cfg.center_lat;
                const currentLon = gps.lon ?? trip.lastGps?.lon ?? cfg.center_lon;
                const distCenterKm = (currentLat && currentLon && cfg.center_lat && cfg.center_lon) ?
                    calculateHaversineDistanceKm(currentLat, currentLon, cfg.center_lat, cfg.center_lon) : 0;

                let violType = null;
                let violVal = 0;
                let violLim = 0;
                let violDesc = '';

                if (speedNow > cfg.max_speed_kmh) {
                    violType = 'VITEZA';
                    violVal = Math.round(speedNow);
                    violLim = cfg.max_speed_kmh;
                    violDesc = `Viteză depășită în Mod Valet: ${Math.round(speedNow)} km/h (limită ${cfg.max_speed_kmh} km/h)`;
                } else if ((m.rpm || 0) > cfg.max_rpm) {
                    violType = 'TURATIE';
                    violVal = Math.round(m.rpm || 0);
                    violLim = cfg.max_rpm;
                    violDesc = `Turație depășită în Mod Valet: ${Math.round(m.rpm || 0)} RPM (limită ${cfg.max_rpm} RPM)`;
                } else if (distCenterKm > cfg.max_radius_km) {
                    violType = 'GEOFENCE';
                    violVal = Number(distCenterKm.toFixed(2));
                    violLim = cfg.max_radius_km;
                    violDesc = `Părăsire perimetru în Mod Valet: ${distCenterKm.toFixed(2)} km (limită ${cfg.max_radius_km} km)`;
                }

                if (violType) {
                    if (!trip.lastValetViolationSec || (nowSec - trip.lastValetViolationSec) >= 20) {
                        trip.lastValetViolationSec = nowSec;
                        let violationsList = [];
                        try { violationsList = JSON.parse(cfg.violations_json || '[]'); } catch (_) { violationsList = []; }
                        const newViolation = {
                            tip: violType,
                            valoare: violVal,
                            limita: violLim,
                            timestamp: pachet.timestamp,
                            descriere: violDesc,
                            lat: currentLat,
                            lon: currentLon
                        };
                        violationsList.push(newViolation);

                        db.run(`
                            UPDATE valet_mode
                            SET violations_count = violations_count + 1,
                                violations_json = ?
                            WHERE UPPER(vin) = ?
                        `, [JSON.stringify(violationsList.slice(-50)), vin.toUpperCase()]);

                        io.emit('alerta_valet', newViolation);
                        io.emit('alerta_live', { tip: 'ALERTA_VALET', descriere: violDesc, severitate: 'WARNING' });
                        console.warn(`⚠️ [MOD VALET VIOLARE] ${violDesc}`);
                    }
                }
            }

            io.emit('telemetrie_live', {
                id_calatorie: trip.id_calatorie,
                km_parcursi:  trip.km.toFixed(2),
                scor_eco:     Math.max(0, 100 - trip.penalizari_eco),
                ...pachet,
            });
            return;
        }

        // ── OPRIRE ───────────────────────────────────────────────────────────
        if (eveniment_motor === 'OPRIRE' && calatoriiActive[vin]) {
            const trip       = calatoriiActive[vin];

            // Golește orice scrieri de telemetrie_flux rămase în buffer înainte de finalizare
            await flushPendingFlux(db, trip);

            const scor_final = Math.max(0, 100 - trip.penalizari_eco);
            const consum_mediu = trip.km > 0.01 ? (trip.consum_l / trip.km) * 100 : null;

            // Optimizare Event Loop: folosim pachetele eșantionate direct din RAM dacă sunt disponibile,
            // evitând I/O-ul blocant și mii de operațiuni JSON.parse sincrone pe firul principal
            let rawPackets = (trip.sampledPackets && trip.sampledPackets.length >= 10)
                ? trip.sampledPackets.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                : null;

            if (!rawPackets) {
                rawPackets = await new Promise(resolve =>
                    db.all(`SELECT matrice_completa_json FROM telemetrie_flux WHERE id_calatorie = ? ORDER BY timestamp ASC LIMIT 1000`,
                        [trip.id_calatorie], (err, rows) =>
                            resolve((rows || []).map(r => { try { return JSON.parse(r.matrice_completa_json); } catch { return null; } }).filter(Boolean))
                    )
                );
            }

            const rezultatAnaliza = await finalizeTripAnalysis(trip, { db, vin, dtcList: dtcService.eroriActiveDTC, rawPackets });

            db.run(
                `UPDATE calatorii SET timestamp_end=?, km_parcursi=?, consum_total_l=?, consum_mediu_100km=?, scor_eco=? WHERE id_calatorie=?`,
                [pachet.timestamp, trip.km.toFixed(2), trip.consum_l.toFixed(2), consum_mediu != null ? consum_mediu.toFixed(1) : null, scor_final, trip.id_calatorie],
                async () => {
                    const litriTotali = rezultatAnaliza
                        ? (rezultatAnaliza.summary.fuel.idleLiters + rezultatAnaliza.summary.fuel.movingLiters)
                        : 0;

                    const fuelRow  = await new Promise(r => db.get(`SELECT tip_combustibil FROM vehicule WHERE vin=?`, [vin], (e, row) => r(row)));
                    const fuelKey  = (fuelRow?.tip_combustibil || 'diesel').toUpperCase().replace('-', '');
                    const pricePerL = THRESHOLDS[`${fuelKey}_PRICE_PER_LITER`] ?? THRESHOLDS.DIESEL_PRICE_PER_LITER;
                    const co2PerL   = THRESHOLDS[`${fuelKey}_CO2_KG_PER_LITER`]  ?? THRESHOLDS.DIESEL_CO2_KG_PER_LITER;
                    const cost = litriTotali * pricePerL;
                    const co2  = litriTotali * co2PerL;

                    if (rezultatAnaliza) {
                        const { summary, health, ai } = rezultatAnaliza;
                        db.run(
                            `INSERT INTO trip_summary (id_calatorie, durata_secunde, timp_relanti_sec, timp_mers_sec, viteza_max, viteza_medie, rpm_max, rpm_mediu, coolant_max, coolant_medie, oil_max, oil_medie, boost_max, boost_mediu, maf_max, maf_mediu, voltaj_min, voltaj_max, hard_brakes, hard_accelerations, nr_alerte, nr_dtc, cost_combustibil, emisii_co2, health_score, raport_ai_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                            [trip.id_calatorie, summary.duration.totalSeconds, summary.duration.idleSeconds, summary.duration.movingSeconds,
                             summary.pid.speed.max, summary.pid.speed.average, summary.pid.rpm.max, summary.pid.rpm.average,
                             summary.pid.coolant.max, summary.pid.coolant.average, summary.pid.oil.max, summary.pid.oil.average,
                             summary.pid.boost.max, summary.pid.boost.average, summary.pid.maf.max, summary.pid.maf.average,
                             summary.pid.voltage.min, summary.pid.voltage.max, summary.events.hardBrakes, summary.events.hardAccelerations,
                             trip.alerts, dtcService.eroriActiveDTC.length, cost.toFixed(2), co2.toFixed(2), health.overallHealth, JSON.stringify(ai)],
                            (err) => { if (err) console.error('[EROARE trip_summary]', err.message); }
                        );
                        console.log(`[TRIP ANALYZER] Health Score #${trip.id_calatorie}: ${health.overallHealth}%`);
                    }

                    console.log(`[TRIP STOP] Sesiunea #${trip.id_calatorie} s-a închis! Total: ${trip.km.toFixed(2)} km`);

                    const tripReport = rezultatAnaliza ? {
                        tripId:      trip.id_calatorie,
                        healthScore: rezultatAnaliza.health.overallHealth,
                        scores: {
                            engine:  rezultatAnaliza.health.engineScore,
                            fuel:    rezultatAnaliza.health.fuelScore,
                            driving: rezultatAnaliza.health.drivingScore,
                            safety:  rezultatAnaliza.health.safetyScore,
                        },
                        stats: {
                            distanceKm:       Number(trip.km.toFixed(2)),
                            durationMin:      Math.round((rezultatAnaliza.summary.duration.totalSeconds || 0) / 60),
                            fuelLiters:       Number(litriTotali.toFixed(2)),
                            consumptionPer100: trip.km > 0.1 ? Number((litriTotali / trip.km * 100).toFixed(1)) : null,
                            costRON:          Number(cost.toFixed(2)),
                            co2Kg:            Number(co2.toFixed(2)),
                            ecoScore:         scor_final,
                        },
                        driving: {
                            smoothPct:         rezultatAnaliza.summary.drivingStyle?.smoothPct        || 0,
                            economicPct:       rezultatAnaliza.summary.drivingStyle?.economicPct      || 0,
                            aggressivePct:     rezultatAnaliza.summary.drivingStyle?.aggressivePct    || 0,
                            hardBrakes:        rezultatAnaliza.summary.events?.hardBrakes             || 0,
                            hardAccelerations: rezultatAnaliza.summary.events?.hardAccelerations      || 0,
                            overspeeds:        rezultatAnaliza.summary.events?.overspeeds             || 0,
                        },
                        insights:    buildTripInsights(rezultatAnaliza),
                        predictions: (rezultatAnaliza.ai?.intelligence?.predictions || [])
                            .filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 2),
                    } : null;

                    io.emit('status_trip', {
                        status:       'STOP',
                        id_calatorie: trip.id_calatorie,
                        health_score: rezultatAnaliza ? rezultatAnaliza.health.overallHealth : null,
                        report:       tripReport,
                    });

                    db.get(`SELECT id FROM vehicles WHERE vin=?`, [vin], async (err, vehicle) => {
                        if (!vehicle) return;
                        const distKm = Number(trip.km.toFixed(1));

                        // Sincronizare automată a odometrului cu km parcurși în cursă
                        let currentOdometer = null;
                        try {
                            const rowOdo = await new Promise(r => db.get('SELECT odometru_calibrat_km FROM vehicule WHERE vin=?', [vin], (e, row) => r(row)));
                            if (rowOdo && rowOdo.odometru_calibrat_km > 0 && distKm > 0.05) {
                                currentOdometer = Number((rowOdo.odometru_calibrat_km + distKm).toFixed(1));
                                await syncOdometer(db, vin, currentOdometer, 'OBD', `Final cursă #${trip.id_calatorie} (+${distKm} km)`);
                            }
                        } catch (odoErr) {
                            console.error('[ODOMETER SYNC WARNING]', odoErr.message);
                        }

                        vehicleEventBus.emit(distKm > 300 ? 'LONG_TRIP' : 'TRIP_COMPLETED', {
                            vehicle_id: vehicle.id, source: 'OBD', distance_km: distKm,
                            mileage_km: currentOdometer, reference_type: 'TRIP', reference_id: trip.id_calatorie,
                            health_score: rezultatAnaliza ? rezultatAnaliza.health.overallHealth : null,
                        });
                        (rezultatAnaliza?.ai?.intelligence?.predictions || [])
                            .filter(p => p.severity === 'HIGH')
                            .forEach(p => vehicleEventBus.emit('AI_PREDICTION', {
                                vehicle_id: vehicle.id, source: 'AI',
                                title: `AI: ${p.component} — ${p.recommendation?.substring(0, 80) || 'Necesita atentie'}`,
                                prediction: p.component, severity_level: p.severity, probability: p.probability,
                                reference_type: 'TRIP', reference_id: trip.id_calatorie,
                            }));
                    });

                    // ── Actualizare Locație Parcare & Armare Automată Sentinela ─────────
                    const parkLat = trip.lastGps?.lat ?? pachet.gps?.lat ?? 44.4323;
                    const parkLon = trip.lastGps?.lon ?? pachet.gps?.lon ?? 26.1063;
                    const parkAlt = trip.lastGps?.alt ?? pachet.gps?.alt ?? 85;
                    const parkedAt = Math.floor(pachet.timestamp / 1000);

                    db.run(`
                        INSERT INTO parcare_sentinela (vin, lat, lon, alt, parked_at, is_armed, updated_at)
                        VALUES (?, ?, ?, ?, ?, 1, ?)
                        ON CONFLICT(vin) DO UPDATE SET
                            lat = excluded.lat,
                            lon = excluded.lon,
                            alt = excluded.alt,
                            parked_at = excluded.parked_at,
                            is_armed = 1,
                            updated_at = excluded.updated_at
                    `, [vin.toUpperCase(), parkLat, parkLon, parkAlt, parkedAt, parkedAt], (pErr) => {
                        if (pErr) console.error('[PARCARE EROARE]', pErr.message);
                        else {
                            console.log(`🅿️ [PARCARE SALVATĂ] ${vin} la lat=${parkLat}, lon=${parkLon} (Sentinela Armată)`);
                            io.emit('parcare_actualizata', {
                                vin,
                                lat: parkLat,
                                lon: parkLon,
                                alt: parkAlt,
                                parkedAt,
                                isArmed: true,
                                navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${parkLat},${parkLon}&travelmode=walking`
                            });
                        }
                    });

                    delete calatoriiActive[vin];
                }
            );
            return;
        }

        // ── 4. SENTINELA DE PARCARE (Șoc, Înclinare, Furt Geofence) ─────────
        if (pachet.stare_motor === 'PARCAT' || pachet.sentinela || pachet.eveniment === 'SOC_PARCARE') {
            const sentryData = pachet.sentinela || {};
            const nowSec = Math.floor(pachet.timestamp / 1000);

            db.get(`SELECT * FROM parcare_sentinela WHERE UPPER(vin) = ?`, [vin.toUpperCase()], (sErr, sentryRow) => {
                if (sErr || !sentryRow || sentryRow.is_armed !== 1) return;

                let events = [];
                try { events = JSON.parse(sentryRow.sentry_events_json || '[]'); } catch (_) { events = []; }

                let triggeredAlert = null;

                // A. Șoc / tamponare caroserie în parcare (> 0.65G)
                const shockG = parseFloat(sentryData.force_g || sentryData.shock_g || pachet.accelerometru?.accel_z || 0);
                if (shockG >= 0.65) {
                    triggeredAlert = {
                        tip: 'IMPACT',
                        titlu: 'Tamponare / Șoc în Parcare!',
                        descriere: `Senzorul de impact a înregistrat o forță de ${shockG.toFixed(2)}G. Verifică starea caroseriei!`,
                        valoare: shockG,
                        timestamp: pachet.timestamp
                    };
                    db.run(`UPDATE parcare_sentinela SET last_impact_at = ?, last_impact_g = ? WHERE UPPER(vin) = ?`,
                        [nowSec, shockG, vin.toUpperCase()]);
                }

                // B. Înclinare suspectă (> 3.5 grade — ridicare platformă / furt roți)
                const tiltDeg = parseFloat(sentryData.tilt_deg || pachet.accelerometru?.tilt_pitch || 0);
                if (!triggeredAlert && Math.abs(tiltDeg) >= 3.5) {
                    triggeredAlert = {
                        tip: 'INCLINARE',
                        titlu: 'Tentativă Ridicare / Înclinare!',
                        descriere: `Înclinare anormală la ${tiltDeg.toFixed(1)}° (posibilă tractare / ridicare pe platformă sau furt roți).`,
                        valoare: tiltDeg,
                        timestamp: pachet.timestamp
                    };
                    db.run(`UPDATE parcare_sentinela SET last_tilt_at = ?, last_tilt_deg = ? WHERE UPPER(vin) = ?`,
                        [nowSec, tiltDeg, vin.toUpperCase()]);
                }

                // C. Furt / mișcare neautorizată fără motor pornit (> 35m față de locul parcării)
                const currLat = pachet.gps?.lat;
                const currLon = pachet.gps?.lon;
                if (!triggeredAlert && currLat && currLon && sentryRow.lat && sentryRow.lon) {
                    const distMeters = calculateHaversineDistanceKm(sentryRow.lat, sentryRow.lon, currLat, currLon) * 1000;
                    if (distMeters >= 35) {
                        triggeredAlert = {
                            tip: 'MISCARE_NEAUTORIZATA',
                            titlu: 'Mișcare Neautorizată / Geofence Breach!',
                            descriere: `Vehiculul a fost deplasat cu ${Math.round(distMeters)}m fără pornirea contactului!`,
                            valoare: Math.round(distMeters),
                            timestamp: pachet.timestamp
                        };
                    }
                }

                if (triggeredAlert) {
                    events.push(triggeredAlert);
                    db.run(`UPDATE parcare_sentinela SET sentry_events_json = ?, updated_at = ? WHERE UPPER(vin) = ?`,
                        [JSON.stringify(events.slice(-30)), nowSec, vin.toUpperCase()]);

                    io.emit('alerta_sentinela', { vin, ...triggeredAlert });
                    io.emit('alerta_live', { tip: 'ALERTA_SENTINELA', descriere: triggeredAlert.descriere, severitate: 'CRITICAL' });
                    console.warn(`🛡️ [SENTINELA ALERTA] ${triggeredAlert.titlu} (${vin}): ${triggeredAlert.descriere}`);
                }
            });
        }
    });

    return client;
}

module.exports = { createMqttClient, flushPendingFlux };
