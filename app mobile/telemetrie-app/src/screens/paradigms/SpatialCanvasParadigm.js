import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    StatusBar,
    Dimensions,
    ScrollView,
} from 'react-native';
import Svg, {
    Rect,
    Circle,
    Line,
    Path,
    Polygon,
    Defs,
    LinearGradient,
    Stop,
    G,
    Text as SvgText,
} from 'react-native-svg';
import { LiveContext } from '../../context/LiveContext';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticCriticalWarning } from '../../services/hapticFeedback';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function SpatialCanvasParadigm() {
    const { liveData, isConnected } = useContext(LiveContext);
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // 4 Zone de Cameră: 'OVERVIEW' | 'ENGINE_BAY' | 'CHASSIS_BRAKES' | 'HIGHWAY_CHASE'
    const [cameraZone, setCameraZone] = useState('OVERVIEW');

    // Sertar holografic deschis (null | 'AI' | 'TRIP')
    const [activeDrawer, setActiveDrawer] = useState(null);

    // Valori telemetrice
    const speed = Math.round(Number(liveData?.viteza_kmh ?? liveData?.motor?.speed ?? 0));
    const rpm = Math.round(Number(liveData?.turatie_rpm ?? liveData?.motor?.rpm ?? 0));
    const load = Math.round(Number(liveData?.sarcina_motor_pct ?? liveData?.motor?.load ?? 0));
    const boost = Number(liveData?.presiune_turbo_bar ?? liveData?.aer?.boost_actual ?? 0).toFixed(2);
    const coolant = Math.round(Number(liveData?.temperaturi?.coolant ?? liveData?.temp_antigel ?? 88));
    const oilTemp = Math.round(Number(liveData?.temperaturi?.oil ?? liveData?.temp_ulei ?? 92));
    const voltage = Number(liveData?.baterie?.ecu_volt ?? liveData?.tensiune ?? 14.1).toFixed(1);

    // Fizică 32 Modele
    const v = liveData?.virtual || {};
    const f = liveData?.fizica || {};
    const brakeDiscTemp = Math.round(Number(v.brakeDiscTempC ?? f.temp_frane_c ?? 110));
    const brakeFluidTemp = Math.round(Number(v.brakeFluidTempEstimatedC ?? 115));
    const roadGrade = Number(v.roadGradePct ?? f.panta_drum_pct ?? 0).toFixed(1);
    const roadGrip = String(v.roadGripStatus || 'NORMAL');
    const fatigue = Math.round(Number(v.driverFatigueScore ?? 88));
    const turboCore = Math.round(Number(v.turboCoreTempC ?? 240));
    const icEff = Math.round(Number(v.intercoolerEfficiencyPct ?? 82));
    const batterySoh = Math.round(Number(v.batterySoH ?? f.baterie_soh_pct ?? 94));
    const suspDamping = Number(v.suspensionDampingRatio ?? 0.28).toFixed(2);
    const tpmsDrift = Number(v.tireRadiusDriftPct ?? 0.0).toFixed(1);

    // Ciclul de aprindere 1-2-4-5-3 la motorul de 5 cilindri în linie
    const firingCyl = useMemo(() => {
        const order = [1, 2, 4, 5, 3];
        if (rpm === 0) return 1;
        const tick = Math.floor((Date.now() / 200) % 5);
        return order[tick];
    }, [rpm]);

    // Culoare discuri frână
    const discColor = useMemo(() => {
        if (brakeDiscTemp < 90) return '#00F0FF';
        if (brakeDiscTemp < 180) return '#FFB800';
        return '#FF2A2A';
    }, [brakeDiscTemp]);

    const selectZone = (zone) => {
        hapticTap();
        setCameraZone(zone);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#04060B" />

            {/* ── Antet Plutitor Spațial ── */}
            <View style={styles.topHudBar}>
                <View style={styles.hudBrand}>
                    <View style={styles.holoBadge}>
                        <Text style={styles.holoBadgeText}>SPATIAL 3D CANVAS</Text>
                    </View>
                    <View style={[styles.netDot, { backgroundColor: isConnected ? '#00FF66' : '#FF2A2A' }]} />
                    <Text style={styles.vinHud}>
                        {activeVehicle?.model || 'AUDI 2.5 TDI'}
                    </Text>
                </View>

                {/* Butoane Acțiuni Rapide */}
                <View style={styles.topActions}>
                    <TouchableOpacity
                        style={[styles.glassBtn, { borderColor: '#00F0FF' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                    >
                        <Text style={[styles.glassBtnText, { color: '#00F0FF' }]}>🎮 DEMO</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.glassBtn, { borderColor: '#FFB800' }]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                    >
                        <Text style={[styles.glassBtnText, { color: '#FFB800' }]}>🎨 STIL</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.glassBtn}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                    >
                        <Text style={styles.glassBtnText}>⮌ V2</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Selector Plutitor Cameră / Zonă Spațială ── */}
            <View style={styles.cameraSelectorRow}>
                {[
                    { id: 'OVERVIEW', label: '🛸 ORBITĂ' },
                    { id: 'ENGINE_BAY', label: '🔥 CAPOTĂ' },
                    { id: 'CHASSIS_BRAKES', label: '🛞 ȘASIU' },
                    { id: 'HIGHWAY_CHASE', label: '🛣️ PERSPECTIVĂ' },
                ].map((c) => {
                    const isActive = cameraZone === c.id;
                    return (
                        <TouchableOpacity
                            key={c.id}
                            style={[
                                styles.cameraPill,
                                isActive && styles.cameraPillActive,
                            ]}
                            onPress={() => selectZone(c.id)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.cameraPillText, isActive && styles.cameraPillTextActive]}>
                                {c.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── CANVAS SPAȚIAL VECTORIAL ── */}
            <View style={styles.canvasContainer}>
                {/* 1. ZONA 01: ORBITĂ & SCUT SENTRY */}
                {cameraZone === 'OVERVIEW' && (
                    <View style={styles.canvasInner}>
                        <Svg width={SCREEN_WIDTH - 24} height={SCREEN_HEIGHT * 0.44} viewBox="0 0 320 280">
                            <Defs>
                                <LinearGradient id="intakeGrad" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor="#00F0FF" stopOpacity="0.8" />
                                    <Stop offset="1" stopColor="#0066FF" stopOpacity="0.3" />
                                </LinearGradient>
                                <LinearGradient id="exhaustGrad" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor="#FF8800" stopOpacity="0.8" />
                                    <Stop offset="1" stopColor="#FF2A2A" stopOpacity="0.3" />
                                </LinearGradient>
                            </Defs>

                            {/* Inele Pulsante Sentry Guard */}
                            <Circle cx={160} cy={140} r={120} stroke="#00F0FF15" strokeWidth={1} fill="none" />
                            <Circle cx={160} cy={140} r={95} stroke="#00F0FF25" strokeWidth={1} strokeDasharray="6,4" fill="none" />

                            {/* Siluetă Caroserie Mașină (Top-Down) */}
                            <Rect x={115} y={50} width={90} height={180} rx={22} fill="#0A111E" stroke="#1E3250" strokeWidth={2} />
                            {/* Parbriz & Geamuri */}
                            <Path d="M 125 100 L 195 100 L 190 145 L 130 145 Z" fill="#142136" stroke="#253E63" strokeWidth={1} />
                            <Path d="M 130 160 L 190 160 L 195 195 L 125 195 Z" fill="#142136" stroke="#253E63" strokeWidth={1} />

                            {/* Linii de Flux Energetic */}
                            {/* Flux Admisie Aer (Albastru) */}
                            <Line x1={160} y1={52} x2={160} y2={85} stroke="url(#intakeGrad)" strokeWidth={3} strokeLinecap="round" />
                            {/* Bloc Motor Central (Portocaliu) */}
                            <Rect x={138} y={75} width={44} height={38} rx={4} fill="#241005" stroke="#FF8800" strokeWidth={1.5} />
                            <SvgText x={160} y={98} fill="#FF8800" fontSize={8} fontWeight="bold" textAnchor="middle">2.5 TDI</SvgText>

                            {/* Flux Evacuare / DPF (Roșu) */}
                            <Line x1={154} y1={113} x2={154} y2={228} stroke="url(#exhaustGrad)" strokeWidth={2.5} strokeLinecap="round" />

                            {/* Vectori de Cuplu către Roți */}
                            <Line x1={138} y1={85} x2={108} y2={85} stroke="#00FF66" strokeWidth={2} strokeLinecap="round" />
                            <Line x1={182} y1={85} x2={212} y2={85} stroke="#00FF66" strokeWidth={2} strokeLinecap="round" />

                            {/* Cele 4 Roți */}
                            <Rect x={98} y={72} width={12} height={28} rx={3} fill="#0E1624" stroke={discColor} strokeWidth={1.5} />
                            <Rect x={210} y={72} width={12} height={28} rx={3} fill="#0E1624" stroke={discColor} strokeWidth={1.5} />
                            <Rect x={98} y={175} width={12} height={28} rx={3} fill="#0E1624" stroke={discColor} strokeWidth={1.5} />
                            <Rect x={210} y={175} width={12} height={28} rx={3} fill="#0E1624" stroke={discColor} strokeWidth={1.5} />

                            {/* Noduri Holografice Interactive */}
                            <G onPress={() => selectZone('ENGINE_BAY')}>
                                <Circle cx={55} cy={85} r={18} fill="#091424" stroke="#00F0FF" strokeWidth={1.5} />
                                <SvgText x={55} y={88} fill="#00F0FF" fontSize={7} fontWeight="bold" textAnchor="middle">MOTOR</SvgText>
                                <Line x1={73} y1={85} x2={138} y2={85} stroke="#00F0FF44" strokeWidth={1} strokeDasharray="3,3" />
                            </G>

                            <G onPress={() => selectZone('CHASSIS_BRAKES')}>
                                <Circle cx={265} cy={85} r={18} fill="#091424" stroke="#FF8800" strokeWidth={1.5} />
                                <SvgText x={265} y={88} fill="#FF8800" fontSize={7} fontWeight="bold" textAnchor="middle">FRÂNE</SvgText>
                                <Line x1={247} y1={85} x2={210} y2={85} stroke="#FF880044" strokeWidth={1} strokeDasharray="3,3" />
                            </G>

                            <G onPress={() => selectZone('HIGHWAY_CHASE')}>
                                <Circle cx={265} cy={190} r={18} fill="#091424" stroke="#00FF66" strokeWidth={1.5} />
                                <SvgText x={265} y={193} fill="#00FF66" fontSize={7} fontWeight="bold" textAnchor="middle">ȘOSEA</SvgText>
                                <Line x1={247} y1={190} x2={210} y2={190} stroke="#00FF6644" strokeWidth={1} strokeDasharray="3,3" />
                            </G>
                        </Svg>

                        {/* Bento Card Vitals Jos */}
                        <View style={styles.overviewBento}>
                            <View style={styles.bentoCell}>
                                <Text style={styles.bentoLbl}>VITEZĂ</Text>
                                <Text style={styles.bentoVal}>{speed} <Text style={styles.bentoUnit}>KM/H</Text></Text>
                            </View>
                            <View style={styles.bentoCell}>
                                <Text style={styles.bentoLbl}>TURAȚIE</Text>
                                <Text style={styles.bentoValLime}>{rpm} <Text style={styles.bentoUnit}>RPM</Text></Text>
                            </View>
                            <View style={styles.bentoCell}>
                                <Text style={styles.bentoLbl}>BOOST</Text>
                                <Text style={styles.bentoValCyan}>{boost} <Text style={styles.bentoUnit}>BAR</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* 2. ZONA 02: ZOOM SUB CAPOTĂ (ENGINE BAY) */}
                {cameraZone === 'ENGINE_BAY' && (
                    <View style={styles.canvasInner}>
                        <Svg width={SCREEN_WIDTH - 24} height={SCREEN_HEIGHT * 0.40} viewBox="0 0 320 240">
                            {/* Compartiment Motor Macro */}
                            <Rect x={10} y={10} width={300} height={220} rx={12} fill="#070D17" stroke="#162942" strokeWidth={1.5} />

                            {/* Cei 5 Cilindri în Linie cu Firing Animation 1-2-4-5-3 */}
                            <SvgText x={160} y={32} fill="#7A8CA3" fontSize={9} fontWeight="bold" textAnchor="middle">
                                BLOC 5 CILINDRI ÎN LINIE (APRINDERE: 1-2-4-5-3)
                            </SvgText>

                            {[1, 2, 3, 4, 5].map((cylNum, i) => {
                                const isFiring = firingCyl === cylNum;
                                const cx = 48 + i * 56;
                                return (
                                    <G key={cylNum}>
                                        <Circle
                                            cx={cx}
                                            cy={70}
                                            r={22}
                                            fill={isFiring ? '#FF4422' : '#0E1A2B'}
                                            stroke={isFiring ? '#FFAA00' : '#1E3554'}
                                            strokeWidth={isFiring ? 2.5 : 1}
                                        />
                                        <SvgText
                                            x={cx}
                                            y={74}
                                            fill={isFiring ? '#FFFFFF' : '#6A7D94'}
                                            fontSize={12}
                                            fontWeight="900"
                                            textAnchor="middle"
                                        >
                                            {cylNum}
                                        </SvgText>
                                    </G>
                                );
                            })}

                            {/* Turbosuflanta VNT & CHRA */}
                            <Rect x={25} y={120} width={80} height={50} rx={6} fill="#140905" stroke="#FF8800" strokeWidth={1.2} />
                            <SvgText x={65} y={142} fill="#FF8800" fontSize={9} fontWeight="bold" textAnchor="middle">TURBO VNT</SvgText>
                            <SvgText x={65} y={158} fill="#FFFFFF" fontSize={11} fontWeight="bold" textAnchor="middle">{turboCore}°C</SvgText>

                            {/* Traseu Intercooler */}
                            <Rect x={120} y={120} width={80} height={50} rx={6} fill="#05141A" stroke="#00F0FF" strokeWidth={1.2} />
                            <SvgText x={160} y={142} fill="#00F0FF" fontSize={9} fontWeight="bold" textAnchor="middle">INTERCOOLER</SvgText>
                            <SvgText x={160} y={158} fill="#FFFFFF" fontSize={11} fontWeight="bold" textAnchor="middle">η {icEff}%</SvgText>

                            {/* Baterie & Alternator */}
                            <Rect x={215} y={120} width={80} height={50} rx={6} fill="#061A0E" stroke="#00FF66" strokeWidth={1.2} />
                            <SvgText x={255} y={142} fill="#00FF66" fontSize={9} fontWeight="bold" textAnchor="middle">BATERIE</SvgText>
                            <SvgText x={255} y={158} fill="#FFFFFF" fontSize={11} fontWeight="bold" textAnchor="middle">{voltage}V ({batterySoh}%)</SvgText>
                        </Svg>

                        {/* Detalii Capotă */}
                        <View style={styles.engineBayDetails}>
                            <Text style={styles.detailText}>ANTIGEL: <Text style={{ color: '#00F0FF' }}>{coolant}°C</Text></Text>
                            <Text style={styles.detailText}>ULEI: <Text style={{ color: '#FFB800' }}>{oilTemp}°C</Text></Text>
                            <Text style={styles.detailText}>SARCINĂ: <Text style={{ color: '#00FF66' }}>{load}%</Text></Text>
                        </View>
                    </View>
                )}

                {/* 3. ZONA 03: ZOOM ȘASIU, FRÂNE & ROȚI */}
                {cameraZone === 'CHASSIS_BRAKES' && (
                    <View style={styles.canvasInner}>
                        <Svg width={SCREEN_WIDTH - 24} height={SCREEN_HEIGHT * 0.40} viewBox="0 0 320 240">
                            <Rect x={10} y={10} width={300} height={220} rx={12} fill="#070D17" stroke="#162942" strokeWidth={1.5} />

                            <SvgText x={160} y={32} fill="#7A8CA3" fontSize={9} fontWeight="bold" textAnchor="middle">
                                TELEMETRIE TERMICĂ FRÂNE & SUSPENSIE
                            </SvgText>

                            {/* Cele 4 Discuri cu Iluminare Termică */}
                            {/* Stânga Față */}
                            <Circle cx={70} cy={80} r={28} fill="#0B1524" stroke={discColor} strokeWidth={3} />
                            <SvgText x={70} y={84} fill={discColor} fontSize={10} fontWeight="bold" textAnchor="middle">SF {brakeDiscTemp}°C</SvgText>

                            {/* Dreapta Față */}
                            <Circle cx={250} cy={80} r={28} fill="#0B1524" stroke={discColor} strokeWidth={3} />
                            <SvgText x={250} y={84} fill={discColor} fontSize={10} fontWeight="bold" textAnchor="middle">DF {brakeDiscTemp}°C</SvgText>

                            {/* Stânga Spate */}
                            <Circle cx={70} cy={165} r={24} fill="#0B1524" stroke={discColor} strokeWidth={2.5} />
                            <SvgText x={70} y={169} fill={discColor} fontSize={9} fontWeight="bold" textAnchor="middle">SS {Math.round(brakeDiscTemp * 0.85)}°C</SvgText>

                            {/* Dreapta Spate */}
                            <Circle cx={250} cy={165} r={24} fill="#0B1524" stroke={discColor} strokeWidth={2.5} />
                            <SvgText x={250} y={169} fill={discColor} fontSize={9} fontWeight="bold" textAnchor="middle">DS {Math.round(brakeDiscTemp * 0.85)}°C</SvgText>

                            {/* Centru: Lichid de Frână & Suspensie */}
                            <Rect x={115} y={90} width={90} height={65} rx={6} fill="#140804" stroke="#FF8800" strokeWidth={1} />
                            <SvgText x={160} y={108} fill="#FF8800" fontSize={8} fontWeight="bold" textAnchor="middle">LICHID FRÂNĂ</SvgText>
                            <SvgText x={160} y={124} fill="#FFFFFF" fontSize={12} fontWeight="bold" textAnchor="middle">{brakeFluidTemp}°C</SvgText>
                            <SvgText x={160} y={142} fill="#A0AEC0" fontSize={7} textAnchor="middle">DAMPING ζ: {suspDamping}</SvgText>
                        </Svg>

                        <View style={styles.engineBayDetails}>
                            <Text style={styles.detailText}>DEVIATIE TPMS: <Text style={{ color: '#00F0FF' }}>{tpmsDrift}%</Text></Text>
                            <Text style={styles.detailText}>STATUS FRÂNE: <Text style={{ color: discColor }}>{brakeDiscTemp > 240 ? 'FIERBERE' : 'OPTIM'}</Text></Text>
                        </View>
                    </View>
                )}

                {/* 4. ZONA 04: CHASE-CAM DINAMIC PE ȘOSEA */}
                {cameraZone === 'HIGHWAY_CHASE' && (
                    <View style={styles.canvasInner}>
                        <Svg width={SCREEN_WIDTH - 24} height={SCREEN_HEIGHT * 0.40} viewBox="0 0 320 240">
                            {/* Orizont */}
                            <Rect x={0} y={0} width={320} height={100} fill="#050912" />
                            <Rect x={0} y={100} width={320} height={140} fill="#090E17" />

                            {/* Șosea în Perspectivă (Tesla Autopilot Style) */}
                            <Polygon points="120,100 200,100 280,240 40,240" fill="#0C1420" stroke="#162942" strokeWidth={1} />

                            {/* Bandă Drum Centrală cu Linii Curgătoare */}
                            <Line x1={160} y1={100} x2={160} y2={120} stroke="#FFFFFF" strokeWidth={2} />
                            <Line x1={160} y1={135} x2={160} y2={165} stroke="#FFFFFF" strokeWidth={3} />
                            <Line x1={160} y1={185} x2={160} y2={235} stroke="#FFFFFF" strokeWidth={4} />

                            {/* Viteză Monumentală Deasupra Orizontului */}
                            <SvgText x={160} y={55} fill="#FFFFFF" fontSize={38} fontFamily={MONO} fontWeight="bold" textAnchor="middle">
                                {speed}
                            </SvgText>
                            <SvgText x={160} y={72} fill="#00F0FF" fontSize={10} fontFamily={MONO} fontWeight="bold" textAnchor="middle">
                                KM/H // {rpm} RPM
                            </SvgText>

                            {/* Siluetă Mașină din Spate (Rear View) */}
                            <Rect x={132} y={160} width={56} height={36} rx={8} fill="#0F1D30" stroke="#00F0FF" strokeWidth={1.5} />
                            {/* Stopuri Roșii */}
                            <Rect x={136} y={170} width={10} height={5} rx={2} fill="#FF2A2A" />
                            <Rect x={174} y={170} width={10} height={5} rx={2} fill="#FF2A2A" />

                            {/* Bandă Stare Aderență sub Roți */}
                            <SvgText x={160} y={225} fill={roadGrip.includes('ICE') ? '#00F0FF' : '#00FF66'} fontSize={9} fontWeight="bold" textAnchor="middle">
                                {roadGrip.includes('ICE') ? '❄️ ATENȚIE: POLEI DETECTAT' : '✓ ADERENȚĂ OPTIMĂ'} (PANTĂ {roadGrade}%)
                            </SvgText>
                        </Svg>

                        <View style={styles.engineBayDetails}>
                            <Text style={styles.detailText}>PANTĂ DRUM: <Text style={{ color: '#FFB800' }}>{roadGrade}%</Text></Text>
                            <Text style={styles.detailText}>SCOR ATENȚIE: <Text style={{ color: '#00FF66' }}>{fatigue}/100</Text></Text>
                        </View>
                    </View>
                )}
            </View>

            {/* ── Sertare Holografice Jos (Floating Glass Pills) ── */}
            <View style={styles.bottomPillRow}>
                <TouchableOpacity
                    style={[styles.floatingPill, activeDrawer === 'AI' && styles.floatingPillActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer((prev) => (prev === 'AI' ? null : 'AI'));
                    }}
                >
                    <Text style={styles.floatingPillText}>✨ INGINER AI</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.floatingPill}
                    onPress={() => {
                        hapticTap();
                        openSimulatorModal();
                    }}
                >
                    <Text style={[styles.floatingPillText, { color: '#00F0FF' }]}>🎮 SIMULARE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.floatingPill, activeDrawer === 'TRIP' && styles.floatingPillActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer((prev) => (prev === 'TRIP' ? null : 'TRIP'));
                    }}
                >
                    <Text style={styles.floatingPillText}>📜 CURSĂ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.floatingPill}
                    onPress={() => {
                        hapticTap();
                        openExperiencePicker();
                    }}
                >
                    <Text style={[styles.floatingPillText, { color: '#FFB800' }]}>🎨 STIL</Text>
                </TouchableOpacity>
            </View>

            {/* ── Conținut Sertar Activ (AI sau Cursă) ── */}
            {activeDrawer === 'AI' && (
                <View style={styles.drawerOverlay}>
                    <View style={styles.drawerCard}>
                        <View style={styles.drawerHead}>
                            <Text style={styles.drawerTitle}>✨ INGINER VIRTUAL // DIAGNOSTIC SPAȚIAL</Text>
                            <TouchableOpacity onPress={() => setActiveDrawer(null)}>
                                <Text style={styles.drawerClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.drawerBody}>
                            Toate cele 32 de subsisteme sunt conectate. Temperatura CHRA ({turboCore}°C) și bilanțul energetic indică ardere stabilă. Nu sunt detectate pierderi de aderență sau șocuri mecanice.
                        </Text>
                    </View>
                </View>
            )}

            {activeDrawer === 'TRIP' && (
                <View style={styles.drawerOverlay}>
                    <View style={styles.drawerCard}>
                        <View style={styles.drawerHead}>
                            <Text style={styles.drawerTitle}>📜 JURNAL TELEMETRIE CURSĂ</Text>
                            <TouchableOpacity onPress={() => setActiveDrawer(null)}>
                                <Text style={styles.drawerClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.tripRow}>
                            <Text style={styles.tripLbl}>DISTANȚĂ SESIUNE:</Text>
                            <Text style={styles.tripVal}>{Number(liveData?.distanta_km ?? 14.8).toFixed(1)} km</Text>
                        </View>
                        <View style={styles.tripRow}>
                            <Text style={styles.tripLbl}>CONSUM INSTANTANEU:</Text>
                            <Text style={styles.tripVal}>{Number(liveData?.consum_instant ?? 5.8).toFixed(1)} L/100</Text>
                        </View>
                        <View style={styles.tripRow}>
                            <Text style={styles.tripLbl}>SCOR ECO:</Text>
                            <Text style={[styles.tripVal, { color: '#00FF66' }]}>{Math.round(Number(liveData?.eco_score ?? 91))}/100</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#04060B',
        paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20,
    },
    topHudBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#101B2B',
        backgroundColor: '#070C16',
    },
    hudBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    holoBadge: {
        backgroundColor: '#B026FF18',
        borderWidth: 1,
        borderColor: '#B026FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
    },
    holoBadgeText: {
        color: '#B026FF',
        fontSize: 8.5,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    netDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    vinHud: {
        color: '#7185A0',
        fontSize: 9,
        fontFamily: MONO,
    },
    topActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    glassBtn: {
        borderWidth: 1,
        borderColor: '#1E2D44',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 3,
        backgroundColor: '#0C1626',
    },
    glassBtnText: {
        color: '#8CA0BA',
        fontSize: 9,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    cameraSelectorRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: '#080E1A',
        borderBottomWidth: 1,
        borderBottomColor: '#122033',
    },
    cameraPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#182A42',
        backgroundColor: '#0B1524',
    },
    cameraPillActive: {
        backgroundColor: '#B026FF22',
        borderColor: '#B026FF',
    },
    cameraPillText: {
        color: '#6E8199',
        fontSize: 9,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    cameraPillTextActive: {
        color: '#FFFFFF',
    },
    canvasContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    canvasInner: {
        width: '100%',
        alignItems: 'center',
    },
    overviewBento: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        backgroundColor: '#070C16',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#152438',
        paddingVertical: 8,
        marginTop: 6,
    },
    bentoCell: {
        alignItems: 'center',
    },
    bentoLbl: {
        color: '#556985',
        fontSize: 7.5,
        fontFamily: MONO,
        marginBottom: 2,
    },
    bentoVal: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    bentoValLime: {
        color: '#00FF66',
        fontSize: 14,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    bentoValCyan: {
        color: '#00F0FF',
        fontSize: 14,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    bentoUnit: {
        fontSize: 8,
        color: '#657795',
    },
    engineBayDetails: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        backgroundColor: '#080E1A',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#132238',
        paddingVertical: 6,
        marginTop: 8,
    },
    detailText: {
        color: '#7185A0',
        fontSize: 9,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    bottomPillRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        paddingVertical: 10,
        backgroundColor: '#050912',
        borderTopWidth: 1,
        borderTopColor: '#122033',
    },
    floatingPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#1A2C45',
        backgroundColor: '#091321',
    },
    floatingPillActive: {
        backgroundColor: '#B026FF25',
        borderColor: '#B026FF',
    },
    floatingPillText: {
        color: '#A0B3CC',
        fontSize: 9,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    drawerOverlay: {
        position: 'absolute',
        bottom: 54,
        left: 12,
        right: 12,
    },
    drawerCard: {
        backgroundColor: '#080E1A',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#B026FF',
        padding: 12,
        shadowColor: '#B026FF',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    drawerHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    drawerTitle: {
        color: '#B026FF',
        fontSize: 9.5,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    drawerClose: {
        color: '#8A99B5',
        fontSize: 12,
        fontWeight: 'bold',
        paddingHorizontal: 4,
    },
    drawerBody: {
        color: '#CBD5E1',
        fontSize: 11,
        lineHeight: 15,
        fontFamily: MONO,
    },
    tripRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
        borderBottomWidth: 0.6,
        borderBottomColor: '#132238',
    },
    tripLbl: {
        color: '#7185A0',
        fontSize: 9,
        fontFamily: MONO,
    },
    tripVal: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
});
