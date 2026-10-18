'use strict';
import React, { useContext, useState, useMemo, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    useWindowDimensions, Modal, Platform, StatusBar, PanResponder,
    Animated,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useKeepAwake } from 'expo-keep-awake';
import { LiveContext }  from '../context/LiveContext';
import { AlertContext } from '../context/AlertContext';
import { AppContext }   from '../context/AppContext';
import { useVehicle }   from '../context/VehicleContext';
import { getVehicleLabel } from '../utils/config';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getRootNavigation } from '../utils/navigation';
import { BottomSheet } from '../components/ui';
import { getSensorInfo } from '../data/sensorDictionary';
import { speakAlert } from '../services/voiceAlertService';
import LandscapeHudModal from '../components/cockpits/LandscapeHudModal';
import RecommendationCard from '../components/ui/RecommendationCard';
import { colors, typography, radii, spacing, layout, TEMPLATES } from '../theme';
import { useSmoothedTelemetry } from '../hooks/useSmoothedTelemetry';
import { hapticTap } from '../services/hapticFeedback';
import Svg, {
    Path,
    Circle,
    Line,
    Rect,
    G,
    Defs,
    LinearGradient,
    Stop,
    Text as SvgText,
} from 'react-native-svg';

// ─── Trigonometric Arc Helpers for Cockpit Gauges ────────────────────────────

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
    };
}

function describeClockwiseArc(x, y, radius, startAngle, endAngle) {
    if (endAngle <= startAngle) return '';
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
        'M', start.x.toFixed(2), start.y.toFixed(2),
        'A', radius, radius, 0, largeArcFlag, 1, end.x.toFixed(2), end.y.toFixed(2)
    ].join(' ');
}

// ─── AI assistant ─────────────────────────────────────────────────────────────

function buildAssistantMsg(liveData, isConnected, vehicleContext = {}) {
    if (!isConnected) return { text: 'Aștept conexiunea. Pornește vehiculul sau verifică conexiunea.', level: 'neutral' };
    const coolant = liveData.temperaturi?.coolant ?? 0;
    const rpm     = liveData.motor?.rpm ?? 0;
    const speed   = liveData.motor?.speed ?? 0;
    const volt    = liveData.baterie?.ecu_volt ?? 0;
    const cons    = liveData.combustibil?.inst_cons ?? 0;
    const dpfRgn  = liveData.dpf?.regen_status;

    const v       = liveData.virtual || {};
    const optMin  = vehicleContext.optTempMin || 80;
    const optMax  = vehicleContext.optTempMax || 95;
    const warnTemp = vehicleContext.warnTemp || (optMax + 5);
    const critTemp = vehicleContext.critTemp || (optMax + 12);
    const highRpmLimit = vehicleContext.highRpmLimit || 3800;

    if (v.dieselRunawayRisk) return { text: v.runawayAlertMessage || '🚨 PERICOL AUTOTURARE PE ULEI! Cuplează ultima treaptă, calcă frâna la podea și eliberează ambreiajul pentru a cala forțat motorul!', level: 'critical' };
    if (v.roadGripStatus === 'BLACK_ICE_GRIP_LOSS_WARNING') return { text: '🚨 Alertă critică: Pierdere aderență / Polei (Black Ice) detectat! Redu viteza imediat.', level: 'critical' };
    if (v.mountainBrakeFadeRisk) return { text: '⛰️ Risc critic: Fierbere lichid de frână (Brake Fade) în pantă montană! Retrogradează imediat.', level: 'critical' };
    if (v.cabinExhaustHazardAlert) return { text: '🫁 Pericol intoxicare monoxid de carbon în staționare! Comută clima pe Recirculare Aer Intern.', level: 'critical' };
    if (v.driverFatigueStatus === 'DRIVER_FATIGUE_TAKE_BREAK_ALERT') return { text: `☕ Alertă oboseală / micro-somn (Scor atenție: ${v.driverFatigueScore || 38}/100). Trage pe dreapta pentru o pauză!`, level: 'serious' };
    if (v.roadGripStatus === 'HYDROPLANING_OR_WET_SLIP_WARNING') return { text: '⚠️ Risc acvaplanare / carosabil ud cu aderență redusă.', level: 'warning' };
    if (v.fuelQualityStatus === 'POOR_DIESEL_CETANE_OR_CONTAMINATION') return { text: '⛽ Calitate slabă combustibil după alimentare (cifră cetanică scăzută / apă). Menajează motorul.', level: 'warning' };
    if (v.parasiticDrainStatus === 'PARASITIC_BATTERY_DRAIN_DETECTED') return { text: `🧛 Consumator parazit în parcare detectat (${v.parasiticDrainMa || 190} mA). Verifică modulele rămase active.`, level: 'warning' };
    if (v.waterPumpOrHeadGasketStatus === 'WATER_PUMP_IMPELLER_OR_HEAD_GASKET_RISK') return { text: `Risc critic supraîncălzire chiulasă/pompă apă (conductanță scăzută: ${v.coolingConductanceKwPerK || 0.38} kW/K).`, level: 'critical' };
    if (v.tirePressureStatus === 'LOW_TIRE_PRESSURE_DETECTED') return { text: 'Alertă TPMS: Roată dezumflată detectată prin deviație v_OBD vs v_GPS (>2.2%).', level: 'warning' };
    if (v.timingPhaseStatus === 'RETARDED_INJECTION_OR_TIMING_BELT_STRETCH') return { text: `Avans întârziat / curea distribuție decalată (anomalie termică evacuare +${v.exhaustHeatAnomalyC || 0}°C).`, level: 'warning' };
    if (v.mafVsTurboTriage === 'MAF_SENSOR_FOULED_TURBO_OK') return { text: 'Senzor debitmetru MAF colmatat/murdar. Turbina este intactă!', level: 'info' };
    if (v.accessoryBeltStatus === 'ALTERNATOR_OVERRUN_PULLEY_OR_AC_DRAG') return { text: 'Gripare fulie alternator frei sau sarcină anormală compresor AC.', level: 'warning' };
    if (v.crankingTriageStatus === 'WEAK_BATTERY_REPLACE') return { text: 'Baterie degradată la pornire (tensiune < 9.5V). Necesită înlocuire.', level: 'warning' };
    if (v.crankingTriageStatus === 'STARTER_MOTOR_HIGH_DRAW_OR_BUSHINGS') return { text: 'Demaror/electromotor defect sau bucșe gripate la pornire.', level: 'warning' };
    if (v.headFatigueStatus === 'COLD_THERMAL_SHOCK_HEAD_RISK') return { text: 'Șoc termo-mecanic sever pe chiulasă (gaze fierbinți la motor rece). Menajează accelerația.', level: 'serious' };
    if (v.turboCoolDownWarning) return { text: `Protecție Turbo: Miezul CHRA este încins (${Math.round(v.turboCoreTempC)}°C). Menține ralanti încă ${Math.round(v.turboCoolDownSec)}s pentru prevenire calaminare.`, level: 'warning' };
    if (v.dmfImbalanceWarning) return { text: 'Instabilitate severă la ralanti / vibrații anormale (posibil joc excesiv volantă cu masă dublă DMF).', level: 'warning' };
    if (v.dpfRegenActive) return { text: v.dpfRegenNotice || 'Regenerare DPF în curs! Menține motorul pornit.', level: 'warning' };
    if (v.rollingDragAnomaly) return { text: 'Rezistență anormală la rulare (posibil etrier frână blocat).', level: 'warning' };
    if (coolant > critTemp) return { text: `Temperatura motorului este critică (${coolant}°C). Recomand oprirea imediată.`, level: 'critical' };
    if (coolant > warnTemp)  return { text: `Temperatura motorului este ridicată (${coolant}°C). Dacă continuă să crească, oprește motorul.`, level: 'serious' };
    if (volt > 0 && volt < 13.0) return { text: 'Tensiunea de la alternator este scăzută. Posibilă problemă electrică.', level: 'warning' };
    if (volt > 0 && volt < 13.5) return { text: 'Tensiunea alternatorului este ușor sub valoarea obișnuită.', level: 'info' };
    if (dpfRgn === 'ACTIVE' || dpfRgn === 'ON') return { text: 'Regenerare DPF activă. Drumul lung ajută la eficiența filtrului.', level: 'info' };
    if (cons > 15 && speed > 5)  return { text: 'Consum instant ridicat. Menține o viteză constantă pentru eficiență.', level: 'info' };
    if (rpm > highRpmLimit && speed > 0) return { text: 'Turație ridicată. Schimbă la o treaptă superioară.', level: 'info' };
    if (speed === 0 && rpm > 500) return { text: 'Motor în ralanti. Temperaturi și presiuni stabile.', level: 'normal' };
    if (speed > 0 && coolant >= optMin && coolant <= optMax) return { text: 'Motorul funcționează la temperatura optimă.', level: 'normal' };
    if (speed > 0) return { text: 'Motorul funcționează normal.', level: 'normal' };
    return { text: 'Nu am observat nimic neobișnuit.', level: 'normal' };
}

function buildContextualAlert(liveData, latestAlert, vehicleContext = {}) {
    const coolant = liveData.temperaturi?.coolant ?? 0;
    const volt    = liveData.baterie?.ecu_volt ?? 0;
    const v       = liveData.virtual || {};
    const optMax  = vehicleContext.optTempMax || 95;
    const warnTemp = vehicleContext.warnTemp || (optMax + 5);
    const critTemp = vehicleContext.critTemp || (optMax + 12);

    if (v.dieselRunawayRisk) {
        return {
            title: '🚨 PERICOL AUTOTURARE PE ULEI',
            description: v.runawayAlertMessage || 'Motorul se turează necontrolat arzând ulei din turbină! Cuplează treapta maximă, calcă frâna și ridică ambreiajul pentru calare forțată!',
            priority: 'critical'
        };
    }
    if (v.roadGripStatus === 'BLACK_ICE_GRIP_LOSS_WARNING') {
        return {
            title: '🚨 PERICOL POLEI (BLACK ICE)',
            description: `Patinare roți (${v.wheelSlipDeltaKmh || 4.5} km/h ecart) la temperatură critică (${liveData.temperaturi?.ambient || 1}°C)! Carosabil înghețat, redu viteza imediat!`,
            priority: 'critical'
        };
    }
    if (v.mountainBrakeFadeRisk) {
        return {
            title: '⛰️ Risc Fierbere Lichid Frână',
            description: `Coborâre montană cu lichid de frână supraîncălzit (${v.brakeFluidTempEstimatedC || 160}°C) în treaptă mare (${liveData.transmisie?.gear || 5}). Retrogradează imediat pentru frână de motor!`,
            priority: 'critical'
        };
    }
    if (v.cabinExhaustHazardAlert) {
        return {
            title: '🫁 Risc Intoxicare Habitaclu',
            description: `Staționare prelungită cu motorul pornit (${Math.round((v.stationaryIdlingSec || 900) / 60)} min). Comută climatizarea pe Recirculare Aer Intern!`,
            priority: 'critical'
        };
    }
    if (v.driverFatigueStatus === 'DRIVER_FATIGUE_TAKE_BREAK_ALERT') {
        return {
            title: '☕ Alertă Oboseală / Micro-Somn',
            description: `Scor atenție scăzut (${v.driverFatigueScore || 38}/100) corelat cu tipar de oscilație involuntară a traiectoriei. Oprește la prima parcare pentru pauză!`,
            priority: 'critical'
        };
    }
    if (v.roadGripStatus === 'HYDROPLANING_OR_WET_SLIP_WARNING') {
        return {
            title: '⚠️ Risc Acvaplanare / Carosabil Ud',
            description: `Patinare roți (${v.wheelSlipDeltaKmh || 4.5} km/h) pe carosabil umed. Evită mișcările bruște de volan și frânarea violentă.`,
            priority: 'high'
        };
    }
    if (v.fuelQualityStatus === 'POOR_DIESEL_CETANE_OR_CONTAMINATION') {
        return {
            title: '⛽ Combustibil Slab / Contaminat',
            description: 'Creștere anormală a consumului specific și instabilitate la ralanti imediat după alimentare. Evită solicitarea la sarcină maximă!',
            priority: 'high'
        };
    }
    if (v.parasiticDrainStatus === 'PARASITIC_BATTERY_DRAIN_DETECTED') {
        return {
            title: '🧛 Consumator Parazit Baterie',
            description: `Curent de descărcare în parcare estimat la ${v.parasiticDrainMa || 190} mA (> 120 mA admis). Modul electronic rămas activ în standby.`,
            priority: 'high'
        };
    }
    if (v.waterPumpOrHeadGasketStatus === 'WATER_PUMP_IMPELLER_OR_HEAD_GASKET_RISK') {
        return {
            title: '🚨 Pompă Apă / Garnitură Chiulasă',
            description: `Conductanță scăzută (${v.coolingConductanceKwPerK || 0.38} kW/K) cu supraîncălzire rapidă. Risc iminent de distrugere motor!`,
            priority: 'critical'
        };
    }
    if (v.tirePressureStatus === 'LOW_TIRE_PRESSURE_DETECTED') {
        return {
            title: '⚠️ Presiune Scăzută Anvelopă',
            description: `Deviație rază dinamică ${v.tireRadiusDriftPct > 0 ? '+' : ''}${v.tireRadiusDriftPct}% (roata se rotește mai rapid decât viteza GPS). Verifică presiunea la rece!`,
            priority: 'high'
        };
    }
    if (v.timingPhaseStatus === 'RETARDED_INJECTION_OR_TIMING_BELT_STRETCH') {
        return {
            title: '⏱️ Avans Întârziat / Distribuție',
            description: `Anomalie termică evacuare (+${v.exhaustHeatAnomalyC || 0}°C) la amestec sărac. Ardere tardivă în galerie sau decalaj curea distribuție!`,
            priority: 'high'
        };
    }
    if (v.crankingTriageStatus === 'WEAK_BATTERY_REPLACE') {
        return {
            title: '🔋 Baterie Slăbită la Pornire',
            description: 'Tensiunea la demaraj a scăzut sub 9.5V cu stare de sănătate (SoH) redusă. Bateria necesită înlocuire.',
            priority: 'high'
        };
    }
    if (v.crankingTriageStatus === 'STARTER_MOTOR_HIGH_DRAW_OR_BUSHINGS') {
        return {
            title: '⚙️ Demaror / Electromotor Gripat',
            description: 'Cădere masivă de tensiune cu turație sub 160 RPM pe baterie bună. Bucșe sau bobinaj demaror uzate.',
            priority: 'high'
        };
    }
    if (v.headFatigueStatus === 'COLD_THERMAL_SHOCK_HEAD_RISK') {
        return {
            title: '❄️ Șoc Termo-Mecanic Chiulasă',
            description: `Gradient termic critic (evacuare ${Math.round(liveData.dpf?.egt1 || liveData.temperaturi?.cat1 || 500)}°C vs apă ${coolant}°C). Risc de fisurare a chiulasei!`,
            priority: 'high'
        };
    }
    if (v.mafVsTurboTriage === 'MAF_SENSOR_FOULED_TURBO_OK') {
        return {
            title: '💡 Diagnoză: Debitmetru MAF Murdar',
            description: 'Presiunea turbo atinge ținta, dar debitmetrul măsoară <72% din aerul teoretic. Economie service: curăță sau înlocuiește MAF (30-150 RON), turbina este intactă!',
            priority: 'medium'
        };
    }
    if (v.accessoryBeltStatus === 'ALTERNATOR_OVERRUN_PULLEY_OR_AC_DRAG') {
        return {
            title: '⚡ Gripare Fulie Alternator / AC',
            description: 'Fluctuații de ralanti corelate cu ripple de tensiune și compensare injecție. Fulie alternator frei blocată sau compresor AC gripat.',
            priority: 'medium'
        };
    }
    if (v.powertrainMountStatus === 'WORN_ENGINE_OR_GEARBOX_MOUNTS') {
        return {
            title: '⚙️ Șoc Tampon Motor / Cutie',
            description: 'Șocuri mari la schimbarea treptelor (|Δax| > 0.25G). Verifică tampoanele antibalans.',
            priority: 'medium'
        };
    }
    if (v.injectorHealthStatus === 'NOZZLE_COKING_OR_PUMP_WEAR') {
        return {
            title: '⛽ Compensare Mare Injectoare',
            description: `Derivă injecție ralanti cald (${v.idleInjectionDriftMg > 0 ? '+' : ''}${v.idleInjectionDriftMg} mg). Posibilă colmatare duze sau uzură pompă.`,
            priority: 'medium'
        };
    }
    if (v.suspensionStatus === 'WORN_SHOCK_ABSORBERS') {
        return {
            title: '🚗 Amortizoare Uzate',
            description: `Factor de amortizare ζ=${v.suspensionDampingRatio || 0.14} < 0.18. Atenuare întârziată a reculului suspensiei.`,
            priority: 'medium'
        };
    }
    if (v.wheelBalanceStatus === 'WHEEL_IMBALANCE_OR_TIRE_RUNOUT') {
        return {
            title: '⚖️ Dezechilibru Roți Autostradă',
            description: 'Vibrații rezonante la viteze de croazieră (90-140 km/h). Verifică echilibrarea roților.',
            priority: 'medium'
        };
    }
    if (v.turboCoolDownWarning) {
        return {
            title: '⏳ Răcire Turbo Necesară',
            description: `Miez CHRA la ${Math.round(v.turboCoreTempC)}°C. Lasă motorul la ralanti ${Math.round(v.turboCoolDownSec)}s înainte de oprire pentru a preveni cocsarea uleiului.`,
            priority: 'high'
        };
    }
    if (v.dmfImbalanceWarning) {
        return {
            title: '⚠️ Dezechilibru Volantă DMF',
            description: 'Fluctuații neregulate de turație la ralanti (σ > 26 RPM) corelate cu vibrații torsionale.',
            priority: 'high'
        };
    }
    if (v.dpfRegenActive) {
        return {
            title: '🔥 Regenerare Activă DPF',
            description: v.dpfRegenNotice || 'Temperatura filtrului >550°C. Nu opri motorul în următoarele minute!',
            priority: 'high'
        };
    }
    if (v.rollingDragAnomaly) {
        return {
            title: '⚠️ Rezistență la Rulare Depășită',
            description: 'Decelerare anormală în coast-down (etrier de frână blocat sau pană de cauciuc).',
            priority: 'high'
        };
    }
    if (coolant > critTemp) return { title: 'Supraîncălzire critică', description: `Temperatura motorului depășește ${critTemp}°C (${coolant}°C). Oprește motorul și verifică lichidul de răcire.`, priority: 'critical' };
    if (coolant > warnTemp)  return { title: 'Temperatură motor ridicată', description: `Temperatura actuală: ${coolant}°C (> normal ${optMax}°C). Dacă continuă să crească, oprește motorul.`, priority: 'high' };
    if (volt > 0 && volt < 13.0) return { title: 'Tensiune scăzută', description: `Tensiunea de încărcare: ${volt.toFixed(1)}V. Posibilă problemă cu alternatorul sau bateria.`, priority: 'high' };
    if (latestAlert) {
        const TIP = { OVERSPEED: `Viteză excesivă${latestAlert.viteza ? ` — ${Math.round(latestAlert.viteza)} km/h` : ''}`, FRANARE_BRUSCA: 'Frânare bruscă detectată', DTC_DETECTAT: `Cod DTC: ${latestAlert.cod || ''}` };
        return { title: TIP[latestAlert.tip] || (latestAlert.tip || 'Eveniment').replace(/_/g, ' '), description: `Eco Score: ${latestAlert.scor_curent ?? '—'}/100`, priority: 'medium' };
    }
    return null;
}

// ─── Params data (5 Logical Diagnostic Categories) ───────────────────────────

const PARAM_CATEGORIES = [
    { id: 'ALL',      label: 'TOATE' },
    { id: 'MOTOR',    label: '🔥 MOTOR & PUTERE' },
    { id: 'TURBO',    label: '🌪️ TURBO & AER' },
    { id: 'TERMIC',   label: '🌡️ TERMIC & ULEI' },
    { id: 'EVACUARE', label: '💨 DPF & EVACUARE' },
    { id: 'ELECTRIC', label: '🔋 ELECTRIC & CUTIE' },
];

function buildCategoryList(catId, d) {
    const m    = d.motor        || {};
    const tem  = d.temperaturi  || {};
    const a    = d.aer          || {};
    const c    = d.combustibil  || {};
    const lam  = d.lambda       || {};
    const ign  = d.aprindere    || {};
    const em   = d.emisii       || {};
    const bat  = d.baterie      || {};
    const dpf  = d.dpf          || {};
    const tr   = d.transmisie   || {};
    const v    = d.virtual      || {};

    switch (catId) {
        case 'MOTOR': return [
            { id: 'rpm',                    label: 'Turație Motor',           val: m.rpm || 0,                 unit: 'RPM',   max: 5000, nominalMin: 750, nominalMax: 4200, color: colors.accent.default },
            { id: 'speed',                  label: 'Viteză Deplasare',        val: m.speed || 0,               unit: 'km/h',  max: 220,  nominalMin: 0,   nominalMax: 130,  color: colors.status.good },
            { id: 'powerHp',                label: 'Putere Estimată Dyno',    val: Math.round(v.powerHp || 0), unit: 'CP',    max: 160,  nominalMin: 5,   nominalMax: 140,  color: colors.status.good, isVirtual: true },
            { id: 'saeCorrectedPowerHp',    label: 'Putere Corectată SAE',    val: Math.round(v.saeCorrectedPowerHp || v.powerHp || 0), unit: 'CP', max: 160, nominalMin: 5, nominalMax: 140, color: colors.status.good, isVirtual: true },
            { id: 'torqueNm',               label: 'Cuplu Motor Real',        val: Math.round(v.torqueNm || 0),unit: 'Nm',    max: 350,  nominalMin: 40,  nominalMax: 290,  color: colors.status.good, isVirtual: true },
            { id: 'load',                   label: 'Sarcină Motor Calculată', val: m.load || 0,            unit: '%',     max: 100,  nominalMin: 15,  nominalMax: 85 },
            { id: 'idleStabilityIndex',     label: 'Stabilitate Ralanti',     val: Math.round(v.idleStabilityIndex ?? 100), unit: '%', max: 100, nominalMin: 75, nominalMax: 100, color: (v.idleStabilityIndex ?? 100) < 70 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'estimatedPayloadKg',     label: 'Sarcină Utilă Payload',   val: Math.round(v.estimatedPayloadKg || 0), unit: 'kg', max: 600, nominalMin: 0, nominalMax: 450, color: colors.status.monitor, isVirtual: true },
            { id: 'bsfcGPerKwh',            label: 'Consum Specific BSFC',    val: Math.round(v.bsfcGPerKwh||210), unit: 'g/kWh', max: 450, nominalMin: 195, nominalMax: 280, color: (v.bsfcGPerKwh||0) > 300 ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'volumetricEfficiencyPct',label: 'Eficiență Volumetrică',   val: Math.round(v.volumetricEfficiencyPct||85), unit: '%', max: 120, nominalMin: 70, nominalMax: 105, color: colors.accent.default, isVirtual: true },
            { id: 'dieselRunawayRisk',      label: 'Risc Autoturare Ulei',    val: v.dieselRunawayRisk ? 'CRITIC' : 'Nominal', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.dieselRunawayRisk ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'idleInjectionDriftMg',   label: 'Derivă Injecție Ralanti', val: v.idleInjectionDriftMg != null ? `${v.idleInjectionDriftMg > 0 ? '+' : ''}${v.idleInjectionDriftMg}` : '0.0', unit: 'mg', max: 5.0, min: -5.0, nominalMin: -1.5, nominalMax: 1.5, color: v.injectorHealthStatus !== 'NORMAL' ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'injectorHealthStatus',   label: 'Stare Duze Injectoare',   val: v.injectorHealthStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.injectorHealthStatus !== 'NORMAL' ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'shiftQualityScore',      label: 'Calitate Schimbare Trepte', val: v.shiftQualityScore ?? 95, unit: '/100', max: 100, nominalMin: 70, nominalMax: 100, color: (v.shiftQualityScore ?? 95) < 70 ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'powertrainMountStatus',  label: 'Stare Suporturi Tampoane',val: v.powertrainMountStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.powertrainMountStatus !== 'NORMAL' ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'pedal_d',                label: 'Poziție Pedală Accel.',   val: m.pedal_d || 0,            unit: '%',     max: 100,  nominalMin: 0,   nominalMax: 100, color: colors.status.monitor },
            { id: 'throttle_pos',           label: 'Deschidere Clapetă',      val: m.throttle_pos || 0,        unit: '%',     max: 100,  nominalMin: 0,   nominalMax: 100 },
            { id: 'torque_driver',          label: 'Cuplu Cerut de Șofer',    val: m.torque_driver || 0,       unit: 'Nm',    max: 400,  nominalMin: 0,   nominalMax: 300, color: colors.status.monitor },
            { id: 'torque_friction',        label: 'Cuplu Frecare Internă',   val: m.torque_friction || 0,    unit: 'Nm',    max: 100,  nominalMin: 10,  nominalMax: 45,  color: colors.status.critical },
            { id: 'diagnosticConfidencePct',label: 'Încredere Diagnoză UDS',  val: v.diagnosticConfidencePct ?? 90, unit: '%', max: 100, nominalMin: 70, nominalMax: 100, color: colors.status.good, isVirtual: true },
            { id: 'isSteadyState',          label: 'Regim Cvasistaționar',    val: v.isSteadyState ? 'Stabil' : 'Tranzient', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.isSteadyState ? colors.status.good : colors.status.monitor, isVirtual: true },
            { id: 'mafVsTurboTriage',       label: 'Triaj MAF vs Turbină',    val: v.mafVsTurboTriage || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.mafVsTurboTriage === 'MAF_SENSOR_FOULED_TURBO_OK' ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'timingPhaseStatus',      label: 'Avans Injecție/Distribuție', val: v.timingPhaseStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.timingPhaseStatus !== 'NORMAL' ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'exhaustHeatAnomalyC',    label: 'Anomalie Căldură Evac.',  val: v.exhaustHeatAnomalyC != null ? `${v.exhaustHeatAnomalyC > 0 ? '+' : ''}${v.exhaustHeatAnomalyC}` : '0.0', unit: '°C', max: 80, min: -40, nominalMin: -15, nominalMax: 25, color: (v.exhaustHeatAnomalyC || 0) > 40 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'roadGripStatus',         label: 'Stare Aderență / Polei',  val: v.roadGripStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.roadGripStatus !== 'NORMAL' ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'wheelSlipDeltaKmh',      label: 'Patinare Roți Δv',        val: (v.wheelSlipDeltaKmh || 0).toFixed(1), unit: 'km/h', max: 20, min: 0, nominalMin: 0, nominalMax: 2.0, color: (v.wheelSlipDeltaKmh || 0) > 4.5 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'driverFatigueScore',     label: 'Scor Vigilență Șofer',    val: v.driverFatigueScore ?? 100, unit: '/100', max: 100, min: 0, nominalMin: 50, nominalMax: 100, color: (v.driverFatigueScore ?? 100) < 45 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'driverFatigueStatus',    label: 'Stare Oboseală Volan',    val: v.driverFatigueStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.driverFatigueStatus !== 'NORMAL' ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'fuelQualityStatus',      label: 'Calitate Combustibil',    val: v.fuelQualityStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.fuelQualityStatus !== 'NORMAL' ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'stationaryIdlingSec',    label: 'Timp Staționare Ralanti', val: Math.round(v.stationaryIdlingSec || 0), unit: 's', max: 1800, nominalMin: 0, nominalMax: 600, color: (v.stationaryIdlingSec || 0) > 900 ? colors.status.caution : colors.status.good, isVirtual: true },
        ];
        case 'TURBO': return [
            { id: 'boost_actual',           label: 'Presiune Turbo (Act)',    val: (a.boost_actual ?? a.boost ?? 0).toFixed(2), unit: 'bar', max: 2.5, nominalMin: 0.95, nominalMax: 2.15, color: colors.status.good },
            { id: 'boost_cmd',              label: 'Presiune Turbo (Cmd)',    val: (a.boost_cmd || 0).toFixed(2),               unit: 'bar', max: 2.5, nominalMin: 0.95, nominalMax: 2.15, color: colors.status.monitor },
            { id: 'boost_error',            label: 'Eroare Presiune Boost',   val: ((a.boost_actual ?? 0) - (a.boost_cmd ?? 0)).toFixed(2), unit: 'bar', max: 0.8, min: -0.8, nominalMin: -0.15, nominalMax: 0.15, isVirtual: true },
            { id: 'maf',                    label: 'Debit Aer Admisie MAF',   val: Math.round(a.maf || 0),   unit: 'g/s',   max: 160, nominalMin: 12,  nominalMax: 135, color: colors.status.monitor },
            { id: 'map',                    label: 'Presiune Galerie MAP',    val: Math.round(a.map || 101),  unit: 'kPa',   max: 300, nominalMin: 98,  nominalMax: 235, color: colors.accent.default },
            { id: 'baro',                   label: 'Presiune Barometrică',    val: Math.round(a.baro || 101), unit: 'kPa',   max: 110, nominalMin: 95,  nominalMax: 105 },
            { id: 'intercoolerEfficiencyPct', label: 'Eficiență Intercooler', val: Math.round(v.intercoolerEfficiencyPct || 0), unit: '%', max: 100, nominalMin: 60, nominalMax: 95, color: (v.intercoolerEfficiencyPct || 0) < 55 ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'turboCoreTempC',         label: 'Temp. Miez CHRA Turbo',   val: Math.round(v.turboCoreTempC || 90), unit: '°C', max: 350, nominalMin: 85, nominalMax: 230, color: (v.turboCoreTempC || 0) > 260 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'turboCoolDownSec',       label: 'Timp Răcire Cooldown',    val: Math.round(v.turboCoolDownSec || 0), unit: 's', max: 120, nominalMin: 0, nominalMax: 20, color: (v.turboCoolDownSec || 0) > 30 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'egrRatioPct',            label: 'Recirculare Gaze EGR',    val: Math.round(v.egrRatioPct || em.egr_cmd || 0), unit: '%', max: 60, nominalMin: 0, nominalMax: 45, isVirtual: true },
        ];
        case 'TERMIC': return [
            { id: 'coolant',                label: 'Temp. Lichid Răcire',     val: Math.round(tem.coolant || 0), unit: '°C', max: 120, nominalMin: 80, nominalMax: 96, color: (tem.coolant||0) > 98 ? colors.status.critical : colors.status.good },
            { id: 'oil',                    label: 'Temp. Ulei Motor',        val: Math.round(tem.oil || (tem.coolant ? tem.coolant + 4 : 0)), unit: '°C', max: 140, nominalMin: 85, nominalMax: 115, color: colors.status.monitor },
            { id: 'iat',                    label: 'Temp. Aer Admisie IAT',   val: Math.round(tem.iat || 0),   unit: '°C', max: 80,  nominalMin: 15, nominalMax: 50, color: colors.accent.default },
            { id: 'turboCompressorOutTempC',label: 'Temp. Ieșire Compresor',  val: Math.round(v.turboCompressorOutTempC || (tem.iat || 25)), unit: '°C', max: 200, nominalMin: 20, nominalMax: 140, color: colors.status.monitor, isVirtual: true },
            { id: 'coolingConductanceKwPerK', label: 'Conductanță Răcire UA', val: v.coolingConductanceKwPerK || 0.85, unit: 'kW/K', max: 2.0, nominalMin: 0.50, nominalMax: 1.60, color: v.waterPumpOrHeadGasketStatus !== 'NORMAL' ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'waterPumpOrHeadGasketStatus', label: 'Pompă Apă / Garnitură', val: v.waterPumpOrHeadGasketStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.waterPumpOrHeadGasketStatus !== 'NORMAL' ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'thermalShockIndex',      label: 'Șoc Termic Chiulasă',     val: v.thermalShockIndex || 0.0, unit: 'idx', max: 5.0, nominalMin: 0.0, nominalMax: 1.5, color: (v.thermalShockIndex || 0) > 1.8 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'brakeFluidTempEstimatedC', label: 'Temp. Lichid Frână',    val: Math.round(v.brakeFluidTempEstimatedC || 25), unit: '°C', max: 260, nominalMin: 20, nominalMax: 140, color: (v.brakeFluidTempEstimatedC || 0) > 145 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'mountainBrakeFadeRisk',  label: 'Risc Brake Fade Pantă',   val: v.mountainBrakeFadeRisk ? 'RISC CRITIC' : 'Sigur', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.mountainBrakeFadeRisk ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'cabinExhaustHazardAlert',label: 'Alertă Gaze Habitaclu',   val: v.cabinExhaustHazardAlert ? 'PERICOL CO' : 'OK', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.cabinExhaustHazardAlert ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'egt1',                   label: 'Gaze Evacuare EGT S1',    val: Math.round(dpf.egt1 || tem.cat_b1s1 || 0), unit: '°C', max: 850, nominalMin: 180, nominalMax: 680, color: colors.status.critical },
            { id: 'deltaOilWaterC',         label: 'Delta Ulei - Răcire',     val: Math.round(v.deltaOilWaterC || 4), unit: '°C', max: 35, nominalMin: 2, nominalMax: 18, isVirtual: true },
            { id: 'sankeyMechanicalPct',    label: 'Randament Mecanic Sankey',val: Math.round(v.energySplit?.mechanicalPct || 0), unit: '%', max: 50, nominalMin: 25, nominalMax: 44, color: colors.status.good, isVirtual: true },
            { id: 'sankeyExhaustPct',       label: 'Căldură Evacuare Sankey', val: Math.round(v.energySplit?.exhaustPct || 0), unit: '%', max: 60, nominalMin: 25, nominalMax: 42, color: colors.status.caution, isVirtual: true },
            { id: 'oilLifeWearFactor',      label: 'Stres Ulei Arrhenius',    val: (v.oilLifeWearFactor || 1.0).toFixed(2), unit: 'x', max: 4.0, nominalMin: 0.8, nominalMax: 1.8, isVirtual: true },
            { id: 'weibullFailRisk',        label: 'Risc Degradare Weibull',  val: Math.round(v.weibullReliability?.oil?.pFail3000kmPct || 0), unit: '%', max: 100, nominalMin: 0, nominalMax: 25, isVirtual: true },
        ];
        case 'EVACUARE': return [
            { id: 'soot_load',              label: 'Încărcare Funingine DPF', val: (dpf.soot_load || 0).toFixed(1), unit: 'g', max: 60, nominalMin: 0, nominalMax: 35, color: (dpf.soot_load||0) > 40 ? colors.status.critical : colors.status.good },
            { id: 'diff_press',             label: 'Presiune Dif. DPF',       val: (dpf.diff_press || 0).toFixed(1), unit: 'kPa', max: 12, nominalMin: 0.4, nominalMax: 6.5, color: colors.status.monitor },
            { id: 'dpfResistanceIndex',     label: 'Rezistență Debit R_dpf',  val: Math.round(v.dpfResistanceIndex || 0), unit: 'idx', max: 200, nominalMin: 10, nominalMax: 110, isVirtual: true },
            { id: 'lambda',                 label: 'Lambda Real Amestec',     val: v.lambda ? v.lambda.toFixed(2) : '1.35', unit: 'λ', max: 2.5, nominalMin: 1.15, nominalMax: 2.1, color: colors.status.good, isVirtual: true },
            { id: 'afr',                    label: 'Raport Aer/Carb. AFR',    val: v.afr ? v.afr.toFixed(1) : '18.2', unit: ':1', max: 30, nominalMin: 15.5, nominalMax: 22.5, isVirtual: true },
            { id: 'o2_b1s1',                label: 'Sondă O2 Tensiune B1S1',  val: (lam.o2_b1s1 || 0).toFixed(2), unit: 'V', max: 1.0, nominalMin: 0.1, nominalMax: 0.9 },
            { id: 'rail_press',             label: 'Presiune Rampă Common Rail', val: Math.round((c.rail_press || 0) / 100), unit: 'bar', max: 1600, nominalMin: 250, nominalMax: 1450, color: colors.status.monitor },
        ];
        case 'ELECTRIC': return [
            { id: 'ecu_volt',               label: 'Tensiune Alternator/Bat.',val: (bat.ecu_volt || bat.bat_volt || 0).toFixed(1), unit: 'V', max: 16, nominalMin: 13.6, nominalMax: 14.6, color: colors.status.good },
            { id: 'batterySoHPct',          label: 'Sănătate Baterie SoH',    val: Math.round(v.batterySoHPct || 96), unit: '%', max: 100, nominalMin: 75, nominalMax: 100, color: colors.status.good, isVirtual: true },
            { id: 'batteryInternalResistanceMOhms', label: 'Rezistență Internă R_int', val: (v.batteryInternalResistanceMOhms || 5.2).toFixed(1), unit: 'mΩ', max: 25, nominalMin: 2, nominalMax: 8.5, isVirtual: true },
            { id: 'voltageDropV',           label: 'Cădere Tensiune Demaror', val: (v.voltageDropV || 0.18).toFixed(2), unit: 'V', max: 2.0, nominalMin: 0.05, nominalMax: 0.45, isVirtual: true },
            { id: 'gear',                   label: 'Treaptă Cutie Viteze',    val: tr.gear ? `Treapta ${tr.gear}` : 'Liber (N)', unit: '', max: 6, nominalMin: 1, nominalMax: 6 },
            { id: 'clutchSlipPct',          label: 'Alunecare Ambreiaj Slip', val: (v.clutchSlipPct || 0).toFixed(1), unit: '%', max: 100, nominalMin: 0, nominalMax: 3.5, color: (v.clutchSlipPct||0) > 8 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'estimatedBrakeDiscTempC',label: 'Temp. Discuri Frână',     val: Math.round(v.estimatedBrakeDiscTempC || 25), unit: '°C', max: 500, nominalMin: 20, nominalMax: 250, color: (v.estimatedBrakeDiscTempC||0) > 300 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'brakeEnergyTripMj',      label: 'Disipare Frânare Archard',val: (v.brakeEnergyTripMj || 0).toFixed(1), unit: 'MJ', max: 30, nominalMin: 0, nominalMax: 15, isVirtual: true },
            { id: 'fusedRoadGradePct',      label: 'Pantă Drum Fuzionată',    val: Number((v.fusedRoadGradePct ?? v.roadGradePct ?? 0).toFixed(1)), unit: '%', max: 25, min: -25, nominalMin: -12, nominalMax: 12, color: colors.accent.default, isVirtual: true },
            { id: 'suspensionDampingRatio', label: 'Amortizare Suspensie ζ',  val: v.suspensionDampingRatio || 0.28, unit: '', max: 0.60, nominalMin: 0.20, nominalMax: 0.45, color: v.suspensionStatus !== 'NORMAL' ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'wheelBalanceStatus',     label: 'Echilibru Roți Viteză',   val: v.wheelBalanceStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.wheelBalanceStatus !== 'NORMAL' ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'weakestComponent',       label: 'Componentă RUL Minimă',   val: (v.rulSummary?.weakestComponent || 'oil').toUpperCase(), unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: colors.status.monitor, isVirtual: true },
            { id: 'minRemainingKm',         label: 'Kilometri RUL Rămași',    val: v.rulSummary?.minRemainingKm != null ? v.rulSummary.minRemainingKm : 3660, unit: 'km', max: 50000, nominalMin: 2000, nominalMax: 30000, color: colors.status.good, isVirtual: true },
            { id: 'roadsideBreakdownRiskPct',label: 'Risc Pană Imobilizare',  val: v.rulSummary?.roadsideBreakdownRiskPct || 0, unit: '%', max: 100, nominalMin: 0, nominalMax: 25, color: (v.rulSummary?.roadsideBreakdownRiskPct || 0) > 30 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'crankingTriageStatus',   label: 'Triaj Demaror/Baterie',   val: v.crankingTriageStatus || 'STANDBY', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.crankingTriageStatus === 'NORMAL' || v.crankingTriageStatus === 'STANDBY' ? colors.status.good : colors.status.caution, isVirtual: true },
            { id: 'tirePressureStatus',     label: 'Presiune Anvelope TPMS',  val: v.tirePressureStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.tirePressureStatus !== 'NORMAL' ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'tireRadiusDriftPct',     label: 'Derivă Rază Roți (TPMS)', val: v.tireRadiusDriftPct != null ? `${v.tireRadiusDriftPct > 0 ? '+' : ''}${v.tireRadiusDriftPct}` : '0.0', unit: '%', max: 8.0, min: -8.0, nominalMin: -1.5, nominalMax: 1.5, color: Math.abs(v.tireRadiusDriftPct || 0) > 2.2 ? colors.status.critical : colors.status.good, isVirtual: true },
            { id: 'accessoryBeltStatus',    label: 'Curea Accesorii / Fulie', val: v.accessoryBeltStatus || 'NORMAL', unit: '', max: 100, nominalMin: 0, nominalMax: 10, color: v.accessoryBeltStatus !== 'NORMAL' ? colors.status.caution : colors.status.good, isVirtual: true },
            { id: 'parasiticDrainMa',       label: 'Consumator Parazit',      val: v.parasiticDrainMa != null ? `${v.parasiticDrainMa} mA` : '25 mA', unit: '', max: 500, nominalMin: 15, nominalMax: 50, color: (v.parasiticDrainMa || 0) > 120 ? colors.status.critical : colors.status.good, isVirtual: true },
        ];
        default: return [];
    }
}

function buildParams(cat, d) {
    if (cat === 'ALL') {
        const categories = ['MOTOR', 'TURBO', 'TERMIC', 'EVACUARE', 'ELECTRIC'];
        return categories.flatMap(cId => buildCategoryList(cId, d));
    }
    return buildCategoryList(cat, d);
}

// ─── Oscilloscope metrics ─────────────────────────────────────────────────────

const SCOPE_METRICS = [
    { id: 'rpm',          label: 'Turație',       color: '#00f0ff', unit: 'RPM',   defaultMax: 5000 },
    { id: 'speed',        label: 'Viteză',        color: '#10b981', unit: 'km/h',  defaultMax: 220  },
    { id: 'powerHp',      label: 'Dyno CP',       color: '#38bdf8', unit: 'CP',    defaultMax: 160  },
    { id: 'map',          label: 'Presiune MAP',  color: '#f59e0b', unit: 'kPa',   defaultMax: 250  },
    { id: 'maf',          label: 'Debit MAF',     color: '#ec4899', unit: 'g/s',   defaultMax: 150  },
    { id: 'boost_actual', label: 'Boost Bar',     color: '#06b6d4', unit: 'bar',   defaultMax: 2.5  },
    { id: 'bsfcGPerKwh',  label: 'BSFC g/kWh',    color: '#84cc16', unit: 'g/kWh', defaultMax: 450  },
    { id: 'inst_cons',    label: 'Consum',        color: '#ef4444', unit: 'L/h',   defaultMax: 20   },
    { id: 'coolant',      label: 'Temp. Apă',     color: '#f97316', unit: '°C',    defaultMax: 110  },
    { id: 'oil',          label: 'Temp. Ulei',    color: '#eab308', unit: '°C',    defaultMax: 130  },
    { id: 'soot_load',    label: 'DPF Funingine', color: '#f43f5e', unit: 'g',     defaultMax: 60   },
    { id: 'rail_press',   label: 'Pres. Rampă',   color: '#8b5cf6', unit: 'bar',   defaultMax: 1600 },
    { id: 'ecu_volt',     label: 'Tensiune 12V',  color: '#a855f7', unit: 'V',     defaultMax: 16   },
    { id: 'batterySoHPct',label: 'Sănătate Bat',  color: '#14b8a6', unit: '%',     defaultMax: 100  },
];

const DUAL_PRESETS = [
    { label: '🌪️ Boost vs. MAF', m1: 'map', m2: 'maf' },
    { label: '🏎️ RPM vs. Viteză', m1: 'rpm', m2: 'speed' },
    { label: '💧 Răcire vs. Putere', m1: 'coolant', m2: 'powerHp' },
    { label: '⛽ Turație vs. Consum', m1: 'rpm', m2: 'inst_cons' },
    { label: '⚡ Tensiune vs. RPM', m1: 'ecu_volt', m2: 'rpm' },
];

// ─── Sub-components & Status Formatting ──────────────────────────────────────

const STATUS_VALUE_LABELS = {
    NORMAL: 'Normal',
    OPTIMAL: 'Optim',
    OPTIMUM: 'Optim',
    STANDBY: 'Așteptare',
    CRITIC: 'Critic',
    Nominal: 'Nominal',
    Stabil: 'Stabil',
    Tranzient: 'Tranzient',
    Sigur: 'Sigur',
    OK: 'OK',
    'RISC CRITIC': 'Risc Critic',
    'PERICOL CO': 'Pericol CO',

    // PHM Level 3, 4 & 5 Diagnostic Statuses
    BLACK_ICE_GRIP_LOSS_WARNING: 'Polei / Gheață',
    HYDROPLANING_OR_WET_SLIP_WARNING: 'Acvaplanare',
    DROWSY_MICRO_SLEEP_CRITICAL: 'Micro-Somn',
    DROWSY_FATIGUE_WARNING: 'Oboseală',
    MOUNTAIN_BRAKE_FADE_BOILING_RISK: 'Fierbere Frâne',
    PARASITIC_BATTERY_DRAIN_RISK: 'Consum Parazit',
    POOR_FUEL_CONTAMINATION_RISK: 'Combustibil Rău',
    CABIN_CO_EXHAUST_HAZARD_RISK: 'Pericol Gaze',
    DIESEL_RUNAWAY_RISK: 'Autoturare',
    WATER_PUMP_IMPELLER_OR_HEAD_GASKET_RISK: 'Pompă/Chiulasă',
    MAF_SENSOR_FOULED_TURBO_OK: 'MAF Murdar',
    TIMING_PHASE_DRIFT_WARNING: 'Derivă Distribuție',
    TIRE_PRESSURE_LOSS_SUSPECTED: 'Pierdere Presiune',
    WORN_ENGINE_OR_GEARBOX_MOUNTS: 'Tampoane Uzate',
    WORN_SHOCK_ABSORBERS: 'Amortizoare',
    WHEEL_IMBALANCE_OR_TIRE_RUNOUT: 'Dezechilibru Roți',
    NOZZLE_COKING_OR_PUMP_WEAR: 'Uzură Duze',
    INTERCOOLER_BOOST_LEAK: 'Pierdere Boost',
    TURBO_UNDERBOOST_WEAR: 'Underboost',
    EGR_FLOW_INSUFFICIENT: 'EGR Înfundat',
    EGR_VALVE_STUCK_OPEN: 'EGR Blocat',
    ALTERNATOR_OVERRUN_PULLEY_OR_AC_DRAG: 'Fulie / AC',
    HEAD_GASKET_OR_IMPELLER_RISK: 'Risc Chiulasă',
    COLD_THERMAL_SHOCK_HEAD_RISK: 'Șoc Termic',
};

function formatStatusVal(val) {
    if (typeof val !== 'string') return val;
    return STATUS_VALUE_LABELS[val] || val.replace(/_/g, ' ');
}

const MetricTile = ({ label, value, unit, color = colors.text.primary, highlight = false, tileW }) => (
    <View style={[
        styles.tile,
        tileW && { width: tileW },
        highlight && { borderColor: color, borderWidth: 2 },
    ]}>
        <Text style={styles.tileLabel} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
        <Text style={[styles.tileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {unit ? <Text style={styles.tileUnit} numberOfLines={1}>{unit}</Text> : null}
    </View>
);

const ParamRow = React.memo(({
    keyName, label, val, unit, max = 100, min = 0, nominalMin, nominalMax,
    isVirtual = false, color = colors.accent.default, last = false, onPress, item
}) => {
    const numVal = parseFloat(val);
    const range = max - min;
    const pct = range > 0 && !isNaN(numVal) ? `${Math.min(Math.max(((numVal - min) / range) * 100, 0), 100)}%` : '0%';

    let barColor = color;
    if (nominalMin !== undefined && nominalMax !== undefined && !isNaN(numVal)) {
        if (numVal >= nominalMin && numVal <= nominalMax) {
            barColor = colors.status.good;
        } else if (numVal > nominalMax * 1.15 || numVal < nominalMin * 0.85) {
            barColor = colors.status.critical;
        } else {
            barColor = colors.status.caution;
        }
    }

    const displayVal = typeof val === 'number'
        ? (Number.isInteger(val) ? val.toLocaleString('ro-RO') : val.toFixed(1))
        : formatStatusVal(val);

    const handlePress = useCallback(() => {
        if (onPress) onPress(item);
    }, [onPress, item]);

    return (
        <TouchableOpacity
            style={[styles.paramRow, last && { borderBottomWidth: 0 }]}
            onPress={handlePress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Senzor ${label}, valoare ${displayVal} ${unit || ''}. Atinge pentru diagnoză și grafic`}
        >
            <View style={styles.paramLabelWrap}>
                <Text style={styles.paramLabel} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
                {isVirtual && (
                    <View style={styles.virtualPill}>
                        <Text style={styles.virtualPillText}>VIRTUAL</Text>
                    </View>
                )}
            </View>
            <View style={styles.paramTrack}>
                <View style={[styles.paramFill, { width: pct, backgroundColor: barColor }]} />
            </View>
            <View style={styles.paramValWrap}>
                <Text style={[styles.paramVal, { color: barColor }]} numberOfLines={1} ellipsizeMode="tail">
                    {displayVal}
                    {unit ? <Text style={styles.paramUnit}> {unit}</Text> : null}
                </Text>
                <Text style={styles.paramChevron}>›</Text>
            </View>
        </TouchableOpacity>
    );
}, (prev, next) => {
    return (
        prev.val === next.val &&
        prev.label === next.label &&
        prev.unit === next.unit &&
        prev.max === next.max &&
        prev.min === next.min &&
        prev.nominalMin === next.nominalMin &&
        prev.nominalMax === next.nominalMax &&
        prev.isVirtual === next.isVirtual &&
        prev.color === next.color &&
        prev.last === next.last &&
        prev.onPress === next.onPress
    );
});

// ─── Main component ───────────────────────────────────────────────────────────

const EMPTY_CHART_HISTORY = [];

const LiveDashboardScreen = ({ navigation: propNav } = {}) => {
    // Menține ecranul aprins continuu în suportul auto în timpul telemetriei live
    useKeepAwake();

    const isFocused = useIsFocused();
    const [tab, setTab] = useState('LIVE');
    const isSmoothingActive = isFocused && tab !== 'PARAMS';

    const hookNav = useNavigation();
    const navigation = propNav || hookNav;
    const { width } = useWindowDimensions();
    const { isConnected, isReconnecting, liveData, chartVersion, getChartHistory } = useContext(LiveContext);
    const { latestAlert, alertsList, unreadCount, markAlertsAsRead } = useContext(AlertContext);
    const { selectedMetric, setSelectedMetric, activeTemplate, currentTemplate, openExperiencePicker, openSimulatorModal } = useContext(AppContext);

    // ── 60 FPS Smoothed Telemetry (Pauză automată când ecranul e în fundal sau pe tab static) ──
    const { animated, numeric } = useSmoothedTelemetry(liveData, isSmoothingActive);

    const [proMode,       setProMode]       = useState(false); // Mod Rapid vs Telemetrie Completă
    const [isHudMirrored, setIsHudMirrored] = useState(false); // Oglindă HUD Parbriz
    const [showLandscapeHud, setShowLandscapeHud] = useState(false); // Ecran HUD Orizontal Complet
    const [category,      setCategory]      = useState('MOTOR');
    const [inspectedParam, setInspectedParam] = useState(null); // Parametru selectat pentru inspecție detaliată

    const handleSelectParam = useCallback((paramItem) => {
        setInspectedParam(paramItem);
    }, []);

    const tpl = currentTemplate || TEMPLATES.MOTORSPORT;
    const [showAlerts, setShowAlerts] = useState(false);
    const [zoomX,      setZoomX]      = useState(10);
    const [autoScaleY, setAutoScaleY] = useState(true);
    const [zoomYMult,  setZoomYMult]  = useState(1);
    const [isDualChannel, setIsDualChannel] = useState(false);
    const [secondMetric,  setSecondMetric]  = useState('speed');

    // Pinch-to-zoom for oscilloscope
    const zoomXRef   = useRef(10);
    const pinchState = useRef({ startDist: 0, startZoom: 10, active: false });
    const pinchPR    = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: e => e.nativeEvent.touches.length === 2,
            onMoveShouldSetPanResponder:  e => e.nativeEvent.touches.length === 2,
            onPanResponderGrant: e => {
                const t0 = e.nativeEvent.touches[0], t1 = e.nativeEvent.touches[1];
                if (!t0 || !t1) return;
                const dx = t0.pageX - t1.pageX, dy = t0.pageY - t1.pageY;
                pinchState.current = { startDist: Math.sqrt(dx*dx + dy*dy), startZoom: zoomXRef.current, active: true };
            },
            onPanResponderMove: e => {
                if (!pinchState.current.active) return;
                const t0 = e.nativeEvent.touches[0], t1 = e.nativeEvent.touches[1];
                if (!t0 || !t1) return;
                const dx = t0.pageX - t1.pageX, dy = t0.pageY - t1.pageY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (pinchState.current.startDist < 10) return;
                const newZoom = Math.max(2, Math.min(40, Math.round(pinchState.current.startZoom / (dist / pinchState.current.startDist))));
                zoomXRef.current = newZoom;
                setZoomX(newZoom);
            },
            onPanResponderRelease:   () => { pinchState.current.active = false; },
            onPanResponderTerminate: () => { pinchState.current.active = false; },
        })
    ).current;
    zoomXRef.current = zoomX;

    // Live data aliases
    const m   = liveData.motor        || {};
    const tem = liveData.temperaturi  || {};
    const a   = liveData.aer          || {};
    const c   = liveData.combustibil  || {};
    const bat = liveData.baterie      || {};
    const dpf = liveData.dpf          || {};
    const tr  = liveData.transmisie   || {};
    const v   = liveData.virtual      || {};

    const { activeVehicle, fuelType } = useVehicle() || {};

    // Parametri dinamici vehicul
    const baseRedline = activeVehicle?.redline_rpm || (fuelType === 'PETROL' ? 6500 : 4800);
    const maxRpmScale = Math.ceil((baseRedline * 1.15) / 1000) * 1000;
    const displacementL = activeVehicle?.displacement_cc ? (activeVehicle.displacement_cc / 1000) : 2.0;
    const optTempMin = activeVehicle?.operating_temp_min || (fuelType === 'PETROL' ? 88 : 82);
    const optTempMax = activeVehicle?.operating_temp_max || (fuelType === 'PETROL' ? 103 : 93);
    const warnTemp = optTempMax + 5;
    const critTemp = optTempMax + 12;

    const coolVal = numeric.coolant ?? (tem.coolant ?? 0);
    const oilVal  = tem.oil;
    const dynamicRedline = useMemo(() => {
        if ((coolVal > 0 && coolVal < 60) || (oilVal != null && oilVal > 0 && oilVal < 55)) {
            return Math.round(baseRedline * 0.55);
        } else if (coolVal >= 60 && coolVal < optTempMin) {
            return Math.round(baseRedline * 0.75);
        }
        return baseRedline;
    }, [baseRedline, coolVal, oilVal, optTempMin]);

    const staticTachoArcs = useMemo(() => {
        const gaugeSize = 260;
        const cx = gaugeSize / 2;
        const cy = gaugeSize / 2;
        const r = 100;
        const redlineAngle = 150 + (dynamicRedline / maxRpmScale) * 240;
        const bgArcPath = describeClockwiseArc(cx, cy, r, 150, 390);
        const redlineArcPath = describeClockwiseArc(cx, cy, r, redlineAngle, 390);

        const maxRpmThousands = Math.round(maxRpmScale / 1000);
        const ticks = [];
        for (let i = 0; i <= maxRpmThousands; i++) {
            const angle = 150 + (i / maxRpmThousands) * 240;
            const p1 = polarToCartesian(cx, cy, r + 14, angle);
            const p2 = polarToCartesian(cx, cy, r + 2, angle);
            const lp = polarToCartesian(cx, cy, r - 18, angle);
            ticks.push({
                key: `major-${i}`,
                x1: p1.x, y1: p1.y,
                x2: p2.x, y2: p2.y,
                isMajor: true,
                val: i,
                lx: lp.x, ly: lp.y,
            });
            if (i < maxRpmThousands) {
                const midAngle = angle + (1 / (maxRpmThousands * 2)) * 240;
                const mp1 = polarToCartesian(cx, cy, r + 8, midAngle);
                const mp2 = polarToCartesian(cx, cy, r + 2, midAngle);
                ticks.push({
                    key: `minor-${i}`,
                    x1: mp1.x, y1: mp1.y,
                    x2: mp2.x, y2: mp2.y,
                    isMajor: false,
                    val: i + 0.5,
                    lx: 0, ly: 0,
                });
            }
        }
        return { bgArcPath, redlineArcPath, ticks, cx, cy, r, gaugeSize, strokeW: 12 };
    }, [dynamicRedline, maxRpmScale]);

    const vehicleContext = useMemo(() => ({
        optTempMin,
        optTempMax,
        warnTemp,
        critTemp,
        highRpmLimit: Math.round(baseRedline * 0.78),
    }), [optTempMin, optTempMax, warnTemp, critTemp, baseRedline]);

    const assistantMsg    = useMemo(() => buildAssistantMsg(liveData, isConnected, vehicleContext),    [liveData, isConnected, vehicleContext]);
    const contextualAlert = useMemo(() => buildContextualAlert(liveData, latestAlert, vehicleContext), [liveData, latestAlert, vehicleContext]);

    // Sinteză vocală & haptică automată pentru alerte critice și de siguranță la volan
    React.useEffect(() => {
        if (contextualAlert && (contextualAlert.priority === 'critical' || contextualAlert.priority === 'high')) {
            const spoken = `${contextualAlert.title}. ${contextualAlert.description}`;
            const prio = contextualAlert.priority === 'critical' ? 'critical' : 'serious';
            speakAlert(spoken, prio, contextualAlert.title);
        }
    }, [contextualAlert?.title, contextualAlert?.priority]);

    // Optimizare Garbage Collection: calculăm array-ul de 600 puncte doar când utilizatorul este în osciloscop (SCOPE) sau inspecție
    const chartHistory = useMemo(() => {
        if (tab === 'SCOPE' || inspectedParam) {
            return getChartHistory();
        }
        return EMPTY_CHART_HISTORY;
    }, [chartVersion, tab, !!inspectedParam]);
    const params          = useMemo(() => buildParams(category, liveData),             [category, liveData]);

    // Tile width: 3 per row, with gap spacing
    const tileW = Math.floor((width - layout.screenPaddingH * 2 - spacing[2] * 2) / 3);

    // ─── LIVE tab ─────────────────────────────────────────────────────────────

    const renderLive = () => {
        const rpm         = numeric.rpm ?? (m.rpm ?? 0);
        const speed       = numeric.speed ?? (m.speed ?? 0);
        const cool        = numeric.coolant ?? (tem.coolant ?? 0);
        const volt        = bat.ecu_volt ?? 0;
        const boost       = numeric.boost ?? (a.boost_actual ?? 0);
        const targetBoost = numeric.targetBoost ?? (a.boost_cmd ?? 0);
        const cons        = c.inst_cons ?? 0;
        const gear        = tr.gear;
        const eco         = liveData.scor_eco ?? 100;

        const powerHp     = numeric.powerHp ?? (v.powerHp || 0);
        const torqueNm    = (v.torqueNm && v.torqueNm > 0)
            ? v.torqueNm
            : (powerHp > 0 && rpm > 400 ? Math.round((powerHp * 7120) / rpm) : 0);
        const vePct       = v.volumetricEfficiencyPct ?? (a.maf ? Math.round((a.maf * 120 / ((rpm || 800) * displacementL * 1.25)) * 100) : 88);
        const lambda      = v.lambda ?? 1.15;
        const afr         = v.afr ?? 16.8;

        // Status temperatură și protecție motor rece din dynamicRedline
        let engineTempStatus = 'optimal'; // 'cold', 'warming', 'optimal'
        let tempBadgeText = null;

        if (dynamicRedline < baseRedline * 0.6) {
            engineTempStatus = 'cold';
            tempBadgeText = `❄️ Motor rece (Redline dinamic: ${dynamicRedline} RPM)`;
        } else if (dynamicRedline < baseRedline) {
            engineTempStatus = 'warming';
            tempBadgeText = `🌡️ În încălzire (Redline dinamic: ${dynamicRedline} RPM)`;
        }

        const redlinePct = (dynamicRedline / maxRpmScale) * 100;
        const rpmPct   = `${Math.min((rpm / maxRpmScale) * 100, 100)}%`;
        const rpmColor = rpm > dynamicRedline
            ? colors.status.critical
            : rpm > (dynamicRedline - 400)
                ? colors.status.caution
                : colors.accent.default;

        const coolColor  = cool > critTemp ? colors.status.critical : cool > warnTemp ? colors.status.caution : cool > 60 ? colors.status.good : colors.text.secondary;
        const voltColor  = volt > 0 && volt < 13.0 ? colors.status.critical : volt > 0 && volt < 13.5 ? colors.status.monitor : volt > 0 ? colors.status.good : colors.text.secondary;
        const ecoColor   = eco >= 85 ? colors.status.good : eco >= 65 ? colors.status.monitor : colors.status.caution;
        const consColor  = cons > 15 ? colors.status.caution : cons > 10 ? colors.status.monitor : colors.text.primary;
        const boostColor = boost > 1.8 ? colors.status.caution : colors.text.primary;

        const aiColorMap = { critical: colors.status.critical, serious: colors.status.caution, warning: colors.status.monitor, info: colors.accent.default, normal: colors.text.secondary, neutral: colors.text.tertiary ?? colors.text.secondary };
        const aiColor = aiColorMap[assistantMsg.level] ?? colors.text.secondary;

        // ── 1. MOTORSPORT COCKPIT (Porsche GT3 & AiM Radial Tachometer) ──
        const renderMotorsportCockpit = () => {
            const ledStartRpm = dynamicRedline * 0.45;
            const ledStep = (dynamicRedline - ledStartRpm) / 10;
            const activeLedCount = Math.min(10, Math.max(0, Math.floor((rpm - ledStartRpm) / ledStep)));
            const isFlashingRedline = rpm >= dynamicRedline * 0.92;

            const { bgArcPath, redlineArcPath, ticks, cx, cy, r, gaugeSize, strokeW } = staticTachoArcs;
            const tachoRatio = Math.min(Math.max(rpm, 0), maxRpmScale) / maxRpmScale;
            const curTachoAngle = 150 + tachoRatio * 240;
            const progressArcPath = curTachoAngle > 150 ? describeClockwiseArc(cx, cy, r, 150, curTachoAngle) : '';

            return (
                <View style={styles.motorsportRoot}>
                    {/* Shift Light Strip (10 LEDs) */}
                    <View style={styles.shiftLightStrip}>
                        {Array.from({ length: 10 }).map((_, idx) => {
                            const isLit = idx < activeLedCount;
                            const isRed = idx >= 8;
                            const isYellow = idx >= 5 && idx < 8;
                            const litColor = isRed ? '#ff2a2a' : isYellow ? '#ffb800' : '#10b981';
                            return (
                                <View
                                    key={idx}
                                    style={[
                                        styles.shiftLed,
                                        isLit && { backgroundColor: litColor, borderColor: litColor, shadowColor: litColor, shadowOpacity: 0.8, shadowRadius: 5, elevation: 4 },
                                        isLit && isFlashingRedline && isRed && styles.shiftLedFlash,
                                    ]}
                                />
                            );
                        })}
                    </View>

                    {/* Central Radial Tachometer SVG */}
                    <View style={styles.tachoWrap}>
                        <Svg width={gaugeSize} height={gaugeSize} style={styles.tachoSvg}>
                            <Path d={bgArcPath} stroke="#162238" strokeWidth={strokeW} fill="none" strokeLinecap="round" />
                            {redlineArcPath ? (
                                <Path d={redlineArcPath} stroke="rgba(255, 42, 42, 0.4)" strokeWidth={strokeW} fill="none" strokeLinecap="round" />
                            ) : null}
                            {progressArcPath ? (
                                <Path d={progressArcPath} stroke={rpmColor} strokeWidth={strokeW} fill="none" strokeLinecap="round" />
                            ) : null}
                            {ticks.map(t => (
                                <G key={t.key}>
                                    <Line
                                        x1={t.x1} y1={t.y1}
                                        x2={t.x2} y2={t.y2}
                                        stroke={t.val * 1000 >= dynamicRedline ? '#ff453a' : '#3d5275'}
                                        strokeWidth={t.isMajor ? 2.5 : 1.5}
                                    />
                                    {t.isMajor && (
                                        <SvgText
                                            x={t.lx}
                                            y={t.ly + 4}
                                            fill={t.val * 1000 >= dynamicRedline ? '#ff6b6b' : '#8b96b5'}
                                            fontSize="11"
                                            fontWeight="700"
                                            textAnchor="middle"
                                        >
                                            {t.val}
                                        </SvgText>
                                    )}
                                </G>
                            ))}
                        </Svg>

                        {/* Center Viewport: Gear, Speed, RPM */}
                        <View style={styles.tachoCenterContent}>
                            <Text style={styles.tachoGear}>{gear ? `G${gear}` : 'N'}</Text>
                            <Text style={[styles.tachoSpeed, { color: tpl.speedColor }]}>{speed}</Text>
                            <Text style={styles.tachoSpeedUnit}>km/h</Text>
                            <Text style={[styles.tachoRpmNum, { color: rpmColor }]}>
                                {typeof rpm === 'number' ? rpm.toLocaleString('ro-RO') : rpm} <Text style={{ fontSize: 9, color: colors.text.secondary }}>RPM</Text>
                            </Text>
                        </View>
                    </View>

                    {/* Twin Flanking Performance Gauges */}
                    <View style={styles.twinPillRow}>
                        <View style={[styles.twinCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                            <View style={styles.twinCardHeader}>
                                <Text style={styles.twinCardTitle}>⚡ BOOST</Text>
                                <Text style={[styles.twinCardDelta, { color: Math.abs(boost - targetBoost) > 0.3 ? colors.status.caution : colors.status.good }]}>
                                    Δ {((boost - targetBoost) > 0 ? '+' : '') + (boost - targetBoost).toFixed(2)}b
                                </Text>
                            </View>
                            <Text style={[styles.twinBigVal, { color: boostColor }]}>{boost.toFixed(2)} <Text style={styles.twinUnit}>bar</Text></Text>
                            <View style={styles.twinMiniBarTrack}>
                                <View style={[styles.twinMiniBarFill, { width: `${Math.min((boost / 2.5) * 100, 100)}%`, backgroundColor: boostColor }]} />
                            </View>
                            <Text style={styles.twinSubText}>Cmd: {targetBoost.toFixed(2)} bar</Text>
                        </View>

                        <View style={[styles.twinCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                            <View style={styles.twinCardHeader}>
                                <Text style={styles.twinCardTitle}>🏁 DYNO POWER</Text>
                                <Text style={styles.twinCardDelta}>VE: {vePct}%</Text>
                            </View>
                            <Text style={[styles.twinBigVal, { color: colors.status.good }]}>{powerHp} <Text style={styles.twinUnit}>CP</Text></Text>
                            <View style={styles.twinMiniBarTrack}>
                                <View style={[styles.twinMiniBarFill, { width: `${Math.min((powerHp / 140) * 100, 100)}%`, backgroundColor: colors.status.good }]} />
                            </View>
                            <Text style={styles.twinSubText}>{torqueNm} Nm · {afr.toFixed(1)} AFR</Text>
                        </View>
                    </View>
                </View>
            );
        };

        // ── 2. AUDI SPORT RS COCKPIT (Boomerang & G-Meter) ───────────────
        const renderAudiRsCockpit = () => {
            const svgW = width - layout.screenPaddingH * 2;
            const svgH = 120;
            const bPath = `M 24 110 L 24 28 Q 24 14 38 14 L ${svgW - 14} 14`;
            const approxLen = svgW + 60;
            const rpmRatio = Math.min(Math.max(rpm, 0), 5000) / 5000;
            const strokeOffset = approxLen * (1 - rpmRatio);
            const isHighRpm = rpm >= 4200;

            const gVal = Number(liveData.accel_g || 0);
            const clampG = Math.max(-0.6, Math.min(0.6, gVal));
            const gDotX = 42;
            const gDotY = 42 - clampG * 35;

            return (
                <View style={[styles.audiRsRoot, { backgroundColor: tpl.bg }]}>
                    {/* Top Boomerang Tachometer SVG */}
                    <View style={styles.audiBoomerangWrap}>
                        <Svg width={svgW} height={svgH}>
                            <Defs>
                                <LinearGradient id="rsTachoGrad" x1="0" y1="0" x2="1" y2="0">
                                    <Stop offset="0" stopColor="#ffffff" />
                                    <Stop offset="0.65" stopColor="#ffffff" />
                                    <Stop offset="0.82" stopColor="#ffb800" />
                                    <Stop offset="0.92" stopColor="#ff2a2a" />
                                </LinearGradient>
                            </Defs>
                            <Path d={bPath} stroke="#1e181c" strokeWidth={11} fill="none" strokeLinecap="round" />
                            <Path d={`M ${svgW * 0.76} 14 L ${svgW - 14} 14`} stroke="rgba(255, 42, 42, 0.4)" strokeWidth={11} fill="none" strokeLinecap="round" />
                            <Path
                                d={bPath}
                                stroke="url(#rsTachoGrad)"
                                strokeWidth={11}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={approxLen}
                                strokeDashoffset={strokeOffset}
                            />
                            <SvgText x={svgW * 0.25} y="32" fill="#606d8a" fontSize="10" fontWeight="700">1</SvgText>
                            <SvgText x={svgW * 0.45} y="32" fill="#606d8a" fontSize="10" fontWeight="700">2</SvgText>
                            <SvgText x={svgW * 0.65} y="32" fill="#606d8a" fontSize="10" fontWeight="700">3</SvgText>
                            <SvgText x={svgW * 0.82} y="32" fill="#ffb800" fontSize="10" fontWeight="700">4</SvgText>
                            <SvgText x={svgW - 24}   y="32" fill="#ff2a2a" fontSize="10" fontWeight="700">5</SvgText>
                        </Svg>

                        <View style={styles.rsRpmPill}>
                            <Text style={[styles.rsRpmPillText, isHighRpm && { color: '#ff2a2a' }]}>
                                {typeof rpm === 'number' ? rpm.toLocaleString('ro-RO') : rpm} <Text style={{ fontSize: 9 }}>RPM</Text>
                            </Text>
                        </View>
                    </View>

                    {/* Inside Frame: Speed, RS Badge, Gear & G-Meter */}
                    <View style={styles.rsCenterGrid}>
                        <View style={styles.rsSpeedCol}>
                            <View style={styles.rsBadgeRow}>
                                <View style={styles.rsBadge}>
                                    <View style={styles.rsBadgeSquare} />
                                    <Text style={styles.rsBadgeText}>RS PERFORMANCE</Text>
                                </View>
                                <View style={styles.rsGearBox}>
                                    <Text style={styles.rsGearText}>{gear ? `S${gear}` : 'N'}</Text>
                                </View>
                            </View>
                            <View style={styles.rsSpeedWrap}>
                                <Text style={styles.rsSpeedNum}>{speed}</Text>
                                <Text style={styles.rsSpeedUnit}>km/h</Text>
                            </View>
                        </View>

                        <View style={styles.rsGCol}>
                            <View style={styles.rsGBox}>
                                <Text style={styles.rsGTitle}>G-METER</Text>
                                <Svg width={84} height={84} style={styles.rsGSvg}>
                                    <Circle cx={42} cy={42} r={38} stroke="#2e1a22" strokeWidth={1.5} fill="#140b0f" />
                                    <Circle cx={42} cy={42} r={26} stroke="#3d202d" strokeWidth={1} fill="none" strokeDasharray="3,3" />
                                    <Circle cx={42} cy={42} r={14} stroke="#3d202d" strokeWidth={1} fill="none" />
                                    <Line x1={4} y1={42} x2={80} y2={42} stroke="#2e1a22" strokeWidth={1} />
                                    <Line x1={42} y1={4} x2={42} y2={80} stroke="#2e1a22" strokeWidth={1} />
                                    <Circle cx={gDotX} cy={gDotY} r={5} fill="#ff2a2a" stroke="#ffffff" strokeWidth={1.5} />
                                </Svg>
                                <Text style={styles.rsGVal}>{Math.abs(gVal).toFixed(2)} G</Text>
                            </View>
                        </View>
                    </View>

                    {/* RS Performance Bar */}
                    <View style={[styles.rsPerfRow, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        <View style={styles.rsPerfItem}>
                            <Text style={styles.rsPerfLabel}>BOOST</Text>
                            <Text style={[styles.rsPerfVal, { color: boostColor }]}>{boost.toFixed(2)} <Text style={{ fontSize: 9 }}>bar</Text></Text>
                        </View>
                        <View style={styles.rsPerfDivider} />
                        <View style={styles.rsPerfItem}>
                            <Text style={styles.rsPerfLabel}>APĂ</Text>
                            <Text style={[styles.rsPerfVal, { color: coolColor }]}>{cool}°C</Text>
                        </View>
                        <View style={styles.rsPerfDivider} />
                        <View style={styles.rsPerfItem}>
                            <Text style={styles.rsPerfLabel}>ULEI</Text>
                            <Text style={styles.rsPerfVal}>{tem.oil ? `${tem.oil}°C` : `${cool + 4}°C`}</Text>
                        </View>
                        <View style={styles.rsPerfDivider} />
                        <View style={styles.rsPerfItem}>
                            <Text style={styles.rsPerfLabel}>PUTERE</Text>
                            <Text style={[styles.rsPerfVal, { color: '#ff2a2a' }]}>{powerHp} <Text style={{ fontSize: 9 }}>CP</Text></Text>
                        </View>
                    </View>
                </View>
            );
        };

        // ── 3. TESLA MINIMAL COCKPIT (Clean & Aerodynamic) ────────────────
        const renderTeslaMinimalCockpit = () => {
            const isPower = powerHp > 5;
            const isRegen = !isPower && (speed > 10 && (cons < 1 || Number(liveData.accel_g || 0) < -0.05));
            const powerPct = Math.min(50, (powerHp / 140) * 50);
            const regenPct = Math.min(50, Math.abs(Number(liveData.accel_g || -0.2)) * 40);

            return (
                <View style={styles.teslaRoot}>
                    {/* Horizon Power / Regen Bar */}
                    <View style={styles.teslaHorizonWrap}>
                        <View style={styles.teslaHorizonTrack}>
                            <View style={styles.teslaHorizonCenter} />
                            {isPower && (
                                <View style={[styles.teslaHorizonFillPower, { width: `${powerPct}%` }]} />
                            )}
                            {isRegen && (
                                <View style={[styles.teslaHorizonFillRegen, { width: `${regenPct}%` }]} />
                            )}
                        </View>
                        <View style={styles.teslaHorizonLabels}>
                            <Text style={styles.teslaHorizonLbl}>REGEN</Text>
                            <Text style={styles.teslaHorizonLbl}>POWER</Text>
                        </View>
                    </View>

                    {/* Drive Selector */}
                    <View style={styles.teslaDriveSelector}>
                        <Text style={styles.teslaDriveModeText}>P</Text>
                        <Text style={styles.teslaDriveModeText}>R</Text>
                        <Text style={styles.teslaDriveModeText}>N</Text>
                        <Text style={[styles.teslaDriveModeText, styles.teslaDriveModeActive]}>{gear ? 'D' : 'P'}</Text>
                    </View>

                    {/* Massive Typography Speed */}
                    <View style={styles.teslaSpeedWrap}>
                        <Text style={styles.teslaSpeedNum}>{speed}</Text>
                        <Text style={styles.teslaSpeedUnit}>km/h</Text>
                    </View>

                    {/* 3 Minimalist Clean Cards */}
                    <View style={styles.teslaCardsRow}>
                        <View style={[styles.teslaCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                            <Text style={styles.teslaCardLabel}>EFICIENȚĂ BSFC</Text>
                            <Text style={styles.teslaCardVal}>{v.bsfcGPerKwh || 208} <Text style={styles.teslaCardUnit}>g/kWh</Text></Text>
                            <Text style={styles.teslaCardSub}>Optimum TDI</Text>
                        </View>
                        <View style={[styles.teslaCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                            <Text style={styles.teslaCardLabel}>TEMPERATURĂ</Text>
                            <Text style={[styles.teslaCardVal, { color: coolColor }]}>{cool}°C</Text>
                            <Text style={styles.teslaCardSub}>Lichid răcire</Text>
                        </View>
                        <View style={[styles.teslaCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                            <Text style={styles.teslaCardLabel}>PUTERE REALĂ</Text>
                            <Text style={[styles.teslaCardVal, { color: colors.accent.default }]}>{powerHp} <Text style={styles.teslaCardUnit}>CP</Text></Text>
                            <Text style={styles.teslaCardSub}>{torqueNm} Nm</Text>
                        </View>
                    </View>
                </View>
            );
        };

        // ── 4. NIGHT STEALTH HUD COCKPIT (OLED Parbriz) ───────────────────
        const renderNightHudCockpit = () => {
            return (
                <View style={styles.hudRoot}>
                    <View style={styles.hudRpmWrap}>
                        <View style={styles.hudRpmTrack}>
                            <View style={[styles.hudRpmFill, { width: rpmPct }]} />
                            <View style={[styles.hudRedlineMarker, { left: `${redlinePct}%` }]} />
                        </View>
                        <View style={styles.hudRpmMeta}>
                            <Text style={styles.hudRpmText}>{typeof rpm === 'number' ? rpm.toLocaleString('ro-RO') : rpm} RPM</Text>
                            <Text style={styles.hudRedlineText}>LIM: {dynamicRedline}</Text>
                        </View>
                    </View>

                    <View style={styles.hudCenterWrap}>
                        <Text style={styles.hudSpeedNum}>{speed}</Text>
                        <Text style={styles.hudGearNum}>{gear ? gear : 'N'}</Text>
                    </View>

                    <View style={styles.hudBottomRow}>
                        <View style={styles.hudMetricItem}>
                            <Text style={styles.hudMetricLbl}>TEMP</Text>
                            <Text style={styles.hudMetricVal}>{cool}°C</Text>
                        </View>
                        <View style={styles.hudMetricItem}>
                            <Text style={styles.hudMetricLbl}>BOOST</Text>
                            <Text style={styles.hudMetricVal}>{boost.toFixed(2)}b</Text>
                        </View>
                        <View style={styles.hudMetricItem}>
                            <Text style={styles.hudMetricLbl}>VOLT</Text>
                            <Text style={styles.hudMetricVal}>{volt.toFixed(1)}V</Text>
                        </View>
                    </View>

                    <Text style={styles.hudMirrorHint}>
                        {isHudMirrored ? '🪞 Oglindire Parbriz Activată (Așază telefonul sub parbriz)' : 'Apasă butonul 🪞 HUD din colțul de sus pentru proiecție'}
                    </Text>
                </View>
            );
        };

        // Select specialized cockpit geometry based on active template
        let cockpitContent = null;
        switch (tpl.id) {
            case 'AUDI_RS':
                cockpitContent = renderAudiRsCockpit();
                break;
            case 'TESLA_MINIMAL':
                cockpitContent = renderTeslaMinimalCockpit();
                break;
            case 'NIGHT_HUD':
                cockpitContent = renderNightHudCockpit();
                break;
            case 'MOTORSPORT':
            default:
                cockpitContent = renderMotorsportCockpit();
                break;
        }

        return (
            <View style={[styles.liveContainer, isHudMirrored && styles.hudMirrored]}>
                {/* ── Active Cockpit Geometry (1 of 4) ── */}
                {cockpitContent}

                {/* ── Cold engine / warming badge (if not HUD) ── */}
                {tpl.id !== 'NIGHT_HUD' && tempBadgeText && (
                    <View style={[styles.coldBadge, engineTempStatus === 'cold' ? styles.coldBadgeActive : styles.warmingBadgeActive]}>
                        <Text style={[styles.coldBadgeText, { color: engineTempStatus === 'cold' ? '#5AC8FA' : colors.status.monitor }]}>
                            {tempBadgeText}
                        </Text>
                    </View>
                )}

                {/* ── DPF regen banner (if not HUD) ── */}
                {tpl.id !== 'NIGHT_HUD' && (dpf.regen_status === 'ACTIVE' || dpf.regen_status === 'ON') && (
                    <View style={styles.dpfBanner}>
                        <Text style={styles.dpfText}>♻ Regenerare DPF — drum lung recomandat</Text>
                    </View>
                )}

                {/* ── Pro Mode: Sensor Fusion Observers (Collapsible / Non-HUD) ── */}
                {proMode && tpl.id !== 'NIGHT_HUD' && (
                    <View style={[styles.observersCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        <View style={styles.dynoHeader}>
                            <View style={[styles.dynoTag, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]}>
                                <Text style={[styles.dynoTagText, { color: colors.accent.default }]}>🔬 SENSOR FUSION & OBSERVERS</Text>
                            </View>
                            <Text style={styles.observerSubtitle}>Inginerie Empirică VAG</Text>
                        </View>

                        <View style={styles.observerGrid}>
                            <TouchableOpacity
                                style={styles.observerCell}
                                onPress={() => setInspectedParam({ id: 'bsfcGPerKwh', label: 'Consum Specific BSFC', val: v.bsfcGPerKwh || 210, unit: 'g/kWh', isVirtual: true, nominalMin: 195, nominalMax: 280 })}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Inspecție Consum Specific BSFC"
                            >
                                <View style={styles.observerLabelRow}>
                                    <Text style={styles.observerLabel}>BSFC (EFICIENȚĂ)</Text>
                                    <Text style={styles.observerChevron}>›</Text>
                                </View>
                                <Text style={styles.observerVal}>{v.bsfcGPerKwh ? `${v.bsfcGPerKwh}` : '—'} <Text style={styles.observerUnit}>g/kWh</Text></Text>
                                <Text style={styles.observerSub}>{v.bsfcGPerKwh < 220 ? '✓ Eficiență optimă TDI' : 'Sarcină parțială'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.observerCell}
                                onPress={() => setInspectedParam({ id: 'oilLifeWearFactor', label: 'Stres Ulei Arrhenius', val: v.oilLifeWearFactor || 1.0, unit: 'x', isVirtual: true, nominalMin: 0.8, nominalMax: 1.8 })}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Inspecție Stres Ulei Arrhenius"
                            >
                                <View style={styles.observerLabelRow}>
                                    <Text style={styles.observerLabel}>UZURĂ ULEI (ARRHENIUS)</Text>
                                    <Text style={styles.observerChevron}>›</Text>
                                </View>
                                <Text style={styles.observerVal}>{v.oilLifeWearFactor ? `${v.oilLifeWearFactor}×` : '1.0×'}</Text>
                                <Text style={styles.observerSub}>{v.oilLifeWearFactor > 1.4 ? '⚠ Solicitare termică' : '✓ Degradare normală'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.observerCell}
                                onPress={() => setInspectedParam({ id: 'batterySoHPct', label: 'Sănătate Baterie SoH', val: v.batterySoHPct || 95, unit: '%', isVirtual: true, nominalMin: 75, nominalMax: 100 })}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Inspecție Sănătate Baterie SoH"
                            >
                                <View style={styles.observerLabelRow}>
                                    <Text style={styles.observerLabel}>SĂNĂTATE BATERIE (SoH)</Text>
                                    <Text style={styles.observerChevron}>›</Text>
                                </View>
                                <Text style={[styles.observerVal, { color: (v.batterySoHPct || 95) < 70 ? colors.status.critical : colors.status.good }]}>
                                    {v.batterySoHPct ?? 95}%
                                </Text>
                                <Text style={styles.observerSub}>Rint: {v.batteryInternalResistanceMOhms ? `${v.batteryInternalResistanceMOhms} mΩ` : '8.2 mΩ'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.observerCell}
                                onPress={() => setInspectedParam({ id: 'brakeEnergyTripMj', label: 'Disipare Frânare Archard', val: v.brakeEnergyTripMj || 0.0, unit: 'MJ', isVirtual: true, nominalMin: 0, nominalMax: 15 })}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Inspecție Energie Frâne Trip"
                            >
                                <View style={styles.observerLabelRow}>
                                    <Text style={styles.observerLabel}>ENERGIE FRÂNE (TRIP)</Text>
                                    <Text style={styles.observerChevron}>›</Text>
                                </View>
                                <Text style={styles.observerVal}>{v.brakeEnergyTripMj ? `${v.brakeEnergyTripMj}` : '0.0'} <Text style={styles.observerUnit}>MJ</Text></Text>
                                <Text style={styles.observerSub}>Discuri: {v.estimatedBrakeDiscTempC ? `~${v.estimatedBrakeDiscTempC}°C` : 'Plăcuțe reci'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── AI Assistant & Contextual Alert (if not HUD) ── */}
                {tpl.id !== 'NIGHT_HUD' && (
                    <>
                        <View style={[styles.aiCard, { borderLeftColor: aiColor }]}>
                            <Text style={[styles.aiText, { color: aiColor }]}>{assistantMsg.text}</Text>
                        </View>
                        {contextualAlert && (
                            <RecommendationCard
                                title={contextualAlert.title}
                                description={contextualAlert.description}
                                priority={contextualAlert.priority}
                                style={{ marginTop: spacing[2] }}
                            />
                        )}
                    </>
                )}
            </View>
        );
    };

    // ─── PARAMS tab ───────────────────────────────────────────────────────────

    const renderParams = () => (
        <View style={styles.paramsContainer}>
            <View style={styles.paramsHintCard}>
                <Text style={styles.paramsHintIcon}>💡</Text>
                <Text style={styles.paramsHintText}>
                    Atinge oricare senzor pentru explicația fizică, toleranțe OEM, mini-grafic live și asistență AI.
                </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {PARAM_CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat.id}
                        style={[styles.chip, category === cat.id && styles.chipActive]}
                        onPress={() => setCategory(cat.id)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: category === cat.id }}
                    >
                        <Text style={[styles.chipText, category === cat.id && styles.chipTextActive]}>
                            {cat.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <View style={styles.paramList}>
                {params.map((p, i) => {
                    const { key: _k, id: _id, ...restProps } = p;
                    const rowKey = p.id || p.key || p.label || `param-${i}`;
                    return (
                        <ParamRow
                            key={rowKey}
                            id={p.id || p.key}
                            {...restProps}
                            item={p}
                            onPress={handleSelectParam}
                            last={i === params.length - 1}
                        />
                    );
                })}
            </View>
        </View>
    );

    // ─── SCOPE tab ────────────────────────────────────────────────────────────

    // ─── SCOPE tab (Osciloscop Telemetrie de Înaltă Rezoluție) ────────────────
    const renderScope = () => {
        const cfg1     = SCOPE_METRICS.find(s => s.id === selectedMetric) ?? SCOPE_METRICS[0];
        const cfg2     = SCOPE_METRICS.find(s => s.id === secondMetric) ?? SCOPE_METRICS[1];

        const maxPts   = Math.floor((width - 80) / zoomX);
        const sliced   = chartHistory.slice(-maxPts);

        // Date canal 1
        const data1    = sliced.map(item => ({
            value: Number(item[cfg1.id]) || 0,
            label: item.label || '',
            rawVal1: Number(item[cfg1.id]) || 0,
            rawVal2: Number(item[cfg2.id]) || 0,
            secunda: item.secunda || 0,
        }));

        // Statistici canal 1
        const vals1    = data1.map(d => d.value);
        const live1    = vals1.length > 0 ? vals1[vals1.length - 1] : 0;
        const max1     = vals1.length > 0 ? Math.max(...vals1) : 0;
        const min1     = vals1.length > 0 ? Math.min(...vals1) : 0;
        const avg1     = vals1.length > 0 ? Math.round((vals1.reduce((a, b) => a + b, 0) / vals1.length) * 10) / 10 : 0;

        // Date canal 2 (dacă este activ modul dual)
        let data2 = [];
        let live2 = 0, max2 = 0, min2 = 0, avg2 = 0;
        let scaleRatio = 1;

        if (isDualChannel) {
            const vals2 = sliced.map(item => Number(item[cfg2.id]) || 0);
            live2 = vals2.length > 0 ? vals2[vals2.length - 1] : 0;
            max2  = vals2.length > 0 ? Math.max(...vals2) : 0;
            min2  = vals2.length > 0 ? Math.min(...vals2) : 0;
            avg2  = vals2.length > 0 ? Math.round((vals2.reduce((a, b) => a + b, 0) / vals2.length) * 10) / 10 : 0;

            scaleRatio = (cfg1.defaultMax || 1) / (cfg2.defaultMax || 1);
            data2 = sliced.map(item => ({
                value: (Number(item[cfg2.id]) || 0) * scaleRatio,
                label: item.label || '',
                rawVal2: Number(item[cfg2.id]) || 0,
                secunda: item.secunda || 0,
            }));
        }

        let maxValue  = cfg1.defaultMax * zoomYMult;
        let stepValue = Math.max(1, Math.round(maxValue / 4));
        if (autoScaleY && data1.length > 0) {
            const peak = Math.max(...data1.map(i => i.value), isDualChannel ? Math.max(...data2.map(i => i.value), 1) : 1);
            maxValue  = Math.ceil(peak * 1.18);
            stepValue = Math.max(1, Math.ceil(maxValue / 4));
        }

        const chartW = width - layout.screenPaddingH * 2 - spacing[4] * 2;

        return (
            <View style={styles.scopeContainer}>
                {/* ── 1. MOD CANAL (UN SINGUR CANAL vs 2 CANALE COMPARATIV) ── */}
                <View style={styles.channelModeSwitchRow}>
                    <TouchableOpacity
                        style={[styles.channelModePill, !isDualChannel && styles.channelModePillActive]}
                        onPress={() => setIsDualChannel(false)}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.channelModePillText, !isDualChannel && styles.channelModePillTextActive]}>
                            📈 CANAL INDIVIDUAL
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.channelModePill, isDualChannel && styles.channelModePillActive]}
                        onPress={() => setIsDualChannel(true)}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.channelModePillText, isDualChannel && styles.channelModePillTextActive]}>
                            🔀 COMPARĂ 2 CANALE
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── 2. PRESET-URI PENTRU 2 CANALE SAU SELECTOR DE METRICI ── */}
                {isDualChannel ? (
                    <View style={styles.dualPresetsWrap}>
                        <Text style={styles.scopeSectionSub}>COMBINAȚII MECANICE RECOMANDATE:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                            {DUAL_PRESETS.map((p, idx) => {
                                const isCurrent = selectedMetric === p.m1 && secondMetric === p.m2;
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[styles.dualPresetChip, isCurrent && styles.dualPresetChipActive]}
                                        onPress={() => {
                                            setSelectedMetric(p.m1);
                                            setSecondMetric(p.m2);
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.dualPresetText, isCurrent && styles.dualPresetTextActive]}>
                                            {p.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                        {SCOPE_METRICS.map(s => (
                            <TouchableOpacity
                                key={s.id}
                                style={[styles.chip, selectedMetric === s.id && { backgroundColor: s.color, borderColor: s.color }]}
                                onPress={() => setSelectedMetric(s.id)}
                            >
                                <Text style={[styles.chipText, selectedMetric === s.id && { color: '#000000', fontWeight: 'bold' }]}>
                                    {s.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* ── 3. BENTO HUD: STATISTICI LIVE / MAX / MIN / MEDIE ── */}
                <View style={styles.statsHudRow}>
                    <View style={[styles.statsHudCard, { borderLeftColor: cfg1.color, borderLeftWidth: 3 }]}>
                        <Text style={styles.statsHudLbl} numberOfLines={1}>🔴 LIVE</Text>
                        <Text style={[styles.statsHudVal, { color: cfg1.color }]} numberOfLines={1}>
                            {live1.toFixed(1)} <Text style={styles.statsHudUnit}>{cfg1.unit}</Text>
                        </Text>
                        {isDualChannel && (
                            <Text style={[styles.statsHudSubVal, { color: cfg2.color }]} numberOfLines={1} ellipsizeMode="tail">
                                CH2: {live2.toFixed(1)} {cfg2.unit}
                            </Text>
                        )}
                    </View>
                    <View style={styles.statsHudCard}>
                        <Text style={styles.statsHudLbl} numberOfLines={1}>🔺 VÂRF (MAX)</Text>
                        <Text style={styles.statsHudVal} numberOfLines={1}>
                            {max1.toFixed(1)} <Text style={styles.statsHudUnit}>{cfg1.unit}</Text>
                        </Text>
                        {isDualChannel && (
                            <Text style={[styles.statsHudSubVal, { color: cfg2.color }]} numberOfLines={1} ellipsizeMode="tail">
                                CH2: {max2.toFixed(1)} {cfg2.unit}
                            </Text>
                        )}
                    </View>
                    <View style={styles.statsHudCard}>
                        <Text style={styles.statsHudLbl} numberOfLines={1}>🔻 MINIM</Text>
                        <Text style={styles.statsHudVal} numberOfLines={1}>
                            {min1.toFixed(1)} <Text style={styles.statsHudUnit}>{cfg1.unit}</Text>
                        </Text>
                        {isDualChannel && (
                            <Text style={[styles.statsHudSubVal, { color: cfg2.color }]} numberOfLines={1} ellipsizeMode="tail">
                                CH2: {min2.toFixed(1)} {cfg2.unit}
                            </Text>
                        )}
                    </View>
                    <View style={styles.statsHudCard}>
                        <Text style={styles.statsHudLbl} numberOfLines={1}>📊 MEDIE</Text>
                        <Text style={styles.statsHudVal} numberOfLines={1}>
                            {avg1.toFixed(1)} <Text style={styles.statsHudUnit}>{cfg1.unit}</Text>
                        </Text>
                        {isDualChannel && (
                            <Text style={[styles.statsHudSubVal, { color: cfg2.color }]} numberOfLines={1} ellipsizeMode="tail">
                                CH2: {avg2.toFixed(1)} {cfg2.unit}
                            </Text>
                        )}
                    </View>
                </View>

                {/* ── 4. COMENZI DE ZOOM & SCALARE ── */}
                <View style={styles.zoomRow}>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomX(p => Math.max(p - 3, 2))}>
                        <Text style={styles.zoomBtnTxt}>TIMP —</Text>
                    </TouchableOpacity>
                    <Text style={styles.zoomVal}>{zoomX}px</Text>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomX(p => Math.min(p + 3, 40))}>
                        <Text style={styles.zoomBtnTxt}>TIMP +</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={[styles.zoomBtn, autoScaleY && { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' }]}
                        onPress={() => setAutoScaleY(true)}
                    >
                        <Text style={[styles.zoomBtnTxt, autoScaleY && { color: '#10b981', fontWeight: 'bold' }]}>AUTO-Y</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => { setAutoScaleY(false); setZoomYMult(p => Math.min(p + 0.2, 3)); }}>
                        <Text style={styles.zoomBtnTxt}>Y —</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => { setAutoScaleY(false); setZoomYMult(p => Math.max(p - 0.2, 0.2)); }}>
                        <Text style={styles.zoomBtnTxt}>Y +</Text>
                    </TouchableOpacity>
                </View>

                {/* ── 5. CARDUL DE GRAFIC OSCILOSCOP CYBERPUNK CU DEGRADEURI NEON ── */}
                <View style={styles.chartCard} {...pinchPR.panHandlers}>
                    <View style={styles.chartHeaderRow}>
                        <View style={styles.chartLegendRow}>
                            <View style={[styles.legendDot, { backgroundColor: cfg1.color }]} />
                            <Text style={[styles.chartLegendLabel, { color: cfg1.color }]}>
                                CH1: {cfg1.label} ({cfg1.unit})
                            </Text>
                            {isDualChannel && (
                                <>
                                    <View style={[styles.legendDot, { backgroundColor: cfg2.color, marginLeft: 12 }]} />
                                    <Text style={[styles.chartLegendLabel, { color: cfg2.color }]}>
                                        CH2: {cfg2.label} ({cfg2.unit})
                                    </Text>
                                </>
                            )}
                        </View>
                        <Text style={styles.chartMetaText}>
                            {data1.length} puncte · {data1.length > 0 ? `${data1[data1.length - 1].secunda}s` : '0s'}
                        </Text>
                    </View>

                    <LineChart
                        data={data1}
                        data2={isDualChannel ? data2 : undefined}
                        width={chartW}
                        height={210}
                        color={cfg1.color}
                        color2={isDualChannel ? cfg2.color : undefined}
                        thickness={2.5}
                        thickness2={isDualChannel ? 2.5 : undefined}
                        curved
                        areaChart
                        areaChart2={isDualChannel}
                        startFillColor={cfg1.color}
                        startFillColor2={isDualChannel ? cfg2.color : undefined}
                        endFillColor="rgba(0, 0, 0, 0.01)"
                        endFillColor2={isDualChannel ? "rgba(0, 0, 0, 0.01)" : undefined}
                        startOpacity={0.35}
                        startOpacity2={isDualChannel ? 0.25 : undefined}
                        endOpacity={0.02}
                        endOpacity2={isDualChannel ? 0.02 : undefined}
                        dataPointsColor={cfg1.color}
                        dataPointsRadius={1}
                        maxValue={maxValue}
                        stepValue={stepValue}
                        noOfSections={4}
                        spacing={zoomX}
                        yAxisColor="transparent"
                        xAxisColor="rgba(56, 189, 248, 0.25)"
                        yAxisTextStyle={{ color: colors.text.secondary, fontSize: 9, fontWeight: 'bold' }}
                        xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: 8 }}
                        rulesColor="rgba(56, 189, 248, 0.12)"
                        rulesType="dashed"
                        initialSpacing={10}
                        endSpacing={10}
                        isAnimated={false}
                        pointerConfig={{
                            pointerStripHeight: 210,
                            pointerStripColor: 'rgba(56, 189, 248, 0.5)',
                            pointerStripWidth: 2,
                            pointerColor: cfg1.color,
                            radius: 5,
                            pointerLabelWidth: 120,
                            pointerLabelHeight: isDualChannel ? 52 : 38,
                            activatePointersOnLongPress: false,
                            autoAdjustPointerLabelPosition: true,
                            pointerLabelComponent: items => {
                                if (!items?.[0]) return null;
                                const item1 = items[0];
                                return (
                                    <View style={[styles.crosshairBadge, isDualChannel && { height: 50, width: 115 }]}>
                                        <Text style={[styles.crosshairVal, { color: cfg1.color }]}>
                                            {item1.rawVal1 ?? item1.value}{' '}
                                            <Text style={{ fontSize: 9, color: colors.text.secondary }}>{cfg1.unit}</Text>
                                        </Text>
                                        {isDualChannel && (
                                            <Text style={[styles.crosshairVal, { color: cfg2.color, fontSize: 11 }]}>
                                                {item1.rawVal2 ?? 0}{' '}
                                                <Text style={{ fontSize: 9, color: colors.text.secondary }}>{cfg2.unit}</Text>
                                            </Text>
                                        )}
                                        <Text style={styles.crosshairSec}>T+{item1.secunda ?? 0}s</Text>
                                    </View>
                                );
                            },
                        }}
                    />
                </View>
            </View>
        );
    };

    // ─── SENSOR TELEMETRY INSPECTOR HELPERS ───────────────────────────────────

    const renderMiniSparkline = (points, chartWidth, chartHeight, strokeColor = '#00f0ff') => {
        if (!points || points.length < 2) return null;
        const padding = 6;
        const values = points.map(p => p.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = (maxVal - minVal) === 0 ? 1 : (maxVal - minVal);
        const innerW = chartWidth - padding * 2;
        const innerH = chartHeight - padding * 2;

        const coords = points.map((p, i) => {
            const x = padding + (i / (points.length - 1)) * innerW;
            const y = chartHeight - padding - ((p.value - minVal) / range) * innerH;
            return { x, y };
        });

        const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, '');
        const lastCoord = coords[coords.length - 1];
        const firstCoord = coords[0];
        const areaD = `${pathD} L ${lastCoord.x.toFixed(1)} ${chartHeight} L ${firstCoord.x.toFixed(1)} ${chartHeight} Z`;

        return (
            <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                    <LinearGradient id="inspectorSparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                        <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                    </LinearGradient>
                </Defs>
                <Path d={areaD} fill="url(#inspectorSparkGrad)" />
                <Path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={lastCoord.x} cy={lastCoord.y} r="3.5" fill={strokeColor} />
            </Svg>
        );
    };

    const renderToleranceRuler = (numVal, nominalMin, nominalMax, minLimit, maxLimit, unit) => {
        if (nominalMin === undefined || nominalMax === undefined) return null;
        const minBound = minLimit !== undefined ? minLimit : Math.min(nominalMin * 0.7, 0);
        const maxBound = maxLimit !== undefined ? maxLimit : nominalMax * 1.3;
        const span = (maxBound - minBound) === 0 ? 1 : (maxBound - minBound);

        const nomLeftPct = Math.max(0, Math.min(100, ((nominalMin - minBound) / span) * 100));
        const nomWidthPct = Math.max(0, Math.min(100 - nomLeftPct, ((nominalMax - nominalMin) / span) * 100));
        const currentPct = isNaN(numVal) ? 50 : Math.max(0, Math.min(100, ((numVal - minBound) / span) * 100));

        const isOptimal = !isNaN(numVal) && numVal >= nominalMin && numVal <= nominalMax;
        const isCritical = !isNaN(numVal) && (numVal > nominalMax * 1.15 || numVal < nominalMin * 0.85);
        const markerColor = isOptimal ? colors.status.good : isCritical ? colors.status.critical : colors.status.caution;

        return (
            <View style={styles.rulerContainer}>
                <View style={styles.rulerHeaderRow}>
                    <Text style={styles.rulerBoundLabel}>MIN: {nominalMin} {unit}</Text>
                    <Text style={[styles.rulerOptimalBadge, { color: markerColor }]}>
                        {isOptimal ? '● ZONĂ OPTIMĂ OEM' : isCritical ? '▲ DEVIAȚIE CRITICĂ' : '▲ ATENȚIE: DEVIAȚIE'}
                    </Text>
                    <Text style={styles.rulerBoundLabel}>MAX: {nominalMax} {unit}</Text>
                </View>
                <View style={styles.rulerTrack}>
                    <View
                        style={[
                            styles.rulerNominalZone,
                            { left: `${nomLeftPct}%`, width: `${nomWidthPct}%` },
                        ]}
                    />
                    <View
                        style={[
                            styles.rulerMarker,
                            { left: `${currentPct}%`, backgroundColor: markerColor, borderColor: '#ffffff' },
                        ]}
                    />
                </View>
                <View style={styles.rulerTicksRow}>
                    <Text style={styles.rulerTickText}>{minBound} {unit}</Text>
                    <Text style={styles.rulerTickText}>Interval: {nominalMin} – {nominalMax} {unit}</Text>
                    <Text style={styles.rulerTickText}>{maxBound} {unit}</Text>
                </View>
            </View>
        );
    };

    const renderSensorInspector = () => {
        if (!inspectedParam) return null;
        const paramKey = inspectedParam.id || inspectedParam.key;
        const sInfo = getSensorInfo(paramKey || inspectedParam.label);
        const numVal = typeof inspectedParam.val === 'number' ? inspectedParam.val : parseFloat(inspectedParam.val);
        const unit = inspectedParam.unit || sInfo?.unit || '';
        const nominalMin = inspectedParam.nominalMin ?? sInfo?.nominalMin;
        const nominalMax = inspectedParam.nominalMax ?? sInfo?.nominalMax;
        const isVirtual = inspectedParam.isVirtual || sInfo?.isVirtual;

        // Filtrare istoric din sesiune pentru sparkline
        const historyPoints = chartHistory
            .map((item, idx) => {
                let raw = null;
                if (paramKey && item[paramKey] !== undefined) raw = item[paramKey];
                else if (item[inspectedParam.label] !== undefined) raw = item[inspectedParam.label];
                if (raw == null || typeof raw === 'object') return null;
                const n = parseFloat(raw);
                return isNaN(n) ? null : { value: n, sec: item.secunda || idx };
            })
            .filter(Boolean)
            .slice(-35);

        const values = historyPoints.map(p => p.value);
        const hasHistory = values.length >= 2;
        const liveVal = values.length > 0 ? values[values.length - 1] : (!isNaN(numVal) ? numVal : 0);
        const maxVal = hasHistory ? Math.max(...values) : liveVal;
        const minVal = hasHistory ? Math.min(...values) : liveVal;
        const avgVal = hasHistory ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : liveVal;

        let statusText = 'NOMINAL (ÎN PARAMETRI OPTIMI OEM)';
        let statusColor = colors.status.good;
        if (nominalMin !== undefined && nominalMax !== undefined && !isNaN(numVal)) {
            if (numVal >= nominalMin && numVal <= nominalMax) {
                statusText = 'NOMINAL (ÎN PARAMETRI OPTIMI OEM)';
                statusColor = colors.status.good;
            } else if (numVal > nominalMax * 1.15 || numVal < nominalMin * 0.85) {
                statusText = 'CRITIC (DEVIAȚIE SEVERĂ FAȚĂ DE LIMITĂ)';
                statusColor = colors.status.critical;
            } else {
                statusText = 'ATENȚIE (DEVIAȚIE UȘOARĂ / TRANZIENT)';
                statusColor = colors.status.caution;
            }
        }

        const displayVal = typeof inspectedParam.val === 'number'
            ? (Number.isInteger(inspectedParam.val) ? inspectedParam.val.toLocaleString('ro-RO') : inspectedParam.val.toFixed(1))
            : formatStatusVal(inspectedParam.val);

        const sparkWidth = Math.max(width - 64, 260);

        const handleOpenInScope = () => {
            const targetScopeId = sInfo.scopeId || (SCOPE_METRICS.find(s => s.id === paramKey)?.id) || 'rpm';
            setSelectedMetric(targetScopeId);
            setTab('SCOPE');
            setInspectedParam(null);
        };

        const handleAskAI = () => {
            const prompt = `Analizează comportamentul parametrului "${sInfo.name}". Valoarea live actuală este ${displayVal} ${unit} (interval nominal OEM recomandat: ${sInfo.nominalRange}). ${sInfo.whatItIs} Există riscuri mecanice sau defecțiuni probabile?`;
            getRootNavigation(navigation)?.navigate('AIExpert', { initialPrompt: prompt });
            setInspectedParam(null);
        };

        return (
            <BottomSheet
                visible={Boolean(inspectedParam)}
                onClose={() => setInspectedParam(null)}
                title="DIAGNOZĂ & DETALII SENZOR"
            >
                <ScrollView
                    style={styles.inspectorScroll}
                    contentContainerStyle={styles.inspectorContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* 1. Header Badges & Title */}
                    <View style={styles.inspectorHeadRow}>
                        <View style={styles.inspectorCategoryPill}>
                            <Text style={styles.inspectorCategoryText}>
                                {sInfo.category || 'TELEMETRIE CAN-BUS'}
                            </Text>
                        </View>
                        <View style={[styles.inspectorOriginPill, isVirtual ? styles.originVirtual : styles.originPhysical]}>
                            <Text style={[styles.inspectorOriginText, { color: isVirtual ? '#00f0ff' : '#10b981' }]}>
                                {isVirtual ? '🧠 VIRTUAL PHM' : '🔌 SENZOR OBD-II'}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.inspectorTitle}>{sInfo.name || inspectedParam.label}</Text>

                    {/* 2. Hero Value & Status Card */}
                    <View style={[styles.inspectorHeroCard, { borderColor: statusColor }]}>
                        <View style={styles.inspectorHeroValRow}>
                            <Text style={[styles.inspectorHeroVal, { color: statusColor }]}>
                                {displayVal}
                                {unit ? <Text style={styles.inspectorHeroUnit}> {unit}</Text> : null}
                            </Text>
                            <View style={[styles.inspectorStatusBadge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
                                <Text style={[styles.inspectorStatusText, { color: statusColor }]}>
                                    {statusText}
                                </Text>
                            </View>
                        </View>
                        {sInfo.nominalRange ? (
                            <Text style={styles.inspectorRangeSub}>
                                Interval nominal: <Text style={{ color: colors.text.primary, fontWeight: 'bold' }}>{sInfo.nominalRange}</Text>
                            </Text>
                        ) : null}
                    </View>

                    {/* 3. Tolerance Ruler */}
                    {nominalMin !== undefined && nominalMax !== undefined && (
                        renderToleranceRuler(numVal, nominalMin, nominalMax, inspectedParam.min, inspectedParam.max, unit)
                    )}

                    {/* 4. Mini Live Sparkline (Istoric Sesiune) */}
                    <View style={styles.sparkCard}>
                        <View style={styles.sparkCardHeader}>
                            <Text style={styles.sparkCardTitle}>📈 GRAFIC LIVE ÎN TIMP REAL (ISTORIC)</Text>
                            <Text style={styles.sparkCardMeta}>{historyPoints.length}s înregistrate</Text>
                        </View>
                        {hasHistory ? (
                            <>
                                <View style={styles.sparkSvgWrap}>
                                    {renderMiniSparkline(historyPoints, sparkWidth, 68, statusColor)}
                                </View>
                                <View style={styles.sparkStatsGrid}>
                                    <View style={styles.sparkStatCell}>
                                        <Text style={styles.sparkStatLabel}>🔴 LIVE</Text>
                                        <Text style={[styles.sparkStatVal, { color: statusColor }]}>{liveVal} {unit}</Text>
                                    </View>
                                    <View style={styles.sparkStatCell}>
                                        <Text style={styles.sparkStatLabel}>🔺 MAX</Text>
                                        <Text style={styles.sparkStatVal}>{maxVal} {unit}</Text>
                                    </View>
                                    <View style={styles.sparkStatCell}>
                                        <Text style={styles.sparkStatLabel}>🔻 MIN</Text>
                                        <Text style={styles.sparkStatVal}>{minVal} {unit}</Text>
                                    </View>
                                    <View style={styles.sparkStatCell}>
                                        <Text style={styles.sparkStatLabel}>📊 MEDIE</Text>
                                        <Text style={styles.sparkStatVal}>{avgVal} {unit}</Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <View style={styles.sparkEmptyWrap}>
                                <Text style={styles.sparkEmptyText}>
                                    ⏱️ Colectare date în curs... Graficul se actualizează la fiecare secundă.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* 5. Ce măsoară acest senzor? */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoCardHead}>
                            <Text style={styles.infoCardIcon}>🔍</Text>
                            <Text style={styles.infoCardTitle}>CE MĂSOARĂ ACEST SENZOR?</Text>
                        </View>
                        <Text style={styles.infoCardBody}>{sInfo.whatItIs}</Text>
                    </View>

                    {/* 6. De ce este important & Simptome defecțiune */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoCardHead}>
                            <Text style={styles.infoCardIcon}>🛡️</Text>
                            <Text style={styles.infoCardTitle}>DE CE ESTE IMPORTANT & CONSECINȚE</Text>
                        </View>
                        <Text style={styles.infoCardBody}>{sInfo.whyItMatters}</Text>
                        {sInfo.symptoms ? (
                            <View style={styles.symptomsBox}>
                                <Text style={styles.symptomsTitle}>⚠️ Semne și Simptome de Defecțiune:</Text>
                                <Text style={styles.symptomsText}>{sInfo.symptoms}</Text>
                            </View>
                        ) : null}
                    </View>

                    {/* 7. Model Matematic & Formulă Fizică */}
                    {sInfo.formula && (
                        <View style={styles.infoCard}>
                            <View style={styles.infoCardHead}>
                                <Text style={styles.infoCardIcon}>📐</Text>
                                <Text style={styles.infoCardTitle}>MODEL FIZIC & FORMULĂ MATEMATICĂ</Text>
                            </View>
                            <View style={styles.formulaBox}>
                                <Text style={styles.formulaText}>{sInfo.formula}</Text>
                            </View>
                        </View>
                    )}

                    {/* 8. Butoane de Acțiune Rapidă */}
                    <View style={styles.actionButtonsWrap}>
                        <TouchableOpacity
                            style={styles.scopeActionBtn}
                            onPress={handleOpenInScope}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Deschide în Osciloscop"
                        >
                            <Text style={styles.scopeActionBtnText}>📈 Deschide în Osciloscop (GRAFIC)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.aiActionBtn}
                            onPress={handleAskAI}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Consultă Inginerul AI"
                        >
                            <Text style={styles.aiActionBtnText}>✨ Consultă Inginerul AI despre acest senzor</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </BottomSheet>
        );
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const connColor = isConnected ? colors.status.good : isReconnecting ? colors.status.monitor : colors.status.critical;
    const connLabel = isConnected ? 'LIVE' : isReconnecting ? 'SYNC' : 'OFF';

    return (
        <View style={[styles.root, { backgroundColor: tpl.bg }]}>
            {/* ── Top bar ─────────────────────────────────────────────── */}
            <View style={styles.topBar}>
                <View style={[styles.connPill, { borderColor: connColor }]}>
                    <View style={[styles.connDot, { backgroundColor: connColor }]} />
                    <Text style={[styles.connLabel, { color: connColor }]}>{connLabel}</Text>
                </View>

                {/* Persona Switch: Rapid vs Pro Telemetrie (Complet voluntar, nelimitat în mers) */}
                <TouchableOpacity
                    style={[styles.modeTogglePill, proMode ? styles.modeTogglePro : styles.modeToggleDriver]}
                    onPress={() => {
                        const next = !proMode;
                        setProMode(next);
                        if (!next && tab === 'PARAMS') setTab('LIVE');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={proMode ? 'Mod Pro activ. Apasă pentru Mod Rapid' : 'Mod Rapid activ. Apasă pentru Mod Pro'}
                >
                    <Text style={[styles.modeToggleText, proMode ? styles.modeToggleTextPro : styles.modeToggleTextDriver]}>
                        {proMode ? '⚡ PRO' : '🚗 RAPID'}
                    </Text>
                </TouchableOpacity>

                {/* Buton Telecomandă Simulator Live */}
                {openSimulatorModal && (
                    <TouchableOpacity
                        style={[styles.hudLaunchBtn, { borderColor: '#00F0FF', backgroundColor: '#00F0FF18', marginRight: spacing[1] }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Deschide Telecomanda de Simulare Live"
                    >
                        <Text style={[styles.hudLaunchBtnText, { color: '#00F0FF' }]}>🎮 DEMO</Text>
                    </TouchableOpacity>
                )}

                {/* Buton Selector Stil / Paradigmă UI */}
                <TouchableOpacity
                    style={[styles.hudLaunchBtn, { borderColor: colors.accent.default, backgroundColor: `${colors.accent.default}18`, marginRight: spacing[1] }]}
                    onPress={() => {
                        hapticTap();
                        openExperiencePicker();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Schimbă stilul de afișare"
                >
                    <Text style={[styles.hudLaunchBtnText, { color: colors.accent.default }]}>🎨 STIL</Text>
                </TouchableOpacity>

                {/* Buton HUD Orizontal Bord */}
                <TouchableOpacity
                    style={styles.hudLaunchBtn}
                    onPress={() => setShowLandscapeHud(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Deschide HUD Orizontal pentru Bord"
                >
                    <Text style={styles.hudLaunchBtnText}>🏎️ HUD</Text>
                </TouchableOpacity>

                {/* HUD Windshield Mirror Toggle când șablonul este NIGHT_HUD */}
                {tpl.isHud && (
                    <TouchableOpacity
                        style={[styles.hudToggleBtn, isHudMirrored && styles.hudToggleBtnActive]}
                        onPress={() => setIsHudMirrored(!isHudMirrored)}
                        accessibilityRole="button"
                        accessibilityLabel="Oglindire afișaj parbriz"
                    >
                        <Text style={[styles.hudToggleText, isHudMirrored && styles.hudToggleTextActive]}>
                            {isHudMirrored ? '🪞 MIRROR ON' : '🪞 HUD'}
                        </Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.vehicleName} numberOfLines={1}>
                    {getVehicleLabel() || 'Dashboard'}
                </Text>
                <TouchableOpacity style={styles.alertBtn} onPress={() => setShowAlerts(true)} accessibilityRole="button" accessibilityLabel="Alerte">
                    <Text style={styles.alertBtnIcon}>🔔</Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* ── Floating Segmented Pill Bar (Modern Compact Selector) ── */}
            <View style={[styles.segmentedWrap, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                {[
                    { id: 'LIVE',   label: 'COCKPIT' },
                    ...(proMode ? [{ id: 'PARAMS', label: 'SENZORI' }] : []),
                    { id: 'SCOPE',  label: 'GRAFIC' },
                ].map(item => {
                    const isActive = tab === item.id;
                    const isDarkTheme = tpl.id === 'AUDI_RS' || tpl.id === 'NIGHT_HUD';
                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.segmentedPill,
                                isActive && { backgroundColor: tpl.accent, shadowColor: tpl.accent, shadowOpacity: 0.35, shadowRadius: 4, elevation: 3 },
                            ]}
                            onPress={() => setTab(item.id)}
                            activeOpacity={0.8}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                        >
                            <Text
                                style={[
                                    styles.segmentedPillText,
                                    isActive && { color: isDarkTheme ? '#ffffff' : '#05070e', fontWeight: typography.weights.heavy },
                                ]}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Offline / reconnecting banner ───────────────────────── */}
            {!isConnected && (
                <View style={[styles.offlineBanner, isReconnecting && styles.offlineBannerSync]}>
                    <Text style={styles.offlineText}>
                        {isReconnecting ? '⟳  Reconectare la server...' : '⊘  Date înghețate — fără conexiune'}
                    </Text>
                </View>
            )}

            {/* ── Content ─────────────────────────────────────────────── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {tab === 'LIVE'   && renderLive()}
                {tab === 'PARAMS' && renderParams()}
                {tab === 'SCOPE'  && renderScope()}
            </ScrollView>

            {/* ── Alerts modal ────────────────────────────────────────── */}
            <Modal
                visible={showAlerts}
                transparent
                animationType="slide"
                onRequestClose={() => { markAlertsAsRead(); setShowAlerts(false); }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHead}>
                            <Text style={styles.modalTitle}>Alerte Sesiune</Text>
                            <TouchableOpacity
                                onPress={() => { markAlertsAsRead(); setShowAlerts(false); }}
                                style={styles.modalClose}
                            >
                                <Text style={{ color: colors.text.primary, fontWeight: typography.weights.bold, fontSize: 16 }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {alertsList.length === 0 ? (
                                <Text style={styles.noAlerts}>Nicio alertă în această sesiune.</Text>
                            ) : alertsList.map(al => (
                                <View key={al.id} style={styles.alertRow}>
                                    <Text style={styles.alertRowTitle}>{(al.tip || 'Eveniment').replace(/_/g, ' ')}</Text>
                                    <Text style={styles.alertRowSub}>Eco Score: {al.scor_curent ?? '—'}/100</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── Sensor Telemetry Inspector BottomSheet ───────────────── */}
            {renderSensorInspector()}

            {/* ── Fullscreen Horizon / Landscape Cockpit HUD (Modular Memoized) ── */}
            <LandscapeHudModal
                visible={showLandscapeHud}
                onClose={() => setShowLandscapeHud(false)}
                liveData={liveData}
                numeric={numeric}
                dynamicRedline={dynamicRedline}
                baseRedline={baseRedline}
                contextualAlert={contextualAlert}
                isHudMirrored={isHudMirrored}
                onToggleMirror={() => setIsHudMirrored(prev => !prev)}
            />
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const TAB_H = 56;

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 44,
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[6],
    },

    // ── Segmented Pill Bar ───────────────────────────────────────────────────
    segmentedWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: layout.screenPaddingH,
        marginTop: spacing[1],
        marginBottom: spacing[2],
        padding: 3,
        borderRadius: radii.full,
        borderWidth: 1,
    },
    segmentedPill: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentedPillText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },

    // ── Top bar ──────────────────────────────────────────────────────────────
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[2],
        gap: spacing[2],
    },
    connPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderRadius: radii.full,
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1],
        flexShrink: 0,
    },
    connDot:   { width: 7, height: 7, borderRadius: 4 },
    connLabel: { fontSize: typography.sizes.micro, fontWeight: typography.weights.heavy },
    modeTogglePill: {
        paddingHorizontal: spacing[2] + 4,
        paddingVertical: spacing[1],
        borderRadius: radii.full,
        borderWidth: 1,
        flexShrink: 0,
    },
    modeToggleDriver: {
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderColor: colors.accent.default,
    },
    modeTogglePro: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderColor: colors.status.monitor,
    },
    modeToggleText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    modeToggleTextDriver: {
        color: colors.accent.default,
    },
    modeToggleTextPro: {
        color: colors.status.monitor,
    },
    hudToggleBtn: {
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        borderColor: '#ff453a',
        borderWidth: 1,
        borderRadius: radii.full,
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1],
        flexShrink: 0,
    },
    hudToggleBtnActive: {
        backgroundColor: '#ff453a',
    },
    hudToggleText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: '#ff453a',
    },
    hudToggleTextActive: {
        color: '#000000',
    },
    vehicleName: {
        flex: 1,
        flexShrink: 1,
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    alertBtn: { padding: spacing[1], position: 'relative', flexShrink: 0 },
    alertBtnIcon: { fontSize: 22 },
    badge: {
        position: 'absolute', top: 0, right: 0,
        backgroundColor: colors.status.critical,
        minWidth: 16, height: 16,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    badgeText: { color: '#FFF', fontSize: 9, fontWeight: typography.weights.heavy },

    // ── Offline banner ───────────────────────────────────────────────────────
    offlineBanner: {
        backgroundColor: colors.tint?.critical ?? 'rgba(255,59,48,0.08)',
        borderBottomWidth: 1,
        borderBottomColor: colors.status.critical,
        paddingVertical: spacing[1] + 2,
        alignItems: 'center',
    },
    offlineBannerSync: {
        backgroundColor: colors.tint?.monitor ?? 'rgba(255,159,10,0.1)',
        borderBottomColor: colors.status.monitor,
    },
    offlineText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },

    // ── LIVE: Speed hero ─────────────────────────────────────────────────────
    liveContainer: { paddingTop: spacing[4] },
    hudMirrored: {
        transform: [{ scaleX: -1 }],
    },
    speedHero: { alignItems: 'center', paddingBottom: spacing[1] },
    speedNum: {
        fontSize: 88,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
        lineHeight: 94,
    },
    speedUnit: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginTop: 0,
    },

    // ── LIVE: RPM bar ────────────────────────────────────────────────────────
    rpmSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginTop: spacing[3],
        marginBottom: spacing[2],
    },
    rpmNum: {
        width: 54,
        textAlign: 'right',
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    rpmTrack: {
        flex: 1,
        height: 8,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        overflow: 'hidden',
        position: 'relative',
    },
    rpmFill:  { height: '100%', borderRadius: radii.full },
    redlineMarker: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        backgroundColor: 'rgba(255, 69, 58, 0.28)',
        borderLeftWidth: 2,
        borderLeftColor: colors.status.critical,
    },
    coldBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 159, 10, 0.12)',
        borderWidth: 1,
        borderColor: colors.status.monitor,
        borderRadius: radii.xs,
        paddingVertical: 3,
        paddingHorizontal: spacing[2],
        marginBottom: spacing[3],
        alignSelf: 'center',
    },
    coldBadgeActive: {
        backgroundColor: 'rgba(90, 200, 250, 0.12)',
        borderColor: '#5AC8FA',
    },
    warmingBadgeActive: {
        backgroundColor: 'rgba(255, 159, 10, 0.12)',
        borderColor: colors.status.monitor,
    },
    coldBadgeText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
    },
    rpmLabel: { fontSize: typography.sizes.micro, color: colors.text.secondary, fontWeight: typography.weights.bold, width: 30 },

    // ── LIVE: DPF banner ─────────────────────────────────────────────────────
    dpfBanner: {
        backgroundColor: colors.tint?.monitor ?? 'rgba(255,159,10,0.1)',
        borderWidth: 1,
        borderColor: colors.status.monitor,
        borderRadius: radii.sm,
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    dpfText: { color: colors.status.monitor, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold },

    // ── LIVE: Virtual Dyno ───────────────────────────────────────────────────
    dynoCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
    },
    dynoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    dynoBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        flexWrap: 'wrap',
    },
    dynoTag: {
        backgroundColor: colors.bg[2],
        paddingHorizontal: spacing[2],
        paddingVertical: 3,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    dynoTagText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },
    dynoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
    },
    dynoCell: {
        flex: 1,
        minWidth: 130,
        backgroundColor: colors.bg[0],
        borderRadius: radii.sm,
        padding: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.subtle ?? colors.bg[2],
    },
    dynoLabel: {
        fontSize: 8,
        color: colors.text.secondary,
        fontWeight: typography.weights.heavy,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    dynoValue: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    dynoUnit: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    dynoMiniBar: {
        height: 3,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        marginTop: 4,
        overflow: 'hidden',
    },
    dynoMiniFill: {
        height: '100%',
        borderRadius: radii.full,
    },
    dynoSub: {
        fontSize: 9,
        color: colors.text.secondary,
        marginTop: 2,
    },

    // ── LIVE: Dual Boost ─────────────────────────────────────────────────────
    boostCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
    },
    boostHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    boostTitle: {
        fontSize: 9,
        color: colors.text.secondary,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
    },
    boostDelta: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    boostBarsWrap: {
        gap: spacing[2],
    },
    boostBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    boostBarLbl: {
        width: 32,
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
    },
    boostBarTrack: {
        flex: 1,
        height: 6,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    boostBarFill: {
        height: '100%',
        borderRadius: radii.full,
    },
    boostBarVal: {
        width: 60,
        textAlign: 'right',
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    turboDiagPill: {
        marginTop: spacing[2],
        paddingVertical: spacing[1],
        paddingHorizontal: spacing[2],
        backgroundColor: 'rgba(255, 159, 10, 0.12)',
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.status.monitor,
    },
    turboDiagText: {
        fontSize: 10,
        color: colors.status.monitor,
        fontWeight: typography.weights.semibold,
    },

    // ── LIVE: Observers card ─────────────────────────────────────────────────
    observersCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
    },
    observerSubtitle: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },
    observerGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginTop: spacing[2],
    },
    observerCell: {
        flex: 1,
        minWidth: '46%',
        backgroundColor: colors.bg[0],
        borderRadius: radii.sm,
        padding: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.subtle ?? colors.bg[2],
    },
    observerLabel: {
        fontSize: 8,
        color: colors.text.secondary,
        fontWeight: typography.weights.heavy,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    observerVal: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    observerUnit: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    observerSub: {
        fontSize: 9,
        color: colors.text.secondary,
        marginTop: 2,
    },

    // ── LIVE: 2×3 tiles ──────────────────────────────────────────────────────
    tileGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    tile: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 78,
    },
    tileLabel: {
        fontSize: 8,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        marginBottom: spacing[1],
    },
    tileValue: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    tileUnit: { fontSize: 9, color: colors.text.secondary, marginTop: 2 },

    // ── LIVE: AI card ────────────────────────────────────────────────────────
    aiCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3] + 2,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderColor: colors.border.default,
        marginBottom: spacing[2],
    },
    aiText: {
        fontSize: typography.sizes.label1,
        lineHeight: typography.sizes.label1 * 1.6,
        fontStyle: 'italic',
    },

    // ── PARAMS tab ───────────────────────────────────────────────────────────
    paramsContainer: { paddingTop: spacing[2] },
    chipsRow: {
        paddingVertical: spacing[3],
        gap: spacing[2],
        paddingRight: layout.screenPaddingH,
    },
    chip: {
        backgroundColor: colors.bg[1],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    chipActive: { backgroundColor: colors.accent.default, borderColor: colors.accent.default },
    chipText:       { color: colors.text.secondary, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold },
    chipTextActive: { color: '#FFFFFF' },

    paramList: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        overflow: 'hidden',
        marginBottom: spacing[4],
    },
    paramRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2] + 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle ?? colors.bg[2],
        gap: spacing[2],
    },
    paramLabelWrap: {
        width: 135,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    paramLabel: {
        flex: 1,
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },
    virtualPill: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: radii.full,
        backgroundColor: 'rgba(0, 240, 255, 0.15)',
        borderWidth: 0.5,
        borderColor: '#00f0ff',
        flexShrink: 0,
    },
    virtualPillText: {
        fontSize: 7.5,
        fontWeight: typography.weights.heavy,
        color: '#00f0ff',
        letterSpacing: 0.5,
    },
    paramTrack: {
        flex: 1,
        height: 4,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        overflow: 'hidden',
        minWidth: 35,
    },
    paramFill:  { height: '100%', borderRadius: radii.full, opacity: 0.9 },
    paramValWrap: {
        minWidth: 70,
        maxWidth: 120,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 3,
    },
    paramVal: {
        textAlign: 'right',
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    paramUnit: { fontSize: 9, color: colors.text.secondary, fontWeight: typography.weights.regular },
    paramChevron: {
        fontSize: 14,
        color: colors.text.tertiary ?? '#525d7a',
        fontWeight: typography.weights.bold,
        marginLeft: 2,
    },
    paramsHintCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        borderColor: 'rgba(56, 189, 248, 0.25)',
        borderWidth: 1,
        borderRadius: radii.md,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        marginBottom: spacing[2],
    },
    paramsHintIcon: { fontSize: 16 },
    paramsHintText: {
        fontSize: 11,
        color: colors.text.secondary,
        flex: 1,
        lineHeight: 16,
        fontWeight: typography.weights.medium,
    },
    observerLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    observerChevron: {
        fontSize: 12,
        color: colors.text.tertiary ?? '#525d7a',
        fontWeight: typography.weights.bold,
    },

    // ── SCOPE tab ────────────────────────────────────────────────────────────
    scopeContainer: { paddingTop: spacing[2] },
    channelModeSwitchRow: {
        flexDirection: 'row',
        backgroundColor: colors.bg[2],
        borderRadius: radii.md,
        padding: 3,
        marginBottom: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    channelModePill: {
        flex: 1,
        paddingVertical: spacing[2],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.sm,
    },
    channelModePillActive: {
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.accent.default,
    },
    channelModePillText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },
    channelModePillTextActive: {
        color: colors.accent.default,
    },
    dualPresetsWrap: {
        marginBottom: spacing[2],
    },
    scopeSectionSub: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 0.8,
        marginBottom: 6,
        paddingHorizontal: 2,
    },
    dualPresetChip: {
        paddingHorizontal: spacing[3],
        paddingVertical: 7,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        marginRight: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    dualPresetChipActive: {
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderColor: colors.accent.default,
    },
    dualPresetText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },
    dualPresetTextActive: {
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
    },
    statsHudRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    statsHudCard: {
        width: '48.5%',
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[2] + 2,
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        minHeight: 56,
    },
    statsHudLbl: {
        fontSize: 8,
        fontWeight: typography.weights.heavy,
        color: colors.text.secondary,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    statsHudVal: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    statsHudSubVal: {
        fontSize: 9,
        fontWeight: typography.weights.bold,
        marginTop: 2,
        fontVariant: ['tabular-nums'],
    },
    statsHudUnit: {
        fontSize: 8,
        fontWeight: typography.weights.regular,
        color: colors.text.secondary,
    },
    zoomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    zoomBtn: {
        paddingHorizontal: spacing[2] + 2,
        height: 28,
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomBtnTxt: { color: colors.text.secondary, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold },
    zoomVal: {
        color: colors.accent.default,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        minWidth: 32,
        textAlign: 'center',
    },
    chartCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
    },
    chartHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: spacing[2],
    },
    chartLegendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
        marginRight: 4,
    },
    chartLegendLabel: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
    },
    chartMetaText: {
        fontSize: 9,
        color: colors.text.secondary,
        fontVariant: ['tabular-nums'],
    },
    chartTitle: {
        color: colors.text.secondary,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
        alignSelf: 'flex-start',
        marginBottom: spacing[2],
    },
    crosshairBadge: {
        height: 36, width: 85,
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingHorizontal: 4,
    },
    crosshairVal: { color: colors.text.primary, fontSize: typography.sizes.label1, fontWeight: typography.weights.heavy, fontVariant: ['tabular-nums'] },
    crosshairSec: { color: colors.text.secondary, fontSize: 8, marginTop: 1 },

    // ── 1. MOTORSPORT COCKPIT STYLES ────────────────────────────────────────
    motorsportRoot: {
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    shiftLightStrip: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
        marginBottom: spacing[1],
    },
    shiftLed: {
        width: 22,
        height: 9,
        borderRadius: 2,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    shiftLedFlash: {
        opacity: 0.9,
    },
    tachoWrap: {
        width: 260,
        height: 260,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginVertical: spacing[1],
    },
    tachoSvg: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    tachoCenterContent: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing[1],
    },
    tachoGear: {
        fontSize: 44,
        fontWeight: typography.weights.heavy,
        color: '#ffb800',
        marginBottom: -4,
    },
    tachoSpeed: {
        fontSize: 56,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
        lineHeight: 60,
    },
    tachoSpeedUnit: {
        fontSize: 11,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: -2,
    },
    tachoRpmNum: {
        fontSize: 12,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
        marginTop: 2,
    },
    twinPillRow: {
        flexDirection: 'row',
        gap: spacing[2],
        width: '100%',
        marginTop: spacing[2],
    },
    twinCard: {
        flex: 1,
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
    },
    twinCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 3,
    },
    twinCardTitle: {
        flex: 1,
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: colors.text.secondary,
        letterSpacing: 0.5,
        marginRight: 4,
    },
    twinCardDelta: {
        fontSize: 10,
        fontWeight: typography.weights.bold,
        color: colors.status.good,
        fontVariant: ['tabular-nums'],
        flexShrink: 0,
    },
    twinBigVal: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
        marginVertical: 2,
    },
    twinUnit: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },
    twinMiniBarTrack: {
        height: 4,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        marginVertical: 3,
        overflow: 'hidden',
    },
    twinMiniBarFill: {
        height: '100%',
        borderRadius: radii.full,
    },
    twinSubText: {
        fontSize: 9,
        color: colors.text.secondary,
        marginTop: 1,
    },

    // ── 2. AUDI RS COCKPIT STYLES ────────────────────────────────────────────
    audiRsRoot: {
        borderRadius: radii.lg,
        paddingVertical: spacing[1],
        marginBottom: spacing[2],
    },
    audiBoomerangWrap: {
        position: 'relative',
        alignItems: 'center',
        marginBottom: spacing[1],
    },
    rsRpmPill: {
        position: 'absolute',
        right: layout.screenPaddingH,
        top: 2,
        backgroundColor: 'rgba(255, 42, 42, 0.15)',
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: 'rgba(255, 42, 42, 0.4)',
    },
    rsRpmPillText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
    },
    rsCenterGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing[2],
        marginVertical: spacing[2],
    },
    rsSpeedCol: {
        flex: 1,
    },
    rsBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: 2,
    },
    rsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 42, 42, 0.2)',
        paddingHorizontal: spacing[2],
        paddingVertical: 3,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: '#ff2a2a',
        gap: 5,
    },
    rsBadgeSquare: {
        width: 7,
        height: 7,
        backgroundColor: '#ff2a2a',
    },
    rsBadgeText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.8,
    },
    rsGearBox: {
        backgroundColor: '#ff2a2a',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: radii.xs,
    },
    rsGearText: {
        color: '#ffffff',
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
    },
    rsSpeedWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    rsSpeedNum: {
        fontSize: 76,
        fontWeight: typography.weights.heavy,
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
        lineHeight: 80,
    },
    rsSpeedUnit: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        textTransform: 'uppercase',
    },
    rsGCol: {
        alignItems: 'center',
    },
    rsGBox: {
        backgroundColor: '#120b0f',
        borderRadius: radii.md,
        padding: spacing[2],
        borderWidth: 1,
        borderColor: '#2e1a22',
        alignItems: 'center',
    },
    rsGTitle: {
        fontSize: 8,
        fontWeight: typography.weights.heavy,
        color: '#ff2a2a',
        letterSpacing: 0.8,
        marginBottom: 3,
    },
    rsGSvg: {
        marginVertical: 2,
    },
    rsGVal: {
        fontSize: 10,
        fontWeight: typography.weights.heavy,
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
    },
    rsPerfRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderRadius: radii.md,
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        borderWidth: 1,
        marginTop: spacing[2],
    },
    rsPerfItem: {
        flex: 1,
        alignItems: 'center',
    },
    rsPerfLabel: {
        fontSize: 8,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    rsPerfVal: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    rsPerfDivider: {
        width: 1,
        height: 20,
        backgroundColor: colors.border.subtle,
    },

    // ── 3. TESLA MINIMAL COCKPIT STYLES ──────────────────────────────────────
    teslaRoot: {
        alignItems: 'center',
        paddingVertical: spacing[1],
        marginBottom: spacing[2],
    },
    teslaHorizonWrap: {
        width: '100%',
        marginBottom: spacing[2],
    },
    teslaHorizonTrack: {
        width: '100%',
        height: 6,
        backgroundColor: '#121926',
        borderRadius: radii.full,
        position: 'relative',
        overflow: 'hidden',
    },
    teslaHorizonCenter: {
        position: 'absolute',
        left: '50%',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: '#334155',
        zIndex: 2,
    },
    teslaHorizonFillPower: {
        position: 'absolute',
        left: '50%',
        top: 0,
        bottom: 0,
        backgroundColor: '#38bdf8',
        borderRadius: radii.full,
    },
    teslaHorizonFillRegen: {
        position: 'absolute',
        right: '50%',
        top: 0,
        bottom: 0,
        backgroundColor: '#10b981',
        borderRadius: radii.full,
    },
    teslaHorizonLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 3,
        paddingHorizontal: 2,
    },
    teslaHorizonLbl: {
        fontSize: 8,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.5,
    },
    teslaDriveSelector: {
        flexDirection: 'row',
        gap: spacing[4],
        marginBottom: spacing[1],
    },
    teslaDriveModeText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: colors.text.disabled,
    },
    teslaDriveModeActive: {
        color: '#38bdf8',
        fontWeight: typography.weights.heavy,
    },
    teslaSpeedWrap: {
        alignItems: 'center',
        marginVertical: spacing[1],
    },
    teslaSpeedNum: {
        fontSize: 88,
        fontWeight: '700',
        color: '#f8fafc',
        fontVariant: ['tabular-nums'],
        lineHeight: 90,
    },
    teslaSpeedUnit: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginTop: -4,
    },
    teslaCardsRow: {
        flexDirection: 'row',
        gap: spacing[2],
        width: '100%',
        marginTop: spacing[2],
    },
    teslaCard: {
        flex: 1,
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        alignItems: 'center',
    },
    teslaCardLabel: {
        fontSize: 8,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 0.6,
        marginBottom: 4,
    },
    teslaCardVal: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    teslaCardUnit: {
        fontSize: 9,
        color: colors.text.secondary,
    },
    teslaCardSub: {
        fontSize: 9,
        color: colors.text.tertiary,
        marginTop: 2,
    },

    // ── 4. NIGHT HUD COCKPIT STYLES ──────────────────────────────────────────
    hudRoot: {
        backgroundColor: '#000000',
        paddingVertical: spacing[2],
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    hudRpmWrap: {
        width: '100%',
        marginBottom: spacing[3],
    },
    hudRpmTrack: {
        width: '100%',
        height: 14,
        backgroundColor: '#1a0505',
        borderRadius: radii.full,
        position: 'relative',
        overflow: 'hidden',
    },
    hudRpmFill: {
        height: '100%',
        backgroundColor: '#ff453a',
        borderRadius: radii.full,
    },
    hudRedlineMarker: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        backgroundColor: 'rgba(255, 69, 58, 0.4)',
        borderLeftWidth: 2,
        borderLeftColor: '#ffffff',
    },
    hudRpmMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingHorizontal: 2,
    },
    hudRpmText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        color: '#ff453a',
        fontVariant: ['tabular-nums'],
    },
    hudRedlineText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: '#ff9f0a',
    },
    hudCenterWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: spacing[4],
        marginVertical: spacing[2],
    },
    hudSpeedNum: {
        fontSize: 115,
        fontWeight: typography.weights.heavy,
        color: '#ff453a',
        fontVariant: ['tabular-nums'],
        lineHeight: 118,
    },
    hudGearNum: {
        fontSize: 64,
        fontWeight: typography.weights.heavy,
        color: '#ff9f0a',
    },
    hudBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: spacing[3],
        paddingVertical: spacing[2],
    },
    hudMetricItem: {
        alignItems: 'center',
    },
    hudMetricLbl: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: '#8e8e93',
        letterSpacing: 1,
        marginBottom: 2,
    },
    hudMetricVal: {
        fontSize: 28,
        fontWeight: typography.weights.heavy,
        color: '#ff453a',
        fontVariant: ['tabular-nums'],
    },
    hudMirrorHint: {
        marginTop: spacing[3],
        fontSize: typography.sizes.micro,
        color: '#636366',
        textAlign: 'center',
    },

    // ── Alerts modal ─────────────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: spacing[5] },
    modalBox: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[4],
    },
    modalHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.bg[2],
        paddingBottom: spacing[3],
        marginBottom: spacing[3],
    },
    modalTitle: { color: colors.text.primary, fontSize: typography.sizes.title3, fontWeight: typography.weights.bold },
    modalClose: {
        backgroundColor: colors.bg[2],
        width: 30, height: 30,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noAlerts: {
        color: colors.status.good,
        textAlign: 'center',
        padding: spacing[5],
        fontSize: typography.sizes.body1,
    },
    alertRow: {
        backgroundColor: colors.bg[2],
        borderLeftWidth: 3,
        borderLeftColor: colors.status.critical,
        padding: spacing[3],
        borderRadius: radii.xs,
        marginBottom: spacing[2],
    },
    alertRowTitle: { color: colors.status.critical, fontWeight: typography.weights.bold, fontSize: typography.sizes.label1 },
    alertRowSub:   { color: colors.text.secondary,  fontSize: typography.sizes.caption,  marginTop: 2 },

    // ─── SENSOR TELEMETRY INSPECTOR & TOLERANCE RULER STYLES ─────────────────
    rulerContainer: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
    },
    rulerHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    rulerBoundLabel: {
        fontSize: 10,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
    },
    rulerOptimalBadge: {
        fontSize: 10,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    rulerTrack: {
        height: 10,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        position: 'relative',
        overflow: 'visible',
        justifyContent: 'center',
        marginVertical: 4,
    },
    rulerNominalZone: {
        position: 'absolute',
        height: '100%',
        backgroundColor: 'rgba(16, 185, 129, 0.35)',
        borderLeftWidth: 1.5,
        borderRightWidth: 1.5,
        borderColor: '#10b981',
        borderRadius: 2,
    },
    rulerMarker: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        top: -2,
        marginLeft: -7,
        elevation: 4,
        shadowColor: '#000000',
        shadowOpacity: 0.5,
        shadowRadius: 3,
    },
    rulerTicksRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing[1],
    },
    rulerTickText: {
        fontSize: 9,
        color: colors.text.tertiary ?? '#525d7a',
    },

    inspectorScroll: {
        maxHeight: 520,
    },
    inspectorContent: {
        paddingBottom: spacing[5],
    },
    inspectorHeadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    inspectorCategoryPill: {
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1],
        borderRadius: radii.full,
        backgroundColor: colors.bg[2],
        borderWidth: 1,
        borderColor: colors.border.subtle ?? colors.bg[2],
    },
    inspectorCategoryText: {
        fontSize: 10,
        fontWeight: typography.weights.heavy,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },
    inspectorOriginPill: {
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1],
        borderRadius: radii.full,
        borderWidth: 1,
    },
    originVirtual: {
        backgroundColor: 'rgba(0, 240, 255, 0.12)',
        borderColor: '#00f0ff',
    },
    originPhysical: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: '#10b981',
    },
    inspectorOriginText: {
        fontSize: 10,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    inspectorTitle: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        marginBottom: spacing[3],
    },
    inspectorHeroCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1.5,
        marginBottom: spacing[3],
    },
    inspectorHeroValRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    inspectorHeroVal: {
        fontSize: 32,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    inspectorHeroUnit: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
    },
    inspectorStatusBadge: {
        paddingHorizontal: spacing[2] + 4,
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.sm,
        borderWidth: 1,
    },
    inspectorStatusText: {
        fontSize: 10,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.4,
    },
    inspectorRangeSub: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: spacing[2],
    },

    sparkCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
    },
    sparkCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    sparkCardTitle: {
        fontSize: 10,
        color: colors.text.secondary,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.7,
    },
    sparkCardMeta: {
        fontSize: 10,
        color: colors.text.tertiary ?? '#525d7a',
        fontVariant: ['tabular-nums'],
    },
    sparkSvgWrap: {
        height: 72,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginVertical: spacing[1],
    },
    sparkStatsGrid: {
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[2],
    },
    sparkStatCell: {
        flex: 1,
        backgroundColor: colors.bg[0],
        borderRadius: radii.xs,
        padding: spacing[1] + 2,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.subtle ?? colors.bg[2],
    },
    sparkStatLabel: {
        fontSize: 8,
        color: colors.text.secondary,
        fontWeight: typography.weights.heavy,
        marginBottom: 2,
    },
    sparkStatVal: {
        fontSize: 11,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    sparkEmptyWrap: {
        paddingVertical: spacing[3],
        alignItems: 'center',
    },
    sparkEmptyText: {
        fontSize: 11,
        color: colors.text.secondary,
        fontStyle: 'italic',
        textAlign: 'center',
    },

    infoCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
    },
    infoCardHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[1] + 2,
    },
    infoCardIcon: {
        fontSize: 16,
    },
    infoCardTitle: {
        fontSize: 10,
        color: colors.text.secondary,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.7,
    },
    infoCardBody: {
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        lineHeight: 20,
    },
    symptomsBox: {
        marginTop: spacing[2],
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderRadius: radii.xs,
        padding: spacing[2],
        borderLeftWidth: 3,
        borderLeftColor: colors.status.critical,
    },
    symptomsTitle: {
        fontSize: 11,
        fontWeight: typography.weights.bold,
        color: colors.status.caution,
        marginBottom: 2,
    },
    symptomsText: {
        fontSize: 11,
        color: colors.text.primary,
        lineHeight: 17,
    },
    formulaBox: {
        backgroundColor: colors.bg[0],
        borderRadius: radii.xs,
        padding: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.subtle ?? colors.bg[2],
        marginTop: spacing[1],
    },
    formulaText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: colors.accent.default,
        fontWeight: 'bold',
    },

    actionButtonsWrap: {
        gap: spacing[2],
        marginTop: spacing[1],
    },
    scopeActionBtn: {
        backgroundColor: 'rgba(0, 240, 255, 0.12)',
        borderColor: '#00f0ff',
        borderWidth: 1.5,
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        alignItems: 'center',
        justifyContent: 'center',
    },
    scopeActionBtnText: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: '#00f0ff',
        letterSpacing: 0.5,
    },
    aiActionBtn: {
        backgroundColor: '#6366f1',
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6366f1',
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 4,
    },
    aiActionBtnText: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: '#ffffff',
        letterSpacing: 0.5,
    },

    // ── Fullscreen Landscape HUD ──────────────────────────────────────────────
    hudLaunchBtn: {
        backgroundColor: 'rgba(0, 240, 255, 0.12)',
        borderWidth: 1,
        borderColor: '#00f0ff',
        paddingHorizontal: spacing[2] + 4,
        paddingVertical: spacing[1] + 1,
        borderRadius: radii.full,
        marginRight: spacing[2],
    },
    hudLaunchBtnText: {
        color: '#00f0ff',
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
    },
});

export default LiveDashboardScreen;
