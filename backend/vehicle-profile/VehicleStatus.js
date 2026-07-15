/**
 * VehicleStatus — Calculeaza starea generala a vehiculului
 *
 * Trei stari posibile:
 * - READY        "Ready for long trip"     (totul OK)
 * - ATTENTION    "Maintenance recommended" (ceva se apropie)
 * - INSPECTION   "Needs inspection"        (ceva depasit sau critic)
 *
 * Se recalculeaza la fiecare:
 * - Service adaugat
 * - Odometru actualizat
 * - Trip finalizat (health score nou)
 * - Document expirat
 */

const { vehicleEventBus } = require('./EventBus');

function computeVehicleStatus(db, vehicleId) {
    return new Promise((resolve) => {
        const checks = {
            overdue_items: 0,
            due_soon_items: 0,
            expired_docs: 0,
            expiring_docs: 0,
            health_score: null,
            high_predictions: 0,
        };

        let pending = 4;
        const done = () => {
            pending--;
            if (pending > 0) return;

            let status = 'READY';
            let reason = null;

            if (checks.overdue_items > 0 || checks.expired_docs > 0 || checks.health_score < 50 || checks.high_predictions >= 2) {
                status = 'INSPECTION';
                if (checks.overdue_items > 0) reason = `${checks.overdue_items} consumabil(e) depasit(e)`;
                else if (checks.expired_docs > 0) reason = 'Document expirat';
                else if (checks.health_score < 50) reason = `Health Score critic: ${checks.health_score}%`;
                else reason = 'Multiple predictii AI severe';
            } else if (checks.due_soon_items > 0 || checks.expiring_docs > 0 || checks.health_score < 75 || checks.high_predictions > 0) {
                status = 'ATTENTION';
                if (checks.due_soon_items > 0) reason = `${checks.due_soon_items} consumabil(e) necesita atentie`;
                else if (checks.expiring_docs > 0) reason = 'Document expira curand';
                else if (checks.health_score < 75) reason = `Health Score: ${checks.health_score}%`;
                else reason = 'Predictie AI activa';
            }

            const now = Math.floor(Date.now() / 1000);
            db.run(`UPDATE vehicles SET vehicle_status = ?, status_reason = ?, status_updated_at = ? WHERE id = ?`,
                [status, reason, now, vehicleId]);

            resolve({ status, reason });
        };

        // Check 1: Maintenance items
        db.all(`SELECT status FROM maintenance_items WHERE vehicle_id = ?`, [vehicleId], (err, rows) => {
            (rows || []).forEach(r => {
                if (r.status === 'OVERDUE') checks.overdue_items++;
                if (r.status === 'DUE_SOON') checks.due_soon_items++;
            });
            done();
        });

        // Check 2: Documents
        db.all(`SELECT expiry_date FROM documents WHERE vehicle_id = ?`, [vehicleId], (err, rows) => {
            const now = Math.floor(Date.now() / 1000);
            (rows || []).forEach(r => {
                if (r.expiry_date < now) checks.expired_docs++;
                else if (r.expiry_date < now + 30 * 86400) checks.expiring_docs++;
            });
            done();
        });

        // Check 3: Health score (din ultima cursa)
        db.get(`SELECT vin FROM vehicles WHERE id = ?`, [vehicleId], (err, vehicle) => {
            if (!vehicle) return done();
            db.get(`SELECT health_score FROM trip_summary ts
                    JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                    WHERE c.vin = ? ORDER BY ts.id_summary DESC LIMIT 1`,
                [vehicle.vin], (err, row) => {
                    checks.health_score = row?.health_score || null;
                    done();
                });
        });

        // Check 4: AI predictions (HIGH severity)
        db.get(`SELECT vin FROM vehicles WHERE id = ?`, [vehicleId], (err, vehicle) => {
            if (!vehicle) return done();
            db.get(`SELECT raport_ai_json FROM trip_summary ts
                    JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                    WHERE c.vin = ? ORDER BY ts.id_summary DESC LIMIT 1`,
                [vehicle.vin], (err, row) => {
                    if (row?.raport_ai_json) {
                        try {
                            const ai = JSON.parse(row.raport_ai_json);
                            const preds = ai?.intelligence?.predictions || [];
                            checks.high_predictions = preds.filter(p => p.severity === 'HIGH').length;
                        } catch (e) {}
                    }
                    done();
                });
        });
    });
}

function initVehicleStatusListeners(db) {
    const recalcForVehicle = (event) => {
        if (event.vehicle_id) computeVehicleStatus(db, event.vehicle_id);
    };

    vehicleEventBus.on('SERVICE_ADDED', recalcForVehicle);
    vehicleEventBus.on('OIL_CHANGED', recalcForVehicle);
    vehicleEventBus.on('FILTER_REPLACED', recalcForVehicle);
    vehicleEventBus.on('BATTERY_REPLACED', recalcForVehicle);
    vehicleEventBus.on('TIMING_BELT_REPLACED', recalcForVehicle);
    vehicleEventBus.on('BRAKE_SERVICE', recalcForVehicle);
    vehicleEventBus.on('MAINTENANCE_COMPLETED', recalcForVehicle);
    vehicleEventBus.on('ODOMETER_UPDATED', recalcForVehicle);
    vehicleEventBus.on('TRIP_COMPLETED', recalcForVehicle);
    vehicleEventBus.on('LONG_TRIP', recalcForVehicle);
    vehicleEventBus.on('DOCUMENT_EXPIRED', recalcForVehicle);
    vehicleEventBus.on('DOCUMENT_RENEWED', recalcForVehicle);
}

module.exports = { computeVehicleStatus, initVehicleStatusListeners };
