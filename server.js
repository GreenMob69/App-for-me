require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const http     = require('http');
const path     = require('path');
const sqlite3  = require('sqlite3').verbose();
const { Server } = require('socket.io');

const { initVehicleProfileTable } = require('./backend/intelligence/BaselineEngine');
const { loadRules }               = require('./backend/knowledge/KnowledgeBase');
const { initVehicleProfile }      = require('./backend/vehicle-profile');

const { startWatchdog }    = require('./services/watchdog');
const { createMqttClient, flushAllActiveTrips } = require('./handlers/mqttHandler');
const { requireAuth }      = require('./middleware/auth');

const app    = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Servire Modele 3D GLB / GLTF pentru WebGL Three.js pe Mobil
const modelsDir = path.join(__dirname, 'app mobile', 'telemetrie-app', 'assets', 'models');
app.use('/models', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
}, express.static(modelsDir));

app.get(['/models/acura_cdx.glb', '/models/car.glb'], (req, res) => {
    const optPath = path.join(modelsDir, 'acura_cdx_car.glb');
    const rawPath = path.join(modelsDir, 'acura_cdx_2016__realistic_3d_car_model.glb');
    const glbPath = require('fs').existsSync(optPath) ? optPath : rawPath;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.sendFile(glbPath);
});

app.get('/models/acura_cdx_raw.glb', (req, res) => {
    const rawPath = path.join(modelsDir, 'acura_cdx_2016__realistic_3d_car_model.glb');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.sendFile(rawPath);
});

app.get('/fleet', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'fleet.html'));
});

const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*' },
    perMessageDeflate: { threshold: 1024 }
});

io.on('connection', (socket) => {
    console.log(`[WEBSOCKET] Client conectat (${socket.id})`);
    socket.on('disconnect', () => console.log(`[WEBSOCKET] Client deconectat (${socket.id})`));
});

const DB_PATH = process.env.DB_PATH || './telemetrie_industriala.db';
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) return console.error('[EROARE DB]', err.message);
    console.log('[DB] Conectat.');
    db.run('PRAGMA foreign_keys = ON;');
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA synchronous = NORMAL;');
    db.run('PRAGMA cache_size = -32000;');
    db.run('PRAGMA temp_store = MEMORY;');
    db.run('PRAGMA mmap_size = 268435456;');
    db.run('PRAGMA busy_timeout = 5000;');

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

        // ── Smart Mobility, Sentry & Safety Tables ───────────────────────────
        db.run(`ALTER TABLE telemetrie_flux ADD COLUMN lat REAL`, () => {});
        db.run(`ALTER TABLE telemetrie_flux ADD COLUMN lon REAL`, () => {});
        db.run(`ALTER TABLE telemetrie_flux ADD COLUMN alt REAL`, () => {});
        db.run(`ALTER TABLE telemetrie_flux ADD COLUMN heading REAL`, () => {});

        db.run(`CREATE TABLE IF NOT EXISTS parcare_sentinela (
            vin TEXT PRIMARY KEY,
            is_armed INTEGER DEFAULT 1,
            lat REAL,
            lon REAL,
            alt REAL,
            parked_at INTEGER,
            parking_meter_expires_at INTEGER,
            parking_meter_minutes INTEGER DEFAULT 0,
            last_impact_at INTEGER,
            last_impact_g REAL,
            last_tilt_at INTEGER,
            last_tilt_deg REAL,
            sentry_events_json TEXT DEFAULT '[]',
            updated_at INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS valet_mode (
            vin TEXT PRIMARY KEY,
            is_active INTEGER DEFAULT 0,
            center_lat REAL,
            center_lon REAL,
            max_radius_km REAL DEFAULT 3.0,
            max_speed_kmh REAL DEFAULT 80,
            max_rpm INTEGER DEFAULT 3500,
            activated_at INTEGER,
            violations_count INTEGER DEFAULT 0,
            violations_json TEXT DEFAULT '[]'
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS contacte_urgenta (
            vin TEXT PRIMARY KEY,
            nume TEXT DEFAULT 'Contact Urgență',
            telefon TEXT DEFAULT '',
            mesaj_personalizat TEXT DEFAULT 'Posibil accident detectat! Verifică starea mea la coordonatele GPS atașate.',
            auto_send_sos INTEGER DEFAULT 1,
            updated_at INTEGER
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_calatorii_vin ON calatorii(vin, timestamp_start)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_calatorii_vin_start ON calatorii(vin, timestamp_start DESC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_flux_calatorie ON telemetrie_flux(id_calatorie, timestamp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_telemetrie_flux_trip_ts ON telemetrie_flux(id_calatorie, timestamp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_flux_timestamp ON telemetrie_flux(timestamp)`);
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
app.use('/api',  require('./routes/smartMobility')(db, io));
app.use('/api',  require('./routes/reports')(db));
app.use('/api',  require('./routes/ai')(db));
app.use('/api',  require('./routes/sync')(db));
app.use('/api',  require('./routes/simulatorControl')(db, io));
app.use('/admin', require('./routes/admin')(db));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[API REST & WS] Server pornit pe http://localhost:${PORT}`));

// Checkpoint periodic WAL la fiecare 15 minute (previne creșterea necontrolată a fișierului -wal)
const walInterval = setInterval(() => {
    db.run('PRAGMA wal_checkpoint(PASSIVE);', (err) => {
        if (err) console.error('[WAL CHECKPOINT ERROR]', err.message);
    });
}, 15 * 60 * 1000);
if (walInterval.unref) walInterval.unref();

// Închidere curată: descarcă pachetele din RAM înainte de ieșire și eliberează WAL
const handleGracefulShutdown = async (signal) => {
    console.log(`\n[SERVER] Primit ${signal}. Salvare pachete telemetrie din buffer și închidere DB...`);
    try {
        if (typeof flushAllActiveTrips === 'function') {
            await flushAllActiveTrips(db);
        }
        db.run('PRAGMA wal_checkpoint(TRUNCATE);', () => {
            db.close((err) => {
                if (err) console.error('[DB CLOSE ERROR]', err.message);
                else console.log('[DB] Conexiune SQLite închisă curat.');
                process.exit(0);
            });
        });
    } catch (err) {
        console.error('[SHUTDOWN ERROR]', err);
        process.exit(1);
    }
};

process.on('SIGINT',  () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
