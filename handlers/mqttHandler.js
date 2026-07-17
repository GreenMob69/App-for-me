'use strict';

const mqtt = require('mqtt');
const { createAnalysis, updateAnalyzer, finalizeTripAnalysis } = require('../backend/analyzers');
const { THRESHOLDS } = require('../backend/analyzers/config');
const { vehicleEventBus }  = require('../backend/vehicle-profile');
const { buildTripInsights } = require('../services/tripInsights');
const calatoriiActive       = require('../services/activeTrips');
const dtcService            = require('../services/dtcService');

const TOPIC_TELEMETRIE = 'telemetrie/obd2';

function createMqttClient(db, io) {
    const client = mqtt.connect('mqtt://broker.emqx.io');

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
                db.run(`INSERT INTO calatorii (vin, timestamp_start) VALUES (?, ?)`, [vin, pachet.timestamp], function(err) {
                    if (!err) {
                        calatoriiActive[vin] = {
                            id_calatorie:     this.lastID,
                            timestamp_start:  pachet.timestamp,
                            km:               0,
                            consum_l:         0,
                            penalizari_eco:   0,
                            ultimul_timestamp: pachet.timestamp,
                            alerts:           0,
                            analysis:         createAnalysis(),
                        };
                        console.log(`[TRIP START] Sesiunea #${this.lastID} a început pentru ${vin}!`);
                        io.emit('status_trip', { status: 'START', id_calatorie: this.lastID });
                    }
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

            db.run(
                `INSERT INTO telemetrie_flux (id_calatorie, timestamp, rpm, viteza_kmh, sarcina_pct, maf_gs, map_kpa, voltaj_v, temp_apa_c, temp_ulei_c, accel_g, consum_lh, boost_bar, dpf_soot, gear, torque_nm, matrice_completa_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [trip.id_calatorie, pachet.timestamp, m.rpm||0, m.speed||0, m.load||0, a.maf||0, a.map||101,
                 bat.ecu_volt||14.1, t.coolant||35, t.oil||20, m.accel_g||0, c.inst_cons||0,
                 a.boost_actual||0, dpf.soot_load||0, trans.gear||1, m.torque_actual||0, JSON.stringify(pachet)]
            );

            const timp_scurs_ore = (pachet.timestamp - trip.ultimul_timestamp) / 3_600_000;
            if (timp_scurs_ore > 0 && timp_scurs_ore < 0.1) {
                trip.km       += (m.speed      || 0) * timp_scurs_ore;
                trip.consum_l += (c.inst_cons  || 0) * timp_scurs_ore;
            }
            trip.ultimul_timestamp = pachet.timestamp;

            const hardBrakesInainte  = trip.analysis.events.hardBrakes;
            const overspeedsInainte  = trip.analysis.events.overspeeds;
            updateAnalyzer(trip, pachet);
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
            const scor_final = Math.max(0, 100 - trip.penalizari_eco);
            const consum_mediu = trip.km > 0.01 ? (trip.consum_l / trip.km) * 100 : null;

            const rawPackets = await new Promise(resolve =>
                db.all(`SELECT matrice_completa_json FROM telemetrie_flux WHERE id_calatorie = ? ORDER BY timestamp ASC`,
                    [trip.id_calatorie], (err, rows) =>
                        resolve((rows || []).map(r => { try { return JSON.parse(r.matrice_completa_json); } catch { return null; } }).filter(Boolean))
                )
            );

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

                    db.get(`SELECT id FROM vehicles WHERE vin=?`, [vin], (err, vehicle) => {
                        if (!vehicle) return;
                        const distKm = Number(trip.km.toFixed(1));
                        vehicleEventBus.emit(distKm > 300 ? 'LONG_TRIP' : 'TRIP_COMPLETED', {
                            vehicle_id: vehicle.id, source: 'OBD', distance_km: distKm,
                            mileage_km: null, reference_type: 'TRIP', reference_id: trip.id_calatorie,
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

                    delete calatoriiActive[vin];
                }
            );
        }
    });

    return client;
}

module.exports = { createMqttClient };
