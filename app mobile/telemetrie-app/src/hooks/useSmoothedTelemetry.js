import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * useSmoothedTelemetry — 60 FPS Interpolator pentru pachetele de telemetrie de 1Hz
 * ---------------------------------------------------------------------------------
 * Transformă salturile bruște de 1 secundă în tranziții fluide la 60 cadre/secundă,
 * eliminând complet sacadarea acelor și a indicatoarelor digitale.
 */
export function useSmoothedTelemetry(liveData, enabled = true) {
    // ── Animated values pentru randare fluidă la 60 FPS ───────────────────────
    const animRpm     = useRef(new Animated.Value(0)).current;
    const animSpeed   = useRef(new Animated.Value(0)).current;
    const animPowerHp = useRef(new Animated.Value(0)).current;
    const animBoost   = useRef(new Animated.Value(0)).current;
    const animTargetBoost = useRef(new Animated.Value(0)).current;
    const animLoad    = useRef(new Animated.Value(0)).current;
    const animCoolant = useRef(new Animated.Value(70)).current;

    // ── Stare cu valori numerice netede pentru etichete text ───────────────────
    const [smoothNumbers, setSmoothNumbers] = useState({
        rpm: 0,
        speed: 0,
        powerHp: 0,
        boost: 0,
        targetBoost: 0,
        load: 0,
        coolant: 70
    });

    useEffect(() => {
        if (!liveData) return;

        const targetRpm     = Number(liveData.motor?.rpm || 0);
        const targetSpeed   = Number(liveData.motor?.speed || 0);
        const targetPowerHp = Number(liveData.virtual?.powerHp || (liveData.motor?.load ? liveData.motor.load * 1.3 : 0));
        const targetBoost   = Number(liveData.aer?.boost_actual ?? ((liveData.aer?.map ? liveData.aer.map - 101 : 0) / 100));
        const targetCmdBoost= Number(liveData.aer?.boost_cmd ?? ((liveData.aer?.map_cmd ? liveData.aer.map_cmd - 101 : 0) / 100));
        const targetLoad    = Number(liveData.motor?.load || 0);
        const targetCoolant = Number(liveData.temperaturi?.coolant || 88);

        // Optimizare de fundal: dacă ecranul este în background sau pe tab static, oprim bucla 60FPS
        if (!enabled) {
            animRpm.setValue(targetRpm);
            animSpeed.setValue(targetSpeed);
            animPowerHp.setValue(targetPowerHp);
            animBoost.setValue(targetBoost);
            animTargetBoost.setValue(targetCmdBoost);
            animLoad.setValue(targetLoad);
            animCoolant.setValue(targetCoolant);
            setSmoothNumbers({
                rpm: targetRpm,
                speed: targetSpeed,
                powerHp: targetPowerHp,
                boost: targetBoost,
                targetBoost: targetCmdBoost,
                load: targetLoad,
                coolant: targetCoolant
            });
            return;
        }

        // Netezire pe 900ms (chiar înainte de următorul pachet de 1000ms)
        const duration = 900;
        const easing = Easing.out(Easing.cubic);

        // Actualizăm starea numerică la ~6.6Hz (150ms) în loc de 20Hz (50ms).
        // Aceasta reduce cu 70% numărul de randări React pe secundă, păstrând cifrele perfect lizibile fără consum excesiv de baterie.
        const updateInterval = setInterval(() => {
            setSmoothNumbers({
                rpm: Math.round(animRpm._value ?? targetRpm),
                speed: Math.round(animSpeed._value ?? targetSpeed),
                powerHp: Math.round(animPowerHp._value ?? targetPowerHp),
                boost: Number((animBoost._value ?? targetBoost).toFixed(2)),
                targetBoost: Number((animTargetBoost._value ?? targetCmdBoost).toFixed(2)),
                load: Math.round(animLoad._value ?? targetLoad),
                coolant: Number((animCoolant._value ?? targetCoolant).toFixed(1))
            });
        }, 150);

        const animGroup = Animated.parallel([
            Animated.timing(animRpm,         { toValue: targetRpm,     duration, easing, useNativeDriver: false }),
            Animated.timing(animSpeed,       { toValue: targetSpeed,   duration, easing, useNativeDriver: false }),
            Animated.timing(animPowerHp,     { toValue: targetPowerHp, duration, easing, useNativeDriver: false }),
            Animated.timing(animBoost,       { toValue: targetBoost,   duration, easing, useNativeDriver: false }),
            Animated.timing(animTargetBoost, { toValue: targetCmdBoost,duration, easing, useNativeDriver: false }),
            Animated.timing(animLoad,        { toValue: targetLoad,    duration, easing, useNativeDriver: false }),
            Animated.timing(animCoolant,     { toValue: targetCoolant, duration, easing, useNativeDriver: false }),
        ]);

        animGroup.start(() => {
            clearInterval(updateInterval);
            setSmoothNumbers({
                rpm: targetRpm,
                speed: targetSpeed,
                powerHp: targetPowerHp,
                boost: targetBoost,
                targetBoost: targetCmdBoost,
                load: targetLoad,
                coolant: targetCoolant
            });
        });

        return () => {
            clearInterval(updateInterval);
            animGroup.stop();
        };
    }, [liveData, enabled]);

    return {
        animated: {
            rpm: animRpm,
            speed: animSpeed,
            powerHp: animPowerHp,
            boost: animBoost,
            targetBoost: animTargetBoost,
            load: animLoad,
            coolant: animCoolant
        },
        numeric: smoothNumbers
    };
}
