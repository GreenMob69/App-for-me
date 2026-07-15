/**
 * CausalGraph.js — graf cauzal determinist
 *
 * Structură de date și algoritmi de traversare pentru graful de cauzalitate
 * al defectelor vehiculului. Pur computațional — fără ML, fără LLM.
 *
 * Tipuri noduri: FAILURE, SENSOR_STATE, SYSTEM_STATE
 * Tipuri muchii:  CAUSES, CONTRIBUTES_TO, ACCELERATES, REQUIRED_FOR, MASKS
 */

const fs = require('fs');
const path = require('path');

const GRAPH_DIR = path.join(__dirname, 'graph');

const CAUSAL_RELATIONS = ['CAUSES', 'CONTRIBUTES_TO', 'ACCELERATES'];

class CausalGraph {
    constructor() {
        this._nodes    = new Map(); // id → node
        this._outgoing = new Map(); // id → [edge]
        this._incoming = new Map(); // id → [edge]
        this._loaded   = false;
    }

    load() {
        if (this._loaded) return this;
        const nodes = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'nodes.json'), 'utf8'));
        const edges = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'edges.json'), 'utf8'));

        for (const n of nodes) {
            this._nodes.set(n.id, n);
            this._outgoing.set(n.id, []);
            this._incoming.set(n.id, []);
        }

        for (const e of edges) {
            if (!this._outgoing.has(e.from)) this._outgoing.set(e.from, []);
            if (!this._incoming.has(e.to))   this._incoming.set(e.to,   []);
            this._outgoing.get(e.from).push(e);
            this._incoming.get(e.to).push(e);
        }

        this._loaded = true;
        return this;
    }

    getNode(id) {
        return this._nodes.get(id) || null;
    }

    getAllNodes() {
        return Array.from(this._nodes.values());
    }

    getOutgoing(id, relations = null) {
        const edges = this._outgoing.get(id) || [];
        return relations ? edges.filter(e => relations.includes(e.relation)) : edges;
    }

    getIncoming(id, relations = null) {
        const edges = this._incoming.get(id) || [];
        return relations ? edges.filter(e => relations.includes(e.relation)) : edges;
    }

    hasNode(id) {
        return this._nodes.has(id);
    }

    /**
     * BFS forward — retornează Map<nodeId, depth> cu toate nodurile
     * accesibile din startId urmând muchii cauzale.
     */
    bfsForward(startId, maxDepth = 8) {
        const visited = new Map([[startId, 0]]);
        const queue   = [[startId, 0]];
        while (queue.length > 0) {
            const [id, depth] = queue.shift();
            if (depth >= maxDepth) continue;
            for (const e of this.getOutgoing(id, CAUSAL_RELATIONS)) {
                if (!visited.has(e.to)) {
                    visited.set(e.to, depth + 1);
                    queue.push([e.to, depth + 1]);
                }
            }
        }
        return visited;
    }

    /**
     * BFS backward — retornează Map<nodeId, depth> cu toate nodurile
     * care pot cauza startId (cauzele sale tranzitive).
     */
    bfsBackward(startId, maxDepth = 8) {
        const visited = new Map([[startId, 0]]);
        const queue   = [[startId, 0]];
        while (queue.length > 0) {
            const [id, depth] = queue.shift();
            if (depth >= maxDepth) continue;
            for (const e of this.getIncoming(id, CAUSAL_RELATIONS)) {
                if (!visited.has(e.from)) {
                    visited.set(e.from, depth + 1);
                    queue.push([e.from, depth + 1]);
                }
            }
        }
        return visited;
    }

    /**
     * Urmărește lanțul primar (greedy, cea mai mare greutate la fiecare pas)
     * pornind de la startId, în direcția indicată.
     *
     * @returns {Array} — listă ordonată de {id, label, type, depth, relation, weight}
     */
    tracePrimaryChain(startId, direction = 'forward', maxDepth = 10) {
        const chain   = [];
        const visited = new Set();
        let current   = startId;

        for (let depth = 0; depth <= maxDepth; depth++) {
            if (!current || visited.has(current)) break;
            visited.add(current);

            const node  = this._nodes.get(current);
            const entry = {
                id:    current,
                label: node?.label || current,
                type:  node?.type  || 'UNKNOWN',
                depth
            };
            chain.push(entry);

            const edges = direction === 'forward'
                ? this.getOutgoing(current, CAUSAL_RELATIONS)
                : this.getIncoming(current, CAUSAL_RELATIONS);

            if (edges.length === 0) break;
            edges.sort((a, b) => b.weight - a.weight);
            const best = edges[0];
            entry.nextRelation = best.relation;
            entry.nextWeight   = best.weight;

            current = direction === 'forward' ? best.to : best.from;
        }

        return chain;
    }

    /**
     * Retornează toate nodurile unui graf parțial format doar din activeIds,
     * împreună cu muchiile cauzale dintre ele.
     */
    subgraph(activeIds) {
        const active = new Set(activeIds);
        const nodes  = activeIds.map(id => this._nodes.get(id)).filter(Boolean);
        const edges  = [];
        for (const id of activeIds) {
            for (const e of this.getOutgoing(id, CAUSAL_RELATIONS)) {
                if (active.has(e.to)) edges.push(e);
            }
        }
        return { nodes, edges };
    }
}

// Singleton — încărcat la primul require()
const instance = new CausalGraph().load();

module.exports = { CausalGraph, graph: instance, CAUSAL_RELATIONS };
