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
const { initVehicleProfileTable } = require('./backend/intelligence/BaselineEngine');
const { loadRules } = require('./backend/knowledge/KnowledgeBase');
const { initVehicleProfile } = require('./backend/vehicle-profile');
const { DigitalTwinSnapshot, DigitalTwinSerializer } = require('./backend/digitalTwin');
const { answerWithContext, buildSuggestedQuestions } = require('./backend/intelligence/ExpertQueryEngine');
const { PDFReportGenerator } = require('./backend/pdf/PDFReportGenerator');

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
        db.run(`ALTER TABLE trip_summary ADD COLUMN trip_tag TEXT DEFAULT 'PERSONAL'`, () => {});

        db.run(`CREATE INDEX IF NOT EXISTS idx_flux_calatorie ON telemetrie_flux(id_calatorie, timestamp);`);
        db.run(`
        CREATE INDEX IF NOT EXISTS idx_trip_summary
        ON trip_summary(id_calatorie);
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_evenimente_calatorie ON evenimente_alerte(id_calatorie);`);

        // Inițializare tabele auxiliare + Knowledge Base
        initVehicleProfileTable(db);
        loadRules();

        // Vehicle Profile — schema + routes
        initVehicleProfile(app, db);
    });
});

// ===============================================================
// HELPER: Generare insights inteligente la finalul cursei
// ===============================================================
function buildTripInsights(rezultat) {
    if (!rezultat) return [];
    const insights = [];
    const { summary, health, ai } = rezultat;

    // Insight 1: Comparație cu scorul anterior (din baseline dacă există)
    if (health.overallHealth >= 90) {
        insights.push({ type: 'POSITIVE', icon: '✓', text: 'Cursă excelentă — toate sistemele în parametri optimi' });
    } else if (health.overallHealth < 60) {
        insights.push({ type: 'NEGATIVE', icon: '!', text: 'Sănătatea vehiculului a scăzut sub 60% în această cursă' });
    }

    // Insight 2: Stil de condus
    const aggressivePct = summary.drivingStyle?.aggressivePct || 0;
    const economicPct = summary.drivingStyle?.economicPct || 0;
    if (aggressivePct > 25) {
        insights.push({ type: 'WARNING', icon: '⚡', text: `Condus agresiv ${Math.round(aggressivePct)}% din cursă — impact pe consum și uzură` });
    } else if (economicPct > 60) {
        insights.push({ type: 'POSITIVE', icon: '✓', text: `Condus economic ${Math.round(economicPct)}% din cursă — excelent!` });
    }

    // Insight 3: Evenimente
    const hardBrakes = summary.events?.hardBrakes || 0;
    const hardAccels = summary.events?.hardAccelerations || 0;
    if (hardBrakes + hardAccels > 3) {
        insights.push({ type: 'WARNING', icon: '⚠', text: `${hardBrakes + hardAccels} evenimente bruște — frânări și accelerări agresive` });
    } else if (hardBrakes === 0 && hardAccels === 0) {
        insights.push({ type: 'POSITIVE', icon: '✓', text: 'Zero evenimente bruște — condus fluent și anticipativ' });
    }

    // Insight 4: Temperatură
    const coolantMax = summary.pid?.coolant?.max || 0;
    if (coolantMax > 100) {
        insights.push({ type: 'NEGATIVE', icon: '!', text: `Temperatura antigel a atins ${coolantMax}°C — supraîncălzire!` });
    }

    // Insight 5: Tensiune
    const voltMin = summary.pid?.voltage?.min || 14;
    if (voltMin < 13.2) {
        insights.push({ type: 'WARNING', icon: '⚡', text: `Tensiune minimă ${voltMin}V — posibilă problemă alternator` });
    }

    // Insight 6: Predicții active (din intelligence)
    const predictions = ai?.intelligence?.predictions || [];
    const highPred = predictions.find(p => p.severity === 'HIGH');
    if (highPred) {
        insights.push({ type: 'NEGATIVE', icon: '!', text: `${highPred.component}: probabilitate ${highPred.probability}% defecțiune — verificare recomandată` });
    }

    return insights.slice(0, 4);
}

const calatoriiActive = {};
const client = mqtt.connect('mqtt://broker.emqx.io');
const TOPIC_TELEMETRIE = 'licenta/audi_a6_c4/telemetrie';

client.on('connect', () => {
    console.log('[MQTT] Conectat la broker! Gata pentru receptia matricei OBD-II & UDS...');
    client.subscribe(TOPIC_TELEMETRIE);
});

client.on('message', async (topic, message) => {
    let pachet;
    try {
        pachet = JSON.parse(message.toString());
    } catch (e) {
        console.error('[MQTT] Pachet invalid (nu este JSON valid):', e.message);
        return;
    }

    if (!pachet || typeof pachet !== 'object' || !pachet.timestamp) {
        console.warn('[MQTT] Pachet ignorat — structura invalida (lipseste timestamp).');
        return;
    }

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
        // TRIP ANALYZER — Nivel 4 + 5 + 6 (pipeline complet, o singură dată)
        // Recuperăm pachetele brute din DB pentru analize avansate
        // (corelații, calitate senzori, integritate date)
        // =======================================================
        const rezultatAnalizaPromise = new Promise((resolve) => {
            db.all(`SELECT matrice_completa_json FROM telemetrie_flux WHERE id_calatorie = ? ORDER BY timestamp ASC`,
                [trip.id_calatorie], async (err, rows) => {
                    const rawPackets = (rows || []).map(r => {
                        try { return JSON.parse(r.matrice_completa_json); }
                        catch(e) { return null; }
                    }).filter(Boolean);

                    const result = await finalizeTripAnalysis(trip, {
                        db,
                        vin,
                        dtcList: eroriActiveDTC,
                        rawPackets
                    });
                    resolve(result);
                });
        });
        const rezultatAnaliza = await rezultatAnalizaPromise;

        db.run(`UPDATE calatorii SET timestamp_end = ?, km_parcursi = ?, consum_total_l = ?, consum_mediu_100km = ?, scor_eco = ? WHERE id_calatorie = ?`, 
            [pachet.timestamp, trip.km.toFixed(2), trip.consum_l.toFixed(2), consum_mediu.toFixed(1), scor_final, trip.id_calatorie], () => {

            const litriTotali = rezultatAnaliza
                ? (rezultatAnaliza.summary.fuel.idleLiters + rezultatAnaliza.summary.fuel.movingLiters)
                : 0;
            const cost = litriTotali * THRESHOLDS.DIESEL_PRICE_PER_LITER;
            const co2  = litriTotali * THRESHOLDS.DIESEL_CO2_KG_PER_LITER;

            if (rezultatAnaliza) {
                const { summary, health, ai } = rezultatAnaliza;

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

            // Construim raportul complet pentru Trip Report Screen
            const tripReport = rezultatAnaliza ? {
                tripId: trip.id_calatorie,
                healthScore: rezultatAnaliza.health.overallHealth,
                scores: {
                    engine: rezultatAnaliza.health.engineScore,
                    fuel: rezultatAnaliza.health.fuelScore,
                    driving: rezultatAnaliza.health.drivingScore,
                    safety: rezultatAnaliza.health.safetyScore
                },
                stats: {
                    distanceKm: Number(trip.km.toFixed(2)),
                    durationMin: Math.round((rezultatAnaliza.summary.duration.totalSeconds || 0) / 60),
                    fuelLiters: Number(litriTotali.toFixed(2)),
                    consumptionPer100: trip.km > 0.1 ? Number((litriTotali / trip.km * 100).toFixed(1)) : 0,
                    costRON: Number(cost.toFixed(2)),
                    co2Kg: Number(co2.toFixed(2)),
                    ecoScore: scor_final
                },
                driving: {
                    smoothPct: rezultatAnaliza.summary.drivingStyle?.smoothPct || 0,
                    economicPct: rezultatAnaliza.summary.drivingStyle?.economicPct || 0,
                    aggressivePct: rezultatAnaliza.summary.drivingStyle?.aggressivePct || 0,
                    hardBrakes: rezultatAnaliza.summary.events?.hardBrakes || 0,
                    hardAccelerations: rezultatAnaliza.summary.events?.hardAccelerations || 0,
                    overspeeds: rezultatAnaliza.summary.events?.overspeeds || 0
                },
                insights: buildTripInsights(rezultatAnaliza),
                predictions: (rezultatAnaliza.ai?.intelligence?.predictions || []).filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 2)
            } : null;

            io.emit('status_trip', {
                status: 'STOP',
                id_calatorie: trip.id_calatorie,
                health_score: rezultatAnaliza ? rezultatAnaliza.health.overallHealth : null,
                report: tripReport
            });

            // Vehicle Timeline — emit trip event
            const { vehicleEventBus } = require('./backend/vehicle-profile');
            db.get(`SELECT id FROM vehicles WHERE vin = ?`, [vin], (err, vehicle) => {
                if (vehicle) {
                    const distKm = Number(trip.km.toFixed(1));
                    vehicleEventBus.emit(distKm > 300 ? 'LONG_TRIP' : 'TRIP_COMPLETED', {
                        vehicle_id: vehicle.id,
                        source: 'OBD',
                        distance_km: distKm,
                        mileage_km: null,
                        reference_type: 'TRIP',
                        reference_id: trip.id_calatorie,
                        health_score: rezultatAnaliza ? rezultatAnaliza.health.overallHealth : null,
                    });

                    // Emit AI predictions as timeline events
                    const predictions = (rezultatAnaliza?.ai?.intelligence?.predictions || [])
                        .filter(p => p.severity === 'HIGH');
                    predictions.forEach(p => {
                        vehicleEventBus.emit('AI_PREDICTION', {
                            vehicle_id: vehicle.id,
                            source: 'AI',
                            title: `AI: ${p.component} — ${p.recommendation?.substring(0, 80) || 'Necesita atentie'}`,
                            prediction: p.component,
                            severity_level: p.severity,
                            probability: p.probability,
                            reference_type: 'TRIP',
                            reference_id: trip.id_calatorie,
                        });
                    });
                }
            });

            delete calatoriiActive[vin];
        });
    }
});

app.get('/api/ping', (req, res) => res.json({ ok: true }));

app.get('/api/calatorii', (req, res) => {
    db.all(`SELECT * FROM calatorii ORDER BY id_calatorie DESC`, [], (err, rows) => res.json(rows || []));
});

// IMPORTANT: literal routes BEFORE parameterized :id to avoid Express matching "filtrate" as an id
app.get('/api/calatorii/filtrate', (req, res) => {
    const { startDate, endDate, hasAlerts, hasDTC, tempOver, tag } = req.query;

    let query = `
        SELECT c.*, ts.health_score, ts.hard_brakes, ts.hard_accelerations, ts.nr_alerte, ts.nr_dtc,
               ts.coolant_max, ts.trip_tag
        FROM calatorii c
        LEFT JOIN trip_summary ts ON ts.id_calatorie = c.id_calatorie
        WHERE c.timestamp_end IS NOT NULL
    `;
    const params = [];

    if (startDate) {
        // 'T00:00:00' fără timezone → Node.js parsează ca oră locală (nu UTC)
        query += ` AND c.timestamp_start >= ?`;
        params.push(new Date(startDate + 'T00:00:00').getTime());
    }
    if (endDate) {
        const endTs = new Date(endDate + 'T00:00:00');
        endTs.setHours(23, 59, 59, 999);
        query += ` AND c.timestamp_start <= ?`;
        params.push(endTs.getTime());
    }
    if (hasAlerts === 'true') {
        query += ` AND (ts.hard_brakes > 0 OR ts.hard_accelerations > 0 OR ts.nr_alerte > 0)`;
    }
    if (hasDTC === 'true') {
        query += ` AND ts.nr_dtc > 0`;
    }
    if (tempOver) {
        query += ` AND ts.coolant_max > ?`;
        params.push(parseFloat(tempOver));
    }
    if (tag && tag !== 'ALL') {
        query += ` AND ts.trip_tag = ?`;
        params.push(tag);
    }

    query += ` ORDER BY c.id_calatorie DESC`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ eroare: err.message });
        res.json(rows || []);
    });
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

app.get('/api/calatorii/:id/report', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT ts.*, c.km_parcursi, c.consum_total_l, c.scor_eco, c.timestamp_start, c.timestamp_end
            FROM trip_summary ts
            JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
            WHERE ts.id_calatorie = ?`, [id], (err, row) => {
        if (!row) return res.status(404).json({ eroare: "Raportul nu există pentru această cursă." });

        let ai = null;
        if (row.raport_ai_json) {
            try { ai = JSON.parse(row.raport_ai_json); } catch(e) {}
        }

        const intelligence = ai?.intelligence || {};
        const litriTotali = (row.cost_combustibil || 0) / THRESHOLDS.DIESEL_PRICE_PER_LITER;

        const report = {
            tripId: row.id_calatorie,
            healthScore: row.health_score,
            scores: {
                engine: ai?.engine?.score || 100,
                fuel: ai?.fuel?.score || 100,
                driving: ai?.driving?.score || 100,
                safety: ai?.safetyScore || 100
            },
            stats: {
                distanceKm: Number((row.km_parcursi || 0).toFixed(2)),
                durationMin: Math.round((row.durata_secunde || 0) / 60),
                fuelLiters: Number(litriTotali.toFixed(2)),
                consumptionPer100: row.km_parcursi > 0.1 ? Number((litriTotali / row.km_parcursi * 100).toFixed(1)) : 0,
                costRON: Number((row.cost_combustibil || 0).toFixed(2)),
                co2Kg: Number((row.emisii_co2 || 0).toFixed(2)),
                ecoScore: row.scor_eco || 100
            },
            driving: {
                smoothPct: ai?.driving?.style?.smoothPct || 0,
                economicPct: ai?.driving?.style?.economicPct || 0,
                aggressivePct: ai?.driving?.style?.aggressivePct || 0,
                hardBrakes: row.hard_brakes || 0,
                hardAccelerations: row.hard_accelerations || 0,
                overspeeds: ai?.driving?.events?.overspeeds || 0
            },
            insights: [],
            predictions: (intelligence.predictions || []).filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 2),
            timestamp: row.timestamp_start
        };

        // Generate insights from saved data
        if (row.health_score >= 90) {
            report.insights.push({ type: 'POSITIVE', icon: '✓', text: 'Cursă excelentă — sisteme în parametri optimi' });
        }
        if (report.driving.aggressivePct > 25) {
            report.insights.push({ type: 'WARNING', icon: '⚡', text: `Condus agresiv ${Math.round(report.driving.aggressivePct)}% din cursă` });
        } else if (report.driving.economicPct > 60) {
            report.insights.push({ type: 'POSITIVE', icon: '✓', text: `Condus economic ${Math.round(report.driving.economicPct)}% din cursă` });
        }
        if (row.hard_brakes + row.hard_accelerations > 3) {
            report.insights.push({ type: 'WARNING', icon: '⚠', text: `${row.hard_brakes + row.hard_accelerations} evenimente bruște detectate` });
        }
        if (row.coolant_max > 100) {
            report.insights.push({ type: 'NEGATIVE', icon: '!', text: `Supraîncălzire: ${row.coolant_max}°C` });
        }
        if (row.voltaj_min < 13.2) {
            report.insights.push({ type: 'WARNING', icon: '⚡', text: `Tensiune minimă ${row.voltaj_min}V` });
        }

        res.json(report);
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
// ENDPOINT VEHICLE HEALTH — alimentează Vehicle Health Dashboard
// ===============================================================
app.get('/api/vehicul/:vin/health', async (req, res) => {
    const vin = req.params.vin || "WAUZZZ4A1RN000000";

    try {
        const lastTrips = await new Promise((resolve) => {
            db.all(`SELECT ts.*, c.vin, c.timestamp_start, c.km_parcursi, c.consum_total_l, c.scor_eco
                    FROM trip_summary ts
                    JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                    WHERE c.vin = ?
                    ORDER BY ts.id_summary DESC LIMIT 10`, [vin], (err, rows) => resolve(rows || []));
        });

        if (lastTrips.length === 0) {
            return res.json({
                status: 'NO_DATA',
                overallHealth: null,
                scores: null,
                subsystems: null,
                predictions: [],
                timeline: [],
                lastTrip: null,
                lastUpdated: null,
                dataQuality: 'NONE'
            });
        }

        const latest = lastTrips[0];
        let ai = null;
        if (latest.raport_ai_json) {
            try { ai = JSON.parse(latest.raport_ai_json); } catch(e) {}
        }

        const intelligence = ai?.intelligence || {};

        // Health scores
        const overallHealth = latest.health_score || 100;
        const scores = {
            engine: ai?.engine?.score || 100,
            fuel: ai?.fuel?.score || 100,
            driving: ai?.driving?.score || 100,
            safety: ai?.safetyScore || 100
        };

        // Subsisteme din VehicleDNA + predictions
        const dna = intelligence.vehicle_dna || {};
        const predictions = intelligence.predictions || [];
        const subsystemsRaw = dna.subsystems || {};

        // Calculare trend per subsistem (comparare medie ultimele 3 vs primele 3)
        const computeTrend = (recentScores, olderScores) => {
            if (recentScores.length < 2 || olderScores.length < 2) return 'STABLE';
            const avgRecent = recentScores.reduce((s, v) => s + v, 0) / recentScores.length;
            const avgOlder = olderScores.reduce((s, v) => s + v, 0) / olderScores.length;
            const diff = avgRecent - avgOlder;
            if (diff > 3) return 'IMPROVING';
            if (diff < -3) return 'DECREASING';
            return 'STABLE';
        };

        const recentHealthScores = lastTrips.slice(0, 3).map(t => t.health_score);
        const olderHealthScores = lastTrips.slice(3, 7).map(t => t.health_score);
        const overallTrend = computeTrend(recentHealthScores, olderHealthScores);

        // Construire subsisteme cu statusuri inteligente
        const getPredictionForSystem = (category) => {
            return predictions.find(p => p.category === category && (p.severity === 'HIGH' || p.severity === 'MEDIUM'));
        };

        const subsystems = {
            motor: {
                score: subsystemsRaw.cooling?.score || scores.engine,
                status: subsystemsRaw.cooling?.status || 'Normal',
                trend: overallTrend,
                prediction: getPredictionForSystem('TERMIC') || getPredictionForSystem('ADMISIE') || null
            },
            electric: {
                score: subsystemsRaw.electrical?.score || 100,
                status: subsystemsRaw.electrical?.status || 'Normal',
                trend: (latest.voltaj_min < 13.4) ? 'DECREASING' : 'STABLE',
                prediction: getPredictionForSystem('ELECTRIC') || null
            },
            turbo: {
                score: subsystemsRaw.turbo?.score || 95,
                status: subsystemsRaw.turbo?.status || 'Parametri în toleranță',
                trend: 'STABLE',
                prediction: getPredictionForSystem('TURBO') || null
            },
            combustibil: {
                score: subsystemsRaw.fuel?.score || scores.fuel,
                status: subsystemsRaw.fuel?.status || 'Injecție optimă',
                trend: 'STABLE',
                prediction: getPredictionForSystem('COMBUSTIBIL') || getPredictionForSystem('EMISII') || null
            },
            stil_condus: {
                score: subsystemsRaw.driving_style?.score || scores.driving,
                status: scores.driving > 85 ? 'Economic' : scores.driving > 65 ? 'Moderat' : 'Agresiv',
                trend: 'STABLE',
                prediction: null
            }
        };

        // Timeline (ultimele 10 curse)
        const timeline = lastTrips.map(t => ({
            tripId: t.id_calatorie,
            health: t.health_score,
            date: new Date(t.created_at * 1000).toISOString().split('T')[0],
            km: t.km_parcursi || 0,
            duration: t.durata_secunde || 0
        })).reverse();

        // Ultima cursă
        const lastTrip = {
            id: latest.id_calatorie,
            date: new Date(latest.created_at * 1000).toISOString(),
            distanceKm: Number((latest.km_parcursi || 0).toFixed(1)),
            durationMin: Math.round((latest.durata_secunde || 0) / 60),
            consumptionPer100: latest.km_parcursi > 0.1
                ? Number(((latest.cost_combustibil / THRESHOLDS.DIESEL_PRICE_PER_LITER) / latest.km_parcursi * 100).toFixed(1))
                : 0,
            ecoScore: latest.scor_eco || 100,
            healthScore: latest.health_score
        };

        // Data quality
        const sensorQuality = intelligence.sensorQuality || [];
        const avgQuality = sensorQuality.length > 0
            ? sensorQuality.reduce((s, sq) => s + sq.quality, 0) / sensorQuality.length
            : 100;
        const dataQuality = avgQuality >= 85 ? 'HIGH' : avgQuality >= 60 ? 'MEDIUM' : 'LOW';

        res.json({
            status: 'OK',
            overallHealth,
            overallTrend,
            scores,
            subsystems,
            predictions: predictions.filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 3),
            timeline,
            lastTrip,
            lastUpdated: new Date(latest.created_at * 1000).toISOString(),
            dataQuality
        });

    } catch (error) {
        console.error('[HEALTH ENDPOINT EROARE]', error.message);
        res.status(500).json({ eroare: "Nu s-a putut calcula starea de sănătate.", detalii: error.message });
    }
});

// ===============================================================
// ENDPOINT DETALIU SUBSISTEM — pentru SubsystemDetailScreen
// ===============================================================
app.get('/api/vehicul/:vin/health/:system', async (req, res) => {
    const vin = req.params.vin || "WAUZZZ4A1RN000000";
    const system = req.params.system;

    try {
        const latest = await new Promise((resolve) => {
            db.get(`SELECT ts.* FROM trip_summary ts
                    JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                    WHERE c.vin = ?
                    ORDER BY ts.id_summary DESC LIMIT 1`, [vin], (err, row) => resolve(row || null));
        });

        if (!latest || !latest.raport_ai_json) {
            return res.status(404).json({ eroare: "Nu există date pentru acest vehicul." });
        }

        let ai;
        try { ai = JSON.parse(latest.raport_ai_json); } catch(e) {
            return res.status(500).json({ eroare: "Datele AI sunt corupte." });
        }

        const intelligence = ai.intelligence || {};
        const predictions = (intelligence.predictions || []).filter(p => {
            const categoryMap = {
                motor: ['TERMIC', 'ADMISIE', 'MOTOR'],
                electric: ['ELECTRIC'],
                turbo: ['TURBO'],
                combustibil: ['COMBUSTIBIL', 'EMISII'],
                stil_condus: []
            };
            return (categoryMap[system] || []).includes(p.category);
        });

        const diagnostics = (intelligence.detailedExplainability || []).filter(d => {
            const systemMap = {
                motor: ['MOTOR', 'MOTOR / TRANSMISIE'],
                electric: ['BATERIE & ELECTRIC', 'BATERIE'],
                turbo: ['TURBO'],
                combustibil: ['COMBUSTIBIL', 'COMBUSTIBIL / ADMISIE'],
                stil_condus: ['COMPORTAMENT']
            };
            return (systemMap[system] || []).includes(d.system);
        });

        const reliability = (intelligence.reliability || []).filter(r => {
            const systemMap = {
                motor: ['MOTOR', 'MOTOR / TRANSMISIE'],
                electric: ['BATERIE & ELECTRIC', 'BATERIE'],
                turbo: ['TURBO'],
                combustibil: ['COMBUSTIBIL', 'COMBUSTIBIL / ADMISIE'],
                stil_condus: ['COMPORTAMENT']
            };
            return (systemMap[system] || []).includes(r.system);
        });

        // Evoluție per subsistem (ultimele 10 curse)
        const evolution = await new Promise((resolve) => {
            db.all(`SELECT ts.health_score, ts.voltaj_min, ts.voltaj_max, ts.coolant_max, ts.boost_mediu,
                           ts.maf_mediu, ts.durata_secunde, ts.created_at, c.km_parcursi
                    FROM trip_summary ts
                    JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                    WHERE c.vin = ?
                    ORDER BY ts.id_summary DESC LIMIT 10`, [vin], (err, rows) => resolve((rows || []).reverse()));
        });

        const baseline = intelligence.baseline_comparison || {};
        const correlations = intelligence.correlations || null;
        const conflicts = intelligence.conflictResolution || {};

        res.json({
            system,
            diagnostics,
            reliability,
            predictions,
            evolution,
            baseline,
            correlations,
            conflicts: conflicts.ambiguous || [],
            sensorQuality: (intelligence.sensorQuality || []).slice(0, 5)
        });

    } catch (error) {
        console.error('[HEALTH DETAIL EROARE]', error.message);
        res.status(500).json({ eroare: "Nu s-a putut încărca detaliul.", detalii: error.message });
    }
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
// ===============================================================
// ENDPOINT RAPORT LUNAR AGREGAT
// ===============================================================
app.get('/api/rapoarte/lunar/:year/:month', (req, res) => {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    const startOfMonth = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    db.all(`
        SELECT c.*, ts.health_score, ts.hard_brakes, ts.hard_accelerations, ts.nr_alerte,
               ts.nr_dtc, ts.cost_combustibil, ts.emisii_co2, ts.durata_secunde, ts.trip_tag
        FROM calatorii c
        LEFT JOIN trip_summary ts ON ts.id_calatorie = c.id_calatorie
        WHERE c.timestamp_end IS NOT NULL
          AND c.timestamp_start >= ? AND c.timestamp_start <= ?
        ORDER BY c.timestamp_start ASC
    `, [startOfMonth, endOfMonth], (err, rows) => {
        if (err) return res.status(500).json({ eroare: err.message });

        const trips = rows || [];
        const totalKm = trips.reduce((s, t) => s + (t.km_parcursi || 0), 0);
        const totalLitri = trips.reduce((s, t) => s + (t.consum_total_l || 0), 0);
        const totalCost = trips.reduce((s, t) => s + (t.cost_combustibil || 0), 0);
        const totalCO2 = trips.reduce((s, t) => s + (t.emisii_co2 || 0), 0);
        const totalDurata = trips.reduce((s, t) => s + (t.durata_secunde || 0), 0);
        const avgEco = trips.length > 0 ? Math.round(trips.reduce((s, t) => s + (t.scor_eco || 100), 0) / trips.length) : 0;
        const avgHealth = trips.filter(t => t.health_score).length > 0
            ? Math.round(trips.filter(t => t.health_score).reduce((s, t) => s + t.health_score, 0) / trips.filter(t => t.health_score).length)
            : null;

        const byTag = {};
        trips.forEach(t => {
            const tag = t.trip_tag || 'PERSONAL';
            if (!byTag[tag]) byTag[tag] = { trips: 0, km: 0, litri: 0, cost: 0 };
            byTag[tag].trips++;
            byTag[tag].km += (t.km_parcursi || 0);
            byTag[tag].litri += (t.consum_total_l || 0);
            byTag[tag].cost += (t.cost_combustibil || 0);
        });

        res.json({
            year,
            month,
            totalTrips: trips.length,
            totalKm: Number(totalKm.toFixed(2)),
            totalLitri: Number(totalLitri.toFixed(2)),
            consumMediu100: totalKm > 0 ? Number((totalLitri / totalKm * 100).toFixed(1)) : 0,
            totalCost: Number(totalCost.toFixed(2)),
            totalCO2: Number(totalCO2.toFixed(2)),
            totalDurataMin: Math.round(totalDurata / 60),
            avgEcoScore: avgEco,
            avgHealthScore: avgHealth,
            byTag,
            trips: trips.map(t => ({
                id: t.id_calatorie,
                date: t.timestamp_start,
                km: t.km_parcursi,
                litri: t.consum_total_l,
                eco: t.scor_eco,
                health: t.health_score,
                tag: t.trip_tag || 'PERSONAL'
            }))
        });
    });
});

// ===============================================================
// ENDPOINT SETARE TAG PE O CURSĂ
// ===============================================================
app.put('/api/calatorii/:id/tag', (req, res) => {
    const id = req.params.id;
    const { tag } = req.body;
    const validTags = ['BUSINESS', 'PERSONAL', 'TESTARE'];
    if (!validTags.includes(tag)) {
        return res.status(400).json({ eroare: `Tag invalid. Valori acceptate: ${validTags.join(', ')}` });
    }
    db.run(`UPDATE trip_summary SET trip_tag = ? WHERE id_calatorie = ?`, [tag, id], function(err) {
        if (err) return res.status(500).json({ eroare: err.message });
        if (this.changes === 0) return res.status(404).json({ eroare: 'Cursă negăsită' });
        res.json({ success: true, id_calatorie: id, tag });
    });
});

// ===============================================================
// AI EXPERT — Digital Twin endpoints
// ===============================================================

// GET /api/vehicul/:vin/twin — context AI Expert (toAIExpert view)
app.get('/api/vehicul/:vin/twin', async (req, res) => {
    try {
        const { vin } = req.params;
        let snapshot = await DigitalTwinSnapshot.load(db, vin);

        // Fallback: if no snapshot yet, build a minimal context from the latest trip_summary
        if (!snapshot) {
            const row = await new Promise(resolve =>
                db.get(`SELECT ts.*, c.km_parcursi, c.consum_total_l, c.consum_mediu_100km,
                               c.scor_eco, c.timestamp_start, c.timestamp_end
                        FROM trip_summary ts
                        JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                        WHERE c.vin = ? AND ts.raport_ai_json IS NOT NULL
                        ORDER BY ts.id_summary DESC LIMIT 1`,
                    [vin], (err, r) => resolve(r || null))
            );

            if (!row) {
                return res.json({
                    status: 'NO_DATA',
                    context: null,
                    suggestedQuestions: ['Cum e starea generală?', 'Pot face un drum lung?', 'Ce știi despre mașina mea?'],
                    message: 'Niciun Digital Twin disponibil. Finalizează o cursă pentru a genera analiza.'
                });
            }

            let ai = null;
            try { ai = JSON.parse(row.raport_ai_json); } catch(e) {}

            const intel      = ai?.intelligence || {};
            const litri      = (row.cost_combustibil || 0) / THRESHOLDS.DIESEL_PRICE_PER_LITER;
            const vehicle    = await new Promise(resolve =>
                db.get('SELECT * FROM vehicule WHERE vin = ?', [vin], (err, r) => resolve(r || {}))
            );

            // Build a minimal toAIExpert-compatible context from available data
            const fallbackContext = {
                identity: {
                    make:              'Audi',
                    model:             vehicle.model || 'A6 C4 2.5 TDI',
                    year:              1995,
                    fuelType:          vehicle.tip_combustibil || 'diesel',
                    engineCode:        'AEL',
                    displacementCc:    2500,
                    currentMileageKm:  null,
                    ageYears:          null,
                    emissionStandard:  'Euro 2',
                },
                capabilities: null,
                health: {
                    overallHealth: row.health_score    || null,
                    engineScore:   ai?.engine?.score   || null,
                    fuelScore:     ai?.fuel?.score     || null,
                    drivingScore:  ai?.driving?.score  || null,
                    safetyScore:   ai?.safetyScore     || null,
                    subsystems:    intel.vehicle_dna?.subsystems || null,
                    scoringMethod: 'trip_summary_fallback',
                },
                predictions:     (intel.predictions || []).filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM'),
                recommendations: (intel.recommendations || []).slice(0, 5),
                baselines:       null,
                correlated:      null,
                reliability:     intel.reliability     || null,
                sessionMetrics: {
                    distanceKm:      row.km_parcursi         || 0,
                    durationMin:     Math.round((row.durata_secunde || 0) / 60),
                    fuelLiters:      litri,
                    consumption100:  row.consum_mediu_100km  || 0,
                    ecoScore:        row.scor_eco            || 100,
                    hardBrakes:      row.hard_brakes         || 0,
                    hardAccels:      row.hard_accelerations  || 0,
                    coolantMax:      row.coolant_max         || null,
                    voltageMin:      row.voltaj_min          || null,
                    boostMax:        row.boost_max           || null,
                    dpfSootMax:      row.dpf_soot_max        || null,
                },
                historical: {
                    recentTrips: [],
                    maintenance: [],
                    milestones:  [],
                },
                trendAnalysis: null,
                reasoning:     intel.detailedExplainability || null,
                dna:           intel.vehicle_dna            || null,
            };

            return res.json({
                status:             'OK',
                context:            fallbackContext,
                suggestedQuestions: buildSuggestedQuestions(fallbackContext),
                twinMeta: {
                    savedAt:          row.timestamp_start,
                    healthScore:      row.health_score,
                    alertLevel:       'NORMAL',
                    dataCompleteness: 60,
                    isFallback:       true,
                }
            });
        }

        const context = DigitalTwinSerializer.toAIExpert(snapshot.twin);
        res.json({
            status: 'OK',
            context,
            suggestedQuestions: buildSuggestedQuestions(context),
            twinMeta: {
                savedAt:          snapshot.savedAt,
                healthScore:      snapshot.healthScore,
                alertLevel:       snapshot.alertLevel,
                dataCompleteness: snapshot.dataCompleteness
            }
        });
    } catch (err) {
        console.error('[/api/vehicul/twin]', err.message);
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

// POST /api/ai/expert/query — răspuns la întrebare în limbaj natural
app.post('/api/ai/expert/query', async (req, res) => {
    try {
        const { vin, question, history } = req.body || {};
        if (!vin || !question?.trim()) {
            return res.status(400).json({ error: '"vin" și "question" sunt obligatorii.' });
        }
        const snapshot = await DigitalTwinSnapshot.load(db, vin);
        if (!snapshot) {
            return res.json({
                answer: 'Nu am date despre vehiculul tău. Finalizează câteva curse pentru a genera o analiză.',
                confidence: 'LOW',
                intent: 'NO_DATA',
                sources: [],
                relatedQuestions: [],
                isFollowUp: false,
                topicRef: null,
            });
        }
        const context = DigitalTwinSerializer.toAIExpert(snapshot.twin);
        const { hydrateStatus, sortDocs } = require('./backend/vehicle-profile/DocumentsModule');
        const documents = await new Promise(resolve => {
            db.get(`SELECT id FROM vehicles WHERE vin = ?`, [vin], (err, row) => {
                if (err || !row) return resolve([]);
                db.all(`SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC`,
                    [row.id], (e2, rows) => resolve(sortDocs(hydrateStatus(rows || []))));
            });
        });
        context.documents = documents;
        const result = answerWithContext(question, context, history || []);
        res.json({ ...result, twinSavedAt: snapshot.savedAt });
    } catch (err) {
        console.error('[/api/ai/expert/query]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/vehicles/:id/summary — JSON complet din Digital Twin (notifications, search, dashboard)
app.get('/api/vehicles/:id/summary', async (req, res) => {
    try {
        const vehicleId = req.params.id;

        const vehicle = await new Promise((resolve, reject) => {
            db.get('SELECT vin FROM vehicles WHERE id = ?', [vehicleId], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
        if (!vehicle) return res.status(404).json({ error: 'Vehicul negăsit.' });

        const { vin } = vehicle;

        const snapshot = await DigitalTwinSnapshot.load(db, vin);
        if (!snapshot) return res.status(404).json({ error: 'Nu există date. Finalizează o cursă mai întâi.' });

        const pdfData  = DigitalTwinSerializer.toPDF(snapshot.twin);

        const timeline = await new Promise((resolve) => {
            db.all(
                `SELECT category, title, description, icon, event_date, mileage_km
                 FROM vehicle_timeline WHERE vehicle_id = ? ORDER BY event_date DESC LIMIT 40`,
                [vehicleId], (err, rows) => resolve(err ? [] : (rows || []))
            );
        });

        const stats = await new Promise((resolve) => {
            db.get(
                `SELECT COUNT(*) AS total_calatorii,
                        COALESCE(SUM(km_parcursi), 0) AS total_km,
                        COALESCE(SUM(combustibil_consumat_l), 0) AS total_combustibil
                 FROM calatorii WHERE vin = ?`,
                [vin], (err, row) => resolve(err ? {} : (row || {}))
            );
        });

        const { hydrateStatus, sortDocs } = require('./backend/vehicle-profile/DocumentsModule');
        const documents = await new Promise((resolve) => {
            db.all(
                `SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC`,
                [vehicleId], (err, rows) => resolve(sortDocs(hydrateStatus(rows || [])))
            );
        });

        res.json({ ...pdfData, timeline, stats, documents, lastSyncAt: snapshot.savedAt });
    } catch (err) {
        console.error('[/api/vehicles/:id/summary]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/vehicles/:id/report/pdf — raport PDF complet bazat pe Digital Twin
app.get('/api/vehicles/:id/report/pdf', async (req, res) => {
    try {
        const vehicleId = req.params.id;

        // Resolve VIN from vehicle ID
        const vehicle = await new Promise((resolve, reject) => {
            db.get('SELECT vin, make, model, year, fuel_type FROM vehicles WHERE id = ?', [vehicleId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (!vehicle) return res.status(404).json({ error: 'Vehicul negăsit.' });

        const { vin } = vehicle;

        // Load Digital Twin snapshot
        const snapshot = await DigitalTwinSnapshot.load(db, vin);
        if (!snapshot) {
            return res.status(404).json({
                error: 'Nu există date suficiente. Finalizează cel puțin o cursă pentru a genera raportul.',
            });
        }

        // Primary data via DigitalTwinSerializer
        const pdfData = DigitalTwinSerializer.toPDF(snapshot.twin);

        // Supplementary: timeline events
        const timeline = await new Promise((resolve) => {
            db.all(
                `SELECT category, title, description, icon, event_date, mileage_km
                 FROM vehicle_timeline
                 WHERE vehicle_id = ?
                 ORDER BY event_date DESC
                 LIMIT 40`,
                [vehicleId],
                (err, rows) => resolve(err ? [] : (rows || []))
            );
        });

        // Supplementary: recent service sessions
        const services = await new Promise((resolve) => {
            db.all(
                `SELECT title, performed_at, mileage_km, cost_total, workshop_name
                 FROM service_sessions
                 WHERE vehicle_id = ?
                 ORDER BY performed_at DESC
                 LIMIT 10`,
                [vehicleId],
                (err, rows) => resolve(err ? [] : (rows || []))
            );
        });

        // Supplementary: vehicle documents
        const { hydrateStatus: _hydrate, sortDocs: _sort } = require('./backend/vehicle-profile/DocumentsModule');
        const documents = await new Promise((resolve) => {
            db.all(
                `SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC`,
                [vehicleId], (err, rows) => resolve(_sort(_hydrate(rows || [])))
            );
        });

        // Supplementary: aggregate trip stats
        const stats = await new Promise((resolve) => {
            db.get(
                `SELECT
                    COUNT(*) AS total_calatorii,
                    COALESCE(SUM(km_parcursi), 0) AS total_km,
                    COALESCE(SUM(combustibil_consumat_l), 0) AS total_combustibil
                 FROM calatorii WHERE vin = ?`,
                [vin],
                (err, row) => resolve(err ? {} : (row || {}))
            );
        });

        // Supplementary: total service costs
        const costs = await new Promise((resolve) => {
            db.get(
                `SELECT COALESCE(SUM(cost_total), 0) AS service
                 FROM service_sessions WHERE vin = ?`,
                [vin],
                (err, row) => resolve(err ? {} : (row || {}))
            );
        });

        const fileName = `raport_${vin}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const generator = new PDFReportGenerator(pdfData, { timeline, services, stats, costs, documents });
        generator.generate(res);

    } catch (err) {
        console.error('[/api/vehicles/:id/report/pdf]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// ===============================================================
// EXPORT CSV — date brute telemetrie pentru o cursă
// ===============================================================
app.get('/api/calatorii/:id/export/csv', (req, res) => {
    const id = req.params.id;

    db.get(`SELECT c.id_calatorie, c.vin, c.km_parcursi, c.scor_eco, c.timestamp_start, c.timestamp_end
            FROM calatorii c WHERE c.id_calatorie = ?`, [id], (err, trip) => {
        if (err || !trip) return res.status(404).json({ eroare: 'Cursa nu există.' });

        db.all(`SELECT * FROM telemetrie_flux WHERE id_calatorie = ? ORDER BY timestamp ASC`, [id], (err2, rows) => {
            if (err2) return res.status(500).json({ eroare: err2.message });
            if (!rows || rows.length === 0) {
                return res.status(404).json({ eroare: 'Nu există date telemetrie pentru această cursă.' });
            }

            // Flatten nested object to dot-notation keys
            function flatObj(obj, prefix = '') {
                if (!obj || typeof obj !== 'object') return {};
                return Object.entries(obj).reduce((acc, [k, v]) => {
                    const key = prefix ? `${prefix}.${k}` : k;
                    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
                        Object.assign(acc, flatObj(v, key));
                    } else {
                        acc[key] = v;
                    }
                    return acc;
                }, {});
            }

            // Fixed columns from telemetrie_flux table
            const FIXED_COLS = ['timestamp', 'rpm', 'viteza_kmh', 'sarcina_pct', 'maf_gs', 'map_kpa',
                'voltaj_v', 'temp_apa_c', 'temp_ulei_c', 'accel_g', 'consum_lh', 'boost_bar',
                'dpf_soot', 'gear', 'torque_nm'];

            // Collect all JSON keys across all rows
            const jsonKeySet = new Set();
            const parsedRows = rows.map(row => {
                let flat = {};
                if (row.matrice_completa_json) {
                    try { flat = flatObj(JSON.parse(row.matrice_completa_json)); }
                    catch(e) {}
                }
                Object.keys(flat).forEach(k => jsonKeySet.add(k));
                return { ...row, _json: flat };
            });

            const JSON_COLS = [...jsonKeySet].sort();
            const ALL_COLS  = [...FIXED_COLS, ...JSON_COLS];

            // Escape a CSV cell value
            const esc = v => {
                if (v === null || v === undefined) return '';
                const s = String(v);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return `"${s.replace(/"/g, '""')}"`;
                }
                return s;
            };

            // Build CSV
            const header = ALL_COLS.join(',');
            const csvRows = parsedRows.map(row => {
                return ALL_COLS.map(col => {
                    if (FIXED_COLS.includes(col)) return esc(row[col]);
                    return esc(row._json[col]);
                }).join(',');
            });

            const metaComment = [
                `# Cursă #${id} · VIN: ${trip.vin}`,
                `# Start: ${trip.timestamp_start ? new Date(trip.timestamp_start).toISOString() : '-'}`,
                `# Stop:  ${trip.timestamp_end   ? new Date(trip.timestamp_end).toISOString()   : '-'}`,
                `# Distanță: ${(trip.km_parcursi || 0).toFixed(2)} km · Eco Score: ${trip.scor_eco || '-'}`,
                `# Randuri: ${rows.length} · Coloane: ${ALL_COLS.length}`,
                '',
            ].join('\n');

            const csv = metaComment + header + '\n' + csvRows.join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="telemetrie_cursa_${id}.csv"`);
            res.send('﻿' + csv);
        });
    });
});

// ===============================================================
// LISTA VEHICULE — pentru switcher multi-vehicul
// ===============================================================
app.get('/api/vehicule/list', (req, res) => {
    db.all(`SELECT vin, model, tip_combustibil, capacitate_rezervor_l FROM vehicule ORDER BY rowid ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ eroare: err.message });
        res.json(rows || []);
    });
});

// ===============================================================
// PDF PER CURSĂ — generează și trimite raportul ca fișier PDF
// ===============================================================
app.get('/api/calatorii/:id/report/pdf', (req, res) => {
    const id = req.params.id;
    // LEFT JOIN so we return a PDF even when trip_summary is missing
    db.get(`SELECT c.id_calatorie, c.vin, c.km_parcursi, c.consum_total_l, c.consum_mediu_100km,
                   c.scor_eco, c.timestamp_start, c.timestamp_end,
                   ts.health_score, ts.durata_secunde, ts.viteza_max, ts.rpm_max,
                   ts.coolant_max, ts.boost_max, ts.voltaj_min, ts.voltaj_max,
                   ts.hard_brakes, ts.hard_accelerations, ts.cost_combustibil,
                   ts.emisii_co2, ts.raport_ai_json
            FROM calatorii c
            LEFT JOIN trip_summary ts ON c.id_calatorie = ts.id_calatorie
            WHERE c.id_calatorie = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ eroare: 'Cursa nu există.' });

        let ai = null;
        if (row.raport_ai_json) {
            try { ai = JSON.parse(row.raport_ai_json); } catch(e) {}
        }

        const intelligence  = ai?.intelligence || {};
        const litriTotali   = (row.cost_combustibil || 0) / THRESHOLDS.DIESEL_PRICE_PER_LITER;
        const durationMin   = Math.round((row.durata_secunde || 0) / 60);
        const startDate     = row.timestamp_start ? new Date(row.timestamp_start).toLocaleString('ro-RO') : '—';
        const predictions   = (intelligence.predictions || []).filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 3);

        try {
            const PDFDocument = require('pdfkit');
            const chunks      = [];
            const doc         = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

            doc.on('data',  chunk => chunks.push(chunk));
            doc.on('error', err  => {
                console.error('[PDF] generation error:', err.message);
                if (!res.headersSent) res.status(500).json({ eroare: 'Eroare internă la generarea PDF.' });
            });
            doc.on('end', () => {
                const buf = Buffer.concat(chunks);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="cursa_${id}.pdf"`);
                res.setHeader('Content-Length', buf.length);
                res.send(buf);
            });

            // Title bar
            doc.rect(50, 50, 495, 44).fill('#1A1A2E');
            doc.fillColor('#FFFFFF').fontSize(16).text(`Raport Cursă #${id}`, 60, 62, { lineBreak: false });
            doc.fillColor('#AAAAAA').fontSize(9).text(startDate, { align: 'right' });
            doc.moveDown(2);

            // Stats
            doc.fillColor('#1A1A2E').fontSize(12).text('STATISTICI', { underline: true });
            doc.moveDown(0.4).fillColor('#333333').fontSize(10);
            doc.text(`Distanta:          ${(row.km_parcursi || 0).toFixed(2)} km`);
            doc.text(`Durata:            ${durationMin} minute`);
            doc.text(`Combustibil:       ${litriTotali.toFixed(2)} L`);
            const cons100 = row.consum_mediu_100km > 0 ? row.consum_mediu_100km.toFixed(1)
                : (row.km_parcursi > 0.1 ? (litriTotali / row.km_parcursi * 100).toFixed(1) : '-');
            doc.text(`Consum mediu:      ${cons100} L/100km`);
            doc.text(`Cost estimat:      ${(row.cost_combustibil || 0).toFixed(2)} RON`);
            doc.text(`Emisii CO2:        ${(row.emisii_co2 || 0).toFixed(2)} kg`);
            doc.text(`Eco Score:         ${row.scor_eco || 100}/100`);
            if (row.health_score) doc.text(`Health Score:      ${row.health_score}%`);
            doc.moveDown(1);

            // Driving style
            doc.fillColor('#1A1A2E').fontSize(12).text('STIL DE CONDUS', { underline: true });
            doc.moveDown(0.4).fillColor('#333333').fontSize(10);
            const ds = ai?.driving?.style || {};
            doc.text(`Condus lin:        ${Math.round(ds.smoothPct || 0)}%`);
            doc.text(`Condus economic:   ${Math.round(ds.economicPct || 0)}%`);
            doc.text(`Condus agresiv:    ${Math.round(ds.aggressivePct || 0)}%`);
            doc.text(`Franari bruste:    ${row.hard_brakes || 0}`);
            doc.text(`Accelerari bruste: ${row.hard_accelerations || 0}`);
            doc.moveDown(1);

            // Predictions
            if (predictions.length > 0) {
                doc.fillColor('#1A1A2E').fontSize(12).text('PREDICTII AI', { underline: true });
                doc.moveDown(0.4).fillColor('#333333').fontSize(10);
                predictions.forEach(p => {
                    doc.text(`[${p.severity}] ${p.title || ''}: ${p.description || ''}`);
                });
                doc.moveDown(1);
            }

            // Peak values
            doc.fillColor('#1A1A2E').fontSize(12).text('VALORI DE VARF', { underline: true });
            doc.moveDown(0.4).fillColor('#333333').fontSize(10);
            if (row.viteza_max)  doc.text(`Viteza max:        ${row.viteza_max} km/h`);
            if (row.rpm_max)     doc.text(`RPM max:           ${row.rpm_max}`);
            if (row.coolant_max) doc.text(`Temp. racire max:  ${row.coolant_max} C`);
            if (row.boost_max > 0) doc.text(`Boost max:       ${row.boost_max.toFixed(2)} bar`);
            if (row.voltaj_min)  doc.text(`Tensiune min/max:  ${row.voltaj_min} / ${row.voltaj_max || '-'} V`);
            doc.moveDown(2);

            doc.fillColor('#AAAAAA').fontSize(8)
                .text(`Generat de OBD-II Monitor  |  VIN: ${row.vin || '-'}  |  Audi A6 C4`, { align: 'center' });

            doc.end();
        } catch (pdfErr) {
            console.error('[PDF] unexpected error:', pdfErr.message);
            if (!res.headersSent) res.status(500).json({ eroare: 'Eroare la generarea PDF: ' + pdfErr.message });
        }
    });
});

// POST /admin/reset-db — șterge toate datele (curse, telemetrie, analize)
// Profilul vehiculului (vehicule) și structura DB rămân intacte.
app.post('/admin/reset-db', (req, res) => {
    const tables = [
        'digital_twin_snapshots', 'trip_summary', 'dtc_events',
        'telemetrie_flux', 'calatorii',
    ];
    db.serialize(() => {
        let errors = [];
        const run = (i) => {
            if (i >= tables.length) {
                if (errors.length) return res.status(500).json({ eroare: errors.join(', ') });
                return res.json({ ok: true, mesaj: `${tables.length} tabele resetate.` });
            }
            db.run(`DELETE FROM ${tables[i]}`, (err) => {
                if (err) errors.push(tables[i]);
                run(i + 1);
            });
        };
        run(0);
    });
});

server.listen(3000, () => console.log(`[API REST & WS] Serverul funcționează pe http://localhost:3000`));