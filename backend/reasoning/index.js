/**
 * reasoning/index.js — public API pentru Diagnostic Reasoning Graph
 *
 * Folosit de analyzers/index.js (pipeline step REASONING).
 * Poate fi importat și direct de AI Expert în viitor.
 */

const { analyzeFromContext } = require('./ReasoningEngine');

// Exportăm doar intrarea publică a modulului.
// analyze(), resolveActiveNodes(), traceChain() și graph sunt
// detalii de implementare folosite intern de ReasoningEngine.
module.exports = { analyzeFromContext };
