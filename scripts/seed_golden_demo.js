/**
 * scripts/seed_golden_demo.js
 * Configurează "Golden Demo State" pentru comisia de licență:
 * 1. Date mașină reale (Audi A6 C4 2.5 TDI AEL, 5 cilindri, 140 CP, B 100 TEL)
 * 2. Documente legale (ITP valabil verde, RCA cu expirare în 12 zile galben, Rovinietă verde)
 * 3. Curățare curse scurte / eșuate de test și lăsarea a 4-5 curse curate de prezentare
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../telemetrie_industriala.db');
const db = new sqlite3.Database(dbPath);

const nowSec = Math.floor(Date.now() / 1000);

db.serialize(() => {
    console.log('[GOLDEN DEMO] Configurăm profilul vehiculului...');

    // 1. Update vehicule (Hot Path)
    db.run(`UPDATE vehicule SET 
        model = 'Audi A6 C4 · 2.5 TDI AEL',
        tip_combustibil = 'DIESEL',
        capacitate_rezervor_l = 80
        WHERE vin = 'WAUZZZ4A1RN000000'`);

    // 2. Update vehicles (Cold Path)
    db.run(`UPDATE vehicles SET 
        make = 'Audi',
        model = 'A6',
        variant = 'C4 2.5 TDI',
        year = 1996,
        color = 'Argintiu Metalizat',
        plate_number = 'B 100 TEL',
        engine_code = 'AEL',
        displacement_cc = 2461,
        power_kw = 103,
        power_hp = 140,
        torque_nm = 290,
        cylinders = 5,
        fuel_type = 'DIESEL',
        fuel_tank_liters = 80,
        transmission = 'MANUAL',
        gears = 6,
        drivetrain = 'FWD',
        emission_standard = 'EURO 2',
        vehicle_status = 'READY',
        updated_at = ?
        WHERE id = 1`, [nowSec]);

    // 3. Documente (RCA galben expirare în 12 zile, ITP verde, Rovinietă verde)
    db.run(`DELETE FROM vehicle_documents WHERE vehicle_id = 1`);

    const rcaExpiry = nowSec + (12 * 86400); // Expiră în 12 zile -> alertă EXPIRING (galben)
    const itpExpiry = nowSec + (240 * 86400); // Expiră în 8 luni -> ACTIVE (verde)
    const rovExpiry = nowSec + (180 * 86400); // Expiră în 6 luni -> ACTIVE (verde)

    const insertDoc = db.prepare(`INSERT INTO vehicle_documents 
        (vehicle_id, title, type, issue_date, expiry_date, reminder_days, issuer, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    insertDoc.run(1, 'Asigurare RCA Auto', 'RCA', nowSec - (353 * 86400), rcaExpiry, 30, 'Generali Asigurări', 'Polisă anuală B0 - Atenție: necesită reînnoire!', nowSec, nowSec);
    insertDoc.run(1, 'Inspecție Tehnică Periodică', 'ITP', nowSec - (125 * 86400), itpExpiry, 30, 'Stația ITP AutoTest RAR', 'Inspecție trecută cu zero defecte majore.', nowSec, nowSec);
    insertDoc.run(1, 'Rovinietă Națională 12 Luni', 'ROVINIETA', nowSec - (185 * 86400), rovExpiry, 15, 'CNAIR', 'Valabilă pe întreaga rețea de drumuri naționale.', nowSec, nowSec);
    insertDoc.finalize();

    // 4. Curățare curse goale (0 km)
    db.run(`DELETE FROM calatorii WHERE km_parcursi <= 0.1 AND id_calatorie NOT IN (
        SELECT id_calatorie FROM calatorii ORDER BY id_calatorie DESC LIMIT 5
    )`);

    console.log('[GOLDEN DEMO] Golden Demo State a fost aplicat cu succes!');
    db.close();
});
