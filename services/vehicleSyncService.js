'use strict';

/**
 * services/vehicleSyncService.js
 * --------------------------------------------------------------------------
 * Punte de sincronizare bidirecțională între:
 *   1. `vehicule` (schema nucleu telemetrie, calatorii, MQTT)
 *   2. `vehicles` (schema profil extins, mentenanta, timeline, documents)
 *
 * Rezolvă riscul de desincronizare semnalat în auditul tehnic.
 * Oricare tabelă este actualizată, modificările esențiale (kilometraj,
 * combustibil, capacitate rezervor, model) sunt reflectate atomic în ambele.
 * --------------------------------------------------------------------------
 */

/**
 * Sincronizează profilul vehiculului în ambele tabele (vehicule + vehicles).
 *
 * @param {Object} db - Instanța sqlite3
 * @param {string} vin - VIN-ul mașinii
 * @param {Object} data - Datele de actualizat (acceptă chei românești sau englezești)
 * @returns {Promise<{ ok: boolean, vin: string, updatedFields: string[] }>}
 */
async function syncVehicleProfile(db, vin, data = {}) {
    if (!vin || typeof vin !== 'string') {
        throw new Error('VIN invalid pentru sincronizare profil vehicul.');
    }

    const cleanVin = vin.toUpperCase().trim();
    const updatedFields = [];

    // Extrage și normalizează valorile acceptând ambele convenții de numire
    const fuelTank = data.capacitate_rezervor_l ?? data.fuel_tank_liters;
    const fuelType = data.tip_combustibil ?? data.fuel_type;
    const odometer = data.odometru_calibrat_km ?? data.odometer_km;
    const model    = data.model;
    const make     = data.make;
    const year     = data.year;

    // ── 1. Actualizare tabelă `vehicule` (telemetrie / MQTT) ───────────────
    const vUpdates = [];
    const vParams  = [];

    if (fuelTank != null && !isNaN(fuelTank)) {
        vUpdates.push('capacitate_rezervor_l = ?');
        vParams.push(Number(fuelTank));
        updatedFields.push('fuel_tank_liters');
    }
    if (fuelType) {
        vUpdates.push('tip_combustibil = ?');
        vParams.push(String(fuelType).toLowerCase());
        updatedFields.push('fuel_type');
    }
    if (odometer != null && !isNaN(odometer)) {
        vUpdates.push('odometru_calibrat_km = ?');
        vParams.push(Number(odometer));
        updatedFields.push('odometer_km');
    }
    if (model) {
        vUpdates.push('model = ?');
        vParams.push(String(model));
        updatedFields.push('model');
    }

    if (vUpdates.length > 0) {
        vParams.push(cleanVin);
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE vehicule SET ${vUpdates.join(', ')} WHERE UPPER(vin) = ?`,
                vParams,
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });
    }

    // ── 2. Actualizare tabelă `vehicles` (profil extins / mentenanță) ───────
    const vpUpdates = [];
    const vpParams  = [];

    if (fuelTank != null && !isNaN(fuelTank)) {
        vpUpdates.push('fuel_tank_liters = ?');
        vpParams.push(Number(fuelTank));
    }
    if (fuelType) {
        vpUpdates.push('fuel_type = ?');
        vpParams.push(String(fuelType).toUpperCase());
    }
    if (model) {
        vpUpdates.push('model = ?');
        vpParams.push(String(model));
    }
    if (make) {
        vpUpdates.push('make = ?');
        vpParams.push(String(make));
        updatedFields.push('make');
    }
    if (year != null && !isNaN(year)) {
        vpUpdates.push('year = ?');
        vpParams.push(Number(year));
        updatedFields.push('year');
    }

    const physicsFields = [
        'curb_weight_kg', 'length_mm', 'width_mm', 'height_mm', 'drag_coefficient',
        'frontal_area_m2', 'tire_spec', 'wheel_radius_m', 'redline_rpm', 'idle_rpm',
        'operating_temp_min', 'operating_temp_max', 'nominal_boost_bar'
    ];
    for (const f of physicsFields) {
        if (data[f] !== undefined) {
            vpUpdates.push(`${f} = ?`);
            vpParams.push(data[f]);
            updatedFields.push(f);
        }
    }

    if (vpUpdates.length > 0) {
        vpUpdates.push(`updated_at = strftime('%s', 'now')`);
        vpParams.push(cleanVin);
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE vehicles SET ${vpUpdates.join(', ')} WHERE UPPER(vin) = ?`,
                vpParams,
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });
    }

    // ── 3. Sincronizare Odometru în `mileage_log` ───────────────────────────
    if (odometer != null && !isNaN(odometer)) {
        await syncOdometer(db, cleanVin, Number(odometer), data.source || 'PROFILE_SYNC', data.note);
    }

    return { ok: true, vin: cleanVin, updatedFields };
}

/**
 * Sincronizează kilometrajul în ambele tabele:
 *   - Setează `vehicule.odometru_calibrat_km`
 *   - Inserează intrare în `mileage_log` (dacă nu există deja aceeași valoare recentă)
 *
 * @param {Object} db - Instanța sqlite3
 * @param {string} vin - VIN-ul mașinii
 * @param {number} odometerKm - Kilometrajul curent
 * @param {string} source - Sursa ('OBD', 'MANUAL', 'SYNC')
 * @param {string} [note] - Notă opțională
 */
async function syncOdometer(db, vin, odometerKm, source = 'SYNC', note = null) {
    if (!vin || odometerKm == null || isNaN(odometerKm) || odometerKm < 0) return;
    const cleanVin = vin.toUpperCase().trim();
    const km = Number(odometerKm);

    // 1. Actualizează odometrul în `vehicule`
    await new Promise((resolve, reject) => {
        db.run(
            `UPDATE vehicule SET odometru_calibrat_km = ? WHERE UPPER(vin) = ?`,
            [km, cleanVin],
            (err) => err ? reject(err) : resolve()
        );
    });

    // 2. Verifică dacă există în `vehicles` pentru a lega de `mileage_log`
    const vehicleRow = await new Promise((resolve) => {
        db.get(`SELECT id FROM vehicles WHERE UPPER(vin) = ?`, [cleanVin], (err, row) => resolve(row));
    });

    if (vehicleRow?.id) {
        const vehicleId = vehicleRow.id;
        // Evită duplicate consecutive de kilometraj identic
        const lastEntry = await new Promise((resolve) => {
            db.get(
                `SELECT odometer_km FROM mileage_log WHERE vehicle_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`,
                [vehicleId],
                (err, row) => resolve(row)
            );
        });

        if (!lastEntry || Math.abs(lastEntry.odometer_km - km) >= 0.5) {
            const now = Math.floor(Date.now() / 1000);
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO mileage_log (vehicle_id, odometer_km, source, recorded_at, note) VALUES (?, ?, ?, ?, ?)`,
                    [vehicleId, km, source, now, note || 'Sincronizare automată kilometraj'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
    }
}

module.exports = {
    syncVehicleProfile,
    syncOdometer
};
