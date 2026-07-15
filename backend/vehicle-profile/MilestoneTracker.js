/**
 * MilestoneTracker — Detecteaza si inregistreaza realizari
 *
 * Asculta evenimentele si verifica daca s-a atins un milestone.
 * Milestone-urile sunt unice per vehicul — nu se repeta.
 */

const { vehicleEventBus } = require('./EventBus');

const MILEAGE_MILESTONES = [50000, 100000, 150000, 200000, 250000, 300000, 500000];

const MILESTONE_DEFINITIONS = {
    MILEAGE_REACHED: {
        icon: '◆',
        titleFn: (km) => `${(km / 1000).toFixed(0)}.000 km parcursi`,
        descFn: (km) => `Vehiculul a atins ${km.toLocaleString()} km`,
    },
    TRIP_COUNT: {
        icon: '→',
        titleFn: (count) => `${count} curse inregistrate`,
        descFn: (count) => `Ai inregistrat ${count} curse cu acest vehicul`,
        thresholds: [10, 50, 100, 250, 500, 1000],
    },
    HEALTH_PERFECT: {
        icon: '★',
        titleFn: () => 'Health Score perfect: 100%',
        descFn: () => 'Toate sistemele functioneaza optim',
    },
    HEALTH_EXCELLENT: {
        icon: '↑',
        titleFn: () => 'Health Score excelent: >95%',
        descFn: () => 'Masina este in stare foarte buna',
    },
    FIRST_LONG_TRIP: {
        icon: '⇒',
        titleFn: (km) => `Primul drum lung: ${km} km`,
        descFn: (km) => `Prima cursa de peste 300 km (${km} km)`,
    },
    DTC_FREE_STREAK: {
        icon: '✓',
        titleFn: (days) => `${days} zile fara erori DTC`,
        descFn: (days) => `Vehiculul functioneaza de ${days} zile fara coduri de eroare`,
        thresholds: [30, 90, 180, 365],
    },
    FIRST_DPF_REGEN: {
        icon: '◎',
        titleFn: () => 'Prima regenerare DPF',
        descFn: () => 'Filtrul de particule a efectuat prima regenerare monitorizata',
    },
    AI_PREDICTION_CONFIRMED: {
        icon: '◈',
        titleFn: (component) => `AI confirmat: ${component}`,
        descFn: (component, days) => `Predictia AI pentru ${component} s-a confirmat dupa ${days} zile`,
    },
    OWNERSHIP_ANNIVERSARY: {
        icon: '◆',
        titleFn: (years) => `${years} ${years === 1 ? 'an' : 'ani'} de proprietate`,
        descFn: (years) => `Deții acest vehicul de ${years} ${years === 1 ? 'an' : 'ani'}`,
        thresholds: [1, 2, 3, 5, 10],
    },
};

let _db = null;

function hasMilestone(vehicleId, milestoneType, title) {
    return new Promise((resolve) => {
        _db.get(`SELECT id FROM milestones WHERE vehicle_id = ? AND milestone_type = ? AND title = ?`,
            [vehicleId, milestoneType, title], (err, row) => resolve(!!row));
    });
}

function recordMilestone(vehicleId, milestoneType, title, description, icon, mileageKm) {
    return new Promise(async (resolve) => {
        const exists = await hasMilestone(vehicleId, milestoneType, title);
        if (exists) return resolve(false);

        const now = Math.floor(Date.now() / 1000);
        _db.run(`INSERT INTO milestones (vehicle_id, milestone_type, title, description, icon, achieved_at, mileage_km)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [vehicleId, milestoneType, title, description, icon, now, mileageKm || null],
            function(err) {
                if (err) return resolve(false);

                // Emit timeline event
                vehicleEventBus.emit('MILESTONE_ACHIEVED', {
                    vehicle_id: vehicleId,
                    source: 'SYSTEM',
                    title,
                    description,
                    milestone_type: milestoneType,
                    mileage_km: mileageKm,
                });

                resolve(true);
            }
        );
    });
}

async function checkMileageMilestones(vehicleId, currentOdometer) {
    if (!currentOdometer) return;

    for (const threshold of MILEAGE_MILESTONES) {
        if (currentOdometer >= threshold) {
            const def = MILESTONE_DEFINITIONS.MILEAGE_REACHED;
            await recordMilestone(
                vehicleId, 'MILEAGE_REACHED',
                def.titleFn(threshold),
                def.descFn(threshold),
                def.icon, threshold
            );
        }
    }
}

async function checkTripCountMilestone(vehicleId) {
    return new Promise((resolve) => {
        _db.get(`SELECT vin FROM vehicles WHERE id = ?`, [vehicleId], (err, vehicle) => {
            if (!vehicle) return resolve();
            _db.get(`SELECT COUNT(*) as count FROM calatorii WHERE vin = ? AND timestamp_end IS NOT NULL`,
                [vehicle.vin], async (err, row) => {
                    const count = row?.count || 0;
                    const def = MILESTONE_DEFINITIONS.TRIP_COUNT;
                    for (const threshold of def.thresholds) {
                        if (count >= threshold) {
                            await recordMilestone(
                                vehicleId, 'TRIP_COUNT',
                                def.titleFn(threshold),
                                def.descFn(threshold),
                                def.icon, null
                            );
                        }
                    }
                    resolve();
                });
        });
    });
}

async function checkHealthMilestone(vehicleId, healthScore) {
    if (healthScore === 100) {
        const def = MILESTONE_DEFINITIONS.HEALTH_PERFECT;
        await recordMilestone(vehicleId, 'HEALTH_PERFECT', def.titleFn(), def.descFn(), def.icon, null);
    } else if (healthScore >= 95) {
        const def = MILESTONE_DEFINITIONS.HEALTH_EXCELLENT;
        await recordMilestone(vehicleId, 'HEALTH_EXCELLENT', def.titleFn(), def.descFn(), def.icon, null);
    }
}

function initMilestoneListeners(db) {
    _db = db;

    vehicleEventBus.on('ODOMETER_UPDATED', async (event) => {
        await checkMileageMilestones(event.vehicle_id, event.odometer_km);
    });

    vehicleEventBus.on('TRIP_COMPLETED', async (event) => {
        await checkTripCountMilestone(event.vehicle_id);
        if (event.health_score) {
            await checkHealthMilestone(event.vehicle_id, event.health_score);
        }
    });

    vehicleEventBus.on('LONG_TRIP', async (event) => {
        const def = MILESTONE_DEFINITIONS.FIRST_LONG_TRIP;
        await recordMilestone(
            event.vehicle_id, 'FIRST_LONG_TRIP',
            def.titleFn(event.distance_km),
            def.descFn(event.distance_km),
            def.icon, event.mileage_km
        );
        await checkTripCountMilestone(event.vehicle_id);
        if (event.health_score) {
            await checkHealthMilestone(event.vehicle_id, event.health_score);
        }
    });
}

function registerMilestoneRoutes(app, db) {
    app.get('/api/vehicles/:id/milestones', (req, res) => {
        db.all(`SELECT * FROM milestones WHERE vehicle_id = ? ORDER BY achieved_at DESC`,
            [req.params.id], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows || []);
            });
    });
}

module.exports = { initMilestoneListeners, registerMilestoneRoutes, checkMileageMilestones };
