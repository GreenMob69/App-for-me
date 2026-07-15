const { createDigitalTwin, TWIN_VERSION }      = require('./VehicleDigitalTwin');
const { VehicleDigitalTwinBuilder }            = require('./VehicleDigitalTwinBuilder');
const { DigitalTwinSerializer }                = require('./DigitalTwinSerializer');
const { DigitalTwinSnapshot }                  = require('./DigitalTwinSnapshot');

module.exports = {
    createDigitalTwin,
    TWIN_VERSION,
    VehicleDigitalTwinBuilder,
    DigitalTwinSerializer,
    DigitalTwinSnapshot
};
