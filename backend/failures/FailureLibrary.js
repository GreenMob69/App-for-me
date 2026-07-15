const fs = require('fs');
const path = require('path');

const DEFINITIONS_DIR = path.join(__dirname, 'definitions');

const _byId = new Map();
const _bySystem = new Map();

function _load() {
    if (!fs.existsSync(DEFINITIONS_DIR)) return;
    const files = fs.readdirSync(DEFINITIONS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const def = JSON.parse(fs.readFileSync(path.join(DEFINITIONS_DIR, file), 'utf8'));
            if (!def.id) continue;
            _byId.set(def.id, def);
            const systems = def.affectedSystems || [];
            for (const sys of systems) {
                const key = sys.toUpperCase();
                if (!_bySystem.has(key)) _bySystem.set(key, []);
                _bySystem.get(key).push(def);
            }
        } catch (e) {
            console.warn(`[FailureLibrary] Failed to load ${file}:`, e.message);
        }
    }
}

_load();

function getById(id) {
    return _byId.get(id) || null;
}

function getBySystem(system) {
    return _bySystem.get(system.toUpperCase()) || [];
}

function resolveForSystem(system, capabilities) {
    const candidates = getBySystem(system);
    if (!capabilities) return candidates;
    return candidates.filter(def => {
        const required = def.requiredCapabilities || [];
        return required.every(cap => !!capabilities[cap]);
    });
}

function getAllIds() {
    return Array.from(_byId.keys());
}

module.exports = { getById, getBySystem, resolveForSystem, getAllIds };
