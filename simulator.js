const mqtt = require('mqtt');

// ── Argumente CLI pentru Demo Live și Comisie ────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    return fallback;
}

const DURATA = parseInt(getArg('--duration', getArg('-d', '600')), 10);
const SPEED_MULT = Math.max(1, parseFloat(getArg('--speed', getArg('-s', '1'))));
const SCENARIO = (getArg('--scenario', 'default')).toLowerCase();
const VIN = getArg('--vin', 'WAUZZZ4A1RN000000');
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://84.235.164.52:1883';
const TOPIC = process.env.MQTT_TOPIC || 'telemetrie/obd2';

const client = mqtt.connect(MQTT_BROKER_URL);

let sec = 0;

// Stări fizice de bază
let spd = 0; let rpm = 800; let gear = 1; let load = 15; let acc_g = 0; let thr = 0;
let maf = 5.2; let map = 101; let map_cmd = 101; let inj_qty = 6.5; let cons = 0.8; let fuel_lvl = 76.5;
let t_cool = 35.0; let t_oil = 20.0; let t_amb = 18.0; let t_cat1 = 150; let t_cat2 = 140;
let volt_bat = 12.6; let volt_ecu = 14.2; let dpf_soot = 12.4; let dpf_diff = 4.2;
let rail_press = 35000; let km_total = 328450.0; let run_time = 0; let eng_hours = 4120.5;

client.on('connect', () => {
    console.log(`[SIMULATOR PRO] Conectat la ${MQTT_BROKER_URL} [Topic: ${TOPIC}]`);
    console.log(`[CONFIG DEMO] Durată: ${DURATA}s | Viteză: ${SPEED_MULT}x | Scenariu: ${SCENARIO.toUpperCase()} | VIN: ${VIN}`);
    console.log('[SIMULATOR PRO] Trimit eveniment PORNIRE...');
    client.publish(TOPIC, JSON.stringify({ ecu: { vin: VIN, model: 'Audi A6 C4 2.5 TDI AEL' }, stare_motor: "PORNIRE", timestamp: Date.now() }));

    const tickMs = Math.max(50, Math.floor(1000 / SPEED_MULT));

    const intv = setInterval(() => {
        sec++; run_time++;
        acc_g = 0.05;
        const progress = sec / DURATA;

        // Ciclul de condus proporțional cu durata aleasă
        if (progress <= 0.10) {
            // Faza 1: Pornire și ralanti
            spd = 0; rpm = 950; load = 22; thr = 0; gear = 1;
        } else if (progress <= 0.40) {
            // Faza 2: Trafic urban (accelerări și opriri la semafor)
            if ((sec % 20) < 12) {
                spd = Math.min(55, spd + 3); acc_g = 0.20; load = 55; thr = 45;
                rpm = 1300 + ((sec % 10) * 110);
                gear = spd > 35 ? 3 : 2;
            } else {
                spd = Math.max(0, spd - 4); acc_g = -0.22; load = 10; thr = 0;
                rpm = spd === 0 ? 800 : 1200;
                if (spd === 0) gear = 1;
            }
        } else if (progress <= 0.80) {
            // Faza 3: Traseu extraurban / Autostradă
            gear = 5;
            spd = Math.min(SCENARIO === 'aggressive' ? 142 : 125, spd + 2);
            rpm = 1700 + ((spd - 70) * 22);
            load = 65; thr = 60; acc_g = 0.05;

            // Frânări bruște simulate
            const triggerBrake1 = Math.floor(DURATA * 0.52);
            const triggerBrake2 = Math.floor(DURATA * 0.72);
            if (sec === triggerBrake1 || sec === triggerBrake2 || (SCENARIO === 'aggressive' && sec % 15 === 0)) {
                console.log(`\n🚨 [SEC ${sec}/${DURATA}] FRÂNARE BRUȘCĂ ABS (-0.62G)!`);
                spd = Math.max(25, spd - 40); rpm = 1300; acc_g = -0.62; load = 8; thr = 0; gear = 3;
            }
        } else if (progress <= 0.95) {
            // Faza 4: Decelerare și răcire
            spd = Math.max(15, spd - 3); rpm = 1100 + (spd * 15); load = 18; thr = 10; acc_g = -0.15; gear = 2;
        } else {
            // Faza 5: Oprire finală
            spd = 0; rpm = 800; load = 15; thr = 0; acc_g = 0; gear = 1;
        }

        // Fizică termică și injecție
        t_cool = +(Math.min(90.0, t_cool + 0.18)).toFixed(1);
        if (t_cool > 50) t_oil = +(Math.min(95.0, t_oil + 0.08)).toFixed(1);
        t_cat1 = +(Math.min(450, 150 + (load * 3.5))).toFixed(1);
        t_cat2 = +(t_cat1 - 25).toFixed(1);

        if (load > 40) {
            map_cmd = Math.floor(101 + (load * 1.6));
            map = Math.floor(map + ((map_cmd - map) * 0.4));
            rail_press = Math.floor(35000 + (load * 850));
        } else {
            map_cmd = 105; map = 105; rail_press = 35000;
        }

        // ── Injectare Defecțiuni pe Scenarii Demo ──────────────────────────
        if (SCENARIO === 'fault_turbo' && progress >= 0.40) {
            // Deficit presiune turbo (Furtun intercooler fisurat / N75 blocat)
            map = Math.floor(108 + (load * 0.25));
        } else if (SCENARIO === 'fault_cooling' && progress >= 0.35) {
            // Termostat blocat pe închis / supraîncălzire critică
            t_cool = +(Math.min(108.5, t_cool + 0.35)).toFixed(1);
        } else if (SCENARIO === 'fault_alternator' && progress >= 0.30) {
            // Cădere regulator tensiune alternator sub sarcină
            volt_ecu = +(12.2 + (Math.random() * 0.15)).toFixed(2);
        }

        if (load < 12 && spd > 0) {
            inj_qty = 0.0; cons = 0.0; maf = +((rpm / 800) * 3.5).toFixed(2);
        } else {
            maf = +((rpm / 800) * (map / 100) * 6.5).toFixed(2);
            inj_qty = +((load / 100) * 42 + 5).toFixed(1);
            cons = +(maf * 0.2985).toFixed(2);
        }

        km_total += (spd / 3600); eng_hours += (1 / 3600);
        fuel_lvl = +(Math.max(0, fuel_lvl - (cons / 3600))).toFixed(3);
        if (SCENARIO !== 'fault_alternator' || progress < 0.30) {
            volt_ecu = +(14.1 + (Math.random() * 0.15 - 0.07)).toFixed(2);
        }
        dpf_soot = +(dpf_soot + 0.001).toFixed(3);
        dpf_diff = +(4.0 + (maf * 0.15)).toFixed(1);

        // ====================================================================
        // MATRICEA EXHAUSTIVĂ (~90 PARAMETRI SAE J1979 & UDS VAG)
        // ====================================================================
        const pachetExhaustiv = {
            stare_motor: "MERS", timestamp: Date.now(),
            motor: {
                rpm: Math.floor(rpm), speed: Math.floor(spd), load: Math.floor(load),
                calc_load: Math.floor(load * 0.98), abs_load: Math.floor(load * 1.05),
                throttle_pos: Math.floor(thr), abs_throttle_b: Math.floor(thr * 0.95), abs_throttle_c: Math.floor(thr * 0.92),
                pedal_d: Math.floor(thr * 1.02), pedal_e: Math.floor(thr * 0.98), pedal_f: Math.floor(thr * 0.95),
                rel_throttle: Math.floor(thr * 0.9), commanded_throttle: Math.floor(thr), idle_pos: spd === 0 ? 100 : 0,
                torque_engine: Math.floor(load * 2.8), torque_driver: Math.floor(thr * 3.1), torque_actual: Math.floor(load * 2.75), torque_friction: 22,
                accel_g: acc_g
            },
            temperaturi: {
                coolant: t_cool, iat: +((t_amb + (map - 100) * 0.15)).toFixed(1), ambient: t_amb, oil: t_oil,
                cat_b1s1: t_cat1, cat_b1s2: t_cat2, cat_b2s1: +(t_cat1 * 0.98).toFixed(1), cat_b2s2: +(t_cat2 * 0.98).toFixed(1)
            },
            aer: {
                maf: maf, map: map, baro: 101, intake_press: map, vacuum: spd === 0 ? 65 : 15,
                boost_turbo: +((map - 100) / 100).toFixed(2), boost_cmd: +((map_cmd - 100) / 100).toFixed(2), boost_actual: +((map - 100) / 100).toFixed(2)
            },
            combustibil: {
                level: fuel_lvl, press: 350, rail_press: rail_press, rail_gauge: rail_press - 100, cmd_press: rail_press,
                inj_timing: +(2.5 + (rpm / 1000) * 1.8).toFixed(1), inj_qty: inj_qty, fuel_rate: cons, inst_cons: cons, avg_cons: 6.8,
                sft_b1: +(Math.random() * 4 - 2).toFixed(1), lft_b1: 1.2, sft_b2: +(Math.random() * 4 - 2).toFixed(1), lft_b2: 1.1
            },
            lambda: {
                o2_b1s1: 0.85, o2_b1s2: 0.75, o2_b2s1: 0.84, o2_b2s2: 0.74,
                wb_b1s1: 1.01, wb_b1s2: 1.00, wb_b2s1: 1.01, wb_b2s2: 1.00, cmd_lambda: 1.00
            },
            aprindere: { timing_adv: +(6.5 + (rpm / 800) * 2.1).toFixed(1), ign_timing: +(6.0 + (rpm / 800) * 2.0).toFixed(1), knock_retard: 0.0 },
            emisii: { egr_cmd: load > 30 ? 15 : 65, egr_error: 0.5, evap_press: -1.2, evap_purge: 12.0, sec_air: "OFF", cat_mon: "PASSED", misfire_mon: "PASSED", readiness: "OK / READY" },
            baterie: { ecu_volt: volt_ecu, bat_volt: volt_bat },
            dpf: { diff_press: dpf_diff, soot_load: dpf_soot, regen_status: "PASSIVE / OFF", egt1: t_cat1, egt2: +(t_cat1 * 0.9).toFixed(1), egt3: +(t_cat1 * 0.8).toFixed(1), egt4: +(t_cat1 * 0.7).toFixed(1) },
            vvt: { cam_intake: +(12.0 + (rpm / 1000) * 4).toFixed(1), cam_exhaust: +(-8.0 - (rpm / 1000) * 2).toFixed(1), cmd_vvt: 12.0 },
            transmisie: { trans_temp: +(t_cool * 0.85).toFixed(1), gear: gear, slip: gear === 1 ? 120 : 15 },
            presiuni: { abs_fuel: 450, oil_press: +(1.8 + (rpm / 1000) * 1.2).toFixed(1), exhaust_press: +(110 + (load * 0.8)).toFixed(1), intake_press_alt: map },
            timp: { run_time: run_time, time_start: run_time, time_dtc_cleared: 142000, warmups: 42 },
            consum_meta: { dist_mil: 0, dist_dtc: 1420, fuel_used: +(cons * (run_time / 3600)).toFixed(2), engine_hours: +eng_hours.toFixed(1), idle_hours: 412.0 },
            senzori_extra: { pedal_pos: Math.floor(thr), cmd_afr: 14.7, actual_afr: 14.68, ethanol_pct: 0.0 },
            dtc: { count: 0, codes: "NONE", mil_status: "OFF", freeze_frame: "NO DATA" },
            ecu: { vin: VIN, cal_id: "AUDI_25TDI_VP37_V4", name: "BOSCH EDC15M+", soft_ver: "4A0907401P", hard_ver: "HW_V1.2", protocol: "SAE J1979 / KWP1281" }
        };

        client.publish(TOPIC, JSON.stringify(pachetExhaustiv));

        if (sec % Math.max(1, Math.floor(DURATA / 10)) === 0 || acc_g <= -0.4) {
            console.log(`[${sec}s/${DURATA}s] ${Math.floor(spd)} km/h | ${Math.floor(rpm)} RPM | MAP: ${map} kPa | Rail: ${rail_press} kPa | Coolant: ${t_cool}°C | Volt: ${volt_ecu}V`);
        }

        if (sec >= DURATA) {
            clearInterval(intv);
            setTimeout(() => {
                client.publish(TOPIC, JSON.stringify({ ecu: { vin: VIN, model: 'Audi A6 C4 2.5 TDI AEL' }, stare_motor: "OPRIRE", timestamp: Date.now() }));
                console.log(`\n🏁 [${DURATA}s] CICLUL EXHAUSTIV FINALIZAT! Pachetul OPRIRE trimis.`);
                client.end(false, () => {
                    console.log('[SIMULATOR PRO] Deconectat.');
                    process.exit(0);
                });
            }, Math.min(1000, tickMs * 2));
        }
    }, tickMs);
});