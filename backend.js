const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

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

        db.run(`CREATE INDEX IF NOT EXISTS idx_flux_calatorie ON telemetrie_flux(id_calatorie, timestamp);`);
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
                    calatoriiActive[vin] = { id_calatorie: this.lastID, km: 0, consum_l: 0, penalizari_eco: 0, ultimul_timestamp: pachet.timestamp };
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

        if ((m.accel_g || 0) <= -0.4) {
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

        db.run(`UPDATE calatorii SET timestamp_end = ?, km_parcursi = ?, consum_total_l = ?, consum_mediu_100km = ?, scor_eco = ? WHERE id_calatorie = ?`, 
            [pachet.timestamp, trip.km.toFixed(2), trip.consum_l.toFixed(2), consum_mediu.toFixed(1), scor_final, trip.id_calatorie], () => {
            console.log(`[TRIP STOP] Sesiunea #${trip.id_calatorie} s-a închis! Total: ${trip.km.toFixed(2)} km`);
            io.emit('status_trip', { status: 'STOP', id_calatorie: trip.id_calatorie });
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

server.listen(3000, () => console.log(`[API REST & WS] Serverul funcționează pe http://localhost:3000`));