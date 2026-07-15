/**
 * SensorQualityEngine.js — Evaluare calitate per senzor
 * -----------------------------------------------------------------------
 * Pentru fiecare senzor monitorizat calculează:
 *   - noise (zgomot statistic — deviație standard a diferențelor consecutive)
 *   - flatline detection (valoare identică pe perioade lungi)
 *   - spikes (salturi bruște care depășesc 3σ)
 *   - missing samples (procent de pachete fără valoare)
 *   - sampling stability (variație în intervalul de timp între mostre)
 *   - impossible jumps (salturi fizic imposibile de la un pachet la altul)
 *   - stale values (ultimele N valori identice)
 *
 * Returnează: [{ sensor, quality, status, problems }]
 * -----------------------------------------------------------------------
 */

const SENSOR_CONFIG = {
    rpm:     { field: 'motor.rpm',             maxDelta: 2000, label: 'RPM' },
    speed:   { field: 'motor.speed',           maxDelta: 40,   label: 'Speed' },
    coolant: { field: 'temperaturi.coolant',   maxDelta: 10,   label: 'Coolant Temp' },
    oil:     { field: 'temperaturi.oil',       maxDelta: 8,    label: 'Oil Temp' },
    maf:     { field: 'aer.maf',              maxDelta: 50,   label: 'MAF' },
    map:     { field: 'aer.map',              maxDelta: 80,   label: 'MAP' },
    boost:   { field: 'aer.boost_actual',     maxDelta: 1.0,  label: 'Boost' },
    voltage: { field: 'baterie.ecu_volt',     maxDelta: 2.0,  label: 'Voltage' },
    fuelRate:{ field: 'combustibil.inst_cons', maxDelta: 15,   label: 'Fuel Rate' },
    load:    { field: 'motor.load',           maxDelta: 40,   label: 'Engine Load' }
};

const FLATLINE_THRESHOLD = 15;
const STALE_THRESHOLD = 10;

function getNestedValue(obj, path) {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
}

function analyzeSensor(sensorKey, config, packets) {
    const values = [];
    const timestamps = [];
    let missingSamples = 0;

    for (const p of packets) {
        const val = getNestedValue(p, config.field);
        if (val === undefined || val === null || isNaN(Number(val))) {
            missingSamples++;
        } else {
            values.push(Number(val));
            timestamps.push(p.timestamp || 0);
        }
    }

    const totalSamples = packets.length;
    const missingPct = totalSamples > 0 ? (missingSamples / totalSamples) * 100 : 100;

    if (values.length < 5) {
        return {
            sensor: config.label,
            key: sensorKey,
            quality: 0,
            status: 'NO_DATA',
            problems: ['Insuficiente mostre pentru evaluare']
        };
    }

    const problems = [];
    let qualityScore = 100;

    // 1. Missing samples
    if (missingPct > 20) {
        qualityScore -= Math.min(30, missingPct * 0.6);
        problems.push(`${Math.round(missingPct)}% mostre lipsă`);
    } else if (missingPct > 5) {
        qualityScore -= missingPct * 0.3;
    }

    // 2. Noise (deviația standard a diferențelor consecutive)
    const diffs = [];
    for (let i = 1; i < values.length; i++) {
        diffs.push(values[i] - values[i - 1]);
    }
    const meanDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    const variance = diffs.reduce((s, d) => s + Math.pow(d - meanDiff, 2), 0) / diffs.length;
    const stdDiff = Math.sqrt(variance);

    // 3. Spikes (salturi peste 3σ)
    let spikeCount = 0;
    for (const d of diffs) {
        if (Math.abs(d - meanDiff) > 3 * stdDiff && stdDiff > 0) {
            spikeCount++;
        }
    }
    const spikePct = (spikeCount / diffs.length) * 100;
    if (spikePct > 5) {
        qualityScore -= Math.min(20, spikePct * 2);
        problems.push(`${spikeCount} spike-uri detectate (${Math.round(spikePct)}%)`);
    }

    // 4. Flatline detection (secvențe lungi cu aceeași valoare)
    let maxFlatline = 1;
    let currentFlatline = 1;
    for (let i = 1; i < values.length; i++) {
        if (values[i] === values[i - 1]) {
            currentFlatline++;
            if (currentFlatline > maxFlatline) maxFlatline = currentFlatline;
        } else {
            currentFlatline = 1;
        }
    }
    if (maxFlatline >= FLATLINE_THRESHOLD) {
        qualityScore -= Math.min(25, (maxFlatline - FLATLINE_THRESHOLD) * 2);
        problems.push(`Flatline: ${maxFlatline} valori consecutive identice`);
    }

    // 5. Impossible jumps (saltul depășește maxDelta)
    let impossibleJumps = 0;
    for (const d of diffs) {
        if (Math.abs(d) > config.maxDelta) {
            impossibleJumps++;
        }
    }
    if (impossibleJumps > 0) {
        qualityScore -= Math.min(20, impossibleJumps * 5);
        problems.push(`${impossibleJumps} salturi imposibile (delta > ${config.maxDelta})`);
    }

    // 6. Stale values (ultimele N valori identice)
    let staleCount = 0;
    const lastVal = values[values.length - 1];
    for (let i = values.length - 2; i >= 0; i--) {
        if (values[i] === lastVal) staleCount++;
        else break;
    }
    if (staleCount >= STALE_THRESHOLD) {
        qualityScore -= Math.min(15, (staleCount - STALE_THRESHOLD));
        problems.push(`Valoare stagnantă: ultimele ${staleCount + 1} mostre identice (${lastVal})`);
    }

    // 7. Sampling stability (variație în intervalele de timp)
    if (timestamps.length > 5) {
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
            const dt = timestamps[i] - timestamps[i - 1];
            if (dt > 0 && dt < 30000) intervals.push(dt);
        }
        if (intervals.length > 2) {
            const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
            const intervalVariance = intervals.reduce((s, v) => s + Math.pow(v - avgInterval, 2), 0) / intervals.length;
            const intervalStd = Math.sqrt(intervalVariance);
            const cv = avgInterval > 0 ? (intervalStd / avgInterval) * 100 : 0;
            if (cv > 50) {
                qualityScore -= Math.min(10, cv * 0.1);
                problems.push(`Instabilitate eșantionare: CV=${Math.round(cv)}%`);
            }
        }
    }

    qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

    let status;
    if (qualityScore >= 90) status = 'EXCELLENT';
    else if (qualityScore >= 75) status = 'GOOD';
    else if (qualityScore >= 50) status = 'DEGRADED';
    else if (qualityScore >= 25) status = 'POOR';
    else status = 'CRITICAL';

    return {
        sensor: config.label,
        key: sensorKey,
        quality: qualityScore,
        status,
        problems
    };
}

function analyzeSensorQuality(packets) {
    if (!packets || !Array.isArray(packets) || packets.length < 5) {
        return [];
    }

    const results = [];
    for (const [key, config] of Object.entries(SENSOR_CONFIG)) {
        results.push(analyzeSensor(key, config, packets));
    }

    return results.sort((a, b) => a.quality - b.quality);
}

module.exports = { analyzeSensorQuality };
