/**
 * UIPlaygroundScreen — ecran de review pentru UI Component Library.
 *
 * EXCLUSIV PENTRU DEZVOLTARE. Nu adăuga în navigarea utilizatorului final.
 * Montează toate componentele din librărie în toate variantele lor.
 */

import React, { useState } from 'react';
import { ScrollView, View, Text, SafeAreaView, StyleSheet } from 'react-native';
import { colors, typography, spacing, layout, radii } from '../theme';

// Phase A
import {
    Card, SectionHeader, Button, IconButton,
    Input, SearchBar, StatusBadge, EmptyState, Skeleton, Divider,
} from '../components/ui';

// Phase B
import {
    HeroCard, MetricCard, HealthGauge, RecommendationCard,
    PredictionCard, TimelineCard, MaintenanceCard, DocumentCard,
    WorkshopCard, CostCard, MilestoneCard,
} from '../components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PGSection = ({ title, children }) => (
    <View style={pg.section}>
        <Text style={pg.sectionTitle}>{title}</Text>
        {children}
    </View>
);

const PGRow = ({ label, children, wrap = false }) => (
    <View style={pg.row}>
        {label ? <Text style={pg.rowLabel}>{label}</Text> : null}
        <View style={[pg.rowContent, wrap && pg.rowWrap]}>
            {children}
        </View>
    </View>
);

const Gap = ({ v = spacing[3] }) => <View style={{ height: v }} />;

// ─────────────────────────────────────────────────────────────────────────────
// Demo Data
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = ['optimal', 'good', 'monitor', 'caution', 'critical', 'neutral'];

const BREAKDOWN = [
    { label: 'Combustibil', amount: 380, icon: '⛽' },
    { label: 'Service', amount: 240, icon: '🔧' },
    { label: 'Asigurare', amount: 180, icon: '🛡' },
    { label: 'Taxe', amount: 60, icon: '📋' },
];

const TIMELINE_ITEMS = [
    { title: 'Schimb ulei + filtru', date: '14 iun 2025', time: '09:30', type: 'maintenance', description: 'Ulei 5W-40 sintetic, 5L' },
    { title: 'Alertă temperatură motor', date: '10 iun 2025', time: '14:15', type: 'alert', description: 'Temperatura a depășit pragul de 105°C' },
    { title: 'Deplasare Cluj → București', date: '7 iun 2025', time: '06:00', type: 'trip', description: '452 km · Eco score: 87' },
    { title: 'ITP efectuat', date: '1 iun 2025', time: '10:00', type: 'milestone' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function UIPlaygroundScreen() {
    const [inputVal, setInputVal]           = useState('');
    const [inputError, setInputError]       = useState('');
    const [searchVal, setSearchVal]         = useState('');
    const [filterActive, setFilterActive]   = useState(false);

    return (
        <SafeAreaView style={pg.safe}>
            <ScrollView
                style={pg.scroll}
                contentContainerStyle={pg.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={pg.screenTitle}>UI Component Library</Text>
                <Text style={pg.screenSubtitle}>Dev playground — toate variantele</Text>

                <Divider strength="subtle" spacing={spacing[4]} />

                {/* ────────────────────── PHASE A ────────────────────── */}
                <Text style={pg.phaseLabel}>FAZA A — FOUNDATION</Text>

                {/* ── Card ───────────────────────────────────────────── */}
                <PGSection title="Card">
                    <PGRow label="Variante">
                        {['default', 'outlined', 'filled', 'elevated'].map(v => (
                            <Card key={v} variant={v} style={pg.cardDemo}>
                                <Text style={pg.demoLabel}>{v}</Text>
                            </Card>
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="Status" wrap>
                        {STATUSES.map(s => (
                            <Card key={s} variant="filled" status={s} style={pg.cardDemoSm}>
                                <Text style={pg.demoLabelSm}>{s}</Text>
                            </Card>
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="Padding">
                        {['none', 'sm', 'md', 'lg'].map(p => (
                            <Card key={p} padding={p} style={pg.cardDemo}>
                                <Text style={pg.demoLabel}>pad {p}</Text>
                            </Card>
                        ))}
                    </PGRow>
                    <Gap />
                    <Card onPress={() => {}} style={pg.fullCard}>
                        <Text style={pg.demoLabel}>Card acționabil (onPress) — press scale 0.98</Text>
                    </Card>
                </PGSection>

                {/* ── SectionHeader ───────────────────────────────────── */}
                <PGSection title="SectionHeader">
                    <SectionHeader title="Titlu mic" size="sm" />
                    <SectionHeader title="Titlu mediu" subtitle="Cu subtitlu" size="md" />
                    <SectionHeader title="Titlu mare" size="lg" action={{ label: 'Vezi tot', onPress: () => {} }} />
                    <SectionHeader title="fără uppercase" uppercase={false} />
                </PGSection>

                {/* ── Button ─────────────────────────────────────────── */}
                <PGSection title="Button">
                    <PGRow label="Variante (md)">
                        {['primary', 'secondary', 'ghost', 'danger', 'success'].map(v => (
                            <Button key={v} label={v} onPress={() => {}} variant={v} />
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="Dimensiuni (primary)">
                        {['sm', 'md', 'lg'].map(s => (
                            <Button key={s} label={s} onPress={() => {}} size={s} />
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="Stări">
                        <Button label="Loading" onPress={() => {}} loading />
                        <Button label="Disabled" onPress={() => {}} disabled />
                        <Button label="Cu icon" onPress={() => {}} leftIcon="⚡" rightIcon="›" />
                    </PGRow>
                    <Gap />
                    <Button label="Full Width" onPress={() => {}} fullWidth />
                </PGSection>

                {/* ── IconButton ──────────────────────────────────────── */}
                <PGSection title="IconButton">
                    <PGRow label="Variante (md, circle)">
                        {['default', 'outlined', 'ghost', 'danger'].map(v => (
                            <IconButton key={v} icon="★" variant={v} onPress={() => {}} accessibilityLabel={v} />
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="Dimensiuni (default)">
                        {['xs', 'sm', 'md', 'lg'].map(s => (
                            <IconButton key={s} icon="⚙" size={s} onPress={() => {}} accessibilityLabel={s} />
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="Badge + shape">
                        <IconButton icon="🔔" badge={3} onPress={() => {}} accessibilityLabel="badge 3" />
                        <IconButton icon="🔔" badge={99} onPress={() => {}} accessibilityLabel="badge 99" />
                        <IconButton icon="🔔" badge={true} onPress={() => {}} accessibilityLabel="badge dot" />
                        <IconButton icon="✕" shape="square" onPress={() => {}} accessibilityLabel="square" />
                        <IconButton icon="✕" disabled onPress={() => {}} accessibilityLabel="disabled" />
                    </PGRow>
                </PGSection>

                {/* ── Input ───────────────────────────────────────────── */}
                <PGSection title="Input">
                    <Input
                        label="Adresă server"
                        placeholder="192.168.1.100"
                        value={inputVal}
                        onChangeText={setInputVal}
                        keyboardType="numeric"
                        helper="IP-ul dispozitivului OBD2"
                    />
                    <Input
                        label="Câmp cu eroare"
                        placeholder="Introdu VIN-ul"
                        value=""
                        onChangeText={() => {}}
                        error="VIN invalid — 17 caractere necesare"
                    />
                    <Input
                        label="Cu icoane"
                        placeholder="Caută..."
                        value=""
                        onChangeText={() => {}}
                        leftIcon={<Text style={pg.inputIcon}>⌕</Text>}
                        rightIcon={<Text style={pg.inputIcon}>✕</Text>}
                    />
                    <Input
                        label="Multiline"
                        placeholder="Note adiționale..."
                        value=""
                        onChangeText={() => {}}
                        multiline
                        numberOfLines={3}
                    />
                    <Input
                        label="Disabled"
                        value="Valoare fixă"
                        onChangeText={() => {}}
                        disabled
                    />
                </PGSection>

                {/* ── SearchBar ───────────────────────────────────────── */}
                <PGSection title="SearchBar">
                    <SearchBar
                        value={searchVal}
                        onChangeText={setSearchVal}
                        placeholder="Caută piese sau service..."
                    />
                    <Gap v={spacing[2]} />
                    <SearchBar
                        value="ulei motor"
                        onChangeText={() => {}}
                        onFilter={() => setFilterActive(p => !p)}
                        filterActive={filterActive}
                        placeholder="Caută..."
                    />
                </PGSection>

                {/* ── StatusBadge ─────────────────────────────────────── */}
                <PGSection title="StatusBadge">
                    <PGRow label="filled" wrap>
                        {STATUSES.map(s => (
                            <StatusBadge key={s} status={s} label={s} variant="filled" />
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="outlined" wrap>
                        {STATUSES.map(s => (
                            <StatusBadge key={s} status={s} label={s} variant="outlined" />
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="dot" wrap>
                        {STATUSES.map(s => (
                            <StatusBadge key={s} status={s} variant="dot" />
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="Mărimi" wrap>
                        {['sm', 'md', 'lg'].map(sz => (
                            <StatusBadge key={sz} status="caution" label={`size ${sz}`} size={sz} />
                        ))}
                    </PGRow>
                    <Gap />
                    <PGRow label="Puls">
                        <StatusBadge status="critical" label="Critic puls" pulse />
                        <StatusBadge status="monitor" variant="dot" pulse />
                    </PGRow>
                </PGSection>

                {/* ── EmptyState ──────────────────────────────────────── */}
                <PGSection title="EmptyState">
                    <Card>
                        <EmptyState icon="🔍" title="Nicio piesă găsită" subtitle="Încearcă un alt termen de căutare" size="sm" />
                    </Card>
                    <Gap />
                    <Card>
                        <EmptyState
                            icon="📊"
                            title="Fără date de telemetrie"
                            subtitle="Conectează dispozitivul OBD2 pentru a vedea statisticile"
                            action={{ label: 'Conectează', onPress: () => {} }}
                            size="md"
                        />
                    </Card>
                </PGSection>

                {/* ── Skeleton ────────────────────────────────────────── */}
                <PGSection title="Skeleton">
                    <PGRow label="Text (1 linie)">
                        <Skeleton variant="text" width={200} />
                    </PGRow>
                    <Gap v={spacing[2]} />
                    <Skeleton variant="text" lines={3} />
                    <Gap v={spacing[2]} />
                    <PGRow label="Rect + Circle">
                        <Skeleton variant="rect" height={60} width={80} />
                        <Skeleton variant="circle" height={48} width={48} />
                        <Skeleton variant="circle" height={32} width={32} />
                    </PGRow>
                    <Gap v={spacing[2]} />
                    <Skeleton variant="card" height={100} />
                    <Gap v={spacing[2]} />
                    <Skeleton variant="rect" height={40} animate={false} />
                    <Text style={pg.note}>↑ animate=false</Text>
                </PGSection>

                {/* ── Divider ─────────────────────────────────────────── */}
                <PGSection title="Divider">
                    <Text style={pg.note}>subtle</Text>
                    <Divider strength="subtle" />
                    <Text style={pg.note}>default</Text>
                    <Divider strength="default" />
                    <Text style={pg.note}>strong</Text>
                    <Divider strength="strong" />
                    <Text style={pg.note}>cu label</Text>
                    <Divider label="SAU" />
                    <PGRow label="vertical">
                        <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                            <Text style={pg.note}>A</Text>
                            <Divider orientation="vertical" />
                            <Text style={pg.note}>B</Text>
                            <Divider orientation="vertical" strength="strong" />
                            <Text style={pg.note}>C</Text>
                        </View>
                    </PGRow>
                </PGSection>

                <Divider label="FAZA B" />

                {/* ────────────────────── PHASE B ────────────────────── */}
                <Text style={[pg.phaseLabel, { marginTop: spacing[4] }]}>FAZA B — VEHICLE</Text>

                {/* ── HeroCard ────────────────────────────────────────── */}
                <PGSection title="HeroCard">
                    {STATUSES.slice(0, 4).map(s => (
                        <React.Fragment key={s}>
                            <HeroCard
                                value={s === 'optimal' ? 94 : s === 'good' ? 78 : s === 'monitor' ? 61 : 38}
                                unit="%"
                                title="Sănătate vehicul"
                                subtitle="Audi A6 C4 · 2.5 TDI"
                                description={`Status: ${s}`}
                                status={s}
                                icon="🚗"
                                onPress={s === 'optimal' ? () => {} : undefined}
                            />
                            <Gap v={spacing[2]} />
                        </React.Fragment>
                    ))}
                    <HeroCard value="--" title="Loading state" loading />
                </PGSection>

                {/* ── MetricCard ──────────────────────────────────────── */}
                <PGSection title="MetricCard">
                    <PGRow label="Grid 2col" wrap>
                        <MetricCard label="Viteză" value={87} unit="km/h" status="good" icon="⚡" trend={5.2} style={pg.metricHalf} />
                        <MetricCard label="Consum" value={7.4} unit="L/100" status="monitor" icon="⛽" trend={12.3} trendInverse style={pg.metricHalf} />
                        <MetricCard label="Temperatură" value={92} unit="°C" status="caution" icon="🌡" trend={-3.1} style={pg.metricHalf} />
                        <MetricCard label="Presiune" value={2.4} unit="bar" status="optimal" icon="◎" trend={0} style={pg.metricHalf} />
                    </PGRow>
                    <Gap />
                    <PGRow label="Mărimi">
                        <MetricCard label="sm" value={42} unit="km/h" size="sm" style={pg.metricThird} />
                        <MetricCard label="md" value={42} unit="km/h" size="md" style={pg.metricThird} />
                        <MetricCard label="lg" value={42} unit="km/h" size="lg" style={pg.metricThird} />
                    </PGRow>
                    <Gap />
                    <MetricCard label="Loading" value={0} loading />
                </PGSection>

                {/* ── HealthGauge ─────────────────────────────────────── */}
                <PGSection title="HealthGauge">
                    <PGRow label="Mărimi + scoruri" wrap>
                        <HealthGauge score={92} label="SĂNĂTATE" subtitle="Excelent" size="sm" />
                        <HealthGauge score={74} label="MOTOR" subtitle="Bun" size="md" />
                    </PGRow>
                    <Gap />
                    <View style={pg.gaugeCenter}>
                        <HealthGauge score={58} label="FRÂNE" subtitle="Monitorizare" size="lg" />
                    </View>
                    <Gap />
                    <PGRow label="Loading">
                        <HealthGauge score={0} size="sm" loading />
                    </PGRow>
                </PGSection>

                {/* ── RecommendationCard ──────────────────────────────── */}
                <PGSection title="RecommendationCard">
                    {['low', 'medium', 'high', 'critical'].map(p => (
                        <React.Fragment key={p}>
                            <RecommendationCard
                                title={`Recomandare prioritate ${p}`}
                                description="Verifică nivelul lichidului de frână și starea plăcuțelor. Ultimul service a depășit intervalul recomandat de 30 000 km."
                                priority={p}
                                icon={p === 'critical' ? '🚨' : p === 'high' ? '⚠' : p === 'medium' ? '💡' : 'ℹ'}
                                action={p !== 'low' ? { label: 'Programează service', onPress: () => {} } : undefined}
                                onDismiss={p === 'low' ? () => {} : undefined}
                            />
                            <Gap v={spacing[2]} />
                        </React.Fragment>
                    ))}
                    <RecommendationCard title="Loading state" loading />
                </PGSection>

                {/* ── PredictionCard ──────────────────────────────────── */}
                <PGSection title="PredictionCard">
                    {['low', 'medium', 'high'].map(c => (
                        <React.Fragment key={c}>
                            <PredictionCard
                                title={`Predicție — confidență ${c}`}
                                prediction="Filtrul de aer va necesita înlocuire în aproximativ 1200 km sau 3 săptămâni, pe baza consumului actual și condițiilor de drum."
                                confidence={c}
                                timeframe="~3 săptămâni · 1200 km"
                                icon="🔮"
                            />
                            <Gap v={spacing[2]} />
                        </React.Fragment>
                    ))}
                    <PredictionCard title="Loading" prediction="" loading />
                </PGSection>

                {/* ── TimelineCard ────────────────────────────────────── */}
                <PGSection title="TimelineCard">
                    {TIMELINE_ITEMS.map((item, idx) => (
                        <TimelineCard
                            key={idx}
                            {...item}
                            isFirst={idx === 0}
                            isLast={idx === TIMELINE_ITEMS.length - 1}
                            onPress={idx === 0 ? () => {} : undefined}
                        />
                    ))}
                    <Gap v={spacing[2]} />
                    <TimelineCard title="Loading state" loading isFirst isLast />
                </PGSection>

                {/* ── MaintenanceCard ─────────────────────────────────── */}
                <PGSection title="MaintenanceCard">
                    <MaintenanceCard
                        title="Schimb ulei motor"
                        subtitle="Motor 2.5 TDI"
                        dueKm={245000}
                        dueDate="oct 2025"
                        estimatedCost={350}
                        status="upcoming"
                        urgency="normal"
                        onPress={() => {}}
                    />
                    <Gap v={spacing[2]} />
                    <MaintenanceCard
                        title="Plăcuțe frână față"
                        dueKm={241500}
                        estimatedCost={480}
                        status="overdue"
                        urgency="high"
                        onPress={() => {}}
                    />
                    <Gap v={spacing[2]} />
                    <MaintenanceCard
                        title="ITP"
                        dueDate="mai 2025"
                        estimatedCost={120}
                        status="done"
                    />
                    <Gap v={spacing[2]} />
                    <MaintenanceCard title="Loading" loading />
                </PGSection>

                {/* ── DocumentCard ────────────────────────────────────── */}
                <PGSection title="DocumentCard">
                    {(['pdf', 'image', 'doc', 'xls', 'other']).map(t => (
                        <React.Fragment key={t}>
                            <DocumentCard
                                title={`Document ${t.toUpperCase()} — Asigurare RCA 2025`}
                                documentType={t}
                                fileSize="2.4 MB"
                                date="15 ian 2025"
                                category="Asigurare"
                                onPress={() => {}}
                            />
                            <Gap v={spacing[2]} />
                        </React.Fragment>
                    ))}
                    <DocumentCard title="Loading" loading />
                </PGSection>

                {/* ── WorkshopCard ────────────────────────────────────── */}
                <PGSection title="WorkshopCard">
                    <WorkshopCard
                        name="AutoService Premium Cluj"
                        address="Str. Fabricii nr. 14, Cluj-Napoca"
                        rating={4.7}
                        reviewCount={312}
                        distance="3.2 km"
                        phone="0264 123 456"
                        certified
                        onPress={() => {}}
                        onCallPress={() => {}}
                    />
                    <Gap v={spacing[2]} />
                    <WorkshopCard
                        name="Service Auto Rapid"
                        address="Calea Turzii 88, Cluj"
                        rating={3.9}
                        reviewCount={48}
                        distance="7.8 km"
                        onPress={() => {}}
                    />
                    <Gap v={spacing[2]} />
                    <WorkshopCard name="Loading" loading />
                </PGSection>

                {/* ── CostCard ────────────────────────────────────────── */}
                <PGSection title="CostCard">
                    <CostCard
                        title="Cheltuieli vehicul"
                        amount={860}
                        currency="RON"
                        period="Iulie 2025"
                        trend={12.4}
                        trendInverse
                        breakdown={BREAKDOWN}
                    />
                    <Gap v={spacing[2]} />
                    <CostCard
                        title="Cost total anual"
                        amount={9840}
                        currency="RON"
                        period="2024"
                        trend={-8.3}
                        trendInverse
                    />
                    <Gap v={spacing[2]} />
                    <CostCard title="Loading" amount={0} loading />
                </PGSection>

                {/* ── MilestoneCard ────────────────────────────────────── */}
                <PGSection title="MilestoneCard">
                    <MilestoneCard
                        title="250 000 km parcurși"
                        description="Vehiculul a atins un sfert de milion de kilometri"
                        achieved
                        icon="🏆"
                        achievedDate="14 iun 2025"
                        target="250 000 km"
                    />
                    <Gap v={spacing[2]} />
                    <MilestoneCard
                        title="10 service-uri efectuate"
                        description="Completeaza 10 vizite la service pentru a atinge acest milestone"
                        achieved={false}
                        icon="🔧"
                        target="10 service-uri"
                        progress={70}
                    />
                    <Gap v={spacing[2]} />
                    <MilestoneCard
                        title="Eco Driver"
                        description="Menține scorul eco peste 85 timp de 30 de zile"
                        achieved={false}
                        icon="🌿"
                        progress={40}
                    />
                    <Gap v={spacing[2]} />
                    <MilestoneCard title="Loading" achieved={false} loading />
                </PGSection>

                <View style={pg.footer}>
                    <Text style={pg.footerText}>Sprint 2 · Faza A + B complete</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const pg = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.bg[0],
    },
    scroll: { flex: 1 },
    content: {
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: spacing[6],
        paddingBottom: spacing[12],
    },

    screenTitle: {
        fontSize: typography.sizes.title1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
    },
    screenSubtitle: {
        fontSize: typography.sizes.body2,
        color: colors.text.tertiary,
        marginTop: spacing[1],
    },

    phaseLabel: {
        fontSize: typography.sizes.caption,
        color: colors.accent.default,
        fontWeight: typography.weights.bold,
        letterSpacing: 1.5,
        marginBottom: spacing[3],
    },

    section: {
        marginBottom: spacing[8],
    },
    sectionTitle: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        marginBottom: spacing[3],
        paddingBottom: spacing[2],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },

    row: {
        marginBottom: spacing[2],
    },
    rowLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginBottom: spacing[1] + 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    rowContent: {
        flexDirection: 'row',
        gap: spacing[2],
        alignItems: 'flex-start',
    },
    rowWrap: { flexWrap: 'wrap' },

    cardDemo: { flex: 1, minHeight: 52, justifyContent: 'center', alignItems: 'center' },
    cardDemoSm: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], minWidth: 80 },
    fullCard: { minHeight: 52, justifyContent: 'center', alignItems: 'center' },

    demoLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    demoLabelSm: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        textAlign: 'center',
    },

    note: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginBottom: spacing[1],
    },

    inputIcon: {
        fontSize: typography.sizes.body2,
        color: colors.text.tertiary,
    },

    metricHalf: { flex: 1 },
    metricThird: { flex: 1 },
    gaugeCenter: { alignItems: 'center', paddingVertical: spacing[3] },

    footer: {
        marginTop: spacing[8],
        alignItems: 'center',
    },
    footerText: {
        fontSize: typography.sizes.caption,
        color: colors.text.disabled,
    },
});
