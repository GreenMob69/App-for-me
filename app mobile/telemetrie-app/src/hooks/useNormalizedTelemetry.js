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
 * 
 * @param {boolean} [isLiveViewActive=true] - Cand este false, ingheata re-randarile la 1Hz/60FPS
 * ale ceasurilor statice, pastrand in fundal doar verificarea alertelor critice.
 */
export function useNormalizedTelemetry(isLiveViewActive = true) {
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
    // Daca vizualizarea Live nu este activa (ex: utilizatorul este pe Curse, Service, Sentry sau AI),
    // si avem deja un snapshot precedent, inghetam valorile numerice pentru a preveni re-randarile parazite.
    if (!isLiveViewActive && lastTelemetryRef.current) {
      const v = (liveData && liveData.virtual) || {};
      const t = (liveData && liveData.temperaturi) || {};
      const coolant = Math.round(t.coolant || t.antigel || 90);
      const hasCritical = Boolean(v.dieselRunawayRisk || v.mountainBrakeFadeRisk || v.roadGripStatus === 'BLACK_ICE_GRIP_LOSS_WARNING' || coolant > 105);
      const prevHadCritical = lastTelemetryRef.current.criticalAlerts && lastTelemetryRef.current.criticalAlerts.length > 0;
      
      if (!hasCritical && !prevHadCritical) {
        return lastTelemetryRef.current;
      }
    }
    const data = liveData || {};
    const d = data.dinamica || {};
    const t = data.temperaturi || {};
    const p = data.presiuni || {};
    const e = data.electric || {};
    const c = data.combustibil || {};
    const v = data.virtual || {};

    const speed = Math.max(0, Math.round(d.viteza || 0));
    const rpm = Math.max(0, Math.round(d.turatie || 0));
    const throttle = Math.min(100, Math.max(0, Math.round(d.acceleratie || 0)));
    const gear = d.treapta_viteza ? String(d.treapta_viteza) : (speed === 0 && rpm < 500 ? 'P' : rpm < 1000 && speed === 0 ? 'N' : 'D');

    // Temperaturi (°C)
    const coolantTemp = Math.round(t.coolant || t.antigel || 90);
    const oilTemp = Math.round(t.ulei || 92);
    const exhaustTemp = Math.round(t.evacuare || t.egt || 420);
    const intakeTemp = Math.round(t.admisie || 24);
    const chraTemp = Math.round(v.chraCoreTempC || (exhaustTemp * 0.72));

    // Presiuni (bar)
    const boostRaw = p.turbo_boost ?? p.boost ?? 0.85;
    const boost = safeNum(parseFloat(safeFmt(boostRaw, 2, '0.85')), 0.85);
    const railPressure = Math.round(safeNum(p.rail_bar ?? p.rampa, 780));
    const oilPressure = safeNum(parseFloat(safeFmt(p.ulei_bar, 1, '3.4')), 3.4);

    // Electricitate
    const batteryVoltage = safeNum(parseFloat(safeFmt(e.tensiune, 1, '14.1')), 14.1);
    const batterySoH = Math.round(safeNum(v.batterySoH, 92));

    // Combustibil & Consum
    const fuelLevel = Math.round(c.nivel_litri ? (safeNum(c.nivel_litri) / 70) * 100 : safeNum(c.procent, 68));
    const fuelRate = safeNum(parseFloat(safeFmt(c.consum_instant ?? (speed > 10 ? 5.8 : 0.8), 1, '5.8')), 5.8);
    const fuelBurnedLiters = safeNum(parseFloat(safeFmt(v.fuelBurnedLiters || c.litri_consumati, 2, '1.45')), 1.45);

    // Frâne & Dinamică
    const brakeFluidTemp = Math.round(safeNum(v.brakeFluidTempC, 85));
    const brakeEnergyTrip = Math.round(safeNum(v.brakeEnergyJoulesTrip, 0) / 1000); // kJ
    const gForceLat = safeNum(parseFloat(safeFmt(v.gForceLateral, 2, '0.00')), 0.0);
    const gForceLong = safeNum(parseFloat(safeFmt(v.gForceLongitudinal, 2, '0.00')), 0.0);

    // RUL & Fiabilitate Weibull
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

    // Balanță Sankey
    const sankey = v.sankeyEnergyBalance || {
      mechanicalPct: 36.5,
      exhaustHeatPct: 18.3,
      coolingFrictionPct: 45.2,
    };

    // Alerte critice
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
  }, [liveData, isConnected, isReconnecting, openSimulatorModal, uiParadigm, setUiParadigm, getChartHistory, isLiveViewActive]);
}
