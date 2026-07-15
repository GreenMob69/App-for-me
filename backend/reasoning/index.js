/**
 * reasoning/index.js — public API pentru Diagnostic Reasoning Graph
 *
 * Folosit de analyzers/index.js (pipeline step REASONING).
 * Poate fi importat și direct de AI Expert în viitor.
 */

const { analyzeFromContext, analyze, resolveActiveNodes, traceChain } = require('./ReasoningEngine');
const { graph } = require('./CausalGraph');

module.exports = {
    analyzeFromContext,
    analyze,
    resolveActiveNodes,
    traceChain,
    graph
};
