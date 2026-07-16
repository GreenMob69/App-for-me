'use strict';
/**
 * TTL Cache — strat de cache peste AsyncStorage cu expirare configurabilă.
 *
 * Utilizare:
 *   import { readCache, writeCache, clearCache, getCacheAge } from './cache';
 *
 *   // Scrie cu TTL 5 minute
 *   await writeCache('@my_key', data, { ttl: 5 * 60 * 1000 });
 *
 *   // Citeste (null daca lipseste sau expirat)
 *   const data = await readCache('@my_key');
 *
 *   // Varsta in secunde (null daca lipseste)
 *   const ageSeconds = await getCacheAge('@my_key');
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minute

// ── Internals ─────────────────────────────────────────────────────────────────

function storageKey(key) {
    return `@cache::${key}`;
}

// ── API ────────────────────────────────────────────────────────────────────────

/**
 * Citeste o intrare din cache. Returneaza null daca lipseste sau a expirat.
 */
export async function readCache(key) {
    try {
        const raw = await AsyncStorage.getItem(storageKey(key));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (Date.now() > entry.expiresAt) {
            await AsyncStorage.removeItem(storageKey(key));
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

/**
 * Scrie o intrare in cache cu TTL specificat (ms).
 */
export async function writeCache(key, data, { ttl = DEFAULT_TTL } = {}) {
    try {
        const entry = {
            data,
            cachedAt:  Date.now(),
            expiresAt: Date.now() + ttl,
        };
        await AsyncStorage.setItem(storageKey(key), JSON.stringify(entry));
    } catch {
        // cache miss is non-fatal
    }
}

/**
 * Sterge o intrare din cache.
 */
export async function clearCache(key) {
    try {
        await AsyncStorage.removeItem(storageKey(key));
    } catch {}
}

/**
 * Returneaza varsta intrarii in secunde, sau null daca nu exista / expirata.
 */
export async function getCacheAge(key) {
    try {
        const raw = await AsyncStorage.getItem(storageKey(key));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (Date.now() > entry.expiresAt) return null;
        return Math.floor((Date.now() - entry.cachedAt) / 1000);
    } catch {
        return null;
    }
}

/**
 * Helper: citeste din cache sau fetch din retea, scrie in cache la succes.
 * Returneaza { data, fromCache, ageSeconds }
 *
 * @param {string}   key        cheie cache
 * @param {function} fetchFn    async () => data
 * @param {object}   opts       { ttl, forceRefresh }
 */
export async function cacheOr(key, fetchFn, { ttl = DEFAULT_TTL, forceRefresh = false } = {}) {
    if (!forceRefresh) {
        const cached = await readCache(key);
        if (cached !== null) {
            const ageSeconds = await getCacheAge(key);
            return { data: cached, fromCache: true, ageSeconds };
        }
    }
    const data = await fetchFn();
    await writeCache(key, data, { ttl });
    return { data, fromCache: false, ageSeconds: 0 };
}
