'use strict';

/**
 * ExplodedComponentSvg.js — Ilustrații Explodate CAD de Înaltă Fidelitate (Varianta 3)
 *
 * Randează o ilustrație tehnică mare și detaliată pentru componenta selectată:
 * - Turbocharger (Carcasă melc, elice compresor, actuator N75, racord silicon)
 * - Motor (Chiuloasă, capac supape, rampă injectoare, bloc motor, baie ulei)
 * - Răcire (Radiator fagure, electro-ventilatoare, termostat G62, vas expansiune)
 * - Frâne (Disc ventilat perforat, etrier Brembo roșu, plăcuțe fricțiune)
 * - Evacuare / DPF (Miez ceramic fagure, senzor presiune diferențială, carcasă inox)
 * - Cutie / Ambreiaj (Volant dublă masă, disc fricțiune, carcasă 6 trepte)
 * - Baterie / Alternator (Stator cupru, bornă baterie, modul electronic ECU)
 */

import React from 'react';
import Svg, {
    Path,
    Rect,
    Circle,
    G,
    Line,
    Defs,
    LinearGradient,
    Stop,
    Polygon,
    Ellipse,
} from 'react-native-svg';

const ExplodedComponentSvg = ({
    componentId = 'turbo',
    height = 180,
    accentColor = '#00f0ff',
}) => {
    // ── 1. TURBOSUFLANTĂ & ACTUATOR VNT ──
    if (componentId === 'turbo') {
        return (
            <Svg width="100%" height={height} viewBox="0 0 340 180">
                <Defs>
                    <LinearGradient id="turboHotGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#f97316" />
                        <Stop offset="1" stopColor="#b45309" />
                    </LinearGradient>
                    <LinearGradient id="turboColdGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#38bdf8" />
                        <Stop offset="1" stopColor="#1e40af" />
                    </LinearGradient>
                </Defs>

                {/* Carcasă evacuare melc (Turbine Housing) */}
                <Path
                    d="M 50 90 C 50 50, 95 40, 125 55 C 145 65, 155 85, 155 110 C 155 140, 125 155, 95 155 C 65 155, 50 130, 50 90 Z"
                    fill="url(#turboHotGrad)"
                    stroke="#ea580c"
                    strokeWidth="2"
                />
                {/* Flanșă evacuare spre downpipe */}
                <Rect x="30" y="75" width="22" height="36" rx="4" fill="#78350f" stroke="#ea580c" strokeWidth="1.5" />
                <Circle cx="36" cy="83" r="2.5" fill="#fcd34d" />
                <Circle cx="36" cy="103" r="2.5" fill="#fcd34d" />

                {/* Butuc central CHRA (Răcire ulei & ax lagăre) */}
                <Rect x="155" y="85" width="30" height="42" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                <Line x1="170" y1="70" x2="170" y2="85" stroke="#38bdf8" strokeWidth="3" />
                <Line x1="170" y1="127" x2="170" y2="145" stroke="#f59e0b" strokeWidth="3" />

                {/* Carcasă admisie compresor aluminiu (Compressor Housing) */}
                <Path
                    d="M 185 105 C 185 70, 215 55, 245 55 C 275 55, 305 75, 305 110 C 305 145, 275 160, 245 160 C 215 160, 185 140, 185 105 Z"
                    fill="url(#turboColdGrad)"
                    stroke="#60a5fa"
                    strokeWidth="2"
                />
                {/* Elice compresor billet cu palete vizibile */}
                <Circle cx="245" cy="108" r="32" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
                    <Line
                        key={i}
                        x1="245"
                        y1="108"
                        x2={245 + 26 * Math.cos(deg * Math.PI / 180)}
                        y2={108 + 26 * Math.sin(deg * Math.PI / 180)}
                        stroke="#7dd3fc"
                        strokeWidth="2"
                    />
                ))}
                <Circle cx="245" cy="108" r="8" fill="#e2e8f0" stroke="#0284c7" strokeWidth="1.5" />

                {/* Ieșire aer comprimat boost spre intercooler */}
                <Path d="M 275 58 L 295 35 L 318 48 L 298 72 Z" fill="#1e3a8a" stroke="#38bdf8" strokeWidth="1.5" />
                {/* Colier furtun silicon */}
                <Rect x="290" y="32" width="6" height="24" rx="2" fill="#94a3b8" transform="rotate(30 290 32)" />

                {/* Actuator vacuum / servomotor electronic VNT */}
                <Rect x="105" y="15" width="40" height="28" rx="6" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                <Line x1="125" y1="43" x2="105" y2="75" stroke="#cbd5e1" strokeWidth="3" />
                <Circle cx="105" cy="75" r="4" fill="#f59e0b" />
            </Svg>
        );
    }

    // ── 2. MOTOR & CHIULOASĂ ──
    if (componentId === 'engine') {
        return (
            <Svg width="100%" height={height} viewBox="0 0 340 180">
                <Defs>
                    <LinearGradient id="engineBlockGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#1e293b" />
                        <Stop offset="0.5" stopColor="#0f172a" />
                        <Stop offset="1" stopColor="#1e293b" />
                    </LinearGradient>
                </Defs>

                {/* Capac supape / Chiuloasă aluminiu */}
                <Rect x="60" y="25" width="220" height="35" rx="6" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <Rect x="80" y="16" width="30" height="12" rx="3" fill="#f59e0b" stroke="#d97706" strokeWidth="1.2" />

                {/* Rampă comună de injecție & 5 Injectoare */}
                <Line x1="75" y1="50" x2="265" y2="50" stroke="#00f0ff" strokeWidth="3" />
                {[90, 125, 160, 195, 230].map((cx, i) => (
                    <G key={i}>
                        <Rect x={cx - 5} y="45" width="10" height="25" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                        <Line x1={cx} y1="70" x2={cx} y2="85" stroke="#cbd5e1" strokeWidth="2" />
                    </G>
                ))}

                {/* Bloc motor din fontă (Cylinder Block) */}
                <Rect x="70" y="70" width="200" height="65" rx="6" fill="url(#engineBlockGrad)" stroke="#475569" strokeWidth="2" />
                {/* 5 Cămăși cilindru vizibile în secțiune */}
                {[90, 125, 160, 195, 230].map((cx, i) => (
                    <G key={i}>
                        <Rect x={cx - 12} y="75" width="24" height="50" rx="3" fill="#090d16" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
                        <Line x1={cx - 8} y1="95" x2={cx + 8} y2="95" stroke="#e2e8f0" strokeWidth="3" />
                    </G>
                ))}

                {/* Baie de ulei inferioară din aluminiu cu aripioare */}
                <Path d="M 85 135 L 255 135 L 245 165 L 95 165 Z" fill="#1e293b" stroke="#64748b" strokeWidth="1.8" />
                {[110, 135, 160, 185, 210, 230].map((cx, i) => (
                    <Line key={i} x1={cx} y1="140" x2={cx} y2="160" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.6" />
                ))}
                {/* Bușon golire ulei */}
                <Rect x="230" y="160" width="10" height="8" rx="2" fill="#f59e0b" />
            </Svg>
        );
    }

    // ── 3. RĂCIRE & TERMOSTAT ──
    if (componentId === 'cooling') {
        return (
            <Svg width="100%" height={height} viewBox="0 0 340 180">
                {/* Miez fagure radiator (Radiator Core) */}
                <Rect x="40" y="30" width="180" height="110" rx="6" fill="#0f172a" stroke="#0284c7" strokeWidth="2" />
                {[45, 65, 85, 105, 125, 145, 165, 185, 205].map((x, i) => (
                    <Line key={i} x1={x} y1="35" x2={x} y2="135" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,2" />
                ))}

                {/* Bazine laterale radiator & Racorduri */}
                <Rect x="25" y="40" width="16" height="90" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                <Rect x="218" y="40" width="16" height="90" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                <Path d="M 10 55 L 25 55" stroke="#10b981" strokeWidth="6" />
                <Path d="M 234 110 L 250 110" stroke="#0284c7" strokeWidth="6" />

                {/* Două electro-ventilatoare de răcire */}
                <Circle cx="90" cy="85" r="32" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                <Circle cx="90" cy="85" r="8" fill="#38bdf8" />
                <Circle cx="165" cy="85" r="32" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                <Circle cx="165" cy="85" r="8" fill="#38bdf8" />

                {/* Carcasă termostat cu senzor ECT (G62) */}
                <Rect x="260" y="55" width="45" height="50" rx="6" fill="#334155" stroke="#10b981" strokeWidth="2" />
                <Circle cx="282" cy="80" r="12" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
                <Rect x="290" y="38" width="12" height="20" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                <Text x="282" y="84" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">87°C</Text>
            </Svg>
        );
    }

    // ── 4. FRÂNE VENTILATE & ETRIER ──
    if (componentId === 'brakes_front' || componentId === 'brakes_rear') {
        return (
            <Svg width="100%" height={height} viewBox="0 0 340 180">
                {/* Disc de frână ventilat mare din fontă aliată */}
                <Circle cx="140" cy="90" r="70" fill="#1e293b" stroke="#94a3b8" strokeWidth="3" />
                <Circle cx="140" cy="90" r="62" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                {/* Caneluri / Perforații de ventilație */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
                    <Circle
                        key={i}
                        cx={140 + 48 * Math.cos(deg * Math.PI / 180)}
                        cy={90 + 48 * Math.sin(deg * Math.PI / 180)}
                        r="2.5"
                        fill="#38bdf8"
                    />
                ))}
                {/* Butuc central cu cele 5 prezoane de roată */}
                <Circle cx="140" cy="90" r="28" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                {[0, 72, 144, 216, 288].map((deg, i) => (
                    <Circle
                        key={i}
                        cx={140 + 18 * Math.cos(deg * Math.PI / 180)}
                        cy={90 + 18 * Math.sin(deg * Math.PI / 180)}
                        r="3.5"
                        fill="#e2e8f0"
                        stroke="#0f172a"
                        strokeWidth="1"
                    />
                ))}

                {/* Etrier performanță cu pistoane multiple (Brembo Gloss Red) */}
                <Path
                    d="M 175 40 C 220 50, 235 80, 235 120 C 235 140, 220 150, 185 155 L 180 135 C 205 130, 210 115, 210 90 C 210 65, 195 55, 175 52 Z"
                    fill="#ef4444"
                    stroke="#ff8888"
                    strokeWidth="2"
                />
                <Circle cx="195" cy="75" r="7" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1" />
                <Circle cx="195" cy="115" r="7" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1" />
                {/* Plăcuță de frână din material compozit */}
                <Rect x="245" y="65" width="16" height="55" rx="3" fill="#713f12" stroke="#f59e0b" strokeWidth="1.5" />
                {/* Conductă hidraulică de frână */}
                <Path d="M 200 40 L 205 20 L 260 20" stroke="#38bdf8" strokeWidth="2.5" fill="none" />
            </Svg>
        );
    }

    // ── 5. FILTRU PARTICULE DPF & EVACUARE ──
    if (componentId === 'dpf') {
        return (
            <Svg width="100%" height={height} viewBox="0 0 340 180">
                {/* Teavă downpipe inox */}
                <Path d="M 30 90 L 75 90" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
                <Path d="M 270 90 L 320 90" stroke="#94a3b8" strokeWidth="12" strokeLinecap="round" />

                {/* Carcasă cilindrică filtru DPF inox */}
                <Rect x="75" y="50" width="195" height="80" rx="20" fill="#1e293b" stroke="#f97316" strokeWidth="2.5" />

                {/* Miez ceramic fagure (Silicon Carbide Monolith) în secțiune */}
                <Rect x="115" y="58" width="115" height="64" rx="4" fill="#0f172a" stroke="#eab308" strokeWidth="1.5" />
                {[125, 145, 165, 185, 205].map((x, i) => (
                    <Line key={i} x1={x} y1="62" x2={x} y2="118" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2,2" />
                ))}

                {/* Țevi senzor presiune diferențială (Delta-P) */}
                <Path d="M 100 50 L 100 25 L 170 25" stroke="#38bdf8" strokeWidth="2" fill="none" />
                <Path d="M 240 50 L 240 25 L 170 25" stroke="#38bdf8" strokeWidth="2" fill="none" />
                <Circle cx="170" cy="25" r="6" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />

                {/* Sondă temperatură gaze EGT */}
                <Line x1="88" y1="130" x2="88" y2="155" stroke="#ef4444" strokeWidth="2" />
                <Circle cx="88" cy="155" r="4" fill="#ef4444" />
            </Svg>
        );
    }

    // ── 6. TRANSMISIE & AMBREIAJ ──
    if (componentId === 'transmission') {
        return (
            <Svg width="100%" height={height} viewBox="0 0 340 180">
                {/* Volant dublă masă (Dual-Mass Flywheel) cu coroană dințată */}
                <Circle cx="80" cy="90" r="50" fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" />
                <Circle cx="80" cy="90" r="44" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3,1" />

                {/* Disc de ambreiaj cu arcuri amortizoare */}
                <Circle cx="130" cy="90" r="38" fill="#334155" stroke="#f59e0b" strokeWidth="2" />
                {[0, 90, 180, 270].map((deg, i) => (
                    <Rect
                        key={i}
                        x={130 + 20 * Math.cos(deg * Math.PI / 180) - 5}
                        y={90 + 20 * Math.sin(deg * Math.PI / 180) - 5}
                        width="10"
                        height="10"
                        rx="2"
                        fill="#f59e0b"
                    />
                ))}

                {/* Carcasă cutie de viteze (Gearbox Housing) */}
                <Path
                    d="M 160 55 L 290 65 L 290 115 L 160 125 Z"
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth="2"
                />
                {/* Pinioane trepte vizibile schematic */}
                <Rect x="180" y="70" width="16" height="40" rx="3" fill="#0284c7" />
                <Rect x="205" y="73" width="16" height="34" rx="3" fill="#0284c7" />
                <Rect x="230" y="75" width="16" height="30" rx="3" fill="#0284c7" />
                <Rect x="255" y="78" width="16" height="24" rx="3" fill="#0284c7" />

                {/* Flanșă cardanică ieșire spate */}
                <Rect x="290" y="82" width="18" height="16" rx="3" fill="#64748b" stroke="#cbd5e1" strokeWidth="1.5" />
            </Svg>
        );
    }

    // ── 7. BATERIE 12V, ALTERNATOR & ECU ──
    return (
        <Svg width="100%" height={height} viewBox="0 0 340 180">
            {/* Alternator cu stator din cupru și fulie */}
            <Circle cx="90" cy="90" r="42" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
            <Circle cx="90" cy="90" r="30" fill="#0f172a" stroke="#d97706" strokeWidth="3" strokeDasharray="4,2" />
            <Circle cx="90" cy="90" r="14" fill="#334155" stroke="#94a3b8" strokeWidth="2" />

            {/* Baterie 12V AGM cu borne */}
            <Rect x="165" y="45" width="120" height="90" rx="8" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
            {/* Borne pozitivă și negativă */}
            <Rect x="185" y="32" width="14" height="14" rx="3" fill="#ef4444" />
            <Rect x="250" y="32" width="14" height="14" rx="3" fill="#3b82f6" />
            <Text x="192" y="43" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">+</Text>
            <Text x="257" y="43" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">-</Text>

            {/* Modul electronic ECU */}
            <Rect x="180" y="65" width="90" height="55" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
            {[188, 196, 204, 212, 220, 228, 236, 244, 252].map((x, i) => (
                <Line key={i} x1={x} y1="120" x2={x} y2="135" stroke="#fcd34d" strokeWidth="2" />
            ))}
        </Svg>
    );
};

export default React.memo(ExplodedComponentSvg);
