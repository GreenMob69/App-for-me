// @ts-check

/**
 * Ensures a value is a valid finite number, otherwise returns fallback.
 * @param {any} val
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeNum(val, fallback = 0) {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') {
        const n = parseFloat(val);
        if (Number.isFinite(n)) return n;
    }
    return fallback;
}

/**
 * Safely formats a number with fixed decimals, avoiding TypeError/NaN.
 * @param {any} val
 * @param {number} [dec=0]
 * @param {string} [fallback='0']
 * @returns {string}
 */
export function safeFmt(val, dec = 0, fallback = '0') {
    const n = safeNum(val, NaN);
    if (Number.isNaN(n)) return fallback;
    return n.toFixed(dec);
}

/**
 * Ensures an array is returned for safe .map/.filter/.slice operations.
 * @template T
 * @param {T[]|any} arr
 * @returns {T[]}
 */
export function safeArr(arr) {
    return Array.isArray(arr) ? arr : [];
}

/**
 * Safely sanitizes an SVG coordinate against NaN and Infinity.
 * @param {any} coord
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeCoord(coord, fallback = 0) {
    return typeof coord === 'number' && Number.isFinite(coord) ? coord : fallback;
}

/**
 * Safely builds an SVG path command string, replacing any NaN or Infinity with 0.
 * @param {string} d
 * @returns {string}
 */
export function sanitizeSvgPath(d) {
    if (typeof d !== 'string') return '';
    return d.replace(/\bNaN\b/g, '0').replace(/\bInfinity\b/g, '0');
}

export default {
    safeNum,
    safeFmt,
    safeArr,
    safeCoord,
    sanitizeSvgPath,
};
