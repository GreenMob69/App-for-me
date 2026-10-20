import { useContext, useMemo, useRef } from 'react';
import { LiveContext } from '../context/LiveContext';
import { AppContext } from '../context/AppContext';
import { safeNum, safeFmt } from '../utils/safeMath';

/**
 * useNormalizedTelemetry
 * Adapter arhitectural unic (Single Source of Truth) care garanteaza ca
 * toate cele 5 stiluri vizuale (Classic, Nothing, Audi '96, F1, Spatial 3D)
 * primesc date curate, sigure (fara null-pointer exceptions) si normalizate,
 * indiferent daca datele vin prin MQTT real, socket sau simulator.
 */
export function useNormalizedTelemetry(_isLiveViewActive = true) {
  const liveCtx = useContext(LiveContext) || {};
  const appCtx = useContext(AppContext) || {};
  const lastTelemetryRef = useRef(null);

  const {
    liveData = {},
    isConnected = false,
    isReconnecting = false,
    getChartHistory,
  } = liveCtx;

  const {
    openSimulatorModal,
    uiParadigm,
    setUiParadigm,
  } = appCtx;

  return useMemo(() => {
    const data = liveData || {};
    const motor = data.motor || {};
    const gps = data.gps || {};
    const d = data.dinamica || {};
    const t = data.temperaturi || {};
    const a = data.aer || {};
    const p = data.presiuni || {};
    const e = data.electric || {};
    const bat = data.baterie || {};
    const c = data.combustibil || {};
    const trans = data.transmisie || {};
    const acc = data.accelerometru || {};
    const v = data.virtual || {};

    // ── 1. DINAMICĂ & VITEZĂ (EXTRAGERE DEFENSIVĂ MULTI-CANAL) ─────────────────
    const rawSpeed = motor.speed ?? gps.speed_kmh ?? data.viteza_kmh ?? d.viteza ?? data.speed ?? 0;
    const speed = Math.max(0, Math.round(safeNum(rawSpeed, 0)));

    const rawRpm = motor.rpm ?? data.rpm ?? d.turatie ?? 0;
    const rpm = Math.max(0, Math.round(safeNum(rawRpm, 0) / 5) * 5); // Cuantizat la multiplu de 5 RPM

    const rawThrottle = motor.throttle_pos ?? motor.load ?? data.throttle ?? data.sarcina_pct ?? d.acceleratie ?? 0;
    const throttle = Math.min(100, Math.max(0, Math.round(safeNum(rawThrottle, 0))));

    const rawLoad = motor.load ?? data.sarcina_pct ?? motor.throttle_pos ?? 0;
    const engineLoad = Math.min(100, Math.max(0, Math.round(safeNum(rawLoad, 0))));

    const rawGear = motor.treapta_viteza ?? trans.gear ?? data.gear ?? d.treapta_viteza;
    const gear = (rawGear !== undefined && rawGear !== null && rawGear !== '')
      ? String(rawGear)
      : (speed === 0 && rpm < 500 ? 'P' : rpm < 1000 && speed === 0 ? 'N' : 'D');

    // ── 2. TEMPERATURI ROTUNJITE LA 0.1°C ────────────────────────────────────
    const rawCoolant = t.coolant ?? t.antigel ?? data.temp_apa_c ?? d.temp_apa ?? 90;
    const coolantTemp = Math.round(safeNum(rawCoolant, 90) * 10) / 10;

    const rawOil = t.oil ?? t.ulei ?? data.temp_ulei_c ?? 92;
    const oilTemp = Math.round(safeNum(rawOil, 92) * 10) / 10;

    const rawExhaust = t.cat1 ?? t.cat2 ?? t.evacuare ?? t.egt ?? data.dpf?.egt1 ?? 420;
    const exhaustTemp = Math.round(safeNum(rawExhaust, 420) * 10) / 10;

    const rawIntake = t.admisie ?? t.ambient ?? data.temperaturi?.ambient ?? 24;
    const intakeTemp = Math.round(safeNum(rawIntake, 24) * 10) / 10;

    const chraTemp = Math.round((v.chraCoreTempC || (exhaustTemp * 0.72)) * 10) / 10;

    // ── 3. PRESIUNI (BAR) ROTUNJITE LA 0.01 BAR / 5 BAR RAIL ─────────────────
    const boostRaw = a.boost_actual ?? data.boost_bar ?? p.turbo_boost ?? p.boost ?? v.boostBar ?? 0.85;
    const boost = Math.round(safeNum(boostRaw, 0.85) * 100) / 100;

    const rawRail = c.rail_press_bar ?? p.rail_bar ?? p.rampa ?? 780;
    const railPressure = Math.round(safeNum(rawRail, 780) / 5) * 5;

    const rawOilPress = p.ulei_bar ?? v.oilPressureBar ?? 3.4;
    const oilPressure = Math.round(safeNum(rawOilPress, 3.4) * 10) / 10;

    // ── 4. ELECTRICITATE ROTUNJITĂ LA 0.01V ──────────────────────────────────
    const rawVolt = bat.ecu_volt ?? bat.bat_volt ?? data.voltaj_v ?? e.tensiune ?? 14.1;
    const batteryVoltage = Math.round(safeNum(rawVolt, 14.1) * 100) / 100;
    const batterySoH = Math.round(safeNum(v.batterySoH, 92));

    // ── 5. COMBUSTIBIL & CONSUM ──────────────────────────────────────────────
    const fuelLevel = Math.round(c.nivel_litri ? (safeNum(c.nivel_litri) / 70) * 100 : safeNum(c.procent, 68));
    const rawFuelRate = c.inst_cons ?? data.consum_lh ?? c.consum_instant ?? (speed > 10 ? 5.8 : 0.8);
    const fuelRate = Math.round(safeNum(rawFuelRate, 5.8) * 10) / 10;
    const fuelBurnedLiters = Math.round(safeNum(v.fuelBurnedLiters || c.litri_consumati, 1.45) * 100) / 100;

    // ── 6. FRÂNE & DINAMICĂ G-FORCE ──────────────────────────────────────────
    const brakeFluidTemp = Math.round(safeNum(v.brakeFluidTempC, 85) * 10) / 10;
    const brakeEnergyTrip = Math.round(safeNum(v.brakeEnergyJoulesTrip, 0) / 1000); // kJ
    const gForceLat = Math.round(safeNum(v.gForceLateral ?? acc.accel_y, 0.0) * 50) / 50; // Pas de 0.02G
    const gForceLong = Math.round(safeNum(motor.accel_g ?? acc.accel_x ?? data.accel_g ?? v.gForceLongitudinal, 0.0) * 50) / 50; // Pas de 0.02G

    // ── 7. PUTERE & CUPLU VIRTUAL ────────────────────────────────────────────
    const powerHp = Math.round(safeNum(v.powerHp ?? v.saeCorrectedPowerHp, (rpm > 500 && throttle > 0) ? ((rpm * throttle) / 100) * 0.035 : 0));
    const torqueNm = Math.round(safeNum(v.torqueNm ?? motor.torque_actual ?? data.torque_nm, (throttle > 0) ? (throttle / 100) * 310 : 0));

    // ── 8. RUL & FIABILITATE WEIBULL ─────────────────────────────────────────
    const weibullRul = v.weibullRulMatrix || {
      oil: 3660,
      dpf: 58650,
      turbo: 25000,
      brakes: 18380,
      battery: 11530,
    };
    const minRulKm = Math.min(...Object.values(weibullRul));
    const breakdownRisk = Math.round(v.roadsideBreakdownRiskPct || 12);
    const b2bRoi = Math.round(v.b2bEconomicRoiEuro || 1689);

    // ── 9. BALANȚĂ SANKEY ────────────────────────────────────────────────────
    const sankey = v.sankeyEnergyBalance || {
      mechanicalPct: 36.5,
      exhaustHeatPct: 18.3,
      coolingFrictionPct: 45.2,
    };

    // ── 10. ALERTE CRITICE ───────────────────────────────────────────────────
    const criticalAlerts = [];
    if (v.dieselRunawayRisk) {
      criticalAlerts.push({
        id: 'RUNAWAY',
        title: 'PERICOL AUTOTURARE ULEI',
        desc: 'Calează forțat motorul prin frână și treapta a 5-a!',
        severity: 'CRITICAL',
      });
    }
    if (v.mountainBrakeFadeRisk) {
      criticalAlerts.push({
        id: 'BRAKE_FADE',
        title: 'FIERBERE LICHID FRÂNĂ',
        desc: `Temp: ${brakeFluidTemp}°C. Folosește frâna de motor!`,
        severity: 'HIGH',
      });
    }
    if (v.roadGripStatus === 'BLACK_ICE_GRIP_LOSS_WARNING') {
      criticalAlerts.push({
        id: 'BLACK_ICE',
        title: 'POLEI DETECTAT (BLACK ICE)',
        desc: 'Diferență viteză roți la 0°C. Atenție la aderență!',
        severity: 'HIGH',
      });
    }
    if (coolantTemp > 105) {
      criticalAlerts.push({
        id: 'OVERHEAT',
        title: 'SUPRAÎNCĂLZIRE MOTOR',
        desc: `Lichid răcire la ${coolantTemp}°C!`,
        severity: 'HIGH',
      });
    }

    // ── DEADBAND CHECK: Dacă valorile cuantizate sunt identice cu frame-ul anterior,
    // returnăm exact aceeași referință de obiect (0 re-randări în arborele React).
    if (lastTelemetryRef.current) {
      const prev = lastTelemetryRef.current;
      const isDeadbandEqual =
        prev.speed === speed &&
        prev.rpm === rpm &&
        prev.gear === gear &&
        prev.throttle === throttle &&
        prev.engineLoad === engineLoad &&
        prev.powerHp === powerHp &&
        prev.torqueNm === torqueNm &&
        prev.coolantTemp === coolantTemp &&
        prev.oilTemp === oilTemp &&
        prev.exhaustTemp === exhaustTemp &&
        prev.boost === boost &&
        prev.railPressure === railPressure &&
        prev.oilPressure === oilPressure &&
        prev.batteryVoltage === batteryVoltage &&
        prev.fuelLevel === fuelLevel &&
        prev.fuelRate === fuelRate &&
        prev.brakeFluidTemp === brakeFluidTemp &&
        prev.gForceLat === gForceLat &&
        prev.gForceLong === gForceLong &&
        prev.isConnected === isConnected &&
        prev.isReconnecting === isReconnecting &&
        prev.uiParadigm === uiParadigm &&
        prev.criticalAlerts.length === criticalAlerts.length;

      if (isDeadbandEqual) {
        return lastTelemetryRef.current;
      }
    }

    // Cilindri 5 cilindri Audi (1-2-4-5-3)
    const cylinderBal = v.cylinderBalancing || [0.1, -0.2, 0.4, -0.3, 0.0];
    const firingIndex = (Math.floor(Date.now() / 250) % 5);
    const firingOrder = [1, 2, 4, 5, 3];
    const activeCylinder = firingOrder[firingIndex];

    const result = {
      // Dinamica
      speed,
      rpm,
      gear,
      throttle,
      engineLoad,
      powerHp,
      torqueNm,
      // Termic
      coolantTemp,
      oilTemp,
      exhaustTemp,
      intakeTemp,
      chraTemp,
      chraCooldownSec: Math.max(0, Math.round(v.turboCooldownSecNeeded || (chraTemp > 280 ? (chraTemp - 200) / 2 : 0))),
      // Presiuni
      boost,
      railPressure,
      oilPressure,
      // Electric
      batteryVoltage,
      batterySoH,
      // Combustibil
      fuelLevel,
      fuelRate,
      fuelBurnedLiters,
      // Frâne & G-Force
      brakeFluidTemp,
      brakeEnergyTrip,
      gForceLat,
      gForceLong,
      // RUL & Fiabilitate
      weibullRul,
      minRulKm,
      breakdownRisk,
      b2bRoi,
      sankey,
      // Stari & Alerte
      criticalAlerts,
      isSteadyState: v.isSteadyState ?? true,
      steadyConfidence: Math.round(v.steadyConfidencePct ?? 94),
      cylinderBal,
      activeCylinder,
      engineState: data.stare_motor || (rpm === 0 ? 'OPRIRE' : speed > 0 ? 'MERS' : 'RALANTI'),
      // Conectivitate & Simulator
      isConnected,
      isReconnecting,
      hasValidData: Boolean(liveData && Object.keys(liveData).length > 0),
      openSimulator: openSimulatorModal || (() => {}),
      uiParadigm,
      setUiParadigm,
      getChartHistory: getChartHistory || (() => []),
    };
    lastTelemetryRef.current = result;
    return result;
  }, [liveData, isConnected, isReconnecting, openSimulatorModal, uiParadigm, setUiParadigm, getChartHistory]);
}
