require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const http     = require('http');
const sqlite3  = require('sqlite3').verbose();
const { Server } = require('socket.io');

const { initVehicleProfileTable } = require('./backend/intelligence/BaselineEngine');
const { loadRules }               = require('./backend/knowledge/KnowledgeBase');
const { initVehicleProfile }      = require('./backend/vehicle-profile');

const { startWatchdog }    = require('./services/watchdog');
const { createMqttClient } = require('./handlers/mqttHandler');
const { requireAuth }      = require('./middleware/auth');

const app    = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
    console.log(`[WEBSOCKET] Client conectat (${socket.id})`);
    socket.on('disconnect', () => console.log(`[WEBSOCKET] Client deconectat (${socket.id})`));
});

const DB_PATH = process.env.DB_PATH || './telemetrie_industriala.db';
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) return console.error('[EROARE DB]', err.message);
    console.log('[DB] Conectat.');
    db.run('PRAGMA foreign_keys = ON;');
    db.run('PRAGMA journal_mode=WAL;');

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS vehicule (
            vin TEXT PRIMARY KEY, model TEXT NOT NULL,
            tip_combustibil TEXT DEFAULT 'diesel',
            capacitate_rezervor_l REAL DEFAULT 80
        )`);
        db.run(`ALTER TABLE vehicule ADD COLUMN odometru_calibrat_km REAL DEFAULT 0`, () => {});

        db.run(`CREATE TABLE IF NOT EXISTS calatorii (
            id_calatorie INTEGER PRIMARY KEY AUTOINCREMENT, vin TEXT NOT NULL,
            timestamp_start INTEGER NOT NULL, timestamp_end INTEGER,
            km_parcursi REAL DEFAULT 0, consum_total_l REAL DEFAULT 0,
            consum_mediu_100km REAL DEFAULT 0, scor_eco INTEGER DEFAULT 100,
            FOREIGN KEY (vin) REFERENCES vehicule(vin)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS telemetrie_flux (
            id_flux INTEGER PRIMARY KEY AUTOINCREMENT, id_calatorie INTEGER NOT NULL,
            timestamp INTEGER NOT NULL, rpm INTEGER, viteza_kmh INTEGER, sarcina_pct REAL,
            maf_gs REAL, map_kpa REAL, voltaj_v REAL, temp_apa_c REAL, temp_ulei_c REAL,
            accel_g REAL, consum_lh REAL, boost_bar REAL, dpf_soot REAL, gear INTEGER,
            torque_nm REAL, matrice_completa_json TEXT,
            FOREIGN KEY (id_calatorie) REFERENCES calatorii(id_calatorie)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS evenimente_alerte (
            id_eveniment INTEGER PRIMARY KEY AUTOINCREMENT, id_calatorie INTEGER NOT NULL,
            timestamp INTEGER NOT NULL, tip_eveniment TEXT NOT NULL, cod_dtc TEXT,
            valoare_masurata REAL, severitate TEXT NOT NULL, descriere TEXT,
            recunoscut_de_sofer BOOLEAN DEFAULT 0,
            FOREIGN KEY (id_calatorie) REFERENCES calatorii(id_calatorie)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS trip_summary (
            id_summary INTEGER PRIMARY KEY AUTOINCREMENT,
            id_calatorie INTEGER UNIQUE NOT NULL,
            durata_secunde INTEGER DEFAULT 0, timp_relanti_sec INTEGER DEFAULT 0,
            timp_mers_sec INTEGER DEFAULT 0, viteza_max REAL DEFAULT 0,
            viteza_medie REAL DEFAULT 0, rpm_max INTEGER DEFAULT 0,
            rpm_mediu INTEGER DEFAULT 0, coolant_max REAL DEFAULT 0,
            coolant_medie REAL DEFAULT 0, oil_max REAL DEFAULT 0, oil_medie REAL DEFAULT 0,
            boost_max REAL DEFAULT 0, boost_mediu REAL DEFAULT 0,
            maf_max REAL DEFAULT 0, maf_mediu REAL DEFAULT 0,
            voltaj_min REAL DEFAULT 0, voltaj_max REAL DEFAULT 0,
            hard_brakes INTEGER DEFAULT 0, hard_accelerations INTEGER DEFAULT 0,
            nr_alerte INTEGER DEFAULT 0, nr_dtc INTEGER DEFAULT 0,
            cost_combustibil REAL DEFAULT 0, emisii_co2 REAL DEFAULT 0,
            health_score INTEGER DEFAULT 100, trip_tag TEXT DEFAULT 'PERSONAL',
            raport_ai_json TEXT,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            FOREIGN KEY(id_calatorie) REFERENCES calatorii(id_calatorie)
        )`);

        db.run(`ALTER TABLE trip_summary ADD COLUMN raport_ai_json TEXT`, () => {});
        db.run(`ALTER TABLE trip_summary ADD COLUMN trip_tag TEXT DEFAULT 'PERSONAL'`, () => {});

        db.run(`CREATE TABLE IF NOT EXISTS realimentari (
            id INTEGER PRIMARY KEY AUTOINCREMENT, vin TEXT NOT NULL,
            timestamp INTEGER NOT NULL, litri REAL NOT NULL,
            pret_pe_litru REAL NOT NULL DEFAULT 0, odometru_km REAL DEFAULT 0,
            notite TEXT DEFAULT ''
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS predictii_validare (
            id INTEGER PRIMARY KEY AUTOINCREMENT, vin TEXT NOT NULL,
            prediction_hash TEXT NOT NULL, titlu TEXT, status TEXT DEFAULT 'ACTIVA',
            timestamp_creat INTEGER NOT NULL, timestamp_rezolvat INTEGER,
            UNIQUE(vin, prediction_hash)
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_calatorii_vin ON calatorii(vin, timestamp_start)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_flux_calatorie ON telemetrie_flux(id_calatorie, timestamp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_trip_summary ON trip_summary(id_calatorie)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_evenimente_calatorie ON evenimente_alerte(id_calatorie)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_realimentari_vin ON realimentari(vin, timestamp DESC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_predictii_vin ON predictii_validare(vin, status)`);

        initVehicleProfileTable(db);
        loadRules();
        initVehicleProfile(app, db);
    });

    startWatchdog(db);
    createMqttClient(db, io);
});

// ── Rute ──────────────────────────────────────────────────────────────────────
app.use('/admin', requireAuth);
app.use('/api',  require('./routes/trips')(db, io));
app.use('/api',  require('./routes/vehicles')(db, io));
app.use('/api',  require('./routes/reports')(db));
app.use('/api',  require('./routes/ai')(db));
app.use('/admin', require('./routes/admin')(db));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[API REST & WS] Server pornit pe http://localhost:${PORT}`));
