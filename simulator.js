const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker.emqx.io');
const TOPIC = 'licenta/audi_a6_c4/telemetrie';
const VIN = "WAUZZZ4A1RN000000";

let sec = 0;
const DURATA = 600;

// Stări fizice de bază
let spd = 0; let rpm = 800; let gear = 1; let load = 15; let acc_g = 0; let thr = 0;
let maf = 5.2; let map = 101; let map_cmd = 101; let inj_qty = 6.5; let cons = 0.8; let fuel_lvl = 76.5;
let t_cool = 35.0; let t_oil = 20.0; let t_amb = 18.0; let t_cat1 = 150; let t_cat2 = 140;
let volt_bat = 12.6; let volt_ecu = 14.2; let dpf_soot = 12.4; let dpf_diff = 4.2;
let rail_press = 35000; let km_total = 328450.0; let run_time = 0; let eng_hours = 4120.5;

client.on('connect', () => {
    console.log('[SIMULATOR PRO] Conectat! Trimit matricea exhaustivă (90+ PID-uri OBD/VAG)...');
    client.publish(TOPIC, JSON.stringify({ ecu: { vin: VIN }, stare_motor: "PORNIRE", timestamp: Date.now() }));

    const intv = setInterval(() => {
        sec++; run_time++;
        acc_g = 0.05;

        // Ciclul de condus 10 minute
        if (sec <= 60) {
            if (sec < 15) { spd = 0; rpm = 950; load = 22; thr = 0; }
            else { spd = Math.min(35, spd + 2); rpm = 1100 + (spd * 40); load = 45; thr = 35; acc_g = 0.18; gear = 2; }
        } else if (sec <= 240) {
            if (sec % 45 < 25) {
                spd = Math.min(65, spd + 3); acc_g = 0.22; load = 68; thr = 55;
                rpm = 1400 + ((sec % 12) * 130);
                if (rpm > 2700) { rpm = 1600; gear = Math.min(4, gear + 1); }
            } else {
                spd = Math.max(0, spd - 4); acc_g = -0.25; load = 10; thr = 0;
                rpm = spd === 0 ? 800 : 1300; if (spd === 0) gear = 1;
            }
        } else if (sec <= 480) {
            gear = 6; spd = Math.min(135, spd + 2); rpm = 1800 + ((spd - 90) * 22);
            load = 60; thr = 65; acc_g = 0.05;
            if (sec === 310 || sec === 430) {
                console.log(`\n🚨 [SEC ${sec}] FRÂNARE DE URGENȚĂ ABS!`);
                spd -= 45; rpm = 1300; acc_g = -0.62; load = 8; thr = 0; gear = 4;
            }
        } else if (sec <= 580) {
            spd = Math.max(15, spd - 2); rpm = 1100 + (spd * 18); load = 18; thr = 10; acc_g = -0.15; gear = 3;
        } else {
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

        if (load < 12 && spd > 0) {
            inj_qty = 0.0; cons = 0.0; maf = +((rpm / 800) * 3.5).toFixed(2);
        } else {
            maf = +((rpm / 800) * (map / 100) * 6.5).toFixed(2);
            inj_qty = +((load / 100) * 42 + 5).toFixed(1);
            cons = +(maf * 0.2985).toFixed(2);
        }

        km_total += (spd / 3600); eng_hours += (1 / 3600);
        fuel_lvl = +(Math.max(0, fuel_lvl - (cons / 3600))).toFixed(3);
        volt_ecu = +(14.1 + (Math.random() * 0.15 - 0.07)).toFixed(2);
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

        if (sec % 10 === 0 || acc_g <= -0.4) {
            console.log(`[${sec}s/600s] ${Math.floor(spd)} km/h | ${Math.floor(rpm)} RPM | MAP: ${map} kPa | Rail: ${rail_press} kPa | DPF Soot: ${dpf_soot}g`);
        }

        if (sec >= DURATA) {
            clearInterval(intv);
            setTimeout(() => {
                client.publish(TOPIC, JSON.stringify({ ecu: { vin: VIN }, stare_motor: "OPRIRE", timestamp: Date.now() }));
                console.log('\n🏁 [600s] CICLUL EXHAUSTIV FINALIZAT!');
                client.end();
            }, 1000);
        }
    }, 1000);
});