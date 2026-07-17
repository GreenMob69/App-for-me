'use strict';

// Singleton — cursele active în memorie, indexate după VIN.
// Partajat între MQTT handler (scrie) și watchdog (citește/șterge).
const calatoriiActive = {};

module.exports = calatoriiActive;
