/**
 * MaintenanceCalculator — Motor de recalculare automată
 *
 * Se declanșează când:
 * - Se adaugă un service_record → recalculează maintenance_item corespunzător
 * - Se adaugă mileage_log → recalculează toate items (remaining_km)
 * - Se finalizează un trip → actualizează km estimat
 */

const DEFAULT_INTERVALS = [
    { item_type: 'OIL_CHANGE', item_name: 'Ulei motor', interval_km: 15000, interval_months: 12 },
    { item_type: 'FILTER_OIL', item_name: 'Filtru ulei', interval_km: 15000, interval_months: 12 },
    { item_type: 'FILTER_AIR', item_name: 'Filtru aer', interval_km: 30000, interval_months: 24 },
    { item_type: 'FILTER_FUEL', item_name: 'Filtru combustibil', interval_km: 60000, interval_months: 48 },
    { item_type: 'FILTER_CABIN', item_name: 'Filtru habitaclu', interval_km: 15000, interval_months: 12 },
    { item_type: 'BRAKE_PADS_FRONT', item_name: 'Placute frana fata', interval_km: 40000, interval_months: null },
    { item_type: 'BRAKE_PADS_REAR', item_name: 'Placute frana spate', interval_km: 60000, interval_months: null },
    { item_type: 'TIMING_BELT', item_name: 'Curea distributie', interval_km: 120000, interval_months: 72 },
    { item_type: 'SERPENTINE_BELT', item_name: 'Curea accesorii', interval_km: 80000, interval_months: 60 },
    { item_type: 'COOLANT_FLUSH', item_name: 'Lichid racire', interval_km: 100000, interval_months: 60 },
    { item_type: 'BRAKE_FLUID', item_name: 'Lichid frana', interval_km: 60000, interval_months: 24 },
    { item_type: 'SPARK_PLUGS', item_name: 'Bujii / Incandescentă', interval_km: 60000, interval_months: null },
    { item_type: 'TRANSMISSION_FLUID', item_name: 'Ulei cutie viteze', interval_km: 80000, interval_months: 72 },
];

function seedMaintenanceItems(db, vehicleId, vehicleSpecs) {
    const items = DEFAULT_INTERVALS.map(item => {
        let intervalKm = item.interval_km;

        // Adjust based on vehicle specs
        if (item.item_type === 'TIMING_BELT' && vehicleSpecs.timing_belt_interval_km) {
            intervalKm = vehicleSpecs.timing_belt_interval_km;
        }
        if (item.item_type === 'SPARK_PLUGS' && vehicleSpecs.spark_plug_interval_km) {
            intervalKm = vehicleSpecs.spark_plug_interval_km;
        }
        // Diesel nu are bujii clasice, dar are incandescentă — păstrăm cu interval mai lung
        if (item.item_type === 'SPARK_PLUGS' && vehicleSpecs.fuel_type === 'DIESEL') {
            intervalKm = 120000;
        }

        return { ...item, interval_km: intervalKm };
    });

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO maintenance_items
            (vehicle_id, item_type, item_name, interval_km, interval_months, status)
        VALUES (?, ?, ?, ?, ?, 'UNKNOWN')
    `);

    items.forEach(item => {
        stmt.run(vehicleId, item.item_type, item.item_name, item.interval_km, item.interval_months);
    });
    stmt.finalize();
}

function getEstimatedOdometer(db, vehicleId) {
    return new Promise((resolve) => {
        // Ultimul mileage_log + suma km din cursele OBD de atunci
        db.get(`
            SELECT odometer_km, recorded_at FROM mileage_log
            WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT 1
        `, [vehicleId], (err, lastMileage) => {
            if (!lastMileage) return resolve(null);

            // Gaseste VIN-ul vehiculului
            db.get(`SELECT vin FROM vehicles WHERE id = ?`, [vehicleId], (err, vehicle) => {
                if (!vehicle) return resolve(lastMileage.odometer_km);

                // Suma km din cursele de dupa ultima citire
                db.get(`
                    SELECT COALESCE(SUM(km_parcursi), 0) as km_since
                    FROM calatorii
                    WHERE vin = ? AND timestamp_start > ? AND timestamp_end IS NOT NULL
                `, [vehicle.vin, lastMileage.recorded_at * 1000], (err, result) => {
                    resolve(lastMileage.odometer_km + Math.round(result?.km_since || 0));
                });
            });
        });
    });
}

function recalculateMaintenanceItem(db, vehicleId, itemType, currentOdometer) {
    return new Promise((resolve) => {
        db.get(`
            SELECT * FROM maintenance_items
            WHERE vehicle_id = ? AND item_type = ?
        `, [vehicleId, itemType], (err, item) => {
            if (!item) return resolve(null);

            const now = Math.floor(Date.now() / 1000);
            let status = 'UNKNOWN';
            let remainingKm = null;
            let remainingDays = null;
            let wearPercent = 0;

            if (item.last_service_km && item.interval_km && currentOdometer) {
                const kmSinceService = currentOdometer - item.last_service_km;
                remainingKm = item.next_due_km ? (item.next_due_km - currentOdometer) : (item.interval_km - kmSinceService);
                wearPercent = Math.min(100, Math.max(0, (kmSinceService / item.interval_km) * 100));
            }

            if (item.next_due_date) {
                remainingDays = Math.round((item.next_due_date - now) / 86400);
            } else if (item.last_service_date && item.interval_months) {
                const nextDueTs = item.last_service_date + (item.interval_months * 30.44 * 86400);
                remainingDays = Math.round((nextDueTs - now) / 86400);
            }

            // Status calculation
            if (item.last_service_km === null && item.last_service_date === null) {
                status = 'UNKNOWN';
            } else if ((remainingKm !== null && remainingKm < 0) || (remainingDays !== null && remainingDays < 0)) {
                status = 'OVERDUE';
                wearPercent = 100;
            } else if ((remainingKm !== null && item.interval_km && remainingKm < item.interval_km * 0.2) ||
                       (remainingDays !== null && remainingDays < 30)) {
                status = 'DUE_SOON';
            } else {
                status = 'OK';
            }

            db.run(`
                UPDATE maintenance_items
                SET status = ?, wear_percent = ?, remaining_km = ?, remaining_days = ?, updated_at = ?
                WHERE vehicle_id = ? AND item_type = ?
            `, [status, Math.round(wearPercent * 10) / 10, remainingKm, remainingDays, now, vehicleId, itemType],
            (err) => {
                resolve({ item_type: itemType, status, wear_percent: wearPercent, remaining_km: remainingKm, remaining_days: remainingDays });
            });
        });
    });
}

function recalculateAllItems(db, vehicleId) {
    return new Promise(async (resolve) => {
        const currentOdometer = await getEstimatedOdometer(db, vehicleId);

        db.all(`SELECT item_type FROM maintenance_items WHERE vehicle_id = ?`, [vehicleId], async (err, items) => {
            if (!items || items.length === 0) return resolve([]);

            const results = [];
            for (const item of items) {
                const result = await recalculateMaintenanceItem(db, vehicleId, item.item_type, currentOdometer);
                if (result) results.push(result);
            }
            resolve(results);
        });
    });
}

function onServiceAdded(db, vehicleId, serviceRecord) {
    return new Promise((resolve) => {
        const now = Math.floor(Date.now() / 1000);
        const performedAt = serviceRecord.performed_at || now;
        const mileageKm = serviceRecord.mileage_km;
        const nextDueKm = serviceRecord.next_due_km || (mileageKm && serviceRecord.interval_km ? mileageKm + serviceRecord.interval_km : null);
        const nextDueDate = serviceRecord.next_due_date || null;

        // Update maintenance_item
        db.run(`
            UPDATE maintenance_items SET
                last_service_id = ?,
                last_service_date = ?,
                last_service_km = ?,
                next_due_km = COALESCE(?, next_due_km),
                next_due_date = COALESCE(?, next_due_date),
                updated_at = ?
            WHERE vehicle_id = ? AND item_type = ?
        `, [
            serviceRecord.id, performedAt, mileageKm,
            nextDueKm, nextDueDate, now,
            vehicleId, serviceRecord.service_type
        ], async (err) => {
            // Add mileage_log entry
            if (mileageKm) {
                db.run(`
                    INSERT INTO mileage_log (vehicle_id, odometer_km, source, recorded_at, note)
                    VALUES (?, ?, 'SERVICE', ?, ?)
                `, [vehicleId, mileageKm, performedAt, `Service: ${serviceRecord.service_type}`]);
            }

            // Recalculate the affected item
            const odometer = mileageKm || await getEstimatedOdometer(db, vehicleId);
            const result = await recalculateMaintenanceItem(db, vehicleId, serviceRecord.service_type, odometer);
            resolve(result);
        });
    });
}

module.exports = {
    DEFAULT_INTERVALS,
    seedMaintenanceItems,
    getEstimatedOdometer,
    recalculateMaintenanceItem,
    recalculateAllItems,
    onServiceAdded,
};
