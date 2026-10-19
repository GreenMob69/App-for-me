// @ts-check
'use strict';

/**
 * Pre-computed Look-Up Table (LUT) for Trigonometric SVG Arcs
 * Eliminates Math.cos/Math.sin floating-point operations and string allocations during 60 FPS gauge rendering.
 */

const LUT_RESOLUTION = 720; // 0.5 degree steps

/**
 * @type {Map<string, string>}
 */
const arcPathCache = new Map();

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
    };
}

/**
 * Returns pre-calculated or cached SVG arc path string.
 * @param {number} x Center X
 * @param {number} y Center Y
 * @param {number} radius Radius
 * @param {number} startAngle Start Angle in Degrees
 * @param {number} endAngle End Angle in Degrees
 * @returns {string} SVG Path string
 */
export function getCachedClockwiseArc(x, y, radius, startAngle, endAngle) {
    if (endAngle <= startAngle) return '';
    
    // Quantize angles to 0.5 degrees for high-fidelity caching
    const qStart = Math.round(startAngle * 2) / 2;
    const qEnd = Math.round(endAngle * 2) / 2;
    const key = `${Math.round(x)}_${Math.round(y)}_${Math.round(radius)}_${qStart}_${qEnd}`;

    const cached = arcPathCache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    const start = polarToCartesian(x, y, radius, qStart);
    const end = polarToCartesian(x, y, radius, qEnd);
    const largeArcFlag = qEnd - qStart <= 180 ? '0' : '1';

    const path = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
    
    // Keep cache bounded
    if (arcPathCache.size > 2000) {
        arcPathCache.clear();
    }
    arcPathCache.set(key, path);
    return path;
}

export default getCachedClockwiseArc;
