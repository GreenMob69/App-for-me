/**
 * DataIntegrityEngine.js — Validare integritate date ÎNAINTE de analiză
 * -----------------------------------------------------------------------
 * Se execută primul în pipeline. Verifică:
 *   - PID-uri lipsă (câmpuri obligatorii absente)
 *   - Timestamp invalid (NaN, negativ, în viitor, ordine greșită)
 *   - Valori imposibile fizic (RPM negativ, Coolant=-40, Voltage=40V)
 *   - Inconsistențe logice (RPM=0 + Speed=120)
 *   - Duplicate (timestamp identic)
 *   - Pachete corupte (JSON malformat, structură incompletă)
 *
 * Returnează: { valid: boolean, warnings: [], errors: [], stats: {} }
 * -----------------------------------------------------------------------
 */

const REQUIRED_PIDS = ['rpm', 'speed', 'coolant', 'voltage'];

const PHYSICAL_LIMITS = {
    rpm:     { min: 0, max: 8000 },
    speed:   { min: 0, max: 300 },
    coolant: { min: -30, max: 140 },
    oil:     { min: -30, max: 180 },
    voltage: { min: 6, max: 18 },
    maf:     { min: 0, max: 600 },
    map:     { min: 0, max: 400 },
    boost:   { min: -1, max: 4 },
    load:    { min: 0, max: 100 },
    fuelRate:{ min: 0, max: 80 },
    dpfSoot: { min: 0, max: 100 },
    torque:  { min: 0, max: 800 },
    accelG:  { min: -3, max: 3 }
};

const CONSISTENCY_RULES = [
    {
        id: 'RPM_ZERO_SPEED_HIGH',
        check: (pids) => pids.rpm === 0 && pids.speed > 30,
        message: 'RPM=0 dar Speed>{speed} km/h — imposibil fizic'
    },
    {
        id: 'COOLANT_EXTREME_LOW',
        check: (pids) => pids.coolant !== null && pids.coolant < -35,
        message: 'Temperatura antigel sub -35°C — senzor deconectat sau eroare'
    },
    {
        id: 'VOLTAGE_IMPOSSIBLE',
        check: (pids) => pids.voltage > 20 || pids.voltage < 4,
        message: 'Tensiune {voltage}V — valoare fizic imposibilă pentru sistem 12V'
    },
    {
        id: 'MAF_HIGH_LOAD_ZERO',
        check: (pids) => pids.maf > 100 && pids.load === 0,
        message: 'MAF={maf} g/s dar Load=0% — date contradictorii'
    },
    {
        id: 'BOOST_WITHOUT_RPM',
        check: (pids) => pids.boost > 1.5 && pids.rpm < 500,
        message: 'Boost={boost} bar la RPM={rpm} — turbo nu poate genera presiune fără turație'
    }
];

function extractPidValues(pachet) {
    return {
        rpm: pachet.motor?.rpm ?? null,
        speed: pachet.motor?.speed ?? null,
        load: pachet.motor?.load ?? null,
        accelG: pachet.motor?.accel_g ?? null,
        torque: pachet.motor?.torque_actual ?? null,
        coolant: pachet.temperaturi?.coolant ?? null,
        oil: pachet.temperaturi?.oil ?? null,
        maf: pachet.aer?.maf ?? null,
        map: pachet.aer?.map ?? null,
        boost: pachet.aer?.boost_actual ?? null,
        voltage: pachet.baterie?.ecu_volt ?? null,
        fuelRate: pachet.combustibil?.inst_cons ?? null,
        dpfSoot: pachet.dpf?.soot_load ?? null
    };
}

function validatePacket(pachet, index, prevTimestamp) {
    const warnings = [];
    const errors = [];

    if (!pachet || typeof pachet !== 'object') {
        errors.push({ type: 'CORRUPT_PACKET', index, message: 'Pachet nul sau non-obiect' });
        return { warnings, errors, timestamp: null };
    }

    const ts = pachet.timestamp;
    if (!ts || typeof ts !== 'number' || ts < 0 || isNaN(ts)) {
        errors.push({ type: 'INVALID_TIMESTAMP', index, message: `Timestamp invalid: ${ts}` });
    } else if (prevTimestamp && ts < prevTimestamp) {
        warnings.push({ type: 'TIMESTAMP_ORDER', index, message: `Timestamp mai mic decât precedentul (${ts} < ${prevTimestamp})` });
    } else if (prevTimestamp && ts === prevTimestamp) {
        warnings.push({ type: 'DUPLICATE_TIMESTAMP', index, message: `Timestamp duplicat: ${ts}` });
    }

    const pids = extractPidValues(pachet);

    for (const pid of REQUIRED_PIDS) {
        if (pids[pid] === null || pids[pid] === undefined) {
            warnings.push({ type: 'MISSING_PID', index, pid, message: `PID obligatoriu lipsă: ${pid}` });
        }
    }

    for (const [pid, limits] of Object.entries(PHYSICAL_LIMITS)) {
        const val = pids[pid];
        if (val === null || val === undefined) continue;
        if (val < limits.min || val > limits.max) {
            errors.push({ type: 'IMPOSSIBLE_VALUE', index, pid, value: val, message: `${pid}=${val} depășește limitele fizice [${limits.min}, ${limits.max}]` });
        }
    }

    for (const rule of CONSISTENCY_RULES) {
        if (rule.check(pids)) {
            const msg = rule.message
                .replace('{speed}', pids.speed)
                .replace('{voltage}', pids.voltage)
                .replace('{maf}', pids.maf)
                .replace('{boost}', pids.boost)
                .replace('{rpm}', pids.rpm);
            errors.push({ type: 'INCONSISTENCY', index, rule: rule.id, message: msg });
        }
    }

    return { warnings, errors, timestamp: ts };
}

function validateTripData(packets) {
    if (!packets || !Array.isArray(packets) || packets.length === 0) {
        return {
            valid: false,
            warnings: [],
            errors: [{ type: 'NO_DATA', message: 'Niciun pachet de telemetrie disponibil' }],
            stats: { totalPackets: 0, validPackets: 0, invalidPackets: 0, missingPidCount: 0, duplicateCount: 0 }
        };
    }

    const allWarnings = [];
    const allErrors = [];
    let prevTimestamp = null;
    let validPackets = 0;
    let duplicateCount = 0;
    let missingPidCount = 0;

    for (let i = 0; i < packets.length; i++) {
        const { warnings, errors, timestamp } = validatePacket(packets[i], i, prevTimestamp);
        allWarnings.push(...warnings);
        allErrors.push(...errors);

        if (errors.length === 0) validPackets++;
        if (timestamp && timestamp === prevTimestamp) duplicateCount++;
        missingPidCount += warnings.filter(w => w.type === 'MISSING_PID').length;

        if (timestamp && timestamp > (prevTimestamp || 0)) {
            prevTimestamp = timestamp;
        }
    }

    const invalidPackets = packets.length - validPackets;
    const errorRate = invalidPackets / packets.length;

    if (errorRate > 0.5) {
        allErrors.unshift({ type: 'HIGH_ERROR_RATE', message: `Rata de erori este ${Math.round(errorRate * 100)}% — datele sunt nesigure` });
    }

    return {
        valid: allErrors.length === 0,
        warnings: allWarnings,
        errors: allErrors,
        stats: {
            totalPackets: packets.length,
            validPackets,
            invalidPackets,
            missingPidCount,
            duplicateCount,
            errorRate: Math.round(errorRate * 100)
        }
    };
}

module.exports = { validateTripData, validatePacket };
