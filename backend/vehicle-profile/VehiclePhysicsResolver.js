'use strict';

/**
 * VehiclePhysicsResolver.js
 * --------------------------------------------------------------------------
 * Motor universal de rezoluție fizică și calibrare dinamică a pragurilor.
 * 
 * Calculează parametrii fizici reali pentru ORICE mașină:
 *   1. Masă & Inerție (massKg) -> Virtual Dyno, Forță tracțiune, Disipare Frâne
 *   2. Dimensiuni & Aerodinamică (Lățime, Înălțime, Cd, Suprafață Frontală A) -> Rezistență Aerodinamică
 *   3. Cauciucuri & Roți (Lățime, Raport Înălțime/Talon, Diametru Jantă) -> Rază Dinamică Roată sub sarcină & Crr
 *   4. Praguri Termice Specifice (Diesel 82-93°C vs Benzină 88-103°C vs EV/HV)
 *   5. Praguri Dinamice de Turație & Redline (Diesel 4800 vs Benzină 6500+ vs EV)
 * --------------------------------------------------------------------------
 */

const { deriveCapabilities } = require('../capabilities/VehicleCapabilities');
const { deriveProfile } = require('../powertrain/PowertrainProfileRegistry');

/**
 * Parsează specificația anvelopei (ex: "225/50 R18", "205/55 R16", "235/45R19", "195/65 R15")
 * Returnează raza dinamică de rulare în metri și coeficientul de rezistență la rulare.
 */
function parseTireSpec(spec) {
    if (!spec || typeof spec !== 'string') {
        return {
            valid: false,
            rawSpec: spec || '205/55 R16',
            widthMm: 205,
            aspectRatio: 55,
            rimInch: 16,
            wheelRadiusM: 0.316,
            crr: 0.013, // coeficient mediu de rulare
        };
    }

    const clean = spec.toUpperCase().trim();
    const match = clean.match(/(\d{3})\s*\/\s*(\d{2})\s*(?:R|ZR)?\s*(\d{2})/);

    if (!match) {
        return {
            valid: false,
            rawSpec: spec,
            widthMm: 205,
            aspectRatio: 55,
            rimInch: 16,
            wheelRadiusM: 0.316,
            crr: 0.013,
        };
    }

    const widthMm     = parseInt(match[1], 10);
    const aspectRatio = parseInt(match[2], 10);
    const rimInch     = parseInt(match[3], 10);

    // Înălțime flanc anvelopă (sidewall)
    const sidewallMm = widthMm * (aspectRatio / 100);
    // Diametru jantă în mm
    const rimMm = rimInch * 25.4;
    // Diametru exterior total teoretic
    const outerDiameterMm = rimMm + (2 * sidewallMm);

    // Raza dinamică sub sarcină (deformație verticală normală pneu de ~3%)
    const wheelRadiusM = Number(((outerDiameterMm / 2) * 0.97 * 0.001).toFixed(4));

    // Coeficient rezistență la rulare pneu (anvelope mai late au Crr ușor mai mare)
    const crr = widthMm >= 235 ? 0.014 : widthMm <= 195 ? 0.011 : 0.013;

    return {
        valid: true,
        rawSpec: `${widthMm}/${aspectRatio} R${rimInch}`,
        widthMm,
        aspectRatio,
        rimInch,
        wheelRadiusM,
        crr,
    };
}

/**
 * Detectează tipul de caroserie din denumirea modelului / variantei
 */
function detectBodyType(model = '', variant = '') {
    const text = `${model} ${variant}`.toUpperCase();

    if (/CDX|RDX|MDX|Q3|Q5|Q7|X1|X3|X4|X5|X6|X7|TIGUAN|TOUAREG|DUSTER|RAV4|CR-V|CRV|KUGA|SPORTAGE|TUCSON|GLC|GLE|GLA|KODIAQ|KAROQ|ATECA|CROSSOVER|SUV/.test(text)) {
        return 'SUV';
    }
    if (/GOLF|POLO|A3|1 SERIES|SERIA 1|FOCUS|FIESTA|CLIO|MEGANE|CIVIC|COROLLA|LEON|IBIZA|FABIA|YARIS|HATCHBACK|COMPACT/.test(text)) {
        return 'HATCHBACK';
    }
    if (/TT|Z4|MIATA|MX-5|MUSTANG|CAMARO|CORVETTE|COUPE|CABRIO|SLK|SLC|BRZ|GT86/.test(text)) {
        return 'COUPE';
    }
    if (/TRANSPORTER|VITO|VIANO|CADDY|KANGOO|BERLINGO|PARTNER|TOURAN|SHARAN|VAN|MPV/.test(text)) {
        return 'VAN';
    }
    return 'SEDAN';
}

/**
 * Calculează aerodinamica: Suprafață Frontală (A) și Coeficient Aerodinamic (Cd)
 */
function estimateAeroSpecs(widthMm, heightMm, bodyType, customCd) {
    let cd = customCd ? Number(customCd) : null;
    let frontalAreaM2 = null;

    if (widthMm && heightMm && !isNaN(widthMm) && !isNaN(heightMm)) {
        // Hucho automotive formula: A ≈ 0.84 × lățime × înălțime
        frontalAreaM2 = Number((0.84 * (widthMm / 1000) * (heightMm / 1000)).toFixed(3));
    }

    // Valori implicite calibrate pe clase de caroserie
    switch (bodyType) {
        case 'SUV':
            if (!cd) cd = 0.35;
            if (!frontalAreaM2) frontalAreaM2 = 2.45;
            break;
        case 'HATCHBACK':
            if (!cd) cd = 0.31;
            if (!frontalAreaM2) frontalAreaM2 = 2.10;
            break;
        case 'COUPE':
            if (!cd) cd = 0.27;
            if (!frontalAreaM2) frontalAreaM2 = 1.95;
            break;
        case 'VAN':
            if (!cd) cd = 0.40;
            if (!frontalAreaM2) frontalAreaM2 = 2.90;
            break;
        case 'SEDAN':
        default:
            if (!cd) cd = 0.29;
            if (!frontalAreaM2) frontalAreaM2 = 2.18;
            break;
    }

    return { cd, frontalAreaM2 };
}

/**
 * Rezolvă specificațiile fizice complete și pragurile dinamice pentru orice vehicul
 */
function resolveVehiclePhysics(vehicleRow = {}, fallbackVin = 'WAUZZZ4A1RN000000') {
    const v = vehicleRow || {};
    const vin = (v.vin || fallbackVin).toUpperCase();
    const model = v.model || 'Vehicul';
    const variant = v.variant || '';
    const bodyType = detectBodyType(model, variant);

    // 1. Capabilități & Profil Propulsie
    const capabilities = deriveCapabilities(v);
    const powertrainProfile = deriveProfile(v, capabilities);

    // 2. Anvelope & Rază roată
    const tire = parseTireSpec(v.tire_spec);
    const wheelRadiusM = v.wheel_radius_m ? Number(v.wheel_radius_m) : tire.wheelRadiusM;
    const crr = tire.crr;

    // 3. Masă & Inerție
    let massKg = v.curb_weight_kg ? Number(v.curb_weight_kg) : null;
    if (!massKg || isNaN(massKg)) {
        // Estimare realistă pe clasă dacă nu a fost setată
        if (capabilities.isElectric) massKg = 1850;
        else if (capabilities.isHybrid) massKg = 1680;
        else if (bodyType === 'SUV') massKg = 1620;
        else if (bodyType === 'HATCHBACK') massKg = 1320;
        else if (bodyType === 'COUPE') massKg = 1420;
        else if (bodyType === 'VAN') massKg = 1950;
        else massKg = 1520; // Sedan default
    }

    // 4. Dimensiuni & Aerodinamică
    const widthMm  = v.width_mm ? Number(v.width_mm) : (bodyType === 'SUV' ? 1840 : bodyType === 'HATCHBACK' ? 1790 : 1820);
    const heightMm = v.height_mm ? Number(v.height_mm) : (bodyType === 'SUV' ? 1620 : bodyType === 'HATCHBACK' ? 1450 : 1460);
    const lengthMm = v.length_mm ? Number(v.length_mm) : (bodyType === 'SUV' ? 4500 : bodyType === 'HATCHBACK' ? 4300 : 4750);
    const aero = estimateAeroSpecs(widthMm, heightMm, bodyType, v.drag_coefficient);

    // 5. Motor (Cilindree, Cilindri)
    let displacementL = v.displacement_cc ? Number((v.displacement_cc / 1000).toFixed(3)) : null;
    let cylinders = v.cylinders ? Number(v.cylinders) : null;

    if (!displacementL) {
        displacementL = capabilities.isElectric ? 0.0 : capabilities.isDiesel ? 2.0 : 1.6;
    }
    if (!cylinders) {
        cylinders = capabilities.isElectric ? 0 : 4;
    }

    // 6. Praguri Dinamice (Turație & Termice)
    let redlineRpm = v.redline_rpm ? Number(v.redline_rpm) : null;
    let idleRpm    = v.idle_rpm ? Number(v.idle_rpm) : null;
    let highRpmThreshold = null;

    let operatingTempMin = v.operating_temp_min ? Number(v.operating_temp_min) : null;
    let operatingTempMax = v.operating_temp_max ? Number(v.operating_temp_max) : null;
    let warningTemp = null;
    let criticalTemp = null;
    let nominalBoostBar = v.nominal_boost_bar !== undefined ? Number(v.nominal_boost_bar) : null;

    if (capabilities.isDiesel) {
        if (!idleRpm) idleRpm = 800;
        if (!redlineRpm) redlineRpm = 4800;
        highRpmThreshold = 3500;

        if (!operatingTempMin) operatingTempMin = 82;
        if (!operatingTempMax) operatingTempMax = 93;
        warningTemp = 98;
        criticalTemp = 105;

        if (nominalBoostBar === null) nominalBoostBar = capabilities.hasTurbo ? 1.35 : 0.0;
    } else if (capabilities.isPetrol) {
        if (!idleRpm) idleRpm = 750;
        if (!redlineRpm) redlineRpm = 6500;
        highRpmThreshold = 5000;

        // La benzină modernă temperatura optimă ajunge confortabil la 100-103°C
        if (!operatingTempMin) operatingTempMin = 88;
        if (!operatingTempMax) operatingTempMax = 103;
        warningTemp = 108;
        criticalTemp = 114;

        if (nominalBoostBar === null) nominalBoostBar = capabilities.hasTurbo ? 0.95 : 0.0;
    } else if (capabilities.isElectric) {
        if (!idleRpm) idleRpm = 0;
        if (!redlineRpm) redlineRpm = 16000;
        highRpmThreshold = 12000;

        // Temperaturi pachet baterie HV
        if (!operatingTempMin) operatingTempMin = 20;
        if (!operatingTempMax) operatingTempMax = 38;
        warningTemp = 48;
        criticalTemp = 58;

        nominalBoostBar = 0.0;
    } else {
        // Hibrid
        if (!idleRpm) idleRpm = 800;
        if (!redlineRpm) redlineRpm = 6200;
        highRpmThreshold = 4800;

        if (!operatingTempMin) operatingTempMin = 82;
        if (!operatingTempMax) operatingTempMax = 98;
        warningTemp = 103;
        criticalTemp = 110;

        if (nominalBoostBar === null) nominalBoostBar = capabilities.hasTurbo ? 0.85 : 0.0;
    }

    return {
        vin,
        model,
        variant,
        bodyType,
        fuelType: (v.fuel_type || (capabilities.isDiesel ? 'diesel' : 'petrol')).toLowerCase(),
        capabilities,
        powertrainProfile,

        // Dimensiuni & Masă
        massKg,
        lengthMm,
        widthMm,
        heightMm,
        cd: aero.cd,
        frontalAreaM2: aero.frontalAreaM2,
        wheelRadiusM,
        crr,
        tire,

        // Motorizare
        cylinders,
        displacementL,

        // Praguri de funcționare
        thresholds: {
            idleRpm,
            redlineRpm,
            highRpmThreshold,
            operatingTempMin,
            operatingTempMax,
            warningTemp,
            criticalTemp,
            nominalBoostBar,
            overspeedKmh: 130,
        },
    };
}

module.exports = {
    parseTireSpec,
    detectBodyType,
    estimateAeroSpecs,
    resolveVehiclePhysics,
};
