/**
 * Vehicle Profile Module — Entry point
 *
 * Responsabilități:
 * - Schema SQL (7 tabele nucleu + vehicle_timeline + milestones)
 * - VIN Decoder (ISO 3779)
 * - Maintenance Calculator (recalculare automata)
 * - EventBus (domain events)
 * - Vehicle Timeline (persistenta evenimentelor)
 * - Vehicle Status (READY / ATTENTION / INSPECTION)
 * - Milestone Tracker (realizari vehicul)
 * - CRUD Routes + Cost Dashboard
 */

const { initVehicleProfileSchema } = require('./schema');
const { registerVehicleProfileRoutes } = require('./routes');
const { decodeVin, validateVin } = require('./VinDecoder');
const { recalculateAllItems, getEstimatedOdometer, onServiceAdded } = require('./MaintenanceCalculator');
const { vehicleEventBus } = require('./EventBus');
const { initTimelineSchema, initTimelineListener, registerTimelineRoutes } = require('./VehicleTimeline');
const { computeVehicleStatus, initVehicleStatusListeners } = require('./VehicleStatus');
const { initMilestoneListeners, registerMilestoneRoutes } = require('./MilestoneTracker');
const { initDocumentsSchema, registerDocumentRoutes } = require('./DocumentsModule');

function initVehicleProfile(app, db) {
    // 1. Schema
    initVehicleProfileSchema(db);
    initTimelineSchema(db);
    initDocumentsSchema(db);

    // 2. Event listeners
    initTimelineListener();
    initVehicleStatusListeners(db);
    initMilestoneListeners(db);

    // 3. Routes
    registerVehicleProfileRoutes(app, db);
    registerTimelineRoutes(app, db);
    registerMilestoneRoutes(app, db);
    registerDocumentRoutes(app, db);

    console.log('[VEHICLE PROFILE] Module initialized (schema + events + timeline + status + milestones + documents + routes)');
}

module.exports = {
    initVehicleProfile,
    decodeVin,
    validateVin,
    recalculateAllItems,
    getEstimatedOdometer,
    onServiceAdded,
    vehicleEventBus,
    computeVehicleStatus,
    initDocumentsSchema,
    registerDocumentRoutes,
};
