/**
 * KnowledgePackLoader.js — încărcare KnowledgePack din orice format
 * -----------------------------------------------------------------------
 * Suportă două formate:
 *
 *   Format 1 — fișier single (ex: generic_diesel.js)
 *     Backward compat cu packs-urile existente.
 *
 *   Format 2 — director modular (ex: VAG/TDI/)
 *     Fiecare responsabilitate = un fișier JSON separat:
 *       manifest.json     — id, version, description, applies_to
 *       thresholds.json   — threshold_overrides
 *       baseline.json     — baseline_overrides
 *       maintenance.json  — service_interval_overrides
 *       patterns.json     — known_failure_patterns (date pure, fără funcții)
 *       rules.json        — additional_rules
 *       scoring.json      — scoring_weight_overrides
 *
 *     Fișierele lipsă sunt tratate ca valori goale (no error).
 *     Permite adăugarea de noi fișiere în viitor fără modificarea loader-ului.
 *
 * Avantajele formatului modular:
 *   - fiecare fișier are un singur scop
 *   - JSON pur = editabil fără logică, validabil cu JSON Schema
 *   - funcțiile de evaluare NU mai sunt în pack — sunt în DiagnosticStrategy
 *   - fișierele pot veni din cloud/DB în viitor
 * -----------------------------------------------------------------------
 */

const fs   = require('fs');
const path = require('path');

/**
 * Încarcă un KnowledgePack, indiferent de format.
 *
 * @param {string} packPath - calea absolută către fișierul JS sau directorul modular
 * @returns {KnowledgePack}
 */
function loadPack(packPath) {
    if (fs.existsSync(packPath) && fs.statSync(packPath).isDirectory()) {
        return _loadDirectory(packPath);
    }
    // Single-file format (JS sau JSON)
    return require(packPath);
}

/**
 * Încarcă un pack din format director modular.
 * Fiecare fragment JSON contribuie la structura finală a pack-ului.
 */
function _loadDirectory(dirPath) {
    const manifest    = _loadFragment(dirPath, 'manifest.json',    {});
    const thresholds  = _loadFragment(dirPath, 'thresholds.json',  {});
    const baseline    = _loadFragment(dirPath, 'baseline.json',    {});
    const maintenance = _loadFragment(dirPath, 'maintenance.json', {});
    const patterns    = _loadFragment(dirPath, 'patterns.json',    []);
    const rules       = _loadFragment(dirPath, 'rules.json',       []);
    const scoring     = _loadFragment(dirPath, 'scoring.json',     {});

    return {
        // date din manifest
        ...manifest,

        // date din fragmentele dedicate
        threshold_overrides:        thresholds,
        baseline_overrides:         baseline,
        service_interval_overrides: maintenance,
        known_failure_patterns:     patterns,
        additional_rules:           rules,
        scoring_weight_overrides:   scoring,
    };
}

/**
 * Returnează conținutul unui fișier JSON dacă există, altfel fallback-ul dat.
 */
function _loadFragment(dirPath, filename, fallback) {
    const fullPath = path.join(dirPath, filename);
    if (!fs.existsSync(fullPath)) return fallback;
    try {
        return require(fullPath);
    } catch (e) {
        console.warn(`[KnowledgePackLoader] Nu pot încărca ${fullPath}: ${e.message}`);
        return fallback;
    }
}

module.exports = { loadPack };
