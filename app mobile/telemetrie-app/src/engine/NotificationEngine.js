'use strict';

// ── Notification type/category/severity enums ─────────────────────────────────
export const NOTIF_TYPE = Object.freeze({
    HEALTH_DROP:              'HEALTH_DROP',
    HEALTH_IMPROVE:           'HEALTH_IMPROVE',
    LONG_TRIP_STATUS_CHANGE:  'LONG_TRIP_STATUS_CHANGE',
    NEW_RECOMMENDATION:       'NEW_RECOMMENDATION',
    MAINTENANCE_OVERDUE:      'MAINTENANCE_OVERDUE',
    MAINTENANCE_DUE_SOON:     'MAINTENANCE_DUE_SOON',
    DOCUMENT_EXPIRING:        'DOCUMENT_EXPIRING',
    DOCUMENT_EXPIRED:         'DOCUMENT_EXPIRED',
    NEW_PREDICTION:           'NEW_PREDICTION',
    CRITICAL_ALERT:           'CRITICAL_ALERT',
    MILESTONE_ACHIEVED:       'MILESTONE_ACHIEVED',
    UNUSUAL_SERVICE_COST:     'UNUSUAL_SERVICE_COST',
});

export const NOTIF_CATEGORY = Object.freeze({
    HEALTH:          'HEALTH',
    MAINTENANCE:     'MAINTENANCE',
    RECOMMENDATIONS: 'RECOMMENDATIONS',
    PREDICTIONS:     'PREDICTIONS',
    ALERTS:          'ALERTS',
    DOCUMENTS:       'DOCUMENTS',
    MILESTONES:      'MILESTONES',
});

export const NOTIF_SEVERITY = Object.freeze({
    INFO:     'INFO',
    WARNING:  'WARNING',
    CRITICAL: 'CRITICAL',
});

// ── Notification icons per type ───────────────────────────────────────────────
export const NOTIF_ICON = {
    [NOTIF_TYPE.HEALTH_DROP]:             '↓',
    [NOTIF_TYPE.HEALTH_IMPROVE]:          '↑',
    [NOTIF_TYPE.LONG_TRIP_STATUS_CHANGE]: '🛣',
    [NOTIF_TYPE.NEW_RECOMMENDATION]:      '⚠',
    [NOTIF_TYPE.MAINTENANCE_OVERDUE]:     '!',
    [NOTIF_TYPE.MAINTENANCE_DUE_SOON]:    '○',
    [NOTIF_TYPE.DOCUMENT_EXPIRING]:       '📄',
    [NOTIF_TYPE.DOCUMENT_EXPIRED]:        '!',
    [NOTIF_TYPE.NEW_PREDICTION]:          '◈',
    [NOTIF_TYPE.CRITICAL_ALERT]:          '✗',
    [NOTIF_TYPE.MILESTONE_ACHIEVED]:      '★',
    [NOTIF_TYPE.UNUSUAL_SERVICE_COST]:    '$',
};

// ── Content-based stable IDs (prevent duplicates on re-sync) ─────────────────
function stableId(type, key) {
    return `${type}::${String(key).replace(/\s+/g, '_').toLowerCase()}`;
}

function scoreRange(s) {
    // Quantize to nearest-5 bucket to avoid churning notifications on tiny fluctuations
    return Math.round((s || 0) / 5) * 5;
}

// ── Main generator ────────────────────────────────────────────────────────────
/**
 * generateNotifications(summaryData, lastSeen)
 *   summaryData — from /api/vehicles/:id/summary (DigitalTwinSerializer.toPDF + timeline)
 *   lastSeen    — from extractLastSeenState() of previous summaryData, persisted between sessions
 *
 * Returns: Array<Notification> with stable content-based IDs (deduplication-safe).
 */
export function generateNotifications(summaryData, lastSeen = {}) {
    if (!summaryData) return [];

    const now   = Date.now();
    const notifs = [];
    const add   = (n) => notifs.push(n);

    const {
        health          = {},
        recommendations = [],
        maintenance     = [],
        predictions     = [],
        milestones      = [],
        documents       = [],
        alertLevel      = 'NORMAL',
    } = summaryData;

    const hs = health.overallHealth ?? null;

    // ── 1. Critical Alert Level ─────────────────────────────────────────────
    if (alertLevel && alertLevel !== 'NORMAL' && alertLevel !== lastSeen.alertLevel) {
        const ALERT_TEXT = {
            DO_NOT_DRIVE:  'Vehiculul necesita interventie imediata.',
            WORKSHOP:      'Mergeti la service cat mai curand posibil.',
            AVOID_HIGHWAY: 'Evitati autostrada si vitezele mari.',
            CAUTION:       'Conduceti cu prudenta si monitorizati vehiculul.',
        };
        add({
            id:       stableId(NOTIF_TYPE.CRITICAL_ALERT, alertLevel),
            type:     NOTIF_TYPE.CRITICAL_ALERT,
            category: NOTIF_CATEGORY.ALERTS,
            severity: ['DO_NOT_DRIVE', 'WORKSHOP'].includes(alertLevel)
                ? NOTIF_SEVERITY.CRITICAL
                : NOTIF_SEVERITY.WARNING,
            icon:      NOTIF_ICON[NOTIF_TYPE.CRITICAL_ALERT],
            title:    'Alerta vehicul',
            body:     ALERT_TEXT[alertLevel] || alertLevel,
            timestamp: now,
            read:     false,
            data:     { alertLevel },
        });
    }

    // ── 2. Health Score changes (quantized to ±5 buckets) ──────────────────
    if (hs != null && lastSeen.healthScore != null) {
        const newBucket  = scoreRange(hs);
        const prevBucket = scoreRange(lastSeen.healthScore);
        const delta      = newBucket - prevBucket;
        if (delta <= -5) {
            add({
                id:       stableId(NOTIF_TYPE.HEALTH_DROP, newBucket),
                type:     NOTIF_TYPE.HEALTH_DROP,
                category: NOTIF_CATEGORY.HEALTH,
                severity: delta <= -15 ? NOTIF_SEVERITY.CRITICAL : NOTIF_SEVERITY.WARNING,
                icon:     NOTIF_ICON[NOTIF_TYPE.HEALTH_DROP],
                title:    'Health Score scazut',
                body:     `Scorul de sanatate a scazut la ${Math.round(hs)}/100 (Δ${delta}).`,
                timestamp: now,
                read:     false,
                data:     { healthScore: hs, delta },
            });
        } else if (delta >= 5) {
            add({
                id:       stableId(NOTIF_TYPE.HEALTH_IMPROVE, newBucket),
                type:     NOTIF_TYPE.HEALTH_IMPROVE,
                category: NOTIF_CATEGORY.HEALTH,
                severity: NOTIF_SEVERITY.INFO,
                icon:     NOTIF_ICON[NOTIF_TYPE.HEALTH_IMPROVE],
                title:    'Vehicul imbunatatit',
                body:     `Scorul de sanatate a crescut la ${Math.round(hs)}/100 (+${delta}).`,
                timestamp: now,
                read:     false,
                data:     { healthScore: hs, delta },
            });
        }
    }

    // ── 3. Long Trip Ready status ───────────────────────────────────────────
    const ltr    = (hs ?? 0) >= 75 && alertLevel === 'NORMAL';
    const wasLtr = (lastSeen.healthScore ?? 0) >= 75 && lastSeen.alertLevel === 'NORMAL';
    if (lastSeen.healthScore != null && ltr !== wasLtr) {
        add({
            id:       stableId(NOTIF_TYPE.LONG_TRIP_STATUS_CHANGE, String(ltr)),
            type:     NOTIF_TYPE.LONG_TRIP_STATUS_CHANGE,
            category: NOTIF_CATEGORY.HEALTH,
            severity: ltr ? NOTIF_SEVERITY.INFO : NOTIF_SEVERITY.WARNING,
            icon:     NOTIF_ICON[NOTIF_TYPE.LONG_TRIP_STATUS_CHANGE],
            title:    ltr ? 'Drum lung recomandat' : 'Drum lung — verificare necesara',
            body:     ltr
                ? 'Vehiculul este pregatit pentru un drum lung.'
                : 'Se recomanda o verificare inainte de un drum lung.',
            timestamp: now,
            read:     false,
            data:     { longTripReady: ltr },
        });
    }

    // ── 4. IMMEDIATE recommendations (new ones only) ────────────────────────
    const seenRecIds = new Set(lastSeen.recIds || []);
    recommendations
        .filter(r => r.urgency === 'IMMEDIATE')
        .forEach(rec => {
            const recKey = rec.failureId || rec.title || '';
            if (recKey && !seenRecIds.has(recKey)) {
                add({
                    id:       stableId(NOTIF_TYPE.NEW_RECOMMENDATION, recKey),
                    type:     NOTIF_TYPE.NEW_RECOMMENDATION,
                    category: NOTIF_CATEGORY.RECOMMENDATIONS,
                    severity: NOTIF_SEVERITY.CRITICAL,
                    icon:     NOTIF_ICON[NOTIF_TYPE.NEW_RECOMMENDATION],
                    title:    'Recomandare urgenta',
                    body:     rec.title || rec.failureId || 'Verificare necesara.',
                    timestamp: now,
                    read:     false,
                    data:     { recId: recKey, urgency: rec.urgency, cost: rec.estimatedRepairCost },
                });
            }
        });

    // ── 5. SOON recommendations (max 2 new) ─────────────────────────────────
    recommendations
        .filter(r => r.urgency === 'SOON')
        .slice(0, 2)
        .forEach(rec => {
            const recKey = rec.failureId || rec.title || '';
            if (recKey && !seenRecIds.has(recKey)) {
                add({
                    id:       stableId(NOTIF_TYPE.NEW_RECOMMENDATION, 'soon::' + recKey),
                    type:     NOTIF_TYPE.NEW_RECOMMENDATION,
                    category: NOTIF_CATEGORY.RECOMMENDATIONS,
                    severity: NOTIF_SEVERITY.WARNING,
                    icon:     NOTIF_ICON[NOTIF_TYPE.NEW_RECOMMENDATION],
                    title:    'Recomandare in curand',
                    body:     rec.title || rec.failureId || 'Verificare recomandata.',
                    timestamp: now,
                    read:     false,
                    data:     { recId: recKey, urgency: rec.urgency },
                });
            }
        });

    // ── 6. Maintenance OVERDUE (max 4) ──────────────────────────────────────
    maintenance
        .filter(m => m.status === 'OVERDUE')
        .slice(0, 4)
        .forEach(item => {
            const itemKey = item.item_name || item.item_type || '';
            add({
                id:       stableId(NOTIF_TYPE.MAINTENANCE_OVERDUE, itemKey),
                type:     NOTIF_TYPE.MAINTENANCE_OVERDUE,
                category: NOTIF_CATEGORY.MAINTENANCE,
                severity: NOTIF_SEVERITY.CRITICAL,
                icon:     NOTIF_ICON[NOTIF_TYPE.MAINTENANCE_OVERDUE],
                title:    'Mentenanta depasita',
                body:     `${itemKey || 'Element'} — intervalul de service a fost depasit.`,
                timestamp: now,
                read:     false,
                data:     { itemKey, status: 'OVERDUE' },
            });
        });

    // ── 7. Maintenance DUE_SOON (max 3) ─────────────────────────────────────
    maintenance
        .filter(m => m.status === 'DUE_SOON')
        .slice(0, 3)
        .forEach(item => {
            const itemKey = item.item_name || item.item_type || '';
            const detail  = item.remaining_days
                ? `~${item.remaining_days} zile`
                : (item.remaining_km ? `~${item.remaining_km} km` : '');
            add({
                id:       stableId(NOTIF_TYPE.MAINTENANCE_DUE_SOON, itemKey),
                type:     NOTIF_TYPE.MAINTENANCE_DUE_SOON,
                category: NOTIF_CATEGORY.MAINTENANCE,
                severity: NOTIF_SEVERITY.WARNING,
                icon:     NOTIF_ICON[NOTIF_TYPE.MAINTENANCE_DUE_SOON],
                title:    'Mentenanta in curand',
                body:     `${itemKey || 'Element'}${detail ? ` — ${detail} ramase` : ''}.`,
                timestamp: now,
                read:     false,
                data:     { itemKey, remaining: { days: item.remaining_days, km: item.remaining_km } },
            });
        });

    // ── 8. High-probability predictions (≥60%, max 3 new) ───────────────────
    const seenPredIds = new Set(lastSeen.predIds || []);
    predictions
        .filter(p => (p.probability ?? 0) >= 60)
        .slice(0, 3)
        .forEach(pred => {
            const predKey = pred.component || '';
            if (predKey && !seenPredIds.has(predKey)) {
                add({
                    id:       stableId(NOTIF_TYPE.NEW_PREDICTION, predKey),
                    type:     NOTIF_TYPE.NEW_PREDICTION,
                    category: NOTIF_CATEGORY.PREDICTIONS,
                    severity: (pred.probability ?? 0) >= 80
                        ? NOTIF_SEVERITY.CRITICAL
                        : NOTIF_SEVERITY.WARNING,
                    icon:     NOTIF_ICON[NOTIF_TYPE.NEW_PREDICTION],
                    title:    'Predictie defectiune',
                    body:     `${predKey}: probabilitate ${pred.probability}%.${pred.estimatedRemainingKm ? ` Ramane ~${Math.round(pred.estimatedRemainingKm)} km.` : ''}`,
                    timestamp: now,
                    read:     false,
                    data:     { component: predKey, probability: pred.probability },
                });
            }
        });

    // ── 9. Document EXPIRED (all expired) ────────────────────────────────────
    documents
        .filter(d => d.status === 'EXPIRED')
        .forEach(doc => {
            const docKey = doc.id ? String(doc.id) : (doc.title || '');
            add({
                id:       stableId(NOTIF_TYPE.DOCUMENT_EXPIRED, docKey),
                type:     NOTIF_TYPE.DOCUMENT_EXPIRED,
                category: NOTIF_CATEGORY.DOCUMENTS,
                severity: NOTIF_SEVERITY.CRITICAL,
                icon:     NOTIF_ICON[NOTIF_TYPE.DOCUMENT_EXPIRED],
                title:    'Document expirat',
                body:     `${doc.title || 'Document'} a expirat. Reînnoiți cât mai curând.`,
                timestamp: now,
                read:     false,
                data:     { docId: docKey, docType: doc.type, title: doc.title },
            });
        });

    // ── 10. Document EXPIRING (all expiring) ──────────────────────────────────
    documents
        .filter(d => d.status === 'EXPIRING')
        .forEach(doc => {
            const docKey = doc.id ? String(doc.id) : (doc.title || '');
            const daysLeft = doc.expiry_date
                ? Math.ceil((doc.expiry_date * 1000 - now) / 86400000)
                : null;
            add({
                id:       stableId(NOTIF_TYPE.DOCUMENT_EXPIRING, docKey),
                type:     NOTIF_TYPE.DOCUMENT_EXPIRING,
                category: NOTIF_CATEGORY.DOCUMENTS,
                severity: NOTIF_SEVERITY.WARNING,
                icon:     NOTIF_ICON[NOTIF_TYPE.DOCUMENT_EXPIRING],
                title:    'Document expiră curând',
                body:     `${doc.title || 'Document'}${daysLeft != null ? ` — mai ${daysLeft} ${daysLeft === 1 ? 'zi' : 'zile'}` : ''}.`,
                timestamp: now,
                read:     false,
                data:     { docId: docKey, docType: doc.type, title: doc.title, daysLeft },
            });
        });

    // ── 11. Milestones achieved (max 2 new) ───────────────────────────────────
    const seenMsIds = new Set(lastSeen.msIds || []);
    milestones
        .filter(ms => ms.achieved_at && !seenMsIds.has(ms.id || ms.title))
        .slice(0, 2)
        .forEach(ms => {
            const msKey = String(ms.id || ms.title || '');
            add({
                id:       stableId(NOTIF_TYPE.MILESTONE_ACHIEVED, msKey),
                type:     NOTIF_TYPE.MILESTONE_ACHIEVED,
                category: NOTIF_CATEGORY.MILESTONES,
                severity: NOTIF_SEVERITY.INFO,
                icon:     ms.icon || NOTIF_ICON[NOTIF_TYPE.MILESTONE_ACHIEVED],
                title:    'Jalon atins',
                body:     `${ms.title || msKey}: ${ms.description || 'Obiectiv indeplinit!'}`,
                timestamp: now,
                read:     false,
                data:     { msId: msKey, title: ms.title },
            });
        });

    // Deduplicate by ID (last-write-wins, but order preserved)
    const seen = new Set();
    return notifs.filter(n => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
    });
}

// ── Extract "last seen" state snapshot (persisted between syncs) ──────────────
export function extractLastSeenState(summaryData) {
    if (!summaryData) return {};
    return {
        healthScore: summaryData.health?.overallHealth ?? null,
        alertLevel:  summaryData.alertLevel ?? null,
        recIds:      (summaryData.recommendations || [])
            .map(r => r.failureId || r.title)
            .filter(Boolean),
        predIds:     (summaryData.predictions || [])
            .map(p => p.component)
            .filter(Boolean),
        msIds:       (summaryData.milestones || [])
            .map(ms => ms.id || ms.title)
            .filter(Boolean),
        docIds:      (summaryData.documents || [])
            .map(d => d.id ? String(d.id) : d.title)
            .filter(Boolean),
    };
}
