'use strict';

/**
 * scripts/export_pdf.js
 * --------------------------------------------------------------------------
 * Utilitar CLI pentru generarea și exportul rapid de rapoarte PDF pentru comisie.
 *
 * Utilizare:
 *   node scripts/export_pdf.js              (exportă ultima cursă finalizată)
 *   node scripts/export_pdf.js --trip 12    (exportă cursa specifică #12)
 *   node scripts/export_pdf.js --vehicle 1  (exportă raportul complet al mașinii)
 * --------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const PDFDocument = require('pdfkit');
const { THRESHOLDS } = require('../backend/analyzers/config');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'telemetrie_industriala.db');

const args = process.argv.slice(2);
function getArg(name) {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const tripIdArg = getArg('--trip');
const vehicleIdArg = getArg('--vehicle');

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, async (err) => {
    if (err) {
        console.error('[EROARE DB] Nu s-a putut deschide baza de date:', err.message);
        process.exit(1);
    }

    try {
        if (vehicleIdArg) {
            await exportVehicleReport(parseInt(vehicleIdArg, 10));
        } else {
            await exportTripReport(tripIdArg ? parseInt(tripIdArg, 10) : null);
        }
    } catch (exportErr) {
        console.error('[EROARE GENERARE PDF]', exportErr.message);
        process.exit(1);
    } finally {
        db.close();
    }
});

async function exportTripReport(targetTripId) {
    const trip = await new Promise((resolve, reject) => {
        let sql = `
            SELECT c.id_calatorie, c.vin, c.km_parcursi, c.consum_total_l, c.consum_mediu_100km,
                   c.scor_eco, c.timestamp_start, c.timestamp_end,
                   ts.health_score, ts.durata_secunde, ts.viteza_max, ts.rpm_max,
                   ts.coolant_max, ts.boost_max, ts.voltaj_min, ts.voltaj_max,
                   ts.hard_brakes, ts.hard_accelerations, ts.cost_combustibil,
                   ts.emisii_co2, ts.raport_ai_json,
                   COALESCE(v.model, 'Audi A6 C4 2.5 TDI AEL') AS model_vehicul
            FROM calatorii c
            LEFT JOIN trip_summary ts ON c.id_calatorie = ts.id_calatorie
            LEFT JOIN vehicule v ON c.vin = v.vin
        `;
        if (targetTripId) {
            sql += ` WHERE c.id_calatorie = ?`;
            db.get(sql, [targetTripId], (err, row) => err ? reject(err) : resolve(row));
        } else {
            sql += ` WHERE ts.id_summary IS NOT NULL ORDER BY c.id_calatorie DESC LIMIT 1`;
            db.get(sql, [], (err, row) => err ? reject(err) : resolve(row));
        }
    });

    if (!trip) {
        console.warn('⚠️ Nu a fost găsită nicio cursă finalizată în baza de date.');
        console.log('Sfat: Rulează simulatorul mai întâi: `node simulator.js --duration 20 --speed 4`');
        return;
    }

    let ai = null;
    if (trip.raport_ai_json) {
        try { ai = JSON.parse(trip.raport_ai_json); } catch {}
    }

    const outputFile = path.join(__dirname, '..', `raport_cursa_${trip.id_calatorie}.pdf`);
    const stream = fs.createWriteStream(outputFile);
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    doc.pipe(stream);

    const litriTotali = (trip.cost_combustibil || 0) / THRESHOLDS.DIESEL_PRICE_PER_LITER;
    const durationMin = Math.round((trip.durata_secunde || 0) / 60);
    const startDate = trip.timestamp_start ? new Date(trip.timestamp_start).toLocaleString('ro-RO') : '—';
    const predictions = (ai?.intelligence?.predictions || []).filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 3);

    // ── Header Vizual ────────────────────────────────────────────────────────
    doc.rect(50, 50, 495, 46).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(16).text(`RAPORT DIAGNOSTIC CURSĂ #${trip.id_calatorie}`, 65, 62, { lineBreak: false });
    doc.fillColor('#94A3B8').fontSize(9).text(startDate, 50, 67, { align: 'right', width: 480 });
    doc.moveDown(2.5);

    // ── Informații Vehicul ───────────────────────────────────────────────────
    doc.fillColor('#0F172A').fontSize(12).text(`Vehicul: ${trip.model_vehicul} [VIN: ${trip.vin}]`);
    doc.moveDown(0.8);

    // ── Statistici Cursă ─────────────────────────────────────────────────────
    doc.fillColor('#1E293B').fontSize(11).text('1. PARAMETRI ȘI CONSUM CURSĂ', { underline: true });
    doc.moveDown(0.4).fillColor('#334155').fontSize(10);
    doc.text(`Distanță parcursă:         ${(trip.km_parcursi || 0).toFixed(2)} km`);
    doc.text(`Durată:                   ${durationMin} min (${trip.durata_secunde || 0} secunde)`);
    doc.text(`Combustibil estimat:      ${litriTotali.toFixed(2)} Litri`);
    const cons100 = trip.consum_mediu_100km > 0
        ? trip.consum_mediu_100km.toFixed(1)
        : (trip.km_parcursi > 0.1 ? (litriTotali / trip.km_parcursi * 100).toFixed(1) : '—');
    doc.text(`Consum mediu:             ${cons100} L/100km`);
    doc.text(`Cost combustibil:         ${(trip.cost_combustibil || 0).toFixed(2)} RON`);
    doc.text(`Emisii CO2:               ${(trip.emisii_co2 || 0).toFixed(2)} kg`);
    doc.text(`Scor Eco condus:          ${trip.scor_eco || 100} / 100`);
    doc.text(`Stare Tehnică (Health):   ${trip.health_score || 100} %`);
    doc.moveDown(1.2);

    // ── Evenimente & Securitate ──────────────────────────────────────────────
    doc.fillColor('#1E293B').fontSize(11).text('2. COMPORTAMENT DINAMIC ȘI INTEGRITATE', { underline: true });
    doc.moveDown(0.4).fillColor('#334155').fontSize(10);
    doc.text(`Frânări bruște (-0.4G):   ${trip.hard_brakes || 0}`);
    doc.text(`Accelerări agresive:      ${trip.hard_accelerations || 0}`);
    doc.text(`Viteză maximă:            ${(trip.viteza_max || 0).toFixed(0)} km/h`);
    doc.text(`Turație maximă:           ${trip.rpm_max || 0} RPM`);
    doc.text(`Presiune Turbo Max:       ${(trip.boost_max || 0).toFixed(2)} bar`);
    doc.text(`Temperatură Coolant Max:  ${(trip.coolant_max || 0).toFixed(1)} °C`);
    doc.text(`Voltaj Alternator:        Min: ${(trip.voltaj_min || 0).toFixed(2)}V  |  Max: ${(trip.voltaj_max || 0).toFixed(2)}V`);
    doc.moveDown(1.2);

    // ── Concluzii AI & Diagnoză ──────────────────────────────────────────────
    doc.fillColor('#1E293B').fontSize(11).text('3. EVALUARE PREDICTIVĂ & DIAGNOZĂ AI (GROQ SDK)', { underline: true });
    doc.moveDown(0.4);

    if (predictions.length > 0) {
        predictions.forEach(p => {
            const sevColor = p.severity === 'HIGH' ? '#DC2626' : '#D97706';
            doc.fillColor(sevColor).fontSize(10).text(`• [${p.severity}] ${p.component}: ${p.prediction}`);
            if (p.recommendation) {
                doc.fillColor('#475569').fontSize(9).text(`  Recomandare: ${p.recommendation}`);
            }
            doc.moveDown(0.3);
        });
    } else {
        doc.fillColor('#16A34A').fontSize(10).text('✓ Nicio anomalie critică detectată. Toți parametrii se află în toleranțele nominale.');
    }

    if (ai?.health?.verdict) {
        doc.moveDown(0.5);
        doc.fillColor('#0F172A').fontSize(10).text(`Verdict Tehnic: "${ai.health.verdict}"`, { italic: true });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.fillColor('#94A3B8').fontSize(8).text(
        `Generat automat de Platforma de Telemetrie și Diagnoză Auto • Antigravity AI Engine`,
        50, 750, { align: 'center', width: 495 }
    );

    doc.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    const stats = fs.statSync(outputFile);
    console.log(`\n======================================================`);
    console.log(`✓ RAPORT PDF GENERAT CU SUCCES!`);
    console.log(`  Fișier: ${outputFile}`);
    console.log(`  Mărime: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`  Cursă:  #${trip.id_calatorie} (${trip.model_vehicul})`);
    console.log(`======================================================\n`);
}

async function exportVehicleReport(vehicleId) {
    const { PDFReportGenerator } = require('../backend/pdf/PDFReportGenerator');
    const { DigitalTwinSnapshot } = require('../backend/digitalTwin');
    const { DigitalTwinSerializer } = require('../backend/digitalTwin/DigitalTwinSerializer');
    const { hydrateStatus, sortDocs } = require('../backend/vehicle-profile/DocumentsModule');

    const vehicle = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM vehicles WHERE id = ?', [vehicleId], (err, row) => err ? reject(err) : resolve(row));
    });

    if (!vehicle) {
        console.error(`⚠️ Vehiculul cu ID ${vehicleId} nu există.`);
        return;
    }

    const snapshot = await DigitalTwinSnapshot.load(db, vehicle.vin);
    if (!snapshot) {
        console.error(`⚠️ Nu există date Digital Twin pentru VIN ${vehicle.vin}.`);
        return;
    }

    const pdfData = DigitalTwinSerializer.toPDF(snapshot.twin);
    const [timeline, services, documents, stats, costs] = await Promise.all([
        new Promise(r => db.all('SELECT * FROM vehicle_timeline WHERE vehicle_id = ? ORDER BY event_date DESC LIMIT 40', [vehicleId], (e, rows) => r(rows || []))),
        new Promise(r => db.all('SELECT * FROM service_sessions WHERE vehicle_id = ? ORDER BY performed_at DESC LIMIT 10', [vehicleId], (e, rows) => r(rows || []))),
        new Promise(r => db.all('SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC', [vehicleId], (e, rows) => r(sortDocs(hydrateStatus(rows || []))))),
        new Promise(r => db.get('SELECT COUNT(*) AS total_calatorii, COALESCE(SUM(km_parcursi), 0) AS total_km FROM calatorii WHERE vin = ?', [vehicle.vin], (e, row) => r(row || {}))),
        new Promise(r => db.get('SELECT COALESCE(SUM(cost_total), 0) AS service FROM service_sessions WHERE vehicle_id = ?', [vehicleId], (e, row) => r(row || {}))),
    ]);

    const outputFile = path.join(__dirname, '..', `raport_complet_${vehicle.vin}.pdf`);
    const stream = fs.createWriteStream(outputFile);

    const generator = new PDFReportGenerator(pdfData, { timeline, services, stats, costs, documents });
    generator.generate(stream);

    await new Promise(r => stream.on('finish', r));
    console.log(`✓ Raport complet generat: ${outputFile}`);
}
