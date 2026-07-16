/**
 * Vehicle Profile — Routes
 * CRUD complet + logică inteligentă de recalculare
 */

const { decodeVin, validateVin } = require('./VinDecoder');
const { seedMaintenanceItems, recalculateAllItems, onServiceAdded, getEstimatedOdometer } = require('./MaintenanceCalculator');
const { vehicleEventBus } = require('./EventBus');
const { hydrateStatus, sortDocs } = require('./DocumentsModule');

// Service type -> event type mapping
const SERVICE_EVENT_MAP = {
    'OIL_CHANGE': 'OIL_CHANGED',
    'FILTER_OIL': 'FILTER_REPLACED',
    'FILTER_AIR': 'FILTER_REPLACED',
    'FILTER_FUEL': 'FILTER_REPLACED',
    'FILTER_CABIN': 'FILTER_REPLACED',
    'BATTERY_REPLACE': 'BATTERY_REPLACED',
    'TIMING_BELT': 'TIMING_BELT_REPLACED',
    'BRAKE_PADS_FRONT': 'BRAKE_SERVICE',
    'BRAKE_PADS_REAR': 'BRAKE_SERVICE',
    'BRAKE_DISCS_FRONT': 'BRAKE_SERVICE',
    'BRAKE_DISCS_REAR': 'BRAKE_SERVICE',
};

function registerVehicleProfileRoutes(app, db) {

    // =============================================================
    // VIN DECODER
    // =============================================================
    app.get('/api/vin/decode/:vin', (req, res) => {
        const result = decodeVin(req.params.vin);
        res.json(result);
    });

    // =============================================================
    // VEHICLES — CRUD
    // =============================================================

    // GET toate vehiculele
    app.get('/api/vehicles', (req, res) => {
        db.all(`SELECT * FROM vehicles ORDER BY created_at DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });

    // GET vehicul individual (cu odometru estimat)
    app.get('/api/vehicles/:id', async (req, res) => {
        try {
            const vehicle = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM vehicles WHERE id = ?`, [req.params.id], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });
            if (!vehicle) return res.status(404).json({ error: 'Vehicul negasit' });

            const odometer = await getEstimatedOdometer(db, vehicle.id);
            res.json({ ...vehicle, estimated_odometer_km: odometer });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET vehicul by VIN
    app.get('/api/vehicles/vin/:vin', async (req, res) => {
        try {
            const vehicle = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM vehicles WHERE vin = ?`, [req.params.vin.toUpperCase()], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });
            if (!vehicle) return res.status(404).json({ error: 'Vehicul negasit' });

            const odometer = await getEstimatedOdometer(db, vehicle.id);
            res.json({ ...vehicle, estimated_odometer_km: odometer });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST creare vehicul (cu VIN decode + seed maintenance items)
    app.post('/api/vehicles', (req, res) => {
        const data = req.body;
        const validation = validateVin(data.vin);
        if (!validation.valid) return res.status(400).json({ error: validation.error });

        const vin = validation.vin;

        // Auto-decode VIN pentru campuri lipsa
        const decoded = decodeVin(vin);

        const vehicle = {
            vin,
            make: data.make || decoded.make || null,
            model: data.model || decoded.model || null,
            variant: data.variant || decoded.variant || null,
            year: data.year || decoded.year || null,
            color: data.color || null,
            plate_number: data.plate_number || null,
            engine_code: data.engine_code || null,
            displacement_cc: data.displacement_cc || null,
            power_kw: data.power_kw || null,
            power_hp: data.power_hp || null,
            torque_nm: data.torque_nm || null,
            cylinders: data.cylinders || null,
            fuel_type: data.fuel_type || null,
            fuel_tank_liters: data.fuel_tank_liters || null,
            transmission: data.transmission || null,
            gears: data.gears || null,
            drivetrain: data.drivetrain || null,
            emission_standard: data.emission_standard || null,
            co2_gkm: data.co2_gkm || null,
            purchase_date: data.purchase_date || null,
            purchase_mileage_km: data.purchase_mileage_km || null,
            purchase_price: data.purchase_price || null,
            oil_capacity_liters: data.oil_capacity_liters || null,
            oil_spec: data.oil_spec || null,
            coolant_capacity_liters: data.coolant_capacity_liters || null,
            timing_belt_interval_km: data.timing_belt_interval_km || null,
            spark_plug_interval_km: data.spark_plug_interval_km || null,
            custom_json: data.custom_json ? JSON.stringify(data.custom_json) : null,
        };

        const columns = Object.keys(vehicle);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(c => vehicle[c]);

        db.run(
            `INSERT INTO vehicles (${columns.join(', ')}) VALUES (${placeholders})`,
            values,
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(409).json({ error: 'Un vehicul cu acest VIN exista deja' });
                    }
                    return res.status(500).json({ error: err.message });
                }

                const vehicleId = this.lastID;

                // Seed maintenance items cu intervalele default
                seedMaintenanceItems(db, vehicleId, vehicle);

                // Add initial mileage if provided
                if (data.purchase_mileage_km) {
                    const now = Math.floor(Date.now() / 1000);
                    db.run(`
                        INSERT INTO mileage_log (vehicle_id, odometer_km, source, recorded_at, note)
                        VALUES (?, ?, 'MANUAL', ?, 'Kilometraj la achizitie')
                    `, [vehicleId, data.purchase_mileage_km, data.purchase_date || now]);
                }

                vehicleEventBus.emit('VEHICLE_CREATED', {
                    vehicle_id: vehicleId,
                    source: 'USER',
                    make: vehicle.make,
                    model: vehicle.model,
                    variant: vehicle.variant,
                    year: vehicle.year,
                    vin,
                    mileage_km: data.purchase_mileage_km || null,
                });

                // Sync în tabelul `vehicule` folosit de pipeline-ul MQTT
                // (INSERT OR IGNORE — dacă e deja acolo din MQTT, nu suprascrie)
                const modelLabel = [vehicle.make, vehicle.model, vehicle.variant, vehicle.year]
                    .filter(Boolean).join(' ') || 'Vehicul';
                const fuelForMqtt = (vehicle.fuel_type || 'diesel').toLowerCase();
                db.run(
                    `INSERT OR IGNORE INTO vehicule (vin, model, tip_combustibil) VALUES (?, ?, ?)`,
                    [vin, modelLabel, fuelForMqtt]
                );

                console.log(`[VEHICLE PROFILE] Vehicul creat: ${vin} (${vehicle.make} ${vehicle.model}) — ID ${vehicleId}`);
                res.status(201).json({ id: vehicleId, ...vehicle, vin_decoded: decoded });
            }
        );
    });

    // PUT actualizare vehicul
    app.put('/api/vehicles/:id', (req, res) => {
        const data = req.body;
        const now = Math.floor(Date.now() / 1000);

        const updatableFields = [
            'make', 'model', 'variant', 'year', 'color', 'plate_number',
            'engine_code', 'displacement_cc', 'power_kw', 'power_hp', 'torque_nm',
            'cylinders', 'fuel_type', 'fuel_tank_liters', 'transmission', 'gears',
            'drivetrain', 'emission_standard', 'co2_gkm', 'purchase_date',
            'purchase_mileage_km', 'purchase_price', 'oil_capacity_liters', 'oil_spec',
            'coolant_capacity_liters', 'timing_belt_interval_km', 'spark_plug_interval_km',
            'custom_json'
        ];

        const sets = [];
        const values = [];

        updatableFields.forEach(field => {
            if (data[field] !== undefined) {
                sets.push(`${field} = ?`);
                values.push(field === 'custom_json' ? JSON.stringify(data[field]) : data[field]);
            }
        });

        if (sets.length === 0) return res.status(400).json({ error: 'Niciun camp de actualizat' });

        sets.push('updated_at = ?');
        values.push(now);
        values.push(req.params.id);

        db.run(
            `UPDATE vehicles SET ${sets.join(', ')} WHERE id = ?`,
            values,
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Vehicul negasit' });

                vehicleEventBus.emit('VEHICLE_UPDATED', {
                    vehicle_id: parseInt(req.params.id),
                    source: 'USER',
                    fields_updated: Object.keys(data).filter(k => data[k] !== undefined),
                });

                res.json({ success: true, id: parseInt(req.params.id) });
            }
        );
    });

    // DELETE vehicul
    app.delete('/api/vehicles/:id', (req, res) => {
        const id = req.params.id;
        db.run(`DELETE FROM maintenance_items WHERE vehicle_id = ?`, [id]);
        db.run(`DELETE FROM service_history WHERE vehicle_id = ?`, [id]);
        db.run(`DELETE FROM mileage_log WHERE vehicle_id = ?`, [id]);
        db.run(`DELETE FROM workshops WHERE vehicle_id = ?`, [id]);
        db.run(`DELETE FROM vehicles WHERE id = ?`, [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Vehicul negasit' });
            res.json({ success: true });
        });
    });

    // =============================================================
    // MILEAGE LOG
    // =============================================================

    // GET istoricul km
    app.get('/api/vehicles/:id/mileage', (req, res) => {
        db.all(`
            SELECT * FROM mileage_log WHERE vehicle_id = ?
            ORDER BY recorded_at DESC LIMIT 50
        `, [req.params.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });

    // POST adaugare km (declanseaza recalculare)
    app.post('/api/vehicles/:id/mileage', async (req, res) => {
        const { odometer_km, source, note } = req.body;
        const vehicleId = req.params.id;
        const now = Math.floor(Date.now() / 1000);

        if (!odometer_km || odometer_km < 0) {
            return res.status(400).json({ error: 'odometer_km este obligatoriu si pozitiv' });
        }

        db.run(`
            INSERT INTO mileage_log (vehicle_id, odometer_km, source, recorded_at, note)
            VALUES (?, ?, ?, ?, ?)
        `, [vehicleId, odometer_km, source || 'MANUAL', now, note || null], async function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // Recalculate all maintenance items with new odometer
            const results = await recalculateAllItems(db, vehicleId);

            vehicleEventBus.emit('ODOMETER_UPDATED', {
                vehicle_id: parseInt(vehicleId),
                source: source || 'MANUAL',
                odometer_km,
                mileage_km: odometer_km,
            });

            // Emit maintenance alerts if status changed
            results.forEach(item => {
                if (item.status === 'DUE_SOON') {
                    vehicleEventBus.emit('MAINTENANCE_DUE_SOON', {
                        vehicle_id: parseInt(vehicleId),
                        source: 'SYSTEM',
                        item_type: item.item_type,
                        item_name: item.item_type,
                        remaining_km: item.remaining_km,
                        remaining_days: item.remaining_days,
                    });
                } else if (item.status === 'OVERDUE') {
                    vehicleEventBus.emit('MAINTENANCE_OVERDUE', {
                        vehicle_id: parseInt(vehicleId),
                        source: 'SYSTEM',
                        item_type: item.item_type,
                        item_name: item.item_type,
                        remaining_km: item.remaining_km,
                    });
                }
            });

            res.status(201).json({
                id: this.lastID,
                odometer_km,
                maintenance_recalculated: results.length,
                items: results
            });
        });
    });

    // =============================================================
    // WORKSHOPS
    // =============================================================

    app.get('/api/vehicles/:id/workshops', (req, res) => {
        db.all(`SELECT * FROM workshops WHERE vehicle_id = ? ORDER BY is_trusted DESC, name ASC`,
            [req.params.id], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows || []);
            });
    });

    app.post('/api/vehicles/:id/workshops', (req, res) => {
        const { name, address, phone, specialization, rating, is_trusted, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'name este obligatoriu' });

        db.run(`
            INSERT INTO workshops (vehicle_id, name, address, phone, specialization, rating, is_trusted, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.params.id, name, address, phone, specialization || 'GENERAL', rating, is_trusted || 0, notes],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, name });
        });
    });

    app.put('/api/workshops/:id', (req, res) => {
        const { name, address, phone, specialization, rating, is_trusted, notes } = req.body;
        db.run(`
            UPDATE workshops SET name=COALESCE(?,name), address=COALESCE(?,address),
                phone=COALESCE(?,phone), specialization=COALESCE(?,specialization),
                rating=COALESCE(?,rating), is_trusted=COALESCE(?,is_trusted), notes=COALESCE(?,notes)
            WHERE id = ?
        `, [name, address, phone, specialization, rating, is_trusted, notes, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Workshop negasit' });
            res.json({ success: true });
        });
    });

    app.delete('/api/workshops/:id', (req, res) => {
        db.run(`DELETE FROM workshops WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Workshop negasit' });
            res.json({ success: true });
        });
    });

    // =============================================================
    // SERVICE SESSIONS (o vizita = N operatiuni)
    // =============================================================

    // GET toate sesiunile de service (cu items incluse)
    app.get('/api/vehicles/:id/services', (req, res) => {
        const vehicleId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;

        db.all(`
            SELECT ss.*, w.name as workshop_display_name
            FROM service_sessions ss
            LEFT JOIN workshops w ON w.id = ss.workshop_id
            WHERE ss.vehicle_id = ?
            ORDER BY ss.performed_at DESC LIMIT ?
        `, [vehicleId, limit], (err, sessions) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!sessions || sessions.length === 0) return res.json([]);

            const sessionIds = sessions.map(s => s.id);
            const placeholders = sessionIds.map(() => '?').join(',');

            db.all(`SELECT * FROM service_items WHERE session_id IN (${placeholders})`,
                sessionIds, (err, items) => {
                    const itemsBySession = {};
                    (items || []).forEach(item => {
                        if (!itemsBySession[item.session_id]) itemsBySession[item.session_id] = [];
                        itemsBySession[item.session_id].push(item);
                    });

                    const result = sessions.map(s => ({
                        ...s,
                        items: itemsBySession[s.id] || []
                    }));

                    res.json(result);
                });
        });
    });

    // POST creare sesiune de service (cu multiple operatiuni)
    // Body: { performed_at, mileage_km, workshop_id?, workshop_name?, cost_total?, cost_parts?, cost_labor?,
    //         title?, notes?, items: [{service_type, description?, cost?, next_due_km?, next_due_date?}] }
    app.post('/api/vehicles/:id/services', async (req, res) => {
        const vehicleId = req.params.id;
        const data = req.body;

        if (!data.performed_at) return res.status(400).json({ error: 'performed_at este obligatoriu' });
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            return res.status(400).json({ error: 'items este obligatoriu (array cu cel putin o operatiune)' });
        }

        // Verify vehicle exists
        const vehicle = await new Promise((resolve) => {
            db.get(`SELECT * FROM vehicles WHERE id = ?`, [vehicleId], (err, row) => resolve(row));
        });
        if (!vehicle) return res.status(404).json({ error: 'Vehicul negasit' });

        // Create session
        const sessionId = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO service_sessions
                    (vehicle_id, performed_at, mileage_km, workshop_id, workshop_name,
                     cost_total, cost_parts, cost_labor, currency, title, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                vehicleId, data.performed_at, data.mileage_km || null,
                data.workshop_id || null, data.workshop_name || null,
                data.cost_total || null, data.cost_parts || null, data.cost_labor || null,
                data.currency || 'RON',
                data.title || null, data.notes || null
            ], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });

        // Insert items and trigger recalculations
        const recalcResults = [];
        for (const item of data.items) {
            if (!item.service_type) continue;

            const itemId = await new Promise((resolve) => {
                db.run(`
                    INSERT INTO service_items (session_id, vehicle_id, service_type, description, cost, next_due_km, next_due_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [sessionId, vehicleId, item.service_type, item.description || null,
                    item.cost || null, item.next_due_km || null, item.next_due_date || null],
                function(err) { resolve(err ? null : this.lastID); });
            });

            if (!itemId) continue;

            // Get interval for this type
            const maintenanceItem = await new Promise((resolve) => {
                db.get(`SELECT interval_km FROM maintenance_items WHERE vehicle_id = ? AND item_type = ?`,
                    [vehicleId, item.service_type], (err, row) => resolve(row));
            });

            // Trigger recalculation per item
            const recalcResult = await onServiceAdded(db, vehicleId, {
                id: itemId,
                service_type: item.service_type,
                performed_at: data.performed_at,
                mileage_km: data.mileage_km,
                next_due_km: item.next_due_km || (data.mileage_km && maintenanceItem ? data.mileage_km + maintenanceItem.interval_km : null),
                next_due_date: item.next_due_date,
                interval_km: maintenanceItem?.interval_km,
            });

            recalcResults.push(recalcResult);

            // Emit specific event per item
            const specificEvent = SERVICE_EVENT_MAP[item.service_type] || 'SERVICE_ADDED';
            vehicleEventBus.emit(specificEvent, {
                vehicle_id: parseInt(vehicleId),
                source: 'USER',
                service_type: item.service_type,
                mileage_km: data.mileage_km,
                cost_total: item.cost,
                workshop_name: data.workshop_name,
                filter_name: item.description,
                title: data.title || item.description,
                reference_type: 'SERVICE_SESSION',
                reference_id: sessionId,
            });
        }

        // Add mileage log for the session
        if (data.mileage_km) {
            db.run(`
                INSERT INTO mileage_log (vehicle_id, odometer_km, source, recorded_at, note)
                VALUES (?, ?, 'SERVICE', ?, ?)
            `, [vehicleId, data.mileage_km, data.performed_at, data.title || 'Service session']);
        }

        const itemTypes = data.items.map(i => i.service_type).join(', ');
        console.log(`[VEHICLE PROFILE] Service session: [${itemTypes}] @ ${data.mileage_km || '?'} km — vehicul ${vehicleId}`);

        res.status(201).json({
            id: sessionId,
            items_count: data.items.length,
            maintenance_updated: recalcResults.filter(Boolean),
        });
    });

    // DELETE service session (cascade deletes items)
    app.delete('/api/services/:id', (req, res) => {
        db.run(`DELETE FROM service_items WHERE session_id = ?`, [req.params.id]);
        db.run(`DELETE FROM service_sessions WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Sesiune negasita' });
            res.json({ success: true });
        });
    });

    // =============================================================
    // COST DASHBOARD
    // =============================================================
    app.get('/api/vehicles/:id/costs', (req, res) => {
        const vehicleId = req.params.id;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const startOfYear = Math.floor(new Date(year, 0, 1).getTime() / 1000);
        const endOfYear = Math.floor(new Date(year, 11, 31, 23, 59, 59).getTime() / 1000);

        db.all(`
            SELECT ss.performed_at, ss.cost_total, ss.cost_parts, ss.cost_labor, ss.title,
                   GROUP_CONCAT(si.service_type) as service_types
            FROM service_sessions ss
            LEFT JOIN service_items si ON si.session_id = ss.id
            WHERE ss.vehicle_id = ? AND ss.performed_at >= ? AND ss.performed_at <= ?
            GROUP BY ss.id
            ORDER BY ss.performed_at DESC
        `, [vehicleId, startOfYear, endOfYear], (err, sessions) => {
            if (err) return res.status(500).json({ error: err.message });

            const totalService = (sessions || []).reduce((s, r) => s + (r.cost_total || 0), 0);
            const totalParts = (sessions || []).reduce((s, r) => s + (r.cost_parts || 0), 0);
            const totalLabor = (sessions || []).reduce((s, r) => s + (r.cost_labor || 0), 0);

            // Fuel costs (from calatorii if available)
            db.get(`
                SELECT vin FROM vehicles WHERE id = ?
            `, [vehicleId], (err, vehicle) => {
                if (!vehicle) return res.json({ year, service: totalService, parts: totalParts, labor: totalLabor, fuel: 0, total: totalService });

                db.get(`
                    SELECT COALESCE(SUM(ts.cost_combustibil), 0) as fuel_cost
                    FROM trip_summary ts
                    JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                    WHERE c.vin = ? AND ts.created_at >= ? AND ts.created_at <= ?
                `, [vehicle.vin, startOfYear, endOfYear], (err, fuelRow) => {
                    const fuelCost = fuelRow?.fuel_cost || 0;

                    res.json({
                        year,
                        service: Number(totalService.toFixed(2)),
                        parts: Number(totalParts.toFixed(2)),
                        labor: Number(totalLabor.toFixed(2)),
                        fuel: Number(fuelCost.toFixed(2)),
                        total: Number((totalService + fuelCost).toFixed(2)),
                        sessions: (sessions || []).map(s => ({
                            date: s.performed_at,
                            cost: s.cost_total,
                            title: s.title,
                            types: s.service_types ? s.service_types.split(',') : [],
                        })),
                    });
                });
            });
        });
    });

    // =============================================================
    // MAINTENANCE ITEMS
    // =============================================================

    // GET toate items (starea curenta a mentenantei)
    app.get('/api/vehicles/:id/maintenance', async (req, res) => {
        const vehicleId = req.params.id;

        try {
            // Recalculate before returning
            await recalculateAllItems(db, vehicleId);

            db.all(`
                SELECT mi.*, si.description as last_service_description,
                       ss.performed_at as last_service_performed_at
                FROM maintenance_items mi
                LEFT JOIN service_items si ON si.id = mi.last_service_id
                LEFT JOIN service_sessions ss ON ss.id = si.session_id
                WHERE mi.vehicle_id = ?
                ORDER BY
                    CASE mi.status
                        WHEN 'OVERDUE' THEN 1
                        WHEN 'DUE_SOON' THEN 2
                        WHEN 'OK' THEN 3
                        WHEN 'UNKNOWN' THEN 4
                    END,
                    mi.wear_percent DESC
            `, [vehicleId], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows || []);
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT actualizare interval custom pentru un item
    app.put('/api/vehicles/:id/maintenance/:itemType', (req, res) => {
        const { interval_km, interval_months, item_name } = req.body;
        const now = Math.floor(Date.now() / 1000);

        const sets = ['updated_at = ?'];
        const values = [now];

        if (interval_km !== undefined) { sets.push('interval_km = ?'); values.push(interval_km); }
        if (interval_months !== undefined) { sets.push('interval_months = ?'); values.push(interval_months); }
        if (item_name !== undefined) { sets.push('item_name = ?'); values.push(item_name); }

        values.push(req.params.id, req.params.itemType);

        db.run(
            `UPDATE maintenance_items SET ${sets.join(', ')} WHERE vehicle_id = ? AND item_type = ?`,
            values,
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Item negasit' });
                res.json({ success: true });
            }
        );
    });

    // =============================================================
    // VEHICLE PROFILE SUMMARY (aggregat pentru frontend — "Hero Card" data)
    // =============================================================
    app.get('/api/vehicles/:id/profile-summary', async (req, res) => {
        const vehicleId = req.params.id;

        try {
            const vehicle = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM vehicles WHERE id = ?`, [vehicleId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });
            if (!vehicle) return res.status(404).json({ error: 'Vehicul negasit' });

            const { computeVehicleStatus } = require('./VehicleStatus');
            const vehicleStatus = await computeVehicleStatus(db, vehicleId);

            const [odometer, maintenanceItems, recentSessions, workshops, recentTimeline, milestones, healthScore, documents] = await Promise.all([
                getEstimatedOdometer(db, vehicleId),
                new Promise(resolve => {
                    db.all(`SELECT * FROM maintenance_items WHERE vehicle_id = ? ORDER BY
                        CASE status WHEN 'OVERDUE' THEN 1 WHEN 'DUE_SOON' THEN 2 WHEN 'OK' THEN 3 ELSE 4 END`,
                        [vehicleId], (err, rows) => resolve(rows || []));
                }),
                new Promise(resolve => {
                    db.all(`SELECT ss.*, GROUP_CONCAT(si.service_type) as types
                            FROM service_sessions ss
                            LEFT JOIN service_items si ON si.session_id = ss.id
                            WHERE ss.vehicle_id = ?
                            GROUP BY ss.id ORDER BY ss.performed_at DESC LIMIT 5`,
                        [vehicleId], (err, rows) => resolve(rows || []));
                }),
                new Promise(resolve => {
                    db.all(`SELECT * FROM workshops WHERE vehicle_id = ?`,
                        [vehicleId], (err, rows) => resolve(rows || []));
                }),
                new Promise(resolve => {
                    db.all(`SELECT * FROM vehicle_timeline WHERE vehicle_id = ? ORDER BY event_date DESC LIMIT 5`,
                        [vehicleId], (err, rows) => resolve(rows || []));
                }),
                new Promise(resolve => {
                    db.all(`SELECT * FROM milestones WHERE vehicle_id = ? ORDER BY achieved_at DESC LIMIT 5`,
                        [vehicleId], (err, rows) => resolve(rows || []));
                }),
                new Promise(resolve => {
                    db.get(`SELECT health_score FROM trip_summary ts
                            JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                            WHERE c.vin = ? ORDER BY ts.id_summary DESC LIMIT 1`,
                        [vehicle.vin], (err, row) => resolve(row?.health_score || null));
                }),
                new Promise(resolve => {
                    db.all(`SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC`,
                        [vehicleId], (err, rows) => resolve(sortDocs(hydrateStatus(rows || []))));
                }),
            ]);

            // Compute "owned for" duration
            const now = Math.floor(Date.now() / 1000);
            const ownershipDays = vehicle.purchase_date ? Math.floor((now - vehicle.purchase_date) / 86400) : null;

            // Last drive (from calatorii)
            const lastDrive = await new Promise(resolve => {
                db.get(`SELECT timestamp_end, km_parcursi FROM calatorii
                        WHERE vin = ? AND timestamp_end IS NOT NULL ORDER BY timestamp_end DESC LIMIT 1`,
                    [vehicle.vin], (err, row) => resolve(row || null));
            });

            const overdueCount = maintenanceItems.filter(i => i.status === 'OVERDUE').length;
            const dueSoonCount = maintenanceItems.filter(i => i.status === 'DUE_SOON').length;

            const totalCostYear = await new Promise(resolve => {
                const oneYearAgo = now - (365 * 86400);
                db.get(`SELECT COALESCE(SUM(cost_total), 0) as total FROM service_sessions WHERE vehicle_id = ? AND performed_at > ?`,
                    [vehicleId, oneYearAgo], (err, row) => resolve(row?.total || 0));
            });

            res.json({
                vehicle,
                vehicle_status: vehicleStatus,
                estimated_odometer_km: odometer,
                health_score: healthScore,
                ownership_days: ownershipDays,
                last_drive: lastDrive ? {
                    timestamp: lastDrive.timestamp_end,
                    days_ago: Math.floor((now * 1000 - lastDrive.timestamp_end) / 86400000),
                    km: lastDrive.km_parcursi,
                } : null,
                maintenance_summary: {
                    overdue: overdueCount,
                    due_soon: dueSoonCount,
                    ok: maintenanceItems.filter(i => i.status === 'OK').length,
                    unknown: maintenanceItems.filter(i => i.status === 'UNKNOWN').length,
                    items: maintenanceItems,
                },
                recent_services: recentSessions,
                recent_timeline: recentTimeline,
                milestones,
                workshops,
                documents,
                cost_last_year: Number(totalCostYear.toFixed(2)),
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    console.log('[VEHICLE PROFILE] Routes registered (CRUD + VIN decoder + maintenance calculator)');
}

module.exports = { registerVehicleProfileRoutes };
