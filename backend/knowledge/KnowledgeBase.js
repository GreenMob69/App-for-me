/**
 * KnowledgeBase.js — Încărcare automată reguli din fișiere JSON
 * -----------------------------------------------------------------------
 * Toate regulile sunt acum în format JSON declarativ. Acest modul:
 *   - Încarcă rules.json la pornire
 *   - Oferă acces la reguli prin API simplu
 *   - Permite adăugarea regulilor noi fără modificarea codului
 *   - Oferă căutare/filtrare pe categorie, severitate, id
 *
 * Utilizare:
 *   const kb = require('./knowledge/KnowledgeBase');
 *   const rules = kb.getRulesByCategory('TURBO');
 *   const all = kb.getAllRules();
 * -----------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

const RULES_PATH = path.join(__dirname, 'rules.json');

let rulesCache = null;

function loadRules() {
    if (rulesCache) return rulesCache;

    try {
        const raw = fs.readFileSync(RULES_PATH, 'utf8');
        rulesCache = JSON.parse(raw);
        console.log(`[KNOWLEDGE BASE] Încărcate ${rulesCache.length} reguli din ${RULES_PATH}`);
        return rulesCache;
    } catch (err) {
        console.error(`[KNOWLEDGE BASE] Eroare la încărcarea regulilor:`, err.message);
        return [];
    }
}

function reloadRules() {
    rulesCache = null;
    return loadRules();
}

function getAllRules() {
    return loadRules();
}

function getRuleById(id) {
    return loadRules().find(r => r.id === id) || null;
}

function getRulesByCategory(category) {
    return loadRules().filter(r => r.category === category);
}

function getRulesBySeverity(severity) {
    return loadRules().filter(r => r.severity === severity);
}

function getCategories() {
    const cats = new Set(loadRules().map(r => r.category));
    return [...cats];
}

function getRuleMetadata(id) {
    const rule = getRuleById(id);
    if (!rule) return null;
    return {
        id: rule.id,
        category: rule.category,
        description: rule.description,
        severity: rule.severity,
        confidence: rule.confidence,
        causes: rule.causes.map(c => c.name),
        recommendations: rule.recommendations,
        references: rule.references
    };
}

function searchRules(query) {
    const q = query.toLowerCase();
    return loadRules().filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.causes.some(c => c.name.toLowerCase().includes(q))
    );
}

// Exporturi publice: funcțiile efectiv folosite de alte module.
// reloadRules, getRulesBySeverity, getCategories, getRuleMetadata, searchRules
// sunt disponibile în fișier dar nu sunt importate de niciun consumator extern.
module.exports = {
    loadRules,
    getAllRules,
    getRuleById,
    getRulesByCategory
};
