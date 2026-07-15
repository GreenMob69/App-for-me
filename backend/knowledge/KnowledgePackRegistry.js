/**
 * KnowledgePackRegistry.js — selectare pack de cunoaștere pentru un vehicul
 * -----------------------------------------------------------------------
 * Packs-urile sunt module JS încărcate la startup. Selectarea se face
 * prin prioritate descrescătoare: cel mai specific → cel mai generic.
 *
 * Ordinea de rezoluție:
 *   1. make + fuel_type potrivit (ex: Audi + diesel → VAG_TDI)
 *   2. fuel_type potrivit (ex: diesel → GENERIC_DIESEL)
 *   3. Fallback absolut: GENERIC_DIESEL
 * -----------------------------------------------------------------------
 */

const path = require('path');
const { loadPack } = require('./KnowledgePackLoader');

const PACKS = {
    GENERIC_DIESEL: require('./packs/generic_diesel'),
    GENERIC_PETROL: require('./packs/generic_petrol'),
    VAG_TDI:        loadPack(path.join(__dirname, 'packs/VAG/TDI')),
};

// Mărci care folosesc platforma VAG (pentru VAG_TDI matching)
const VAG_MAKES = new Set([
    'Audi', 'Volkswagen', 'Volkswagen Commercial', 'SEAT', 'Skoda'
]);

/**
 * Selectează cel mai specific KnowledgePack pentru vehiculul dat.
 *
 * @param {Object|null} vehicleRow  - rândul din tabela `vehicles` (sau null)
 * @param {Object|null} capabilities - VehicleCapabilities derivate (sau null)
 * @returns {KnowledgePack}
 */
function resolve(vehicleRow, capabilities) {
    const make     = (vehicleRow?.make      || '').trim();
    const fuel     = (capabilities?._fuelType || vehicleRow?.fuel_type || 'diesel').toLowerCase();
    const year     = vehicleRow?.year ? Number(vehicleRow.year) : null;

    // ── Nivel 1: match make + fuel_type ──────────────────────────────
    if (VAG_MAKES.has(make) && fuel === 'diesel') {
        const pack = PACKS.VAG_TDI;
        if (_yearInRange(year, pack.applies_to.year_range)) {
            return pack;
        }
    }

    // ── Nivel 2: match fuel_type ──────────────────────────────────────
    if (fuel === 'petrol' || fuel === 'gasoline' || fuel === 'benzina' || fuel === 'benzin') {
        return PACKS.GENERIC_PETROL;
    }

    // ── Nivel 3: fallback absolut ─────────────────────────────────────
    return PACKS.GENERIC_DIESEL;
}

function _yearInRange(year, range) {
    if (!range || year === null) return true;
    return year >= range[0] && year <= range[1];
}

/**
 * Acces direct la un pack după ID (util pentru teste).
 * @param {string} id
 * @returns {KnowledgePack|null}
 */
function getById(id) {
    return PACKS[id] || null;
}

module.exports = { resolve, getById, PACKS };
