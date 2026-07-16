'use strict';
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
    ink:       '#111827',
    muted:     '#6b7280',
    light:     '#9ca3af',
    accent:    '#4d8ef5',
    navyDark:  '#0f1c3f',
    navyMid:   '#1e2d5a',
    bgSubtle:  '#f4f6fb',
    border:    '#e2e4ed',
    optimal:   '#2fcfa4',
    good:      '#34d172',
    monitor:   '#f0c04a',
    caution:   '#f0883e',
    critical:  '#f06464',
    neutral:   '#8b96b5',
    white:     '#ffffff',
};

const A4_W = 595.28;
const A4_H = 841.89;
const M    = 50;          // margin
const CW   = A4_W - M*2; // 495.28 usable width

// ── Font resolution ───────────────────────────────────────────────────────────
const FONT_REG  = 'C:\\Windows\\Fonts\\arial.ttf';
const FONT_BOLD = 'C:\\Windows\\Fonts\\arialbd.ttf';
const FONT_ITAL = 'C:\\Windows\\Fonts\\ariali.ttf';
const HAS_ARIAL = fs.existsSync(FONT_REG) && fs.existsSync(FONT_BOLD);

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s) {
    if (s == null) return C.neutral;
    if (s >= 90)  return C.optimal;
    if (s >= 75)  return C.good;
    if (s >= 55)  return C.monitor;
    if (s >= 35)  return C.caution;
    return C.critical;
}

function urgencyColor(u) {
    if (u === 'IMMEDIATE') return C.critical;
    if (u === 'SOON')      return C.caution;
    if (u === 'PLANNED')   return C.monitor;
    return C.neutral;
}

function mtnStatusColor(s) {
    if (s === 'OVERDUE')  return C.critical;
    if (s === 'DUE_SOON') return C.caution;
    if (s === 'OK')       return C.good;
    return C.neutral;
}

function alertLevelColor(l) {
    if (l === 'DO_NOT_DRIVE')  return C.critical;
    if (l === 'WORKSHOP')      return C.caution;
    if (l === 'AVOID_HIGHWAY') return C.monitor;
    if (l === 'CAUTION')       return C.monitor;
    return C.good;
}

function alertLevelLabel(l) {
    const MAP = {
        'DO_NOT_DRIVE':  'NU CONDUCETI',
        'WORKSHOP':      'MERGETI LA SERVICE',
        'AVOID_HIGHWAY': 'EVITATI AUTOSTRADA',
        'CAUTION':       'PRECAUTIE',
        'NORMAL':        'STARE NORMALA',
    };
    return MAP[l] || (l || 'N/A');
}

function fmtKm(n) {
    if (n == null) return '—';
    return `${Number(Math.round(n)).toLocaleString('ro-RO')} km`;
}

function fmtNum(n, dec = 0) {
    if (n == null) return '—';
    return Number(n).toLocaleString('ro-RO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtCost(cost) {
    if (!cost) return '—';
    if (cost.min && cost.max) return `${cost.min}–${cost.max} RON`;
    if (cost.min) return `${cost.min} RON`;
    if (cost.max) return `${cost.max} RON`;
    return '—';
}

function fmtDate(ts) {
    if (!ts) return '—';
    try {
        const d = ts < 1e11 ? new Date(ts * 1000) : new Date(ts);
        return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return '—'; }
}

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n || 0));
}

function subName(id) {
    const MAP = {
        engine:      'MOTOR',
        cooling:     'RACIRE',
        fuel:        'COMBUSTIBIL',
        electrical:  'ELECTRIC',
        turbo:       'TURBO',
        dpf:         'DPF',
        transmission:'TRANSMISIE',
        egr:         'EGR',
        driving:     'STIL CONDUS',
        safety:      'SIGURANTA',
    };
    return MAP[(id || '').toLowerCase()] || (id || '').toUpperCase();
}

// ── PDFReportGenerator ────────────────────────────────────────────────────────
class PDFReportGenerator {
    constructor(data, supp = {}) {
        this.data = data;
        this.supp = supp;
        this.doc  = new PDFDocument({
            size: 'A4',
            autoFirstPage: false,
            bufferPages: false,
            info: {
                Title:   'Raport Diagnostic Auto',
                Author:  'OBD-II Monitor',
                Subject: `${data.identity?.make || ''} ${data.identity?.model || ''} — Diagnostic Report`,
            },
        });
        this.pageNum = 0;
        this.totalPages = 7;
        this.ts = new Date().toLocaleString('ro-RO', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        if (HAS_ARIAL) {
            this.doc.registerFont('R', FONT_REG);
            this.doc.registerFont('B', FONT_BOLD);
            if (fs.existsSync(FONT_ITAL)) this.doc.registerFont('I', FONT_ITAL);
            else this.doc.registerFont('I', FONT_REG);
        }
        this.R = HAS_ARIAL ? 'R' : 'Helvetica';
        this.B = HAS_ARIAL ? 'B' : 'Helvetica-Bold';
        this.I = HAS_ARIAL ? 'I' : 'Helvetica-Oblique';
    }

    generate(stream) {
        this.doc.pipe(stream);
        this._pageCover();
        this._pageSubsystems();
        this._pageRecommendations();
        this._pageMaintenance();
        this._pagePredictions();
        this._pageTimeline();
        this._pageExecutiveSummary();
        this.doc.end();
    }

    // ── Page scaffolding ─────────────────────────────────────────────────────

    _addPage() {
        this.pageNum++;
        this.doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
        this.y = M;
    }

    _stripHeader(label) {
        const doc = this.doc;
        doc.rect(0, 0, A4_W, 26).fillColor(C.navyDark).fill();
        doc.font(this.B).fontSize(8).fillColor(C.accent)
            .text('OBD-II MONITOR', M, 8);
        doc.font(this.R).fontSize(7.5).fillColor('rgba(255,255,255,0.55)')
            .text(label, M + 120, 9, { align: 'left', width: 200 });
        doc.font(this.R).fontSize(7).fillColor('rgba(255,255,255,0.4)')
            .text(`${this.pageNum} / ${this.totalPages}`, A4_W - M - 28, 9, { align: 'right', width: 28 });
        this.y = 38;
    }

    _footer() {
        const doc = this.doc;
        const fy  = A4_H - 22;
        doc.rect(0, fy, A4_W, 22).fillColor(C.bgSubtle).fill();
        doc.rect(0, fy, A4_W, 0.5).fillColor(C.border).fill();
        doc.font(this.R).fontSize(6.5).fillColor(C.light)
            .text('Generat de OBD-II Monitor v1.0 — Digital Twin Engine', M, fy + 7);
        doc.font(this.R).fontSize(6.5).fillColor(C.light)
            .text(this.ts, A4_W - M - 160, fy + 7, { align: 'right', width: 160 });
    }

    _sectionBar(title, y, bg = C.navyMid) {
        const doc = this.doc;
        doc.rect(M, y, CW, 18).fillColor(bg).fill();
        doc.font(this.B).fontSize(7.5).fillColor(C.white)
            .text(title.toUpperCase(), M + 8, y + 5, { width: CW - 16 });
        return y + 22;
    }

    _divider(y) {
        this.doc.rect(M, y, CW, 0.5).fillColor(C.border).fill();
        return y + 6;
    }

    _progressBar(x, y, w, h, pct, color) {
        const doc = this.doc;
        doc.rect(x, y, w, h).fillColor('#dfe2ea').fill();
        const fw = Math.round(clamp(pct, 0, 100) * w / 100);
        if (fw > 0) doc.rect(x, y, fw, h).fillColor(color).fill();
    }

    _badge(text, x, y, bg, fg = C.white) {
        const doc   = this.doc;
        doc.font(this.B).fontSize(7);
        const tw = doc.widthOfString(text);
        const bw = Math.min(tw + 10, 120);
        doc.rect(x, y, bw, 13).fillColor(bg).fill();
        doc.fillColor(fg).text(text, x + 5, y + 3, { width: bw - 10, lineBreak: false });
        return bw;
    }

    // ── Page 1: Cover ────────────────────────────────────────────────────────

    _pageCover() {
        const { data } = this;
        const id       = data.identity  || {};
        const health   = data.health    || {};
        const meta     = data.meta      || {};
        const lastTrip = data.lastTrip  || {};
        const doc      = this.doc;

        this._addPage();

        // ── Hero strip
        doc.rect(0, 0, A4_W, 108).fillColor(C.navyDark).fill();
        doc.rect(0, 108, A4_W, 3).fillColor(C.accent).fill();

        // App name + report type
        doc.font(this.B).fontSize(24).fillColor(C.accent)
            .text('OBD-II MONITOR', M, 26);
        doc.font(this.R).fontSize(11).fillColor('rgba(255,255,255,0.65)')
            .text('RAPORT DIAGNOSTIC COMPLET', M, 60);
        doc.font(this.R).fontSize(8).fillColor('rgba(255,255,255,0.35)')
            .text(`Generat: ${this.ts}`, M, 80);

        // Alert level box (top right)
        const alColor = alertLevelColor(data.alertLevel);
        const alLabel = alertLevelLabel(data.alertLevel);
        doc.rect(A4_W - M - 130, 26, 130, 60)
            .fillColor(alColor + '18').fill();
        doc.rect(A4_W - M - 130, 26, 3, 60).fillColor(alColor).fill();
        doc.font(this.R).fontSize(7).fillColor(alColor)
            .text('STATUS GENERAL', A4_W - M - 124, 35, { width: 120 });
        doc.font(this.B).fontSize(11).fillColor(alColor)
            .text(alLabel, A4_W - M - 124, 49, { width: 120 });

        this.y = 122;

        // ── Vehicle identity card
        doc.rect(M, this.y, CW, 72).fillColor(C.bgSubtle).fill();
        doc.rect(M, this.y, CW, 72).strokeColor(C.border).lineWidth(0.5).stroke();

        const vehicleFull = [id.make, id.model, id.variant].filter(Boolean).join(' ');
        doc.font(this.B).fontSize(19).fillColor(C.navyDark)
            .text(vehicleFull || 'Vehicul', M + 14, this.y + 10, { width: CW * 0.62 });
        doc.font(this.R).fontSize(9).fillColor(C.muted)
            .text(
                [id.year, id.fuelType, id.engineCode, id.emissionStandard].filter(Boolean).join(' · '),
                M + 14, this.y + 36, { width: CW * 0.62 }
            );

        // Plate + color row
        const plateLine = [id.plateNumber, id.color].filter(Boolean).join(' · ');
        if (plateLine) {
            doc.font(this.R).fontSize(8).fillColor(C.light)
                .text(plateLine, M + 14, this.y + 52, { width: CW * 0.62 });
        }

        // VIN right-aligned
        doc.font(this.B).fontSize(8.5).fillColor(C.muted)
            .text('VIN', M + CW * 0.64, this.y + 16, { width: CW * 0.33, align: 'right' });
        doc.font(this.R).fontSize(9.5).fillColor(C.navyDark)
            .text(id.vin || '—', M + CW * 0.64, this.y + 30, { width: CW * 0.33, align: 'right' });
        if (id.currentMileageKm) {
            doc.font(this.B).fontSize(16).fillColor(C.accent)
                .text(fmtKm(id.currentMileageKm), M + CW * 0.64, this.y + 48, { width: CW * 0.33, align: 'right' });
        }
        this.y += 82;

        // ── Health score row (4 blocks)
        const scores = [
            { label: 'HEALTH SCORE',  val: health.overallHealth, big: true },
            { label: 'MOTOR',         val: health.engineScore },
            { label: 'COMBUSTIBIL',   val: health.fuelScore },
            { label: 'SIGURANTA',     val: health.safetyScore },
        ];
        const bw = CW / 4;
        scores.forEach((s, i) => {
            const bx  = M + i * bw;
            const bg  = s.big ? C.navyDark : (i % 2 === 0 ? C.bgSubtle : C.white);
            const vc  = scoreColor(s.val);
            const txt = s.val != null ? String(Math.round(s.val)) : '—';
            doc.rect(bx, this.y, bw, 62).fillColor(bg).fill();
            if (i > 0) doc.rect(bx, this.y, 0.5, 62).fillColor(C.border).fill();
            doc.font(this.B).fontSize(s.big ? 30 : 22).fillColor(s.big ? C.white : vc)
                .text(txt, bx, this.y + (s.big ? 8 : 12), { width: bw, align: 'center' });
            doc.font(s.big ? this.B : this.R).fontSize(7).fillColor(s.big ? C.accent : C.muted)
                .text(s.label, bx, this.y + (s.big ? 46 : 46), { width: bw, align: 'center' });
        });
        this.y += 66;

        // Long Trip Ready
        const ltr = (health.overallHealth ?? 0) >= 75 && data.alertLevel === 'NORMAL';
        doc.font(this.R).fontSize(8.5).fillColor(C.muted)
            .text('Drum lung recomandat:', M, this.y + 3, { continued: true })
            .font(this.B).fillColor(ltr ? C.good : C.caution)
            .text(ltr ? '  DA' : '  NU — verificare necesara');
        doc.font(this.R).fontSize(8.5).fillColor(C.muted)
            .text(`  ·  Stil condus: ${health.drivingScore != null ? Math.round(health.drivingScore) + '/100' : '—'}`, M + 240, this.y + 3);
        this.y += 18;

        // ── Last trip summary
        if (lastTrip.distanceKm) {
            this.y = this._sectionBar('ULTIMA CURSA', this.y, '#2a3a6e');
            const ltY  = this.y;
            const ltW  = CW / 5;
            const ltData = [
                { l: 'DISTANTA',    v: `${fmtNum(lastTrip.distanceKm, 1)} km` },
                { l: 'CONSUM',      v: `${fmtNum(lastTrip.avgConsumption100km, 1)} L/100` },
                { l: 'VITEZA MAX',  v: `${fmtNum(lastTrip.maxSpeedKmh)} km/h` },
                { l: 'ECO SCORE',   v: `${Math.round(lastTrip.ecoScore || 0)}/100` },
                { l: 'ALERTE',      v: String(lastTrip.alertCount || 0) },
            ];
            ltData.forEach((c, i) => {
                const cx = M + i * ltW;
                if (i > 0) doc.rect(cx, ltY, 0.5, 32).fillColor(C.border).fill();
                doc.font(this.R).fontSize(7).fillColor(C.muted)
                    .text(c.l, cx + 2, ltY + 3, { width: ltW - 4, align: 'center' });
                doc.font(this.B).fontSize(11).fillColor(C.navyDark)
                    .text(c.v, cx + 2, ltY + 14, { width: ltW - 4, align: 'center' });
            });
            this.y = ltY + 36;
        }

        // ── Reasoning summary
        if (data.reasoning?.summary) {
            this.y = this._sectionBar('SUMAR DIAGNOSTIC AI', this.y);
            doc.font(this.R).fontSize(9).fillColor(C.ink).lineGap(2)
                .text(data.reasoning.summary, M + 8, this.y, {
                    width: CW - 16, align: 'justify', lineBreak: true,
                });
            this.y = doc.y + 8;
        }

        // Meta footer line
        this.y = this._divider(this.y + 4);
        doc.font(this.R).fontSize(7).fillColor(C.light)
            .text(
                `Completitudine: ${meta.dataCompleteness ?? 0}%  ·  Knowledge Pack: ${meta.activeKnowledgePack || '—'}  ·  Pipeline: ${meta.pipelineSteps?.length || 19} pasi  ·  v${meta.version || '1.0'}`,
                M, this.y, { width: CW }
            );

        this._footer();
    }

    // ── Page 2: Subsystem Scores ─────────────────────────────────────────────

    _pageSubsystems() {
        const { data } = this;
        const health = data.health || {};
        const doc    = this.doc;

        this._addPage();
        this._stripHeader('STARE SISTEME & METRICI VEHICUL');

        // ── Subsystem scores
        this.y = this._sectionBar('SCORURI SUBSISTEME', this.y);

        const subSystems = health.subsystems?.length
            ? health.subsystems
            : [
                { id: 'engine',      label: 'Motor',         score: health.engineScore   },
                { id: 'fuel',        label: 'Combustibil',   score: health.fuelScore     },
                { id: 'driving',     label: 'Stil condus',   score: health.drivingScore  },
                { id: 'safety',      label: 'Siguranta',     score: health.safetyScore   },
            ].filter(s => s.score != null);

        const barW    = CW * 0.48;
        const barX    = M + CW - barW;
        const rowH    = 26;

        subSystems.forEach((sub, i) => {
            const ry  = this.y + i * rowH;
            const bg  = i % 2 === 0 ? C.bgSubtle : C.white;
            doc.rect(M, ry, CW, rowH).fillColor(bg).fill();

            const score  = sub.score ?? sub.effectiveWeight ?? null;
            const sColor = scoreColor(score);
            const sText  = score != null ? Math.round(score) : '—';

            // Subsystem name
            doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                .text(subName(sub.id || sub.label), M + 8, ry + 8, { width: 110 });

            // Status pill
            const statusLabel = score == null ? 'N/A'
                : score >= 90 ? 'OPTIM'
                : score >= 75 ? 'BUN'
                : score >= 55 ? 'MONITORIZARE'
                : score >= 35 ? 'ATENTIE'
                : 'CRITIC';
            doc.font(this.R).fontSize(7).fillColor(sColor)
                .text(statusLabel, M + 122, ry + 9, { width: 80 });

            // Score value
            doc.font(this.B).fontSize(10.5).fillColor(sColor)
                .text(String(sText), barX - 36, ry + 6, { width: 32, align: 'right' });

            // Progress bar
            this._progressBar(barX, ry + 9, barW, 8, score ?? 0, sColor);
        });
        this.y += subSystems.length * rowH + 12;

        // ── Baseline deviations
        const devs = data.baseline?.deviations || {};
        const devKeys = Object.keys(devs).filter(k => devs[k] != null);
        if (devKeys.length > 0) {
            this.y = this._sectionBar('DEVIATII FATA DE LINIA DE BAZA', this.y);
            const half = Math.ceil(devKeys.length / 2);
            devKeys.forEach((k, i) => {
                const col = i < half ? 0 : 1;
                const row = i < half ? i : i - half;
                const dx  = M + col * (CW / 2);
                const dy  = this.y + row * 18;
                const val = devs[k];
                const pct = parseFloat(val) || 0;
                const col_ = Math.abs(pct) > 15 ? C.caution : Math.abs(pct) > 5 ? C.monitor : C.good;
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(k.replace(/_/g, ' ').toUpperCase(), dx + 4, dy + 3, { width: CW/2 - 60 });
                doc.font(this.B).fontSize(8.5).fillColor(col_)
                    .text(`${pct > 0 ? '+' : ''}${fmtNum(pct, 1)}%`, dx + CW/2 - 56, dy + 3, { width: 50, align: 'right' });
            });
            this.y += half * 18 + 8;
        }

        // ── Vehicle DNA traits
        const traits = data.dna?.traits || [];
        if (traits.length > 0) {
            this.y = this._sectionBar('AMPRENTĂ VEHICUL (DNA)', this.y);
            const fp = data.dna?.fingerprint;
            if (fp) {
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(`Fingerprint: `, M + 8, this.y + 2, { continued: true })
                    .font(this.B).fillColor(C.navyDark).text(fp);
                this.y += 16;
            }
            traits.slice(0, 8).forEach((trait, i) => {
                const tx = M + 8 + (i % 3) * (CW / 3);
                const ty = this.y + Math.floor(i / 3) * 14;
                doc.font(this.R).fontSize(8).fillColor(C.ink)
                    .text(`• ${trait}`, tx, ty, { width: CW / 3 - 8 });
            });
            this.y += Math.ceil(Math.min(traits.length, 8) / 3) * 14 + 6;
        }

        // ── Capabilities
        const caps = data.profile?.capabilities;
        if (caps) {
            this.y = this._sectionBar('ECHIPAMENTE & CAPABILITATI', this.y);
            const capList = Object.entries(caps)
                .filter(([, v]) => v === true || v === false)
                .map(([k, v]) => ({ k, v }));
            const capW = CW / 4;
            capList.slice(0, 16).forEach((c, i) => {
                const cx = M + (i % 4) * capW;
                const cy = this.y + Math.floor(i / 4) * 14;
                const dot = c.v ? '●' : '○';
                const col = c.v ? C.good : C.muted;
                doc.font(this.B).fontSize(7.5).fillColor(col)
                    .text(`${dot} ${c.k.replace(/has/i, '').replace(/([A-Z])/g, ' $1').trim().toUpperCase()}`,
                        cx + 4, cy, { width: capW - 8 });
            });
            this.y += Math.ceil(Math.min(capList.length, 16) / 4) * 14 + 6;
        }

        this._footer();
    }

    // ── Page 3: Recommendations ──────────────────────────────────────────────

    _pageRecommendations() {
        const { data } = this;
        const recs = data.recommendations || [];
        const doc  = this.doc;

        this._addPage();
        this._stripHeader('RECOMANDARI PRIORITIZATE');

        if (recs.length === 0) {
            this.y = this._sectionBar('RECOMANDARI', this.y);
            doc.font(this.I).fontSize(9).fillColor(C.muted)
                .text('Nicio recomandare activa. Vehiculul este in stare optima.', M + 8, this.y + 8);
            this._footer();
            return;
        }

        this.y = this._sectionBar(`RECOMANDARI ACTIVE — ${recs.length} ELEMENTE`, this.y);

        const visibleRecs = recs.slice(0, 8);
        const recH = Math.min(Math.floor((A4_H - this.y - 40) / visibleRecs.length), 68);

        visibleRecs.forEach((rec, i) => {
            const ry     = this.y + i * recH;
            const uColor = urgencyColor(rec.urgency);
            const bg     = i % 2 === 0 ? C.bgSubtle : C.white;

            doc.rect(M, ry, CW, recH - 2).fillColor(bg).fill();
            doc.rect(M, ry, 4, recH - 2).fillColor(uColor).fill();

            // Rank circle
            doc.rect(M + 8, ry + 5, 18, 18).fillColor(uColor + '22').fill();
            doc.font(this.B).fontSize(10).fillColor(uColor)
                .text(String(rec.rank || i + 1), M + 8, ry + 7, { width: 18, align: 'center' });

            // Title + urgency badge
            doc.font(this.B).fontSize(9).fillColor(C.navyDark)
                .text(rec.title || rec.failureId || '—', M + 32, ry + 6, { width: CW * 0.42 });

            // Urgency / Severity badges
            let bx = M + CW * 0.46;
            bx += this._badge(rec.urgency || '—', bx, ry + 5, uColor) + 4;

            if (rec.severity) {
                const sCol = rec.severity === 'CRITICAL' ? C.critical
                           : rec.severity === 'HIGH'     ? C.caution
                           : rec.severity === 'MEDIUM'   ? C.monitor : C.neutral;
                this._badge(rec.severity, bx, ry + 5, sCol);
            }

            // Drive recommendation
            if (rec.driveRecommendation && rec.driveRecommendation !== 'NORMAL') {
                doc.font(this.R).fontSize(7).fillColor(uColor)
                    .text(`⚠ ${rec.driveRecommendation}`, M + 32, ry + 22, { width: 200 });
            }

            // Recommended action
            if (rec.recommendedAction) {
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(rec.recommendedAction, M + 32, ry + (rec.driveRecommendation !== 'NORMAL' ? 33 : 22),
                        { width: CW * 0.44, lineBreak: false });
            }

            // Right column: cost + time
            const rightX = M + CW * 0.72;
            const rightW = CW * 0.27;
            doc.font(this.R).fontSize(7).fillColor(C.muted)
                .text('Cost estimat:', rightX, ry + 6, { width: rightW });
            doc.font(this.B).fontSize(8.5).fillColor(C.ink)
                .text(fmtCost(rec.estimatedRepairCost), rightX, ry + 16, { width: rightW });

            if (rec.estimatedRepairTime) {
                const rt = rec.estimatedRepairTime;
                const timeStr = rt.min && rt.max
                    ? `${rt.min}–${rt.max} ${rt.unit || 'ore'}`
                    : `${rt.min || rt.max || '—'} ${rt.unit || 'ore'}`;
                doc.font(this.R).fontSize(7).fillColor(C.muted)
                    .text(`Timp: ${timeStr}`, rightX, ry + 30, { width: rightW });
            }

            if (rec.diyPossible === false) {
                doc.font(this.R).fontSize(7).fillColor(C.caution)
                    .text(`Service: ${rec.recommendedWorkshopType || 'GENERAL'}`, rightX, ry + 42, { width: rightW });
            }

            // Source tag
            if (rec.isRootCause) {
                doc.font(this.R).fontSize(6.5).fillColor(C.accent)
                    .text('CAUZA RADACINA', M + 32, ry + recH - 13, { width: 100 });
            }
        });

        this.y += visibleRecs.length * recH + 8;

        if (recs.length > 8) {
            doc.font(this.I).fontSize(8).fillColor(C.muted)
                .text(`... si ${recs.length - 8} recomandari suplimentare in sistemul de monitoring.`, M, this.y);
        }

        this._footer();
    }

    // ── Page 4: Maintenance ──────────────────────────────────────────────────

    _pageMaintenance() {
        const { data, supp } = this;
        const maintenance = data.maintenance || [];
        const milestones  = data.milestones  || [];
        const services    = supp.services    || [];
        const doc         = this.doc;

        this._addPage();
        this._stripHeader('MENTENANTA, SERVICII & JALOANE');

        // ── Maintenance items table
        this.y = this._sectionBar(`STARE MENTENANTA — ${maintenance.length} ELEMENTE`, this.y);

        const sorted = [...maintenance].sort((a, b) => {
            const ord = { OVERDUE: 0, DUE_SOON: 1, UNKNOWN: 2, OK: 3 };
            return (ord[a.status] ?? 4) - (ord[b.status] ?? 4);
        });

        const rowH   = 20;
        const colWs  = [CW * 0.30, CW * 0.14, CW * 0.16, CW * 0.18, CW * 0.22];
        const colXs  = [M, M + colWs[0], M + colWs[0] + colWs[1], M + colWs[0] + colWs[1] + colWs[2], M + colWs[0] + colWs[1] + colWs[2] + colWs[3]];
        const hdrs   = ['ELEMENT', 'STATUS', 'UZURA %', 'RAMAS KM', 'URMATOARE'];

        // Header row
        doc.rect(M, this.y, CW, rowH).fillColor(C.navyDark).fill();
        hdrs.forEach((h, i) => {
            doc.font(this.B).fontSize(7).fillColor(C.white)
                .text(h, colXs[i] + 4, this.y + 6, { width: colWs[i] - 8 });
        });
        this.y += rowH;

        sorted.slice(0, 14).forEach((item, i) => {
            const ry   = this.y + i * rowH;
            const bg   = i % 2 === 0 ? C.bgSubtle : C.white;
            const sCol = mtnStatusColor(item.status);

            doc.rect(M, ry, CW, rowH).fillColor(bg).fill();

            // Name
            doc.font(this.B).fontSize(8).fillColor(C.navyDark)
                .text(item.item_name || item.item_type || '—', colXs[0] + 4, ry + 6, { width: colWs[0] - 8, lineBreak: false });
            // Status
            doc.font(this.B).fontSize(7.5).fillColor(sCol)
                .text(item.status || '—', colXs[1] + 4, ry + 6, { width: colWs[1] - 8, lineBreak: false });
            // Wear %
            const wp = item.wear_percent ?? 0;
            this._progressBar(colXs[2] + 4, ry + 8, colWs[2] - 16, 6, clamp(wp, 0, 100), sCol);
            doc.font(this.R).fontSize(7).fillColor(sCol)
                .text(`${Math.round(wp)}%`, colXs[2] + colWs[2] - 22, ry + 6, { width: 18, align: 'right' });
            // Remaining km
            doc.font(this.R).fontSize(8).fillColor(C.ink)
                .text(item.remaining_km != null ? fmtKm(item.remaining_km) : '—', colXs[3] + 4, ry + 6, { width: colWs[3] - 8, lineBreak: false });
            // Next due
            const nextDue = item.next_due_date
                ? fmtDate(item.next_due_date)
                : (item.next_due_km ? fmtKm(item.next_due_km) : '—');
            doc.font(this.R).fontSize(8).fillColor(C.ink)
                .text(nextDue, colXs[4] + 4, ry + 6, { width: colWs[4] - 8, lineBreak: false });
        });
        this.y += Math.min(sorted.length, 14) * rowH + 10;

        // ── Recent services
        if (services.length > 0) {
            this.y = this._sectionBar('ISTORIC SERVICII RECENTE', this.y);
            services.slice(0, 5).forEach((svc, i) => {
                const sy = this.y + i * 22;
                const bg = i % 2 === 0 ? C.bgSubtle : C.white;
                doc.rect(M, sy, CW, 22).fillColor(bg).fill();
                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(svc.title || 'Service', M + 8, sy + 6, { width: CW * 0.40 });
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(fmtDate(svc.performed_at), M + CW * 0.42, sy + 7, { width: 80 });
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(fmtKm(svc.mileage_km), M + CW * 0.58, sy + 7, { width: 80 });
                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(svc.cost_total ? `${fmtNum(svc.cost_total)} RON` : '—', M + CW * 0.76, sy + 7, { width: CW * 0.24, align: 'right' });
            });
            this.y += Math.min(services.length, 5) * 22 + 8;
        }

        // ── Milestones
        if (milestones.length > 0) {
            this.y = this._sectionBar('JALOANE VEHICUL', this.y);
            milestones.slice(0, 6).forEach((ms, i) => {
                const my = this.y + i * 20;
                const bg = i % 2 === 0 ? C.bgSubtle : C.white;
                doc.rect(M, my, CW, 20).fillColor(bg).fill();
                doc.font(this.B).fontSize(8.5).fillColor(C.accent)
                    .text(ms.icon || '★', M + 6, my + 5, { width: 16 });
                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(ms.title || '—', M + 24, my + 5, { width: CW * 0.50 });
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(fmtDate(ms.achieved_at), M + CW * 0.56, my + 6, { width: 80 });
                if (ms.mileage_km) {
                    doc.font(this.R).fontSize(8).fillColor(C.light)
                        .text(fmtKm(ms.mileage_km), M + CW * 0.76, my + 6, { width: CW * 0.23, align: 'right' });
                }
            });
            this.y += Math.min(milestones.length, 6) * 20 + 6;
        }

        this._footer();
    }

    // ── Page 5: Predictions & Reasoning ─────────────────────────────────────

    _pagePredictions() {
        const { data } = this;
        const preds   = data.predictions || [];
        const rsn     = data.reasoning   || {};
        const doc     = this.doc;

        this._addPage();
        this._stripHeader('PREDICTII DEFECTIUNI & ANALIZA CAUZALA');

        // ── Fault predictions
        const visPreds = preds.slice(0, 6);
        this.y = this._sectionBar(`PREDICTII ACTIVE — ${preds.length} COMPONENTE`, this.y);

        if (visPreds.length === 0) {
            doc.font(this.I).fontSize(9).fillColor(C.muted)
                .text('Nicio predictie activa. Toate componentele in parametri normali.', M + 8, this.y + 8);
            this.y += 30;
        } else {
            const pH  = 54;
            visPreds.forEach((p, i) => {
                const py     = this.y + i * pH;
                const col    = i % 2 === 0 ? 0 : 1;
                const row    = Math.floor(i / 2);
                const px     = M + col * (CW / 2);
                const piy    = this.y + row * pH;
                const pColor = p.severity === 'HIGH' ? C.critical : p.severity === 'MEDIUM' ? C.caution : C.monitor;

                if (i % 2 === 0) {
                    // new row background
                    doc.rect(M, piy, CW, pH - 2).fillColor(row % 2 === 0 ? C.bgSubtle : C.white).fill();
                }

                const halfW = CW / 2 - 8;
                doc.rect(px + 4, piy + 4, halfW, pH - 8).fillColor(C.white).fill();
                doc.rect(px + 4, piy + 4, halfW, pH - 8).strokeColor(pColor + '44').lineWidth(0.5).stroke();
                doc.rect(px + 4, piy + 4, 3, pH - 8).fillColor(pColor).fill();

                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(p.component || '—', px + 12, piy + 8, { width: halfW * 0.55 });
                doc.font(this.R).fontSize(7).fillColor(C.muted)
                    .text(p.category || '—', px + 12, piy + 21, { width: halfW * 0.55 });

                // Probability bar
                const probColor = p.probability >= 70 ? C.critical : p.probability >= 40 ? C.caution : C.monitor;
                this._progressBar(px + 12, piy + 36, halfW * 0.55, 5, p.probability || 0, probColor);
                doc.font(this.B).fontSize(8).fillColor(probColor)
                    .text(`${p.probability || 0}%`, px + halfW * 0.55 + 14, piy + 33, { width: 28 });

                // Remaining km / days
                doc.font(this.R).fontSize(7.5).fillColor(C.muted)
                    .text(
                        p.estimatedRemainingKm
                            ? `~${fmtKm(p.estimatedRemainingKm)}`
                            : (p.estimatedRemainingDays ? `~${p.estimatedRemainingDays} zile` : '—'),
                        px + halfW * 0.62, piy + 8, { width: halfW * 0.37 }
                    );

                // Confidence
                doc.font(this.R).fontSize(7).fillColor(C.light)
                    .text(`Incredere: ${p.confidence ?? '—'}%`, px + halfW * 0.62, piy + 22, { width: halfW * 0.37 });

                // Cost
                if (p.estimatedRepairCostRange) {
                    doc.font(this.B).fontSize(8).fillColor(C.navyDark)
                        .text(fmtCost(p.estimatedRepairCostRange), px + halfW * 0.62, piy + 34, { width: halfW * 0.37 });
                }
            });
            this.y += Math.ceil(visPreds.length / 2) * pH + 8;
        }

        // ── Reasoning Engine output
        if (rsn && (rsn.rootCauses?.length > 0 || rsn.chains?.length > 0)) {
            this.y = this._sectionBar(`ANALIZA CAUZALA — Incredere ${rsn.confidence ?? '—'}%`, this.y);

            // Root causes
            if (rsn.rootCauses?.length > 0) {
                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text('Cauze radacina detectate:', M + 8, this.y + 2);
                this.y += 16;

                rsn.rootCauses.slice(0, 4).forEach((rc, i) => {
                    const ry = this.y + i * 20;
                    doc.rect(M, ry, CW, 20).fillColor(i % 2 === 0 ? C.bgSubtle : C.white).fill();
                    this._badge(`RC-${i + 1}`, M + 6, ry + 4, C.accent);
                    doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                        .text(rc.label || rc.id || '—', M + 44, ry + 6, { width: CW * 0.45 });
                    doc.font(this.R).fontSize(7.5).fillColor(C.muted)
                        .text(`${rc.explainedCount || 0} efecte explicate`, M + CW * 0.52, ry + 6, { width: CW * 0.20 });
                    doc.font(this.B).fontSize(8).fillColor(C.accent)
                        .text(`Scor: ${rc.score ?? '—'}`, M + CW * 0.74, ry + 6, { width: CW * 0.24, align: 'right' });
                });
                this.y += rsn.rootCauses.slice(0, 4).length * 20 + 8;
            }

            // Causal chain
            const chain = rsn.chains?.[0]?.chain;
            if (chain?.length > 0) {
                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(`Lant cauzal (${rsn.chains[0].rootCauseLabel || ''}):`, M + 8, this.y + 2);
                this.y += 16;
                chain.slice(0, 5).forEach((node, i) => {
                    const indent = i * 16;
                    const arrow  = i === 0 ? '◉' : '→';
                    doc.font(this.R).fontSize(8).fillColor(i === 0 ? C.accent : C.ink)
                        .text(`${arrow} ${node.label || node.id || '—'}`, M + 8 + indent, this.y + i * 14, { width: CW - indent - 16 });
                });
                this.y += chain.slice(0, 5).length * 14 + 8;
            }

            // Active nodes
            if (rsn.activeNodes?.length > 0) {
                doc.font(this.B).fontSize(7.5).fillColor(C.muted)
                    .text(`Noduri active: ${rsn.activeNodes.join(', ')}`, M + 8, this.y, { width: CW - 16 });
                this.y += 16;
            }
        }

        this._footer();
    }

    // ── Page 6: Vehicle Timeline ─────────────────────────────────────────────

    _pageTimeline() {
        const { data, supp } = this;
        const timeline = supp.timeline || [];
        const trips    = data.recentTrips || [];
        const doc      = this.doc;

        this._addPage();
        this._stripHeader('TIMELINE VEHICUL — EVENIMENTE & CURSE');

        // ── Timeline events
        if (timeline.length > 0) {
            this.y = this._sectionBar(`EVENIMENTE RECENTE — ${timeline.length} TOTAL`, this.y);
            const catColor = {
                SERVICE:     C.accent,
                MAINTENANCE: C.monitor,
                HEALTH:      C.good,
                AI:          C.optimal,
                TRIP:        C.neutral,
                MILEAGE:     C.light,
                MILESTONE:   '#b76bff',
                USER:        C.muted,
                SYSTEM:      C.light,
                DOCUMENT:    C.accent,
            };
            timeline.slice(0, 18).forEach((ev, i) => {
                const ey  = this.y + i * 22;
                const bg  = i % 2 === 0 ? C.bgSubtle : C.white;
                const col = catColor[ev.category] || C.neutral;

                doc.rect(M, ey, CW, 22).fillColor(bg).fill();
                doc.rect(M, ey, 3, 22).fillColor(col).fill();

                doc.font(this.B).fontSize(7.5).fillColor(col)
                    .text((ev.icon || '●') + ' ' + (ev.category || '—'), M + 8, ey + 4, { width: 75 });
                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(ev.title || '—', M + 86, ey + 4, { width: CW * 0.45 });
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(ev.description || '', M + 86, ey + 14, { width: CW * 0.45, lineBreak: false });
                doc.font(this.R).fontSize(7.5).fillColor(C.light)
                    .text(fmtDate(ev.event_date), M + CW * 0.74, ey + 4, { width: CW * 0.26, align: 'right' });
                if (ev.mileage_km) {
                    doc.font(this.R).fontSize(7.5).fillColor(C.light)
                        .text(fmtKm(ev.mileage_km), M + CW * 0.74, ey + 13, { width: CW * 0.26, align: 'right' });
                }
            });
            this.y += Math.min(timeline.length, 18) * 22 + 8;
        }

        // ── Recent trips
        if (trips.length > 0 && this.y < A4_H - 120) {
            this.y = this._sectionBar(`CURSE RECENTE — ${trips.length} INREGISTRATE`, this.y);
            const tripColW = CW / 5;
            const tcols    = ['DATA', 'DISTANTA', 'CONSUM', 'ECO', 'ALERTE'];

            doc.rect(M, this.y, CW, 18).fillColor(C.navyMid).fill();
            tcols.forEach((h, i) => {
                doc.font(this.B).fontSize(7).fillColor(C.white)
                    .text(h, M + i * tripColW + 4, this.y + 5, { width: tripColW - 8, align: 'center' });
            });
            this.y += 18;

            trips.slice(0, 8).forEach((t, i) => {
                const ty   = this.y + i * 18;
                const bg   = i % 2 === 0 ? C.bgSubtle : C.white;
                doc.rect(M, ty, CW, 18).fillColor(bg).fill();
                const vals = [
                    fmtDate(t.timestamp_start),
                    fmtNum(t.km_parcursi, 1) + ' km',
                    fmtNum(t.consum_mediu_100km, 1) + ' L/100',
                    String(t.scor_eco ?? '—'),
                    String(t.nr_alerte || 0),
                ];
                vals.forEach((v, j) => {
                    doc.font(j === 3 && t.scor_eco ? this.B : this.R)
                        .fontSize(8).fillColor(j === 3 ? scoreColor(t.scor_eco) : C.ink)
                        .text(v, M + j * tripColW + 4, ty + 5, { width: tripColW - 8, align: 'center', lineBreak: false });
                });
            });
            this.y += Math.min(trips.length, 8) * 18 + 6;
        }

        this._footer();
    }

    // ── Page 7: Executive Summary ────────────────────────────────────────────

    _pageExecutiveSummary() {
        const { data, supp } = this;
        const recs     = data.recommendations || [];
        const maint    = data.maintenance    || [];
        const identity = data.identity       || {};
        const health   = data.health         || {};
        const stats    = supp.stats          || {};
        const costs    = supp.costs          || {};
        const doc      = this.doc;

        this._addPage();
        this._stripHeader('EXECUTIVE SUMMARY & FORECAST');

        // ── Executive summary block
        this.y = this._sectionBar('REZUMAT EXECUTIV', this.y);

        const critCount = recs.filter(r => r.urgency === 'IMMEDIATE').length;
        const soonCount = recs.filter(r => r.urgency === 'SOON').length;
        const overdueCount = maint.filter(m => m.status === 'OVERDUE').length;

        // Three KPI boxes
        const kpiW = CW / 3;
        const kpiY = this.y;
        const kpis = [
            {
                label: 'ACTIUNI IMEDIATE',
                val:   String(critCount),
                color: critCount > 0 ? C.critical : C.good,
                sub:   critCount > 0 ? 'Necesita atentie urgenta' : 'Fara actiuni urgente',
            },
            {
                label: 'MENTENANTA DEPASITA',
                val:   String(overdueCount),
                color: overdueCount > 0 ? C.caution : C.good,
                sub:   overdueCount > 0 ? 'Elemente neefectuate' : 'Mentenanta la zi',
            },
            {
                label: 'HEALTH SCORE GENERAL',
                val:   health.overallHealth != null ? `${Math.round(health.overallHealth)}/100` : '—',
                color: scoreColor(health.overallHealth),
                sub:   alertLevelLabel(data.alertLevel),
            },
        ];
        kpis.forEach((kpi, i) => {
            const kx = M + i * kpiW;
            doc.rect(kx, kpiY, kpiW, 52).fillColor(i % 2 === 0 ? C.bgSubtle : C.white).fill();
            if (i > 0) doc.rect(kx, kpiY, 0.5, 52).fillColor(C.border).fill();
            doc.font(this.R).fontSize(7).fillColor(C.muted)
                .text(kpi.label, kx + 6, kpiY + 6, { width: kpiW - 12, align: 'center' });
            doc.font(this.B).fontSize(20).fillColor(kpi.color)
                .text(kpi.val, kx + 6, kpiY + 18, { width: kpiW - 12, align: 'center' });
            doc.font(this.R).fontSize(7.5).fillColor(C.muted)
                .text(kpi.sub, kx + 6, kpiY + 42, { width: kpiW - 12, align: 'center' });
        });
        this.y = kpiY + 58;

        // ── Maintenance forecast (next 12 months)
        const upcoming12 = maint
            .filter(m => m.status === 'DUE_SOON' || m.status === 'OVERDUE' ||
                (m.remaining_days != null && m.remaining_days <= 365))
            .slice(0, 6);

        if (upcoming12.length > 0) {
            this.y = this._sectionBar('FORECAST MENTENANTA — URMATOARELE 12 LUNI', this.y);
            const estCostMin = upcoming12.reduce((acc) => acc + 150, 0);
            const estCostMax = upcoming12.reduce((acc) => acc + 600, 0);

            upcoming12.forEach((item, i) => {
                const iy = this.y + i * 20;
                const bg = i % 2 === 0 ? C.bgSubtle : C.white;
                doc.rect(M, iy, CW, 20).fillColor(bg).fill();

                const sCol = mtnStatusColor(item.status);
                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(item.item_name || item.item_type, M + 8, iy + 5, { width: CW * 0.40 });
                doc.font(this.B).fontSize(7.5).fillColor(sCol)
                    .text(item.status || '—', M + CW * 0.42, iy + 6, { width: CW * 0.14 });
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(
                        item.remaining_days != null ? `~${item.remaining_days} zile` : '—',
                        M + CW * 0.58, iy + 6, { width: CW * 0.14 }
                    );
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(
                        item.next_due_km ? fmtKm(item.next_due_km) : '—',
                        M + CW * 0.74, iy + 6, { width: CW * 0.24, align: 'right' }
                    );
            });
            this.y += upcoming12.length * 20 + 6;

            doc.font(this.R).fontSize(8).fillColor(C.muted)
                .text(`Cost estimat total mentenanta: `, M + 8, this.y + 4, { continued: true })
                .font(this.B).fillColor(C.navyDark)
                .text(`${estCostMin}–${estCostMax} RON`, { continued: false });
            this.y += 20;
        }

        // ── Ownership cost summary
        const totalKm   = stats.total_km        ?? 0;
        const totalFuel = stats.total_combustibil ?? 0;
        const nrTrips   = stats.total_calatorii  ?? 0;
        const costFuel  = totalFuel * 6.5;  // ~6.5 RON/L estimated
        const costMaint = costs.service ?? 0;
        const totalCost = costFuel + costMaint;

        if (totalKm > 0 || costMaint > 0) {
            this.y = this._sectionBar('COST TOTAL PROPRIETATE ESTIMAT', this.y);
            const costRows = [
                { label: 'Total km inregistrati',       val: fmtKm(totalKm) },
                { label: 'Curse inregistrate',          val: String(nrTrips) },
                { label: 'Combustibil consumat (OBD)',  val: `${fmtNum(totalFuel, 1)} L` },
                { label: 'Cost estimat combustibil',    val: `${fmtNum(costFuel)} RON` },
                { label: 'Cost service inregistrat',    val: `${fmtNum(costMaint)} RON` },
                { label: 'COST TOTAL ESTIMAT',          val: `${fmtNum(totalCost)} RON`, bold: true },
            ];
            const hrW = CW / 2;
            costRows.forEach((cr, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const cx  = M + col * hrW;
                const cy  = this.y + row * 18;
                const bg  = row % 2 === 0 ? C.bgSubtle : C.white;
                doc.rect(cx, cy, hrW, 18).fillColor(bg).fill();
                if (cr.bold) {
                    doc.rect(cx, cy, hrW, 18).fillColor(C.accentDark + '10').fill();
                }
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(cr.label + ':', cx + 6, cy + 4, { width: hrW * 0.55 });
                doc.font(cr.bold ? this.B : this.R).fontSize(cr.bold ? 9.5 : 8.5)
                    .fillColor(cr.bold ? C.navyDark : C.ink)
                    .text(cr.val, cx + hrW * 0.58, cy + 4, { width: hrW * 0.38, align: 'right' });
            });
            this.y += Math.ceil(costRows.length / 2) * 18 + 8;
        }

        // ── Top recommendations summary
        const topRecs = recs.slice(0, 3);
        if (topRecs.length > 0) {
            this.y = this._sectionBar('ACTIUNI RECOMANDATE PRIORITAR', this.y);
            topRecs.forEach((r, i) => {
                const ry     = this.y + i * 20;
                const uColor = urgencyColor(r.urgency);
                doc.rect(M, ry, CW, 20).fillColor(i % 2 === 0 ? C.bgSubtle : C.white).fill();
                doc.rect(M, ry, 3, 20).fillColor(uColor).fill();
                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(`${i + 1}. ${r.title || r.failureId}`, M + 10, ry + 5, { width: CW * 0.50 });
                doc.font(this.R).fontSize(7.5).fillColor(C.muted)
                    .text(fmtCost(r.estimatedRepairCost), M + CW * 0.54, ry + 6, { width: CW * 0.20 });
                doc.font(this.B).fontSize(7.5).fillColor(uColor)
                    .text(r.urgency || '—', M + CW * 0.76, ry + 6, { width: CW * 0.23, align: 'right' });
            });
            this.y += topRecs.length * 20 + 6;
        }

        // ── Documents status
        const documents = supp.documents || [];
        if (documents.length > 0) {
            this.y = this._sectionBar('STARE DOCUMENTE VEHICUL', this.y);

            const docStatusColor = (s) =>
                s === 'EXPIRED'  ? C.critical :
                s === 'EXPIRING' ? C.monitor  :
                C.good;

            documents.forEach((d, i) => {
                const dy   = this.y + i * 20;
                const bg   = i % 2 === 0 ? C.bgSubtle : C.white;
                const sCol = docStatusColor(d.status);
                doc.rect(M, dy, CW, 20).fillColor(bg).fill();
                doc.rect(M, dy, 3, 20).fillColor(sCol).fill();

                doc.font(this.B).fontSize(8.5).fillColor(C.navyDark)
                    .text(d.title || '—', M + 10, dy + 5, { width: CW * 0.30 });
                doc.font(this.R).fontSize(7.5).fillColor(C.muted)
                    .text(d.type || '—', M + CW * 0.33, dy + 6, { width: CW * 0.17 });
                doc.font(this.R).fontSize(8).fillColor(C.muted)
                    .text(d.expiry_date ? fmtDate(d.expiry_date) : '—', M + CW * 0.52, dy + 6, { width: CW * 0.22 });
                doc.font(this.B).fontSize(7.5).fillColor(sCol)
                    .text(d.status || '—', M + CW * 0.76, dy + 6, { width: CW * 0.23, align: 'right' });
            });
            this.y += documents.length * 20 + 8;
        }

        // ── Identity summary footer
        this.y = this._divider(this.y + 8);
        doc.font(this.B).fontSize(8).fillColor(C.navyDark)
            .text(`${identity.make || ''} ${identity.model || ''} ${identity.variant || ''}`.trim(), M, this.y + 2);
        doc.font(this.R).fontSize(7.5).fillColor(C.muted)
            .text(
                [
                    identity.engineCode,
                    identity.powerHp ? `${identity.powerHp} CP` : null,
                    identity.emissionStandard,
                    identity.vin ? `VIN: ${identity.vin}` : null,
                ].filter(Boolean).join(' · '),
                M, this.y + 14, { width: CW * 0.75 }
            );
        doc.font(this.R).fontSize(7.5).fillColor(C.muted)
            .text(`Varsta: ${identity.ageYears ? identity.ageYears + ' ani' : '—'}`, M + CW * 0.77, this.y + 2, { width: CW * 0.23, align: 'right' });

        this._footer();
    }
}

module.exports = { PDFReportGenerator };
