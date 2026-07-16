/**
 * statusUtils.js — utilitare semantice pentru stări și scoruri
 *
 * Centralizează toate constantele de culori semantice, funcțiile
 * de mapare score → culoare și etichetele de status.
 * Importat de orice componentă sau ecran care afișează statusuri.
 */

import { colors } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// SEVERITY COLORS — pentru ObservationCard, UpcomingTimeline
// ─────────────────────────────────────────────────────────────────────────────

export const SEVERITY_COLORS = {
    info:     colors.accent.default,
    warning:  colors.status.monitor,
    serious:  colors.status.caution,
    critical: colors.status.critical,
};

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATION STYLES — pentru StatusHeader
// ─────────────────────────────────────────────────────────────────────────────

export const EVALUATION_STYLES = {
    EXCELLENT: { color: colors.status.good,     tint: colors.tint.good },
    GOOD:      { color: colors.accent.default,  tint: colors.tint.accent },
    ATTENTION: { color: colors.status.monitor,  tint: colors.tint.monitor },
    PROBLEM:   { color: colors.status.caution,  tint: colors.tint.caution },
    CRITICAL:  { color: colors.status.critical, tint: colors.tint.critical },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE STYLES — pentru ConfidenceBadge
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIDENCE_STYLES = {
    HIGH:   { color: colors.status.good,    bg: colors.tint.good },
    MEDIUM: { color: colors.status.monitor, bg: colors.tint.monitor },
    LOW:    { color: colors.text.secondary, bg: 'rgba(139,150,181,0.10)' },
};

// ─────────────────────────────────────────────────────────────────────────────
// TREND INDICATORS — pentru ComparisonSection
// ─────────────────────────────────────────────────────────────────────────────

export const TREND_INDICATORS = {
    stable:    { color: colors.text.secondary, symbol: '—' },
    improving: { color: colors.status.good,    symbol: '↑' },
    declining: { color: colors.status.caution, symbol: '↓' },
    warning:   { color: colors.status.monitor, symbol: '↓' },
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVE COLORS — pentru stări drive recommendation
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVE_COLORS = {
    NORMAL:        colors.status.optimal,
    CAUTION:       colors.status.monitor,
    AVOID_HIGHWAY: colors.status.caution,
    WORKSHOP:      colors.status.critical,
    DO_NOT_DRIVE:  colors.status.critical,
};

// ─────────────────────────────────────────────────────────────────────────────
// URGENCY LABELS
// ─────────────────────────────────────────────────────────────────────────────

export const URGENCY_LABELS = {
    IMMEDIATE: 'Imediat',
    SOON:      'Curând',
    PLANNED:   'Planificat',
    MONITOR:   'Monitorizare',
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCȚII DE MAPARE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returnează culoarea semantică corespunzătoare unui scor de sănătate (0–100).
 */
export function getHealthColor(score) {
    if (score >= 90) return colors.status.optimal;
    if (score >= 75) return colors.status.good;
    if (score >= 55) return colors.status.monitor;
    if (score >= 35) return colors.status.caution;
    return colors.status.critical;
}

/**
 * Returnează culoarea de tint corespunzătoare unui scor de sănătate (0–100).
 */
export function getHealthTint(score) {
    if (score >= 90) return colors.tint.optimal;
    if (score >= 75) return colors.tint.good;
    if (score >= 55) return colors.tint.monitor;
    if (score >= 35) return colors.tint.caution;
    return colors.tint.critical;
}

/**
 * Returnează eticheta stil de condus pe baza scorului driving (0–100).
 */
export function getDrivingRank(score) {
    if (score >= 80) return 'Fluid';
    if (score >= 60) return 'Economic';
    return 'Agresiv';
}

/**
 * Returnează culoarea pentru scorul de subsistem (folosit în SubsystemCard).
 */
export function getSubsystemColor(score) {
    if (score >= 85) return colors.status.good;
    if (score >= 60) return colors.status.monitor;
    return colors.status.critical;
}
