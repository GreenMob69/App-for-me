/**
 * Vehicle Profile — Schema SQL
 * 7 tabele nucleu: vehicles, mileage_log, service_sessions, service_items,
 *                   maintenance_items, workshops, milestones
 */

const TABLES = [
    // ─── VEHICLES ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vin TEXT UNIQUE NOT NULL,

        -- Identitate
        make TEXT,
        model TEXT,
        variant TEXT,
        year INTEGER,
        color TEXT,
        plate_number TEXT,

        -- Motor
        engine_code TEXT,
        displacement_cc INTEGER,
        power_kw INTEGER,
        power_hp INTEGER,
        torque_nm INTEGER,
        cylinders INTEGER,
        fuel_type TEXT,
        fuel_tank_liters REAL,

        -- Transmisie
        transmission TEXT,
        gears INTEGER,
        drivetrain TEXT,

        -- Norme
        emission_standard TEXT,
        co2_gkm INTEGER,

        -- Achizitie
        purchase_date INTEGER,
        purchase_mileage_km INTEGER,
        purchase_price REAL,

        -- Specificatii service
        oil_capacity_liters REAL,
        oil_spec TEXT,
        coolant_capacity_liters REAL,
        timing_belt_interval_km INTEGER,
        spark_plug_interval_km INTEGER,

        -- Status calculat (actualizat automat)
        vehicle_status TEXT DEFAULT 'UNKNOWN',
        status_reason TEXT,
        status_updated_at INTEGER,

        -- Metadata
        created_at INTEGER DEFAULT (strftime('%s','now')),
        updated_at INTEGER DEFAULT (strftime('%s','now')),

        -- Extensibilitate
        custom_json TEXT
    )`,

    // ─── MILEAGE LOG ────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS mileage_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,

        odometer_km INTEGER NOT NULL,
        source TEXT NOT NULL,
        recorded_at INTEGER NOT NULL,
        note TEXT,

        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`,

    // ─── WORKSHOPS ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS workshops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,

        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        specialization TEXT DEFAULT 'GENERAL',
        rating INTEGER,
        is_trusted INTEGER DEFAULT 0,
        notes TEXT,

        created_at INTEGER DEFAULT (strftime('%s','now')),

        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`,

    // ─── SERVICE SESSIONS ───────────────────────────────────────
    // O sesiune de service = o vizita la atelier (poate contine N operatiuni)
    `CREATE TABLE IF NOT EXISTS service_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,

        -- Cand si unde
        performed_at INTEGER NOT NULL,
        mileage_km INTEGER,
        workshop_id INTEGER,
        workshop_name TEXT,

        -- Costuri agregate
        cost_total REAL,
        cost_parts REAL,
        cost_labor REAL,
        currency TEXT DEFAULT 'RON',

        -- Descriere
        title TEXT,
        notes TEXT,

        -- Metadata
        created_at INTEGER DEFAULT (strftime('%s','now')),

        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
        FOREIGN KEY (workshop_id) REFERENCES workshops(id)
    )`,

    // ─── SERVICE ITEMS ──────────────────────────────────────────
    // Fiecare operatiune individuala dintr-o sesiune
    `CREATE TABLE IF NOT EXISTS service_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        vehicle_id INTEGER NOT NULL,

        service_type TEXT NOT NULL,
        description TEXT,

        cost REAL,

        -- Urmatorul interval (optional)
        next_due_km INTEGER,
        next_due_date INTEGER,

        FOREIGN KEY (session_id) REFERENCES service_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`,

    // ─── MAINTENANCE ITEMS ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS maintenance_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,

        item_type TEXT NOT NULL,
        item_name TEXT NOT NULL,

        status TEXT DEFAULT 'UNKNOWN',

        last_service_id INTEGER,
        last_service_date INTEGER,
        last_service_km INTEGER,

        interval_km INTEGER,
        interval_months INTEGER,
        next_due_km INTEGER,
        next_due_date INTEGER,

        wear_percent REAL DEFAULT 0,
        remaining_km INTEGER,
        remaining_days INTEGER,

        updated_at INTEGER DEFAULT (strftime('%s','now')),

        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
        FOREIGN KEY (last_service_id) REFERENCES service_items(id),
        UNIQUE(vehicle_id, item_type)
    )`,

    // ─── MILESTONES ─────────────────────────────────────────────
    // Realizari / repere importante ale vehiculului
    `CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,

        milestone_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,

        achieved_at INTEGER NOT NULL,
        mileage_km INTEGER,

        -- Metadata
        icon TEXT,
        is_celebrated INTEGER DEFAULT 0,

        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`
];

const INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_mileage_vehicle ON mileage_log(vehicle_id, recorded_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_vehicle ON service_sessions(vehicle_id, performed_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_items_session ON service_items(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_items_vehicle_type ON service_items(vehicle_id, service_type)`,
    `CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_items(vehicle_id, item_type)`,
    `CREATE INDEX IF NOT EXISTS idx_workshops_vehicle ON workshops(vehicle_id)`,
    `CREATE INDEX IF NOT EXISTS idx_milestones_vehicle ON milestones(vehicle_id, achieved_at DESC)`
];

// Migratii pentru baze de date existente
const MIGRATIONS = [
    `ALTER TABLE vehicles ADD COLUMN vehicle_status TEXT DEFAULT 'UNKNOWN'`,
    `ALTER TABLE vehicles ADD COLUMN status_reason TEXT`,
    `ALTER TABLE vehicles ADD COLUMN status_updated_at INTEGER`,
];

function initVehicleProfileSchema(db) {
    TABLES.forEach(sql => db.run(sql));
    INDEXES.forEach(sql => db.run(sql));
    // Migratii safe (ignora erori "duplicate column")
    MIGRATIONS.forEach(sql => db.run(sql, () => {}));
    console.log('[VEHICLE PROFILE] Schema initializata (7 tabele nucleu).');
}

module.exports = { initVehicleProfileSchema };
