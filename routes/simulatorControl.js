'use strict';

const express = require('express');
const { handleIncomingTelemetry } = require('../handlers/mqttHandler');

module.exports = function (db, io) {
    const router = express.Router();

    let simState = {
        timer: null,
        scenario: 'idle',
        startTime: null,
        durationSec: 180,
        elapsedSec: 0,
        vin: 'WAUZZZ4A1RN000000',
        model: 'Audi A6 C4 2.5 TDI AEL',
        // Valori simulate de bază
        speed: 0,
        rpm: 800,
        gear: 1,
        load: 15,
        coolant: 45,
        oil: 35,
        boost: 0.1,
        lat: 44.4323,
        lon: 26.1063,
    };

    function generatePacketForScenario(scenario, sec, totalSec) {
        const progress = Math.min(sec / Math.max(totalSec, 1), 1.0);
        const now = Date.now();

        let spd = 65 + Math.sin(sec / 5) * 20;
        let rpm = 1800 + Math.sin(sec / 5) * 800;
        let load = 40 + Math.sin(sec / 4) * 25;
        let gear = 4;
        let coolant = Math.min(90, 45 + progress * 45);
        let oil = Math.min(95, 35 + progress * 60);
        let boost = 0.8 + Math.sin(sec / 6) * 0.4;
        let map_cmd = 180;
        let map_act = 180;
        let maf = 55 + (rpm / 1000) * 15;
        let accel_x = 0.05 + Math.sin(sec / 3) * 0.12;
        let accel_y = Math.cos(sec / 4) * 0.15;
        let accel_z = 1.0;
        let brakeTemp = 90;
        let brakeFluidTemp = 100;
        let roadGrade = 0;
        let wheelSlip = 0;
        let runawayRisk = false;
        let dtcList = [];

        // Scenarii dedicate
        switch (scenario) {
            case 'normal':
                // Croazieră optimă TDI (100% nominal)
                spd = 88 + Math.sin(sec / 8) * 12;
                rpm = 2100 + Math.sin(sec / 8) * 250;
                gear = 5;
                load = 42;
                coolant = 89;
                oil = 92;
                boost = 1.15;
                map_act = 215;
                map_cmd = 215;
                break;

            case 'fault_turbo':
                // Furtun Intercooler Fisurat / Boost Leak (MAP scade dramatic sub comandă)
                spd = 60 + Math.sin(sec / 4) * 10;
                rpm = 2600 + Math.sin(sec / 4) * 400;
                load = 85;
                map_cmd = 230;
                map_act = 135; // Diferență masivă => Boost Leak
                boost = 0.35;
                dtcList.push({ cod: 'P0299', modul: 'ECU', severitate: 'WARNING', descriere: 'Turbocharger Underboost Condition' });
                break;

            case 'fault_cooling':
                // Supraîncălzire lichid răcire
                spd = 70;
                rpm = 2200;
                load = 65;
                coolant = Math.min(118, 90 + (sec * 0.8));
                oil = Math.min(132, 95 + (sec * 0.7));
                boost = 1.0;
                if (coolant > 105) {
                    dtcList.push({ cod: 'P0217', modul: 'ECU', severitate: 'CRITICAL', descriere: 'Engine Coolant Overtemperature Condition' });
                }
                break;

            case 'mountain_brakes':
                // Coborâre munte cu frânare intensă și risc de fierbere lichid frână
                spd = 55 + Math.sin(sec / 3) * 25;
                rpm = 2800;
                gear = 3;
                load = 10;
                roadGrade = -7.5; // Pantă de -7.5%
                accel_x = -0.38 + Math.sin(sec / 2) * 0.15; // Frânare frecventă
                brakeTemp = Math.min(380, 110 + (sec * 6));
                brakeFluidTemp = Math.min(210, 105 + (sec * 3.5)); // Risc fierbere lichid de frână
                break;

            case 'black_ice':
                // Polei / Pierdere violentă de aderență
                spd = 68;
                rpm = 2700 + Math.sin(sec / 2) * 500;
                gear = 4;
                load = 55;
                accel_y = Math.sin(sec / 2) * 0.35; // Derapaj lateral
                wheelSlip = 14.5; // Slip delta mare => Polei (Black Ice)
                break;

            case 'dpf_regen':
                // Regenerare activă DPF la 625°C
                spd = 95;
                rpm = 2350;
                gear = 5;
                load = 50;
                coolant = 92;
                oil = 105;
                boost = 1.25;
                break;

            case 'diesel_runaway':
                // Autoturare diesel pe ulei (RPM urcă necontrolat la 4800+ RPM)
                spd = 90 + sec * 1.5;
                rpm = Math.min(5200, 3200 + (sec * 80));
                gear = 4;
                load = 100;
                boost = 2.4;
                coolant = 102;
                runawayRisk = true;
                break;

            case 'worn_injectors':
                // Injectoare colmatate / dezechilibru cantitate injecție
                spd = 65;
                rpm = 1950 + (Math.random() * 80 - 40);
                gear = 4;
                load = 58;
                coolant = 88;
                dtcList.push({ cod: 'P0263', modul: 'ECU', severitate: 'WARNING', descriere: 'Cylinder 1 Contribution/Balance Fault' });
                break;

            default:
                break;
        }

        return {
            ecu: { vin: simState.vin, model: simState.model },
            stare_motor: 'MERS',
            timestamp: now,
            // Top-level aliases for universal compatibility
            viteza_kmh: Math.round(spd),
            rpm: Math.round(rpm),
            sarcina_pct: Math.round(load),
            throttle: Math.round(load * 0.9),
            temp_apa_c: +coolant.toFixed(1),
            temp_ulei_c: +oil.toFixed(1),
            voltaj_v: scenario === 'fault_cooling' ? 13.4 : 14.2,
            consum_lh: +(4.2 + (load / 100) * 4.8).toFixed(1),
            gear: gear,
            boost_bar: +boost.toFixed(2),
            torque_nm: Math.round(load * 2.8),
            dinamica: {
                viteza: Math.round(spd),
                turatie: Math.round(rpm),
                acceleratie: Math.round(load * 0.9),
                treapta_viteza: gear,
            },
            gps: {
                lat: +(simState.lat + (sec * 0.00015)).toFixed(6),
                lon: +(simState.lon + (sec * 0.0001)).toFixed(6),
                alt: 85,
                heading: 45,
                speed_kmh: Math.round(spd),
            },
            accelerometru: {
                accel_x: +accel_x.toFixed(2),
                accel_y: +accel_y.toFixed(2),
                accel_z: +accel_z.toFixed(2),
                tilt_pitch: +(roadGrade * 0.57).toFixed(1),
                tilt_roll: 0.0,
            },
            motor: {
                rpm: Math.round(rpm),
                speed: Math.round(spd),
                load: Math.round(load),
                accel_g: +accel_x.toFixed(2),
                torque_actual: Math.round(load * 2.8),
                throttle_pos: Math.round(load * 0.9),
                treapta_viteza: gear,
                wheel_slip_kmh: wheelSlip,
            },
            temperaturi: {
                coolant: +coolant.toFixed(1),
                oil: +oil.toFixed(1),
                ambient: 18.0,
                cat1: scenario === 'dpf_regen' ? 625 : 240,
                cat2: scenario === 'dpf_regen' ? 610 : 220,
            },
            aer: {
                maf: +maf.toFixed(1),
                map: Math.round(map_act),
                map_cmd: Math.round(map_cmd),
                boost_actual: +boost.toFixed(2),
                boost_cmd: +((map_cmd - 100) / 100).toFixed(2),
            },
            combustibil: {
                inst_cons: +(4.2 + (load / 100) * 4.8).toFixed(1),
                inj_qty_mg: +(load * 0.55 + 8).toFixed(1),
                rail_press_bar: Math.round(800 + load * 7),
            },
            baterie: {
                ecu_volt: scenario === 'fault_cooling' ? 13.4 : 14.2,
                bat_volt: 12.6,
            },
            dpf: {
                regen_status: scenario === 'dpf_regen' ? 'ACTIVE' : 'OFF',
                soot_load: scenario === 'dpf_regen' ? 38.5 : 12.0,
                egt1: scenario === 'dpf_regen' ? 625 : 250,
            },
            transmisie: {
                gear: gear,
            },
            virtual: {
                brakeDiscTempC: brakeTemp,
                brakeFluidTempEstimatedC: brakeFluidTemp,
                roadGradePct: roadGrade,
                mountainBrakeFadeRisk: brakeFluidTemp >= 160,
                dieselRunawayRisk: runawayRisk,
                roadGripStatus: wheelSlip >= 8 ? 'BLACK_ICE_GRIP_LOSS_WARNING' : 'NORMAL',
            },
            dtc: dtcList,
        };
    }

    // ── POST /api/simulator/start ─────────────────────────────────────────────
    router.post('/simulator/start', async (req, res) => {
        try {
            const { scenario = 'normal', durationSec = 180, vin } = req.body || {};

            // Oprește simularea veche dacă rula
            if (simState.timer) {
                clearInterval(simState.timer);
                simState.timer = null;
            }

            const targetVin = vin || simState.vin;
            simState.scenario = scenario;
            simState.durationSec = parseInt(durationSec, 10) || 180;
            simState.elapsedSec = 0;
            simState.startTime = Date.now();
            simState.vin = targetVin;

            // Trimite pachetul de start
            await handleIncomingTelemetry(db, io, {
                ecu: { vin: targetVin, model: simState.model },
                stare_motor: 'PORNIRE',
                timestamp: Date.now(),
                gps: { lat: simState.lat, lon: simState.lon, alt: 85, heading: 45 },
            });

            console.log(`[SIMULATOR CLOUD] Pornit scenariu "${scenario}" (${simState.durationSec}s) pentru ${targetVin}`);

            // Buclă 1 Hz
            simState.timer = setInterval(async () => {
                simState.elapsedSec++;

                if (simState.elapsedSec >= simState.durationSec) {
                    // Auto-oprire la finalul duratei
                    clearInterval(simState.timer);
                    simState.timer = null;
                    await handleIncomingTelemetry(db, io, {
                        ecu: { vin: targetVin, model: simState.model },
                        stare_motor: 'OPRIRE',
                        timestamp: Date.now(),
                    });
                    console.log(`[SIMULATOR CLOUD] Scenariul "${scenario}" s-a finalizat automat.`);
                    return;
                }

                const packet = generatePacketForScenario(simState.scenario, simState.elapsedSec, simState.durationSec);
                await handleIncomingTelemetry(db, io, packet);
            }, 1000);

            res.json({
                success: true,
                running: true,
                scenario: simState.scenario,
                durationSec: simState.durationSec,
                vin: targetVin,
            });
        } catch (err) {
            console.error('[SIMULATOR START ERROR]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/simulator/stop ──────────────────────────────────────────────
    router.post('/simulator/stop', async (req, res) => {
        try {
            if (simState.timer) {
                clearInterval(simState.timer);
                simState.timer = null;
            }

            // Trimite pachetul de oprire contact
            await handleIncomingTelemetry(db, io, {
                ecu: { vin: simState.vin, model: simState.model },
                stare_motor: 'OPRIRE',
                timestamp: Date.now(),
            });

            console.log(`[SIMULATOR CLOUD] Oprit manual pentru ${simState.vin}.`);
            simState.scenario = 'idle';
            simState.elapsedSec = 0;

            res.json({
                success: true,
                running: false,
                message: 'Simulare oprită cu succes. Sesiunea a fost închisă și salvată.',
            });
        } catch (err) {
            console.error('[SIMULATOR STOP ERROR]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── GET /api/simulator/status ─────────────────────────────────────────────
    router.get('/simulator/status', (req, res) => {
        res.json({
            running: Boolean(simState.timer),
            scenario: simState.scenario,
            elapsedSec: simState.elapsedSec,
            durationSec: simState.durationSec,
            vin: simState.vin,
        });
    });

    return router;
};
