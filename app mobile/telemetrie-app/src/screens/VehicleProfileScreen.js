import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
    Platform, StatusBar, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
    HeroCard, HealthGauge, MetricCard, CostCard,
    MaintenanceCard, MilestoneCard, WorkshopCard, DocumentCard,
    TimelineCard, SectionHeader, StatusBadge, EmptyState,
} from '../components/ui';
import { fetchProfileSummary, fetchHealthStatus, fetchCostDashboard, exportPDFReport, fetchVehicleSummary, fetchDocuments } from '../services/vehicleService';
import api from '../services/api';
import { getVin, getVehicleLabel } from '../utils/config';
import { computeEvaluation, buildHeaderMessage } from '../engine/MessageEngine';
import { NotificationContext } from '../context/NotificationContext';
import { colors, typography, radii, spacing, layout } from '../theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskVin(vin) {
    if (!vin || vin.length < 7) return vin || '—';
    return `${vin.slice(0, 3)}···${vin.slice(-4)}`;
}

function tsToMs(ts) {
    if (!ts) return null;
    return ts < 1e11 ? ts * 1000 : ts;
}

function fmtDate(ts) {
    const ms = tsToMs(ts);
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtNum(n) {
    if (n === null || n === undefined) return '—';
    return Number(Math.round(n)).toLocaleString('ro-RO');
}

function formatOwnershipDays(days) {
    if (!days || days <= 0) return '—';
    const years  = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    if (years > 0 && months > 0) return `${years} ${years === 1 ? 'an' : 'ani'}, ${months} luni`;
    if (years > 0)  return `${years} ${years === 1 ? 'an' : 'ani'}`;
    return `${months} luni`;
}

function vStatusToDesign(s) {
    if (s === 'READY')      return 'good';
    if (s === 'ATTENTION')  return 'monitor';
    if (s === 'INSPECTION') return 'caution';
    return 'neutral';
}

function healthToStatus(score) {
    if (score === null || score === undefined) return 'neutral';
    if (score >= 90) return 'optimal';
    if (score >= 75) return 'good';
    if (score >= 60) return 'monitor';
    if (score >= 40) return 'caution';
    return 'critical';
}

function mtnStatus(s) {
    if (s === 'OVERDUE')  return 'overdue';
    if (s === 'DUE_SOON') return 'upcoming';
    return 'done';
}

function mtnUrgency(s) {
    if (s === 'OVERDUE')  return 'high';
    if (s === 'DUE_SOON') return 'normal';
    return 'low';
}

function docTypeForStatus(status) {
    if (status === 'EXPIRED')  return 'pdf';
    if (status === 'EXPIRING') return 'doc';
    return 'xls';
}

function docExpiryText(doc) {
    if (!doc.expiry_date) return undefined;
    const ms = doc.expiry_date < 1e11 ? doc.expiry_date * 1000 : doc.expiry_date;
    return new Date(ms).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function tlType(severity) {
    return (severity === 'CRITICAL' || severity === 'WARNING') ? 'alert' : 'trip';
}

function buildEngineLine(v) {
    const parts = [];
    if (v.engine_code)      parts.push(v.engine_code);
    if (v.displacement_cc)  parts.push(`${(v.displacement_cc / 1000).toFixed(1)}L`);
    return parts.join(' · ') || '—';
}

function buildPowerLine(v) {
    const parts = [];
    if (v.power_hp)   parts.push(`${v.power_hp} CP`);
    if (v.power_kw)   parts.push(`${v.power_kw} kW`);
    if (v.torque_nm)  parts.push(`${v.torque_nm} Nm`);
    return parts.join(' / ') || '—';
}

function buildHeroSubtitle(v) {
    const parts = [];
    if (v.engine_code)     parts.push(v.engine_code);
    if (v.displacement_cc) parts.push(`${(v.displacement_cc / 1000).toFixed(1)}L`);
    if (v.power_hp)        parts.push(`${v.power_hp} CP`);
    if (v.fuel_type)       parts.push(v.fuel_type);
    return parts.join(' · ') || (v.fuel_type || '—');
}

// ─── Sub-component: labeled info row ─────────────────────────────────────────

const InfoRow = ({ label, value, last }) => (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
);

// ─── Component ────────────────────────────────────────────────────────────────

const VehicleProfileScreen = () => {
    const navigation = useNavigation();
    const { syncFromSummary } = useContext(NotificationContext);

    const [screenState, setScreenState] = useState('loading');
    const [profile,     setProfile]     = useState(null);
    const [health,      setHealth]      = useState(null);
    const [costs,       setCosts]       = useState(null);
    const [stats,       setStats]       = useState(null);
    const [documents,   setDocuments]   = useState([]);
    const [loadedAt,    setLoadedAt]    = useState(null);
    const [pdfExporting, setPdfExporting] = useState(false);

    const loadData = useCallback(async () => {
        setScreenState(prev => prev === 'success' ? 'success' : 'loading');
        try {
            const year = new Date().getFullYear();
            const [profileRes, healthRes, costsRes, statsRes, docsRes] = await Promise.allSettled([
                fetchProfileSummary(),
                fetchHealthStatus(),
                fetchCostDashboard(year),
                api.get(`/vehicul/${getVin()}/statistici`),
                fetchDocuments(),
            ]);
            setProfile(profileRes.status === 'fulfilled' ? profileRes.value : null);
            setHealth(healthRes.status  === 'fulfilled' ? healthRes.value  : null);
            setCosts(costsRes.status   === 'fulfilled' ? costsRes.value   : null);
            setStats(statsRes.status   === 'fulfilled' ? statsRes.value.data : null);
            setDocuments(docsRes.status === 'fulfilled' ? docsRes.value : []);
            setLoadedAt(new Date());
            setScreenState(profileRes.status === 'fulfilled' ? 'success' : 'error');
            // Background notification sync from full twin summary
            fetchVehicleSummary().then(syncFromSummary).catch(() => {});
        } catch {
            setScreenState(prev => prev === 'success' ? prev : 'error');
        }
    }, [syncFromSummary]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleExportPDF = useCallback(async () => {
        if (pdfExporting) return;
        setPdfExporting(true);
        try {
            await exportPDFReport();
        } catch (err) {
            Alert.alert('Export PDF', err.message || 'Eroare la generarea raportului.');
        } finally {
            setPdfExporting(false);
        }
    }, [pdfExporting]);

    // ── Loading ───────────────────────────────────────────────────────────────
    if (screenState === 'loading') {
        return (
            <View style={styles.main}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.backBtnText}>←</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Profilul meu</Text>
                        <Text style={styles.subtitle}>{getVehicleLabel() || 'Logbook'}</Text>
                    </View>
                </View>
                <View style={styles.scrollContent}>
                    <HeroCard value="…" unit="" title="PROFILUL MAȘINII" subtitle="Se încarcă dosarul…" status="neutral" loading style={styles.heroCard} />
                </View>
            </View>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (screenState === 'error' && !profile) {
        return (
            <View style={[styles.main, styles.center]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.backBtnText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Profilul meu</Text>
                </View>
                <EmptyState
                    title="Nu pot accesa profilul vehiculului."
                    subtitle="Verifică conexiunea la server și încearcă din nou."
                    action={{ label: 'Încearcă din nou', onPress: loadData }}
                    style={{ paddingHorizontal: layout.screenPaddingH }}
                />
            </View>
        );
    }

    // ── Data ──────────────────────────────────────────────────────────────────
    const vehicle         = profile?.vehicle             || {};
    const vStatus         = profile?.vehicle_status?.status || null;
    const vStatusReason   = profile?.vehicle_status?.reason || null;
    const odometer        = profile?.estimated_odometer_km;
    const ownershipDays   = profile?.ownership_days;
    const lastDrive       = profile?.last_drive;
    const maintenanceSummary = profile?.maintenance_summary || {};
    const maintenanceItems   = maintenanceSummary.items    || [];
    const milestones         = profile?.milestones         || [];
    const workshops          = profile?.workshops          || [];
    const recentTimeline     = profile?.recent_timeline    || [];

    const healthScore = health?.overallHealth ?? profile?.health_score ?? null;
    const evaluation  = computeEvaluation(healthScore);
    const { message: healthMsg, subtitle: healthSubtitle } = buildHeaderMessage(evaluation, health?.predictions || []);

    const topMaintenance = [...maintenanceItems]
        .sort((a, b) => {
            const ord = { OVERDUE: 0, DUE_SOON: 1, OK: 2, UNKNOWN: 3 };
            return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
        })
        .slice(0, 3);

    const overdueCount  = maintenanceSummary.overdue  || 0;
    const dueSoonCount  = maintenanceSummary.due_soon || 0;

    const costsTotal   = parseFloat(costs?.total   || 0);
    const costsService = parseFloat(costs?.service || 0);
    const costsFuel    = parseFloat(costs?.fuel    || 0);
    const costsYear    = costs?.year || new Date().getFullYear();

    const kmDriven = odometer && vehicle.purchase_mileage_km
        ? odometer - vehicle.purchase_mileage_km
        : (stats?.total_km ?? null);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <View style={styles.main}>
            {/* ── Header ────────────────────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Profilul meu</Text>
                    <Text style={styles.subtitle}>
                        {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : 'Vehicul înregistrat'}
                    </Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={loadData}>
                    <Text style={styles.iconBtnText}>↺</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.iconBtn, styles.pdfBtn, pdfExporting && styles.pdfBtnActive]}
                    onPress={handleExportPDF}
                    disabled={pdfExporting}
                    accessibilityRole="button"
                    accessibilityLabel="Exportă raport PDF"
                    accessibilityHint="Generează și partajează raportul complet de diagnostic"
                    accessibilityState={{ disabled: pdfExporting }}
                >
                    <Text style={[styles.iconBtnText, styles.pdfBtnText]}>
                        {pdfExporting ? '…' : 'PDF'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── 1. Hero ─────────────────────────────────────────────── */}
                <HeroCard
                    value={vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : 'Vehicul'}
                    unit={vehicle.year ? String(vehicle.year) : ''}
                    title="PROFILUL MAȘINII"
                    subtitle={buildHeroSubtitle(vehicle)}
                    description={`${maskVin(vehicle.vin)} · ${odometer ? `~${fmtNum(odometer)} km` : 'km —'}`}
                    status={vStatusToDesign(vStatus)}
                    style={styles.heroCard}
                />

                {/* ── 2. Sănătate vehicul ──────────────────────────────────── */}
                <SectionHeader title="SĂNĂTATE VEHICUL" style={styles.sectionHeader} />
                <View style={styles.gaugeContainer}>
                    {healthScore !== null ? (
                        <HealthGauge
                            score={healthScore}
                            label="SĂNĂTATE"
                            subtitle={healthSubtitle}
                            size="lg"
                            animate
                        />
                    ) : (
                        <HealthGauge score={0} label="SĂNĂTATE" subtitle="Date insuficiente" size="lg" loading />
                    )}
                </View>
                <View style={[styles.msgCard, { borderColor: colors.border.default }]}>
                    <Text style={[styles.msgText, { color: colors.text.primary }]}>{healthMsg}</Text>
                    {vStatus && vStatusReason ? (
                        <Text style={styles.msgSub}>{vStatusReason}</Text>
                    ) : null}
                    {lastDrive ? (
                        <Text style={styles.msgMeta}>
                            Ultima cursă: acum {lastDrive.days_ago === 0 ? 'azi' : `${lastDrive.days_ago} ${lastDrive.days_ago === 1 ? 'zi' : 'zile'}`}
                            {lastDrive.km > 0 ? ` · ${fmtNum(lastDrive.km)} km` : ''}
                        </Text>
                    ) : null}
                </View>

                {/* ── 3. Statistici proprietar ─────────────────────────────── */}
                <SectionHeader title="PROPRIETATE · STATISTICI" style={styles.sectionHeader} />
                <View style={styles.metricsGrid}>
                    <MetricCard
                        label="POSESIE"
                        value={formatOwnershipDays(ownershipDays) === '—' ? '—' : formatOwnershipDays(ownershipDays).split(',')[0]}
                        unit={ownershipDays > 365 ? 'ani' : 'luni'}
                        size="sm"
                        style={styles.metricCard}
                    />
                    <MetricCard
                        label="KILOMETRAJ"
                        value={odometer ? fmtNum(odometer) : '—'}
                        unit="km (est.)"
                        size="sm"
                        style={styles.metricCard}
                    />
                    <MetricCard
                        label="CURSE"
                        value={stats?.total_calatorii ?? '—'}
                        unit="înregistrate"
                        size="sm"
                        style={styles.metricCard}
                    />
                    <MetricCard
                        label="RULAT TOTAL"
                        value={kmDriven ? fmtNum(kmDriven) : '—'}
                        unit="km de la achiziție"
                        size="sm"
                        style={styles.metricCard}
                    />
                </View>

                {/* ── 4. Dosar tehnic ──────────────────────────────────────── */}
                <SectionHeader title="DOSAR TEHNIC" style={styles.sectionHeader} />
                <View style={styles.infoCard}>
                    <View style={styles.infoCardHeader}>
                        <Text style={styles.infoCardTitle}>
                            {[vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ') || 'Vehicul'}
                        </Text>
                        {vStatus ? (
                            <StatusBadge status={vStatusToDesign(vStatus)} label={
                                vStatus === 'READY' ? 'Operațional' :
                                vStatus === 'ATTENTION' ? 'Atenție' : 'Inspecție'
                            } size="sm" />
                        ) : null}
                    </View>

                    {vehicle.fuel_type ? (
                        <InfoRow label="Combustibil" value={vehicle.fuel_type} />
                    ) : null}
                    {(vehicle.engine_code || vehicle.displacement_cc) ? (
                        <InfoRow label="Motor" value={buildEngineLine(vehicle)} />
                    ) : null}
                    {(vehicle.power_hp || vehicle.power_kw) ? (
                        <InfoRow label="Putere / Cuplu" value={buildPowerLine(vehicle)} />
                    ) : null}
                    {vehicle.transmission ? (
                        <InfoRow label="Transmisie" value={`${vehicle.transmission}${vehicle.gears ? ` · ${vehicle.gears} trepte` : ''}`} />
                    ) : null}
                    {vehicle.drivetrain ? (
                        <InfoRow label="Tracțiune" value={vehicle.drivetrain} />
                    ) : null}
                    {vehicle.emission_standard ? (
                        <InfoRow label="Normă emisii" value={vehicle.emission_standard} />
                    ) : null}
                    {vehicle.co2_gkm ? (
                        <InfoRow label="Emisii CO₂" value={`${vehicle.co2_gkm} g/km`} />
                    ) : null}
                    {vehicle.fuel_tank_liters ? (
                        <InfoRow label="Rezervor" value={`${vehicle.fuel_tank_liters} L`} />
                    ) : null}
                    {vehicle.oil_spec ? (
                        <InfoRow label="Ulei recomandat" value={`${vehicle.oil_spec}${vehicle.oil_capacity_liters ? ` · ${vehicle.oil_capacity_liters}L` : ''}`} />
                    ) : null}
                    {vehicle.color ? (
                        <InfoRow label="Culoare" value={vehicle.color} />
                    ) : null}
                    {vehicle.plate_number ? (
                        <InfoRow label="Număr înmatriculare" value={vehicle.plate_number} />
                    ) : null}
                    <InfoRow label="VIN" value={vehicle.vin || '—'} last />
                </View>

                {/* ── 5. Mentenanță ───────────────────────────────────────── */}
                <SectionHeader title="MENTENANȚĂ" style={styles.sectionHeader} />

                {(overdueCount > 0 || dueSoonCount > 0) ? (
                    <View style={styles.badgeRow}>
                        {overdueCount > 0 && (
                            <StatusBadge
                                label={`${overdueCount} restante`}
                                status="critical"
                                variant="filled"
                                size="sm"
                                style={styles.badge}
                            />
                        )}
                        {dueSoonCount > 0 && (
                            <StatusBadge
                                label={`${dueSoonCount} scadente`}
                                status="monitor"
                                variant="filled"
                                size="sm"
                                style={styles.badge}
                            />
                        )}
                        {overdueCount === 0 && dueSoonCount === 0 && (
                            <StatusBadge label="Mentenanță la zi" status="good" variant="filled" size="sm" />
                        )}
                    </View>
                ) : (
                    <View style={styles.badgeRow}>
                        <StatusBadge label="Mentenanță la zi" status="good" variant="filled" size="sm" />
                    </View>
                )}

                {topMaintenance.length > 0 ? topMaintenance.map((item, idx) => (
                    <MaintenanceCard
                        key={item.id ?? idx}
                        title={item.item_name}
                        subtitle={item.item_type?.replace(/_/g, ' ')}
                        dueKm={item.next_due_km}
                        dueDate={item.next_due_date ? fmtDate(item.next_due_date) : undefined}
                        status={mtnStatus(item.status)}
                        urgency={mtnUrgency(item.status)}
                        style={styles.mtnCard}
                    />
                )) : (
                    <EmptyState
                        title="Niciun element de mentenanță."
                        subtitle="Adaugă service-uri pentru a activa urmărirea mentenanței."
                        size="sm"
                        style={styles.emptySmall}
                    />
                )}

                <SectionHeader title="DOCUMENTE" size="sm" style={styles.subSectionHeader} />
                {documents.length > 0 ? documents.map((doc, idx) => (
                    <DocumentCard
                        key={doc.id ?? idx}
                        title={doc.title}
                        documentType={docTypeForStatus(doc.status)}
                        category={doc.type}
                        date={docExpiryText(doc)}
                        style={styles.docCard}
                    />
                )) : (
                    <EmptyState
                        title="Niciun document adăugat."
                        subtitle="Adaugă ITP, RCA, CASCO și Rovinietă pentru urmărire."
                        size="sm"
                        style={styles.emptySmall}
                    />
                )}

                {/* ── 6. Costuri ───────────────────────────────────────────── */}
                {costsTotal > 0 ? (
                    <>
                        <SectionHeader title={`COSTURI ${costsYear}`} style={styles.sectionHeader} />
                        <CostCard
                            title={`Costuri ${costsYear}`}
                            amount={costsTotal}
                            currency="RON"
                            period={String(costsYear)}
                            breakdown={[
                                ...(costsService > 0 ? [{ label: 'Service', amount: costsService }] : []),
                                ...(costsFuel    > 0 ? [{ label: 'Combustibil', amount: costsFuel }] : []),
                            ]}
                            style={styles.costCard}
                        />
                    </>
                ) : null}

                {/* ── 7. Realizări ─────────────────────────────────────────── */}
                <SectionHeader title="REALIZĂRI" style={styles.sectionHeader} />
                {milestones.length > 0 ? milestones.map((ms, idx) => (
                    <MilestoneCard
                        key={ms.id ?? idx}
                        title={ms.title}
                        description={ms.description}
                        achieved
                        icon={ms.icon}
                        achievedDate={ms.achieved_at ? fmtDate(ms.achieved_at) : undefined}
                        style={styles.milestoneCard}
                    />
                )) : (
                    <EmptyState
                        title="Nicio realizare încă."
                        subtitle="Prima ta realizare apare după câteva curse înregistrate."
                        size="sm"
                        style={styles.emptySmall}
                    />
                )}

                {/* ── 8. Atelier de service ────────────────────────────────── */}
                {workshops.length > 0 ? (
                    <>
                        <SectionHeader title="ATELIER DE SERVICE" style={styles.sectionHeader} />
                        {workshops.map((ws, idx) => (
                            <WorkshopCard
                                key={ws.id ?? idx}
                                name={ws.name}
                                address={ws.address}
                                phone={ws.phone}
                                rating={ws.rating}
                                certified={!!ws.is_trusted}
                                onCallPress={ws.phone ? () => Linking.openURL(`tel:${ws.phone}`) : undefined}
                                style={styles.workshopCard}
                            />
                        ))}
                    </>
                ) : null}

                {/* ── 9. Activitate recentă ────────────────────────────────── */}
                {recentTimeline.length > 0 ? (
                    <>
                        <SectionHeader title="ACTIVITATE RECENTĂ" style={styles.sectionHeader} />
                        {recentTimeline.map((ev, idx) => (
                            <TimelineCard
                                key={ev.id ?? idx}
                                title={ev.title}
                                description={ev.description}
                                date={ev.event_date ? new Date(tsToMs(ev.event_date)).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) : '—'}
                                type={tlType(ev.severity)}
                                isFirst={idx === 0}
                                isLast={idx === recentTimeline.length - 1}
                            />
                        ))}
                    </>
                ) : null}

                {/* ── 10. Footer ───────────────────────────────────────────── */}
                <View style={styles.footer}>
                    <View style={styles.footerRow}>
                        <Text style={styles.footerLabel}>VIN</Text>
                        <Text style={styles.footerValue}>{vehicle.vin || '—'}</Text>
                    </View>
                    {vehicle.purchase_date ? (
                        <View style={styles.footerRow}>
                            <Text style={styles.footerLabel}>Achiziționat</Text>
                            <Text style={styles.footerValue}>{fmtDate(vehicle.purchase_date)}</Text>
                        </View>
                    ) : null}
                    {loadedAt ? (
                        <View style={styles.footerRow}>
                            <Text style={styles.footerLabel}>Ultima sincronizare</Text>
                            <Text style={styles.footerValue}>
                                {loadedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    ) : null}
                    <View style={styles.footerRow}>
                        <Text style={styles.footerLabel}>Vehicul Digital Twin</Text>
                        <Text style={styles.footerValue}>OBD-II Monitor v1.0</Text>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    main: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44,
    },
    center: { justifyContent: 'center', alignItems: 'center' },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        gap: spacing[3],
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: radii.full,
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backBtnText: { color: colors.text.primary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
    title:       { fontSize: typography.sizes.title3, fontWeight: typography.weights.bold, color: colors.text.primary },
    subtitle:    { fontSize: typography.sizes.caption, color: colors.text.secondary, marginTop: 2 },
    iconBtn: {
        width: 32, height: 32, borderRadius: radii.full,
        backgroundColor: colors.bg[1], borderWidth: 1, borderColor: colors.border.default,
        justifyContent: 'center', alignItems: 'center',
    },
    iconBtnText: { color: colors.text.secondary, fontSize: typography.sizes.body, fontWeight: typography.weights.bold },
    pdfBtn: {
        width: 44, borderRadius: radii.sm,
        backgroundColor: colors.accent.default, borderColor: colors.accent.default,
        marginLeft: spacing[2],
    },
    pdfBtnActive: { opacity: 0.6 },
    pdfBtnText:   { color: '#FFFFFF', fontSize: typography.sizes.caption },

    // ── Scroll ────────────────────────────────────────────────────────────────
    scroll:        { flex: 1 },
    scrollContent: { paddingHorizontal: layout.screenPaddingH, paddingBottom: spacing[12] },

    // ── Section spacing ───────────────────────────────────────────────────────
    heroCard:         { marginTop: spacing[4], marginBottom: spacing[4] },
    sectionHeader:    { marginTop: spacing[2], marginBottom: spacing[3] },
    subSectionHeader: { marginTop: spacing[3], marginBottom: spacing[2] },

    // ── Health gauge ──────────────────────────────────────────────────────────
    gaugeContainer: { alignItems: 'center', marginBottom: spacing[3] },
    msgCard: {
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderRadius: radii.lg,
        padding: spacing[4],
        marginBottom: spacing[4],
    },
    msgText: { fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, lineHeight: 22 },
    msgSub:  { fontSize: typography.sizes.label2, color: colors.text.secondary, marginTop: spacing[1] },
    msgMeta: { fontSize: typography.sizes.caption, color: colors.text.tertiary ?? colors.text.secondary, marginTop: spacing[2] },

    // ── Ownership metrics 2×2 grid ────────────────────────────────────────────
    metricsGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: spacing[4],
    },
    metricCard: { width: '48.5%', marginBottom: spacing[3] },

    // ── Technical info card ───────────────────────────────────────────────────
    infoCard: {
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
        borderRadius: radii.lg,
        padding: spacing[4],
        marginBottom: spacing[4],
    },
    infoCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    infoCardTitle: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        flex: 1,
        marginRight: spacing[2],
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[2],
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle ?? colors.border.default,
    },
    infoRowLast: { /* no special styling needed */ },
    infoLabel: { fontSize: typography.sizes.label2, color: colors.text.secondary, flex: 1 },
    infoValue: {
        fontSize: typography.sizes.label2,
        color: colors.text.primary,
        fontWeight: typography.weights.semibold,
        flex: 1,
        textAlign: 'right',
    },

    // ── Maintenance badges ────────────────────────────────────────────────────
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
    badge:    {},
    mtnCard:  { marginBottom: spacing[2] },
    docCard:  { marginBottom: spacing[2] },
    emptySmall: { marginBottom: spacing[4], paddingVertical: spacing[4] },

    // ── Cost card ─────────────────────────────────────────────────────────────
    costCard: { marginBottom: spacing[4] },

    // ── Milestones ────────────────────────────────────────────────────────────
    milestoneCard: { marginBottom: spacing[2] },

    // ── Workshop ──────────────────────────────────────────────────────────────
    workshopCard: { marginBottom: spacing[2] },

    // ── Footer ────────────────────────────────────────────────────────────────
    footer: {
        marginTop: spacing[4],
        paddingTop: spacing[4],
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing[1] + 2,
    },
    footerLabel: { fontSize: typography.sizes.caption, color: colors.text.secondary },
    footerValue: { fontSize: typography.sizes.caption, color: colors.text.primary, fontWeight: typography.weights.semibold },
});

export default VehicleProfileScreen;
