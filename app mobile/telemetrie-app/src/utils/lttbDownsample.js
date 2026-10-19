// @ts-check
'use strict';

/**
 * Largest-Triangle-Three-Buckets (LTTB) Downsampling Algorithm
 * Downsamples time-series data while preserving visually significant peaks, valleys, and anomalies.
 * Reduces 3,600+ points to ~100 points for 60 FPS chart rendering without stuttering.
 * 
 * @param {Array<{ x: number, y: number, value?: number }>} data - Input array of points
 * @param {number} threshold - Target number of points to output (e.g. 80-120)
 * @returns {Array<{ x: number, y: number, value?: number }>} Downsampled points
 */
export function lttbDownsample(data, threshold = 100) {
    if (!Array.isArray(data) || data.length <= threshold || threshold <= 2) {
        return data || [];
    }

    const sampled = [];
    const dataLength = data.length;
    const bucketSize = (dataLength - 2) / (threshold - 2);

    let a = 0; // Initially the first point in the dataset
    sampled.push(data[a]);

    for (let i = 0; i < threshold - 2; i++) {
        // Calculate point average for next bucket (bucket C)
        let avgX = 0;
        let avgY = 0;
        let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
        let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
        avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;

        const avgRangeLength = avgRangeEnd - avgRangeStart;

        for (let j = avgRangeStart; j < avgRangeEnd; j++) {
            const pt = data[j];
            const yVal = pt.value !== undefined ? pt.value : pt.y;
            avgX += pt.x !== undefined ? pt.x : j;
            avgY += Number(yVal) || 0;
        }
        avgX /= (avgRangeLength || 1);
        avgY /= (avgRangeLength || 1);

        // Get the range for this bucket (bucket B)
        let rangeOffs = Math.floor(i * bucketSize) + 1;
        let rangeTo = Math.floor((i + 1) * bucketSize) + 1;

        // Point a
        const ptA = data[a];
        const pointAx = ptA.x !== undefined ? ptA.x : a;
        const pointAy = Number(ptA.value !== undefined ? ptA.value : ptA.y) || 0;

        let maxArea = -1;
        let nextA = rangeOffs;

        for (let j = rangeOffs; j < rangeTo; j++) {
            const ptB = data[j];
            if (!ptB) continue;
            const ptBx = ptB.x !== undefined ? ptB.x : j;
            const ptBy = Number(ptB.value !== undefined ? ptB.value : ptB.y) || 0;

            // Calculate triangle area over points: (pointAx, pointAy), (ptBx, ptBy), (avgX, avgY)
            const area = Math.abs(
                (pointAx - avgX) * (ptBy - pointAy) -
                (pointAx - ptBx) * (avgY - pointAy)
            ) * 0.5;

            if (area > maxArea) {
                maxArea = area;
                nextA = j;
            }
        }

        sampled.push(data[nextA]); // Pick the point that forms the largest triangle
        a = nextA;
    }

    // Always keep the last point
    sampled.push(data[dataLength - 1]);

    return sampled;
}

export default lttbDownsample;
