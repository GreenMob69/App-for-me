const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// ===============================================================
// Trip Analyzer (Nivel 3 + 4 + 5) — backend.js rămâne responsabil
// doar de MQTT, API și baza de date; toată analiza stă în
// backend/analyzers/. Vezi backend/analyzers/config.js pentru
// pragurile reglabile și maparea câmpurilor din pachetul MQTT.
// ===============================================================
const { createAnalysis, updateAnalyzer, finalizeTripAnalysis } = require('./backend/analyzers');
const { THRESHOLDS } = require('./backend/analyzers/config');
const { analyzeTrends } = require('./backend/analyzers/TrendEngine');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
    console.log(`[WEBSOCKET] Client conectat (${socket.id}) - Stream activ pentru 90+ parametri OEM!`);
    socket.on('disconnect', () => console.log(`[WEBSOCKET] Client deconectat (${socket.id})`));
});

const db = new sqlite3.Database('./telemetrie_industriala.db', (err) => {
    if (err) return console.error('[EROARE DB]', err.message);
    console.log('[DB] Conectat. Inițializez schema relațională pentru matricea exhaustivă SAE J1979 & VAG...');
    db.run("PRAGMA foreign_keys = ON;");

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS vehicule (
            vin TEXT PRIMARY KEY, model TEXT NOT NULL, tip_combustibil TEXT DEFAULT 'diesel', capacitate_rezervor_l REAL DEFAULT 80
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS calatorii (
            id_calatorie INTEGER PRIMARY KEY AUTOINCREMENT, vin TEXT NOT NULL, timestamp_start INTEGER NOT NULL, timestamp_end INTEGER,
            km_parcursi REAL DEFAULT 0, consum_total_l REAL DEFAULT 0, consum_mediu_100km REAL DEFAULT 0, scor_eco INTEGER DEFAULT 100,
            FOREIGN KEY (vin) REFERENCES vehicule(vin)
        )`);

        // Stocăm parametrii principali pentru grafice rapide + tot pachetul de 90 parametri ca JSON Blob
        db.run(`CREATE TABLE IF NOT EXISTS telemetrie_flux (
            id_flux INTEGER PRIMARY KEY AUTOINCREMENT, id_calatorie INTEGER NOT NULL, timestamp INTEGER NOT NULL,
            rpm INTEGER, viteza_kmh INTEGER, sarcina_pct REAL, maf_gs REAL, map_kpa REAL, voltaj_v REAL, temp_apa_c REAL, temp_ulei_c REAL, accel_g REAL,
            consum_lh REAL, boost_bar REAL, dpf_soot REAL, gear INTEGER, torque_nm REAL, matrice_completa_json TEXT,
            FOREIGN KEY (id_calatorie) REFERENCES calatorii(id_calatorie)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS evenimente_alerte (
            id_eveniment INTEGER PRIMARY KEY AUTOINCREMENT, id_calatorie INTEGER NOT NULL, timestamp INTEGER NOT NULL, tip_eveniment TEXT NOT NULL,
            cod_dtc TEXT, valoare_masurata REAL, severitate TEXT NOT NULL, descriere TEXT, recunoscut_de_sofer BOOLEAN DEFAULT 0,
            FOREIGN KEY (id_calatorie) REFERENCES calatorii(id_calatorie)
        )`);
        db.run(`
            CREATE TABLE IF NOT EXISTS trip_summary (

            id_summary INTEGER PRIMARY KEY AUTOINCREMENT,

            id_calatorie INTEGER UNIQUE NOT NULL,

            durata_secunde INTEGER DEFAULT 0,

            timp_relanti_sec INTEGER DEFAULT 0,

            timp_mers_sec INTEGER DEFAULT 0,

            viteza_max REAL DEFAULT 0,
            viteza_medie REAL DEFAULT 0,

            rpm_max INTEGER DEFAULT 0,
            rpm_mediu INTEGER DEFAULT 0,

            coolant_max REAL DEFAULT 0,
            coolant_medie REAL DEFAULT 0,

            oil_max REAL DEFAULT 0,
            oil_medie REAL DEFAULT 0,

            boost_max REAL DEFAULT 0,
            boost_mediu REAL DEFAULT 0,

            maf_max REAL DEFAULT 0,
            maf_mediu REAL DEFAULT 0,

            voltaj_min REAL DEFAULT 0,
            voltaj_max REAL DEFAULT 0,

            hard_brakes INTEGER DEFAULT 0,

            hard_accelerations INTEGER DEFAULT 0,

            nr_alerte INTEGER DEFAULT 0,

            nr_dtc INTEGER DEFAULT 0,

            cost_combustibil REAL DEFAULT 0,

            emisii_co2 REAL DEFAULT 0,

            health_score INTEGER DEFAULT 100,

            trip_tag TEXT DEFAULT 'PERSONAL',

            raport_ai_json TEXT,

            created_at INTEGER DEFAULT (strftime('%s','now')),

            FOREIGN KEY(id_calatorie)
            REFERENCES calatorii(id_calatorie)

        );
        `);

        // Dacă baza de date exista deja dintr-o rulare anterioară (CREATE TABLE
        // IF NOT EXISTS nu adaugă coloane la un tabel deja creat), adăugăm
        // coloana și pe cale de migrare. E OK dacă dă eroare "duplicate column" —
        // înseamnă că există deja.
        db.run(`ALTER TABLE trip_summary ADD COLUMN raport_ai_json TEXT`, () => {});

        db.run(`CREATE INDEX IF NOT EXISTS idx_flux_calatorie ON telemetrie_flux(id_calatorie, timestamp);`);
        db.run(`
        CREATE INDEX IF NOT EXISTS idx_trip_summary
        ON trip_summary(id_calatorie);
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_evenimente_calatorie ON evenimente_alerte(id_calatorie);`);
    });
});

const calatoriiActive = {};
const client = mqtt.connect('mqtt://broker.emqx.io');
const TOPIC_TELEMETRIE = 'licenta/audi_a6_c4/telemetrie';

client.on('connect', () => {
    console.log('[MQTT] Conectat la broker! Gata pentru receptia matricei OBD-II & UDS...');
    client.subscribe(TOPIC_TELEMETRIE);
});

client.on('message', (topic, message) => {
    const pachet = JSON.parse(message.toString());
    const vin = pachet.ecu?.vin || "WAUZZZ4A1RN000000";
    const eveniment_motor = pachet.stare_motor;

    if (eveniment_motor === "PORNIRE" && !calatoriiActive[vin]) {
        db.run(`INSERT OR IGNORE INTO vehicule (vin, model) VALUES (?, ?)`, [vin, "Audi A6 C4 2.5 TDI AEL"], () => {
            db.run(`INSERT INTO calatorii (vin, timestamp_start) VALUES (?, ?)`, [vin, pachet.timestamp], function(err) {
                if (!err) {
                    calatoriiActive[vin] = {
                                              id_calatorie: this.lastID,

                                              km: 0,
                                              consum_l: 0,

                                              penalizari_eco: 0,   // scor eco "live", afișat pe telefon în timp real

                                              ultimul_timestamp: pachet.timestamp,

                                              alerts: 0,

                                              // ===============================
                                              // ANALIZĂ CĂLĂTORIE — Nivel 3/4/5
                                              // Tot ce ținea înainte de maxRPM, sumRPM, maxCoolant,
                                              // sumCoolant, hardBrakes, hardAccelerations etc. stă
                                              // acum într-un singur obiect, actualizat de
                                              // backend/analyzers/TripAnalyzer.js la fiecare pachet.
                                              // ===============================
                                              analysis: createAnalysis()
                    };
                    console.log(`[TRIP START] Sesiunea #${this.lastID} a început pentru Audi A6 C4!`);
                    io.emit('status_trip', { status: 'START', id_calatorie: this.lastID });
                }
            });
        });
        return;
    }

    if (eveniment_motor === "MERS" && calatoriiActive[vin]) {
        const trip = calatoriiActive[vin];
        const m = pachet.motor || {};
        const t = pachet.temperaturi || {};
        const a = pachet.aer || {};
        const c = pachet.combustibil || {};
        const bat = pachet.baterie || {};
        const dpf = pachet.dpf || {};
        const trans = pachet.transmisie || {};

        const sqlFlux = `INSERT INTO telemetrie_flux (id_calatorie, timestamp, rpm, viteza_kmh, sarcina_pct, maf_gs, map_kpa, voltaj_v, temp_apa_c, temp_ulei_c, accel_g, consum_lh, boost_bar, dpf_soot, gear, torque_nm, matrice_completa_json) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sqlFlux, [
            trip.id_calatorie, pachet.timestamp, m.rpm || 0, m.speed || 0, m.load || 0, a.maf || 0, a.map || 101, 
            bat.ecu_volt || 14.1, t.coolant || 35, t.oil || 20, m.accel_g || 0, c.inst_cons || 0, a.boost_actual || 0, 
            dpf.soot_load || 0, trans.gear || 1, m.torque_actual || 0, JSON.stringify(pachet)
        ]);

        const timp_scurs_ore = (pachet.timestamp - trip.ultimul_timestamp) / 3600000;
        if (timp_scurs_ore > 0 && timp_scurs_ore < 0.1) {
            trip.km += (m.speed || 0) * timp_scurs_ore;
            trip.consum_l += (c.inst_cons || 0) * timp_scurs_ore;
        }
        trip.ultimul_timestamp = pachet.timestamp;
        // =======================================================
        // TRIP ANALYZER — Nivel 3 (vezi backend/analyzers/TripAnalyzer.js)
        // Un singur apel actualizează TOT: PID-uri (min/max/medie),
        // zone RPM, turbo, temperaturi, stil de condus, consum,
        // evenimente (kickdown, overspeed, frânare/accelerare bruscă,
        // decelerare rapidă) și KPI-uri.
        // =======================================================
        const hardBrakesInainte = trip.analysis.events.hardBrakes;
        updateAnalyzer(trip, pachet);
        const tocmaiAFostFranareBrusca = trip.analysis.events.hardBrakes > hardBrakesInainte;

        // Scorul eco "live" rămâne simplu și rapid, pentru feedback instant pe telefon
        // (analiza completă cu 4 scoruri + Overall Health se calculează o singură
        // dată, la OPRIRE, în finalizeTripAnalysis — vezi mai jos).
        if ((m.accel_g || 0) >= 0.35) {
            trip.penalizari_eco += 3;
        }

        if (tocmaiAFostFranareBrusca) {
            trip.alerts++;
            trip.penalizari_eco += 5;
            db.run(`INSERT INTO evenimente_alerte (id_calatorie, timestamp, tip_eveniment, valoare_masurata, severitate, descriere)
                    VALUES (?, ?, ?, ?, ?, ?)`, [trip.id_calatorie, pachet.timestamp, 'FRANARE_BRUSCA', m.accel_g, 'WARNING', 'Frânare agresivă (-0.4G depășit)']);
            io.emit('alerta_live', { tip: 'FRANARE_BRUSCA', g: m.accel_g, scor_curent: Math.max(0, 100 - trip.penalizari_eco) });
        }

        // Broadcast integral către telefon cu toți cei ~90 parametri organizați
        const dateBroadcast = {
            id_calatorie: trip.id_calatorie,
            km_parcursi: trip.km.toFixed(2),
            scor_eco: Math.max(0, 100 - trip.penalizari_eco),
            ...pachet // Include absolut tot: motor, temperaturi, aer, combustibil, lambda, aprindere, emisii, baterie, dpf, vvt, transmisie, presiuni, timp, consum_meta, extra, dtc, ecu
        };

        io.emit('telemetrie_live', dateBroadcast);
        return;
    }

    if (eveniment_motor === "OPRIRE" && calatoriiActive[vin]) {
        const trip = calatoriiActive[vin];
        const scor_final = Math.max(0, 100 - trip.penalizari_eco);
        const consum_mediu = trip.km > 0.01 ? (trip.consum_l / trip.km) * 100 : 0;

        // =======================================================
        // TRIP ANALYZER — Nivel 4 + 5 (o singură dată, la final)
        // summary  = statisticile complete (cerințele 1-6, 8-9)
        // health   = Driving/Engine/Fuel/Safety Score + Overall Health (cerința 7)
        // ai       = obiectul pregătit pentru GPT (cerința 10) — nefolosit încă
        // =======================================================
        const rezultatAnaliza = finalizeTripAnalysis(trip);

        db.run(`UPDATE calatorii SET timestamp_end = ?, km_parcursi = ?, consum_total_l = ?, consum_mediu_100km = ?, scor_eco = ? WHERE id_calatorie = ?`, 
            [pachet.timestamp, trip.km.toFixed(2), trip.consum_l.toFixed(2), consum_mediu.toFixed(1), scor_final, trip.id_calatorie], () => {

            if (rezultatAnaliza) {
                const { summary, health, ai } = rezultatAnaliza;
                const litriTotali = summary.fuel.idleLiters + summary.fuel.movingLiters;
                const cost = litriTotali * THRESHOLDS.DIESEL_PRICE_PER_LITER;
                const co2 = litriTotali * THRESHOLDS.DIESEL_CO2_KG_PER_LITER;

                db.run(`INSERT INTO trip_summary (
                    id_calatorie, durata_secunde, timp_relanti_sec, timp_mers_sec,
                    viteza_max, viteza_medie, rpm_max, rpm_mediu,
                    coolant_max, coolant_medie, oil_max, oil_medie,
                    boost_max, boost_mediu, maf_max, maf_mediu,
                    voltaj_min, voltaj_max, hard_brakes, hard_accelerations,
                    nr_alerte, nr_dtc, cost_combustibil, emisii_co2, health_score,
                    raport_ai_json
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    trip.id_calatorie, summary.duration.totalSeconds, summary.duration.idleSeconds, summary.duration.movingSeconds,
                    summary.pid.speed.max, summary.pid.speed.average, summary.pid.rpm.max, summary.pid.rpm.average,
                    summary.pid.coolant.max, summary.pid.coolant.average, summary.pid.oil.max, summary.pid.oil.average,
                    summary.pid.boost.max, summary.pid.boost.average, summary.pid.maf.max, summary.pid.maf.average,
                    summary.pid.voltage.min, summary.pid.voltage.max, summary.events.hardBrakes, summary.events.hardAccelerations,
                    trip.alerts, eroriActiveDTC.length, cost.toFixed(2), co2.toFixed(2), health.overallHealth,
                    JSON.stringify(ai)
                ], (err) => {
                    if (err) console.error('[EROARE trip_summary]', err.message);
                });

                console.log(`[TRIP ANALYZER] Health Score #${trip.id_calatorie}: ${health.overallHealth}% (Engine ${health.engineScore}% | Fuel ${health.fuelScore}% | Driving ${health.drivingScore}% | Safety ${health.safetyScore}%)`);
            }

            console.log(`[TRIP STOP] Sesiunea #${trip.id_calatorie} s-a închis! Total: ${trip.km.toFixed(2)} km`);
            io.emit('status_trip', {
                status: 'STOP',
                id_calatorie: trip.id_calatorie,
                health_score: rezultatAnaliza ? rezultatAnaliza.health.overallHealth : null
            });
            delete calatoriiActive[vin];
        });
    }
});

app.get('/api/calatorii', (req, res) => {
    db.all(`SELECT * FROM calatorii ORDER BY id_calatorie DESC`, [], (err, rows) => res.json(rows || []));
});

app.get('/api/calatorii/:id', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM calatorii WHERE id_calatorie = ?`, [id], (err, trip) => {
        if (!trip) return res.status(404).json({ eroare: "Călătoria nu a fost găsită" });
        db.all(`SELECT * FROM evenimente_alerte WHERE id_calatorie = ? ORDER BY timestamp ASC`, [id], (err, alerte) => {
            // NOU: Acum extragem absolut toată matricea salvată ca text JSON și o decodăm
            db.all(`SELECT timestamp, matrice_completa_json FROM telemetrie_flux WHERE id_calatorie = ? ORDER BY timestamp ASC`, [id], (err, grafic) => {
                
                const date_complete = (grafic || []).map(row => {
                    try {
                        return JSON.parse(row.matrice_completa_json);
                    } catch(e) {
                        return null;
                    }
                }).filter(i => i !== null);

                res.json({ rezumat: trip, alerte: alerte || [], date_grafic: date_complete });
            });
        });
    });
});

app.get('/api/calatorii/:id/analiza', (req, res) => {
    db.get(`SELECT * FROM trip_summary WHERE id_calatorie = ?`, [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ eroare: "Nu există încă o analiză (trip_summary) pentru această călătorie — probabil cursa e încă activă sau nu a fost pornită după acest update." });
        const { raport_ai_json, ...rest } = row;
        res.json({ ...rest, ai: raport_ai_json ? JSON.parse(raport_ai_json) : null });
    });
});

app.get('/api/vehicul/:vin/statistici', (req, res) => {
    db.get(`SELECT COUNT(*) AS total_calatorii, SUM(km_parcursi) AS total_km, SUM(consum_total_l) AS total_combustibil, AVG(scor_eco) AS scor_mediu FROM calatorii WHERE vin = ? AND timestamp_end IS NOT NULL`, [req.params.vin], (err, stats) => res.json(stats || {}));
});

let eroriActiveDTC = [
    { cod: "P0101", modul: "Motor (ECU)", severitate: "CRITICAL", descriere: "Senzor MAF (Debitul de aer) - Semnal în afara limitelor" },
    { cod: "P0234", modul: "Turbo", severitate: "WARNING", descriere: "Turbosuflanta - Condiție de suprapresiune (Overboost)" },
    { cod: "17586", modul: "K-Line VAG", severitate: "INFO", descriere: "Senzor temperatură lichid de răcire G62 - Semnal intermitent" }
];

app.get('/api/vehicul/:vin/diagnoza', (req, res) => {
    db.get(`SELECT voltaj_v FROM telemetrie_flux WHERE id_calatorie IN (SELECT id_calatorie FROM calatorii WHERE vin = ?) ORDER BY id_flux DESC LIMIT 1`, [req.params.vin], (err, row) => {
        const v = row ? row.voltaj_v : 14.1;
        res.json({
            vin: req.params.vin, model: "Audi A6 C4 2.5 TDI AEL",
            sistem_electric: { voltaj_curent: v, stare_alternator: v < 13.6 ? "UZAT_DEGRADAT" : "OPTIM", baterie_soh_pct: v >= 13.8 ? 98 : 80 },
            coduri_dtc: eroriActiveDTC, total_erori: eroriActiveDTC.length
        });
    });
});

app.post('/api/vehicul/:vin/stergere-erori', (req, res) => {
    eroriActiveDTC = [];
    io.emit('alerta_live', { tip: 'DTC_CLEARED', descriere: 'Erorile au fost șterse prin OBD-II!' });
    res.json({ status: "SUCCES", mesaj: "Erorile au fost șterse." });
});
// ===============================================================
// ENDPOINT MENTENANȚĂ PREDICTIVĂ (TREND ENGINE)
// ===============================================================
app.get('/api/vehicul/:vin/tendinte', async (req, res) => {
    const vin = req.params.vin || "WAUZZZ4A1RN000000";
    const limit = parseInt(req.query.limit) || 20; // Analizăm implicit ultimele 20 de curse

    try {
        const raportTendinte = await analyzeTrends(db, vin, limit);
        res.json(raportTendinte);
    } catch (error) {
        console.error('[TREND ENGINE EROARE]', error.message);
        res.status(500).json({ eroare: "Nu s-a putut calcula raportul de tendințe.", detalii: error.message });
    }
});
server.listen(3000, () => console.log(`[API REST & WS] Serverul funcționează pe http://localhost:3000`));