/**
 * SubsystemScorer.js — scoruri per subsistem de propulsie
 * -----------------------------------------------------------------------
 * Scoruri PURE per subsistem: primesc inputs expliciți, returnează structuri
 * identice indiferent de tipul de propulsie.
 *
 * Fiecare scorer returnează:
 *   score       — 0-100, ponderat cu coverage (beneficiu incertitudine: 70)
 *   rawScore    — scorul neponderat din semnale disponibile
 *   coverage    — 0-1.0, fracția PID-urilor cheie disponibile
 *   confidence  — 0-100, coverage × reliability
 *   reliability — 0-1.0, calitatea senzorilor de la SensorQualityEngine
 *   explanation — frază despre ce a condus scorul
 *
 * Formula pentru date parțiale:
 *   score = rawScore × coverage + NEUTRAL × (1 - coverage)
 *
 * Unde NEUTRAL = 70 (beneficiu incertitudine — vehiculul funcționează
 * deci probabil subsistemul este OK, nu știm sigur).
 *
 * NU accesează DiagnosticContext direct — primește inputs extrași de
 * HealthEngine. Astfel rămâne testabil izolat.
 * -----------------------------------------------------------------------
 */

const NEUTRAL = 70;

function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(v)));
}

// ── PID primar per subsistem — folosit pentru reliability din SensorQualityEngine ──
// SensorQualityEngine returnează array: [{ key: 'rpm', quality: 95, ... }]
const SUBSYSTEM_PRIMARY_PID = {
    ENGINE:         'rpm',
    FUEL:           'fuelRate',
    TURBO:          'boost',
    COOLING:        'coolant',
    ELECTRICAL:     'voltage',
    EMISSIONS:      'maf',
    DPF:            null,
    TRANSMISSION:   'rpm',
    LAMBDA:         null,
    BATTERY_PACK:   null,
    ELECTRIC_MOTOR: null,
    THERMAL_MGMT:   'coolant',
    REGENERATION:   null,
    CHARGING:       null,
    ICE_ENGINE:     'rpm',
    HYBRID_BATTERY: null,
};

// ── Coverage — verifică ce date sunt disponibile în summary ──────────────
// Returnează 0.0 (niciun semnal) … 1.0 (toate semnalele prezente)

function computeCoverage(subsystemId, summary) {
    const checker = COVERAGE_CHECKERS[subsystemId];
    if (!checker) return 1.0;
    return Math.min(1.0, Math.max(0.0, checker(summary)));
}

const COVERAGE_CHECKERS = {
    ENGINE:       (s) => {
        const hasRpm   = s?.pid?.rpm?.average !== undefined ? 0.5 : 0;
        const hasZones = s?.rpmZones ? 0.5 : 0;
        return hasRpm + hasZones;
    },
    FUEL:         (s) => (s?.drivingStyle && s?.duration ? 1.0 : 0.4),
    TURBO:        (s) => (s?.pid?.boost?.average !== undefined ? 1.0 : 0.0),
    COOLING:      (s) => (s?.temperature?.coolant ? 1.0 : 0.0),
    ELECTRICAL:   (s) => (s?.pid?.voltage?.average !== undefined ? 1.0 : 0.0),
    EMISSIONS:    (s) => (s?.pid?.maf?.average !== undefined ? 1.0 : 0.0),
    DPF:          (s) => (s?.pid?.dpfSoot?.max !== undefined ? 1.0 : 0.0),
    TRANSMISSION: (s) => {
        const hasRpm   = s?.pid?.rpm?.average !== undefined ? 0.5 : 0;
        const hasSpeed = s?.pid?.speed?.average !== undefined ? 0.5 : 0;
        return hasRpm + hasSpeed;
    },
    LAMBDA:       (s) => (s?.pid?.o2Sensor?.average !== undefined ? 1.0 : 0.0),
    BATTERY_PACK: (s) => (s?.pid?.soc?.average !== undefined ? 0.8 : 0.0),
    ELECTRIC_MOTOR: (s) => (s?.pid?.motorTemp?.average !== undefined ? 1.0 : 0.0),
    THERMAL_MGMT: (s) => (s?.temperature?.coolant ? 0.6 : 0.0),
    REGENERATION: (s) => (s?.pid?.regenPct?.average !== undefined ? 1.0 : 0.0),
    CHARGING:     (s) => (s?.pid?.chargeRate?.average !== undefined ? 1.0 : 0.0),
    ICE_ENGINE:   (s) => COVERAGE_CHECKERS.ENGINE(s),
    HYBRID_BATTERY: (s) => COVERAGE_CHECKERS.BATTERY_PACK(s),
};

// ── Reliability — din SensorQualityEngine (array [{key, quality}]) ────────

function getReliability(subsystemId, sensorQuality) {
    if (!sensorQuality || !Array.isArray(sensorQuality)) return 1.0;
    const pid = SUBSYSTEM_PRIMARY_PID[subsystemId];
    if (!pid) return 1.0;
    const entry = sensorQuality.find(s => s.key === pid);
    if (!entry || typeof entry.quality !== 'number') return 1.0;
    return parseFloat(Math.min(1.0, entry.quality / 100).toFixed(2));
}

// ── Scorers ────────────────────────────────────────────────────────────────

const SCORERS = {

    // ════════════════════════════════════════════════════════════════════
    // ENGINE — stres mecanic: turație, sarcină
    // ════════════════════════════════════════════════════════════════════
    ENGINE: {
        compute({ summary }) {
            let score = 100;
            const rpmZones = summary?.rpmZones;
            if (!rpmZones) return NEUTRAL;

            const highRpmExcess = Math.max(0, (rpmZones.over3500Pct || 0) - 15);
            score -= Math.min(20, highRpmExcess * 0.6);

            const load = summary?.pid?.load?.average;
            if (load && load > 75) {
                score -= Math.min(15, (load - 75) * 0.5);
            }

            const idlePct = rpmZones.idlePct || 0;
            if (idlePct > 35) {
                score -= Math.min(10, (idlePct - 35) * 0.3);
            }

            return clamp(score);
        },
        explain(raw, coverage, { summary }) {
            if (coverage < 0.3) return 'Date RPM insuficiente pentru evaluare motor';
            const highRpm = summary?.rpmZones?.over3500Pct || 0;
            const load    = summary?.pid?.load?.average;
            if (raw < 65) return `Stres mecanic ridicat — ${Math.round(highRpm)}% din timp peste 3500 RPM`;
            if (highRpm > 20) return `Motor solicitat — ${Math.round(highRpm)}% la turații înalte`;
            if (load && load > 75) return `Sarcină medie ridicată: ${Math.round(load)}%`;
            return `Motor în parametri optimi de turație (medie ${Math.round(summary?.pid?.rpm?.average || 0)} RPM)`;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // FUEL — eficiență combustibil + comportament condus
    // ════════════════════════════════════════════════════════════════════
    FUEL: {
        compute({ summary }) {
            let score = 100;

            const aggressivePct = summary?.drivingStyle?.aggressivePct || 0;
            score -= Math.min(30, aggressivePct * 0.5);

            const totalSec = summary?.duration?.totalSeconds || 0;
            const idleSec  = summary?.duration?.idleSeconds  || 0;
            const idleRatio = totalSec > 0 ? (idleSec / totalSec) * 100 : 0;
            score -= Math.min(20, Math.max(0, idleRatio - 10) * 0.6);

            return clamp(score);
        },
        explain(raw, coverage, { summary }) {
            const agg = summary?.drivingStyle?.aggressivePct || 0;
            if (agg > 40) return `Consum crescut — ${Math.round(agg)}% din cursă în regim agresiv`;
            const idleSec = summary?.duration?.idleSeconds || 0;
            if (idleSec > 300) return `Ralanti excesiv — ${Math.round(idleSec / 60)} min oprit cu motorul pornit`;
            if (raw >= 88) return 'Eficiență combustibil bună — condus calm, idle moderat';
            return `Consum în parametri acceptabili (${Math.round(agg)}% regim agresiv)`;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // TURBO — presiune boost, furtunuri, wastegate
    // ════════════════════════════════════════════════════════════════════
    TURBO: {
        compute({ summary, baselineOverrides }) {
            let score = 100;
            const boostAvg = summary?.pid?.boost?.average;
            if (boostAvg === undefined) return NEUTRAL;

            const expectedBoost = baselineOverrides?.boost || 1.2;

            if (boostAvg < 0.5) {
                score -= 40;
            } else if (boostAvg < expectedBoost * 0.75) {
                const deficit = (expectedBoost - boostAvg) / expectedBoost;
                score -= Math.min(35, deficit * 90);
            } else if (boostAvg < expectedBoost * 0.90) {
                const deficit = (expectedBoost - boostAvg) / expectedBoost;
                score -= Math.min(20, deficit * 70);
            }

            const boostMax = summary?.pid?.boost?.max;
            if (boostMax && boostMax < expectedBoost * 0.65) score -= 10;

            return clamp(score);
        },
        explain(raw, coverage, { summary, baselineOverrides }) {
            if (coverage < 0.1) return 'Senzor boost indisponibil — evaluare turbo prin proxy';
            const boostAvg = summary?.pid?.boost?.average;
            const expected = baselineOverrides?.boost || 1.2;
            if (!boostAvg) return 'Date boost insuficiente';
            if (boostAvg < expected * 0.75) {
                return `Presiune boost scăzută — medie ${boostAvg.toFixed(2)} bar (normal: ${expected} bar)`;
            }
            if (raw >= 90) return `Turbosuflantă în parametri buni — boost mediu ${boostAvg.toFixed(2)} bar`;
            return `Presiune boost acceptabilă — ${boostAvg.toFixed(2)} bar`;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // COOLING — management termic: temperaturi, timpi în zone critice
    // ════════════════════════════════════════════════════════════════════
    COOLING: {
        compute({ summary, thresholds }) {
            let score = 100;
            const t = summary?.temperature?.coolant;
            if (!t) return NEUTRAL;

            score -= Math.min(30, ((t.timeOver100 || 0) / 60) * 6);
            score -= Math.min(15, ((t.timeOver95  || 0) / 60) * 2.5);
            score -= Math.min(10, ((t.timeOver90  || 0) / 60) * 1);

            const coolantMax = summary?.pid?.coolant?.max;
            const warningTemp = thresholds?.coolant_warning || 100;
            if (coolantMax && coolantMax > warningTemp + 5) score -= 10;

            return clamp(score);
        },
        explain(raw, coverage, { summary, thresholds }) {
            if (coverage < 0.1) return 'Senzor temperatură indisponibil — evaluare răcire limitată';
            const t = summary?.temperature?.coolant;
            if (!t) return 'Date temperatură lipsă';
            if ((t.timeOver100 || 0) > 60) {
                return `Supraîncălzire detectată — ${Math.round(t.timeOver100 / 60)} min peste 100°C`;
            }
            if ((t.timeOver95 || 0) > 180) {
                return `Temperaturi ridicate — ${Math.round(t.timeOver95 / 60)} min peste 95°C`;
            }
            const maxC = summary?.pid?.coolant?.max;
            if (raw >= 90) return `Sistem răcire optim — maxim ${maxC || '?'}°C`;
            return `Temperaturi acceptabile — maxim ${maxC || '?'}°C`;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // ELECTRICAL — baterie + alternator (tensiune OBD2)
    // ════════════════════════════════════════════════════════════════════
    ELECTRICAL: {
        compute({ summary, baselineOverrides }) {
            let score = 100;
            const voltAvg = summary?.pid?.voltage?.average;
            const voltMin = summary?.pid?.voltage?.min;
            if (voltAvg === undefined) return NEUTRAL;

            if (voltMin && voltMin < 12.5) score -= 30;
            else if (voltMin && voltMin < 13.0) score -= 18;

            if (voltAvg < 13.4) score -= 20;
            else if (voltAvg < 13.8) score -= 10;

            const expected = baselineOverrides?.voltage || 14.0;
            if (voltAvg < expected - 0.5) {
                score -= Math.min(15, (expected - voltAvg) * 10);
            }

            return clamp(score);
        },
        explain(raw, coverage, { summary }) {
            if (coverage < 0.1) return 'Senzor tensiune indisponibil';
            const voltAvg = summary?.pid?.voltage?.average;
            const voltMin = summary?.pid?.voltage?.min;
            if (voltMin && voltMin < 12.5) {
                return `Tensiune critică — minim ${voltMin}V (baterie sau alternator defect)`;
            }
            if (voltAvg && voltAvg < 13.4) {
                return `Tensiune sub normal — medie ${voltAvg}V (alternator posibil degradat)`;
            }
            if (raw >= 90) return `Circuit electric sănătos — tensiune medie ${voltAvg}V`;
            return `Tensiune acceptabilă — medie ${voltAvg}V`;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // EMISSIONS — EGR + debit aer (MAF vs baseline)
    // ════════════════════════════════════════════════════════════════════
    EMISSIONS: {
        compute({ summary, baseline, baselineOverrides }) {
            let score = 100;
            const mafAvg = summary?.pid?.maf?.average;
            if (mafAvg === undefined) return NEUTRAL;

            // Folosim baseline dacă e disponibil (Step 11+); altfel override din pack
            const baselineMaf = baseline?.raw_baseline?.maf || baselineOverrides?.maf;
            if (baselineMaf && baselineMaf > 0) {
                const drop = (baselineMaf - mafAvg) / baselineMaf;
                if (drop > 0.20) score -= 35;
                else if (drop > 0.12) score -= 20;
                else if (drop > 0.06) score -= 10;
            }

            const idlePct = summary?.rpmZones?.idlePct || 0;
            if (idlePct > 40) score -= Math.min(12, (idlePct - 40) * 0.4);

            return clamp(score);
        },
        explain(raw, coverage, { summary, baseline, baselineOverrides }) {
            if (coverage < 0.1) return 'Senzor MAF indisponibil — evaluare emisii/EGR limitată';
            const mafAvg    = summary?.pid?.maf?.average;
            const baselineMaf = baseline?.raw_baseline?.maf || baselineOverrides?.maf;
            if (baselineMaf && mafAvg) {
                const drop = Math.round((baselineMaf - mafAvg) / baselineMaf * 100);
                if (drop > 15) return `Debit aer redus cu ${drop}% față de normal — posibile depuneri EGR`;
            }
            if (raw >= 88) return `EGR și debit aer în parametri normali (${mafAvg?.toFixed(1)} g/s)`;
            return `Debit aer ${mafAvg?.toFixed(1)} g/s — monitorizare recomandată`;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // DPF — filtru particule diesel
    // ════════════════════════════════════════════════════════════════════
    DPF: {
        compute({ summary }) {
            let score = 100;
            const dpfMax  = summary?.pid?.dpfSoot?.max;
            const dpfAvg  = summary?.pid?.dpfSoot?.average;
            const idlePct = summary?.rpmZones?.idlePct || 0;
            const distKm  = summary?.distanceKm || 0;
            const durSec  = summary?.duration?.totalSeconds || 0;

            if (dpfMax) {
                if (dpfMax > 60)      score -= 40;
                else if (dpfMax > 45) score -= 25;
                else if (dpfMax > 30) score -= 12;
            } else if (dpfAvg && dpfAvg > 25) {
                score -= 10;
            }

            if (idlePct > 40) score -= Math.min(12, (idlePct - 40) * 0.4);

            // Curse scurte repetate → regenerare imposibilă
            if (distKm < 10 && durSec > 600) score -= 10;

            return clamp(score);
        },
        explain(raw, coverage, { summary }) {
            if (coverage < 0.1) return 'PID DPF indisponibil — estimare prin pattern curse';
            const dpfMax = summary?.pid?.dpfSoot?.max;
            if (dpfMax && dpfMax > 60) return `DPF înfundat — ${dpfMax}% soot (regenerare urgentă)`;
            if (dpfMax && dpfMax > 45) return `DPF la limita de regenerare — ${dpfMax}% soot`;
            if (raw >= 90) return `DPF funcțional — nivel funingine în parametri`;
            return 'DPF în stare acceptabilă — monitorizare de rutină';
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // TRANSMISSION — raport RPM/viteză, kickdown-uri
    // ════════════════════════════════════════════════════════════════════
    TRANSMISSION: {
        compute({ summary }) {
            let score = 100;
            const rpm   = summary?.pid?.rpm?.average;
            const speed = summary?.pid?.speed?.average;

            if (rpm && speed && speed > 50 && rpm > 3200) {
                score -= Math.min(20, (rpm - 3200) / 60);
            }

            const kickdowns = summary?.events?.kickdowns || 0;
            const distKm = Math.max(summary?.distanceKm || 1, 1);
            score -= Math.min(15, (kickdowns / distKm) * 30);

            return clamp(score);
        },
        explain(raw, coverage, { summary }) {
            if (coverage < 0.3) return 'Date transmisie insuficiente';
            const kickdowns = summary?.events?.kickdowns || 0;
            if (kickdowns > 5) return `${kickdowns} kickdown-uri — solicitare crescută a transmisiei`;
            if (raw >= 90) return 'Transmisie operată în parametri optimi';
            return 'Transmisie în parametri acceptabili';
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // LAMBDA — sondă lambda oxigen (benzinǎ)
    // ════════════════════════════════════════════════════════════════════
    LAMBDA: {
        compute({ summary }) {
            const o2 = summary?.pid?.o2Sensor?.average;
            if (o2 === undefined) return NEUTRAL;
            const deviation = Math.abs(1.0 - o2);
            return clamp(100 - deviation * 200);
        },
        explain(raw, coverage, { summary }) {
            if (coverage < 0.1) return 'Senzor lambda indisponibil — evaluare arderi limitată';
            const o2 = summary?.pid?.o2Sensor?.average;
            if (!o2) return 'Date lambda lipsă';
            if (o2 < 0.85) return `Amestec bogat (λ=${o2.toFixed(2)}) — injectoare sau MAF`;
            if (o2 > 1.15) return `Amestec sărac (λ=${o2.toFixed(2)}) — scurgere aer sau MAF`;
            return `Lambda în parametri optimi (λ=${o2.toFixed(2)})`;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // BEV / HEV — scorers stub
    // Returnează scor neutru cu coverage 0 — onest față de lipsa datelor OBD2.
    // La implementarea Failure Library / Diagnostic Graph, acești scorers vor
    // fi înlocuiți cu implementări reale.
    // ════════════════════════════════════════════════════════════════════

    BATTERY_PACK: {
        compute({ summary }) {
            const soc = summary?.pid?.soc?.average;
            if (!soc) return NEUTRAL;
            if (soc < 15) return clamp(40);
            if (soc < 30) return clamp(70);
            return clamp(90);
        },
        explain(raw, coverage) {
            return coverage < 0.1
                ? 'Date baterie indisponibile prin OBD2 standard (scorer placeholder)'
                : `Stare baterie estimată — date limitate (${Math.round(coverage * 100)}% acoperire)`;
        }
    },

    ELECTRIC_MOTOR: {
        compute() { return NEUTRAL; },
        explain() { return 'Date motor electric indisponibile prin OBD2 standard'; }
    },

    THERMAL_MGMT: {
        compute({ summary }) {
            const t = summary?.temperature?.coolant;
            if (!t) return NEUTRAL;
            let score = 100;
            score -= Math.min(25, ((t.timeOver95 || 0) / 60) * 3);
            return clamp(score);
        },
        explain(raw, coverage) {
            return coverage < 0.1
                ? 'Date termomanagement limitate'
                : 'Termomanagement evaluat prin proxy temperatură lichid răcire';
        }
    },

    REGENERATION: {
        compute() { return NEUTRAL; },
        explain() { return 'Date recuperare energie indisponibile prin OBD2 standard'; }
    },

    CHARGING: {
        compute() { return NEUTRAL; },
        explain() { return 'Date sistem încărcare indisponibile prin OBD2 standard'; }
    },
};

// Alias-uri pentru subsistemele HEV (același scorer, ID diferit)
SCORERS.ICE_ENGINE     = SCORERS.ENGINE;
SCORERS.HYBRID_BATTERY = SCORERS.BATTERY_PACK;

// ── API public ─────────────────────────────────────────────────────────────

/**
 * Scoreaza un subsistem.
 *
 * @param {string} subsystemId
 * @param {Object} inputs
 *   @param {Object}      inputs.summary          - TripSummary
 *   @param {Object}      inputs.thresholds        - KnowledgePack.threshold_overrides
 *   @param {Object}      inputs.baselineOverrides - KnowledgePack.baseline_overrides
 *   @param {Object|null} inputs.baseline          - BaselineEngine result (null la Step 4)
 *   @param {Object|null} inputs.trends            - TrendEngine result
 *   @param {Array|null}  inputs.sensorQuality     - SensorQualityEngine result array
 * @returns {{ id, score, rawScore, coverage, confidence, reliability, explanation }}
 */
function scoreSubsystem(subsystemId, inputs) {
    const scorer = SCORERS[subsystemId];
    if (!scorer) {
        return {
            id: subsystemId, score: NEUTRAL, rawScore: NEUTRAL,
            coverage: 0, confidence: 0, reliability: 1.0,
            explanation: `Scorer nedisponibil pentru subsistemul ${subsystemId}`,
        };
    }

    const coverage    = computeCoverage(subsystemId, inputs.summary);
    const reliability = getReliability(subsystemId, inputs.sensorQuality);
    const raw         = clamp(scorer.compute(inputs));

    // Date parțiale → ponderat cu neutral (nu ignorat)
    const blended = Math.round(raw * coverage + NEUTRAL * (1 - coverage));

    return {
        id:          subsystemId,
        score:       clamp(blended),
        rawScore:    raw,
        coverage:    parseFloat(coverage.toFixed(2)),
        confidence:  Math.round(coverage * reliability * 100),
        reliability: reliability,
        explanation: scorer.explain(raw, coverage, inputs),
    };
}

/**
 * Scoreaza toate subsistemele active dintr-un PowertrainProfile.
 *
 * @param {{ id, label, effectiveWeight }[]} activeSubsystems - din computeActiveSubsystems()
 * @param {Object} inputs - același obiect ca pentru scoreSubsystem
 * @returns {{ id, label, effectiveWeight, score, rawScore, coverage, confidence, reliability, explanation }[]}
 */
function scoreAllSubsystems(activeSubsystems, inputs) {
    return activeSubsystems.map(sub => {
        const result = scoreSubsystem(sub.id, inputs);
        return {
            ...result,
            label:           sub.label,
            effectiveWeight: sub.effectiveWeight,
        };
    });
}

module.exports = { scoreSubsystem, scoreAllSubsystems, SUBSYSTEM_PIDS: COVERAGE_CHECKERS };
