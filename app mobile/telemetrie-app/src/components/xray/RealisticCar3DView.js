// @ts-check
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getActiveServerUrl } from '../../utils/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * RealisticCar3DView — Motor WebGL2 PBR Three.js Showroom Fotorealist
 * - Încărcare model 3D Acura CDX (`.glb`) cu vopsea fotorealistă și reflexii metalice
 * - Platformă turnantă showroom iluminată cu inel neon cyan (#00F0FF)
 * - Iluminare PBR studio multi-direcțională (Key, 2xFills, Rim Spotlight, ToneMapping 2.2)
 * - Suport piese individuale `.glb` din `assets/models/parts/` cu normalizare Box3
 * - Rotație roți proporțională cu viteza
 * - Geometrie internă X-Ray strict calibrată în interiorul caroseriei (fără străpungeri de capotă)
 */
export default function RealisticCar3DView({
    visualMode = 'STUDIO_REALISTIC', // 'STUDIO_REALISTIC' | 'XRAY_ANATOMY' | 'HOLOGRAM_WIREFRAME' | 'ISOLATED_PART_3D'
    selectedPart = null,             // 'engine' | 'turbo' | 'cooling' | 'transmission' | 'dpf' | 'brakes' | 'battery' | 'suspension'
    exploded = false,                // true -> desface subansamblurile în spațiu
    cameraPreset = 'OVERVIEW',       // 'OVERVIEW' | 'ENGINE_BAY' | 'CHASSIS_BRAKES' | 'HIGHWAY_CHASE'
    autoRotate = false,
    telemetry = {},
    onSelectPart,
    onChangeVisualMode,
    style,
    height = 280,
    showOverlayControls = true,
}) {
    const webViewRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState(0);
    const serverUrl = getActiveServerUrl() || 'http://localhost:3000';

    // Notifică WebView-ul la schimbarea modului vizual, piesei selectate sau camerei
    useEffect(() => {
        if (!webViewRef.current) return;
        const msg = JSON.stringify({
            type: 'STATE_CHANGE',
            visualMode,
            selectedPart,
            exploded,
            cameraPreset,
            autoRotate,
        });
        webViewRef.current.postMessage(msg);
    }, [visualMode, selectedPart, exploded, cameraPreset, autoRotate]);

    // Transmite datele de telemetrie către bucla WebGL pentru rotații și reacții termice
    useEffect(() => {
        if (!webViewRef.current) return;
        const msg = JSON.stringify({
            type: 'TELEMETRY_UPDATE',
            rpm: telemetry?.rpm || 800,
            speed: telemetry?.speed || 0,
            boost: telemetry?.boost || 0,
            coolantTemp: telemetry?.coolantTemp || 90,
            chraTemp: telemetry?.chraTemp || 420,
            exhaustTemp: telemetry?.exhaustTemp || 380,
            brakeFluidTemp: telemetry?.brakeFluidTemp || 75,
            dpfRegenActive: telemetry?.dpfRegenActive || false,
            sootGrams: telemetry?.dpfSootGrams || 12,
            gLat: telemetry?.gForceLat || 0,
            gLong: telemetry?.gForceLong || 0,
        });
        webViewRef.current.postMessage(msg);
    }, [
        telemetry?.rpm,
        telemetry?.speed,
        telemetry?.boost,
        telemetry?.coolantTemp,
        telemetry?.chraTemp,
        telemetry?.exhaustTemp,
        telemetry?.brakeFluidTemp,
        telemetry?.dpfRegenActive,
        telemetry?.gForceLat,
        telemetry?.gForceLong,
    ]);

    // Tratează mesajele primite din bucla WebGL
    const handleMessage = useCallback((event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'LOAD_PROGRESS') {
                setLoadProgress(Math.round(data.progress * 100));
            } else if (data.type === 'LOADED') {
                setIsLoading(false);
            } else if (data.type === 'SELECT_PART' && onSelectPart) {
                onSelectPart(data.partId);
            }
        } catch {
            // Ignoră
        }
    }, [onSelectPart]);

    // Șablon HTML5 + Three.js PBR Showroom
    const htmlContent = useMemo(() => `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; -webkit-user-select: none; }
        html, body {
            width: 100%; height: 100%; overflow: hidden;
            background: radial-gradient(circle at 50% 40%, #1E293B 0%, #0B111E 70%, #04070D 100%);
        }
        #webgl-canvas { width: 100%; height: 100%; display: block; }
        #loading-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            background: rgba(4, 7, 13, 0.88); color: #00F0FF; font-family: monospace; font-size: 11px;
            letter-spacing: 1.5px; z-index: 10; pointer-events: none; transition: opacity 0.4s ease;
        }
        .spinner {
            width: 32px; height: 32px; border: 2px solid #00F0FF22;
            border-top: 2px solid #00F0FF; border-radius: 50%;
            animation: spin 0.8s linear infinite; margin-bottom: 12px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>

    <!-- Three.js r128 cu fallback automat CDN -->
    <script src="${serverUrl}/three.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';"></script>
    <script src="${serverUrl}/OrbitControls.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';"></script>
    <script src="${serverUrl}/GLTFLoader.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';"></script>
</head>
<body>
    <div id="loading-overlay">
        <div class="spinner"></div>
        <div id="progress-text">INITIALIZARE SHOWROOM 3D...</div>
    </div>
    <div id="webgl-container" style="width:100%; height:100%;"></div>

    <script>
    (function() {
        var container = document.getElementById('webgl-container');
        var progressText = document.getElementById('progress-text');
        var loadingOverlay = document.getElementById('loading-overlay');

        function sendToRN(payload) {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
        }

        // ── 1. INITIALIZARE SCENA & RENDERER SHOWROOM ──────────────────────────
        var scene = new THREE.Scene();
        // Clear color transparent pentru a lasa fundalul radial CSS sa creeze atmosfera de studio
        var camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(3.8, 1.8, 4.2);

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        var controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.maxPolarAngle = Math.PI / 2 + 0.02;
        controls.minDistance = 1.2;
        controls.maxDistance = 12.0;
        controls.target.set(0, 0.45, 0);

        // ── 2. PLATFORMA CIRCULARĂ TURNTABLE & INEL LUMINESCENT CYAN ───────────
        // Placa turnantă studio - Gri-Ardezie Metalic de Showroom (#1E293B)
        var platformGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.04, 64);
        var platformMat = new THREE.MeshStandardMaterial({
            color: 0x1E293B,
            roughness: 0.65,
            metalness: 0.45
        });
        var turntable = new THREE.Mesh(platformGeo, platformMat);
        turntable.position.y = -0.02;
        turntable.receiveShadow = true;
        scene.add(turntable);

        // Inel exterior neon cyan (#38BDF8)
        var outerRingGeo = new THREE.RingGeometry(2.73, 2.78, 64);
        var outerRingMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8, side: THREE.DoubleSide });
        var outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
        outerRing.rotation.x = -Math.PI / 2;
        outerRing.position.y = 0.005;
        scene.add(outerRing);

        // Inel concentric interior discret
        var innerRingGeo = new THREE.RingGeometry(1.78, 1.82, 48);
        var innerRingMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        var innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.y = 0.004;
        scene.add(innerRing);

        // Inel concentric central
        var centerRingGeo = new THREE.RingGeometry(0.88, 0.91, 36);
        var centerRingMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.20, side: THREE.DoubleSide });
        var centerRing = new THREE.Mesh(centerRingGeo, centerRingMat);
        centerRing.rotation.x = -Math.PI / 2;
        centerRing.position.y = 0.003;
        scene.add(centerRing);

        // Contact shadow discret
        var shadowPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(5.6, 5.6),
            new THREE.ShadowMaterial({ opacity: 0.38 })
        );
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = 0.006;
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);

        // ── 3. ILUMINARE DE SHOWROOM FOTOREALISTĂ (MULTI-LIGHT STUDIO RIG) ────
        // 1. Lumină ambientală echilibrată sus-jos
        var hemiLight = new THREE.HemisphereLight(0xF1F5F9, 0x1E293B, 0.95);
        scene.add(hemiLight);

        // 2. Key Light (față-sus-dreapta)
        var keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.85);
        keyLight.position.set(5, 7, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.bias = -0.0005;
        scene.add(keyLight);

        // 3. Fill Light 1 (stânga-lateral)
        var fillLight1 = new THREE.DirectionalLight(0x94A3B8, 0.85);
        fillLight1.position.set(-5, 4, -3);
        scene.add(fillLight1);

        // 4. Fill Light 2 (dreapta-lateral)
        var fillLight2 = new THREE.DirectionalLight(0xCBD5E1, 0.85);
        fillLight2.position.set(5, 4, -3);
        scene.add(fillLight2);

        // 5. Rim / Contour Spotlight din spate-sus (cyan accent contur)
        var rimSpot = new THREE.SpotLight(0x38BDF8, 2.2, 16, Math.PI / 4, 0.4);
        rimSpot.position.set(0, 4.5, -4.5);
        rimSpot.target.position.set(0, 0.45, 0);
        scene.add(rimSpot);
        scene.add(rimSpot.target);

        // ── 4. GRUPURI DE ENTITĂȚI ────────────────────────────────────────────
        var carModelRoot = new THREE.Group();
        scene.add(carModelRoot);

        var internalOrgansGroup = new THREE.Group();
        internalOrgansGroup.visible = false; // Ascuns implicit în modul STUDIO_REALISTIC
        scene.add(internalOrgansGroup);

        var pinsGroup = new THREE.Group();
        pinsGroup.visible = false;
        scene.add(pinsGroup);

        var wheelMeshes = [];
        var telemetrySpeed = 0;

        // ── 5. CELE 8 SUBSISTEME MECANICE INTERNE (CALIBRATE STRICT ÎN CAROSERIE) ──
        // Limite caroserie Acura CDX: Y_MAX <= 0.65 (capotă), Z_FRONT <= 1.45 (grilă radiator)
        var organs = {};

        // 1. MOTOR (ENGINE) — Y max 0.62, Z 1.05 (ansamblu mecanic fotorealist CNC, fara capac turcoaz)
        var engineGroup = new THREE.Group();

        // Bloc motor din fonta / aluminiu structural inchis cu striatii laterale
        var blockMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.92, roughness: 0.28 });
        var blockMesh = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.24, 0.66), blockMat);
        blockMesh.position.set(0, 0.40, 1.05);
        engineGroup.add(blockMesh);

        // Baie de ulei inferioara metalica
        var oilPanMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, metalness: 0.85, roughness: 0.4 });
        var oilPan = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.58), oilPanMat);
        oilPan.position.set(0, 0.26, 1.05);
        engineGroup.add(oilPan);

        // Chiulasa din aluminiu frezat CNC
        var headMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.88, roughness: 0.22 });
        var headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.10, 0.64), headMat);
        headMesh.position.set(0, 0.54, 1.05);
        engineGroup.add(headMesh);

        // Capac culbutori / axe cu came din magneziu texturat antracit (fara paralelipiped turcoaz!)
        var valveCoverMat = new THREE.MeshStandardMaterial({ color: 0x1E2533, metalness: 0.80, roughness: 0.35 });
        var valveCover = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.60), valveCoverMat);
        valveCover.position.set(0, 0.60, 1.05);
        engineGroup.add(valveCover);

        // 4 Bobine de inductie individuale cu piulite hexagonale argintii
        var coilMat = new THREE.MeshStandardMaterial({ color: 0x090D16, roughness: 0.7 });
        var boltMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, metalness: 0.95, roughness: 0.15 });
        for (var c = 0; c < 4; c++) {
            var zPos = 0.84 + c * 0.14;
            var coil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.08), coilMat);
            coil.position.set(0, 0.635, zPos);
            engineGroup.add(coil);

            var bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 6), boltMat);
            bolt.position.set(0, 0.645, zPos);
            engineGroup.add(bolt);
        }

        // Galeria de admisie cu 4 tevi curbate din aluminiu
        var intakePlenumMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 });
        var intakePlenum = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.54, 16), intakePlenumMat);
        intakePlenum.position.set(-0.24, 0.52, 1.05);
        intakePlenum.rotation.x = Math.PI / 2;
        engineGroup.add(intakePlenum);

        for (var r = 0; r < 4; r++) {
            var runnerZ = 0.84 + r * 0.14;
            var runnerCurve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(-0.24, 0.52, runnerZ),
                new THREE.Vector3(-0.16, 0.58, runnerZ),
                new THREE.Vector3(-0.08, 0.54, runnerZ)
            );
            var runner = new THREE.Mesh(new THREE.TubeGeometry(runnerCurve, 12, 0.018, 8, false), intakePlenumMat);
            engineGroup.add(runner);
        }

        // Galeria de evacuare metalica spre turbina
        var exhaustManifoldMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.9, roughness: 0.25 });
        var exhaustLog = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.48, 16), exhaustManifoldMat);
        exhaustLog.position.set(0.24, 0.48, 1.05);
        exhaustLog.rotation.x = Math.PI / 2;
        engineGroup.add(exhaustLog);

        // 4 Pistoane articulate din otel forjat
        var pistons = [];
        var pistonMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.15 });
        for (var i = 0; i < 4; i++) {
            var pMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16), pistonMat);
            pMesh.position.set(0, 0.44, 0.84 + i * 0.14);
            engineGroup.add(pMesh);
            pistons.push(pMesh);
        }
        organs['engine'] = { group: engineGroup, center: new THREE.Vector3(0, 0.48, 1.05), glbContainer: new THREE.Group() };
        engineGroup.add(organs['engine'].glbContainer);
        internalOrgansGroup.add(engineGroup);

        // 2. TURBOCHARGER (TURBINĂ CHRA) — Y 0.52, Z 0.95
        var turboGroup = new THREE.Group();
        var compMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.9, roughness: 0.2 });
        var compHousing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.045, 16, 24), compMat);
        compHousing.position.set(0.32, 0.52, 0.95);
        compHousing.rotation.y = Math.PI / 2;
        turboGroup.add(compHousing);

        var turbMat = new THREE.MeshStandardMaterial({ color: 0x475569, emissive: 0x000000, metalness: 0.75, roughness: 0.45 });
        var turbHousing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.04, 16, 24), turbMat);
        turbHousing.position.set(0.32, 0.52, 0.84);
        turbHousing.rotation.y = Math.PI / 2;
        turboGroup.add(turbHousing);
        organs['turbo'] = { group: turboGroup, center: new THREE.Vector3(0.32, 0.52, 0.90), turbMat: turbMat, glbContainer: new THREE.Group() };
        turboGroup.add(organs['turbo'].glbContainer);
        internalOrgansGroup.add(turboGroup);

        // 3. RĂCIRE (COOLING) — Y 0.40, Z 1.36 (ansamblu radiator cu celule, ventilatoare si furtunuri)
        var coolingGroup = new THREE.Group();

        // Rama exterioara din aluminiu anodizat
        var radFrameMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.85, roughness: 0.3 });
        var radFrame = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.28, 0.03), radFrameMat);
        radFrame.position.set(0, 0.40, 1.36);
        coolingGroup.add(radFrame);

        // Miez de racire cu lamele dese din aluminiu
        var radCoreMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.92, roughness: 0.25, wireframe: true });
        var radCore = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.24, 18, 10), radCoreMat);
        radCore.position.set(0, 0.40, 1.376);
        coolingGroup.add(radCore);

        // Furtun superior radiator spre blocul motor
        var hoseMat = new THREE.MeshStandardMaterial({ color: 0x090D16, roughness: 0.85 });
        var upperHoseCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-0.20, 0.48, 1.34),
            new THREE.Vector3(-0.16, 0.54, 1.20),
            new THREE.Vector3(-0.10, 0.52, 1.10)
        );
        var upperHose = new THREE.Mesh(new THREE.TubeGeometry(upperHoseCurve, 14, 0.02, 8, false), hoseMat);
        coolingGroup.add(upperHose);

        // Doua carcase cu ventilatoare electrice rotative
        var fanShroudMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.7 });
        var fanBladeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });
        var fanHousings = [-0.15, 0.15];
        var fanRotors = [];
        fanHousings.forEach(function(fx) {
            var shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.025, 24, 1, true), fanShroudMat);
            shroud.position.set(fx, 0.40, 1.34);
            shroud.rotation.x = Math.PI / 2;
            coolingGroup.add(shroud);

            var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), fanShroudMat);
            hub.position.set(fx, 0.40, 1.34);
            hub.rotation.x = Math.PI / 2;
            coolingGroup.add(hub);

            var fanBladesGroup = new THREE.Group();
            fanBladesGroup.position.set(fx, 0.40, 1.34);
            for (var b = 0; b < 5; b++) {
                var blade = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.004), fanBladeMat);
                blade.position.set(0, 0.045, 0);
                var bladeHolder = new THREE.Group();
                bladeHolder.rotation.z = b * (Math.PI * 2 / 5);
                bladeHolder.add(blade);
                fanBladesGroup.add(bladeHolder);
            }
            coolingGroup.add(fanBladesGroup);
            fanRotors.push(fanBladesGroup);
        });

        organs['cooling'] = { group: coolingGroup, center: new THREE.Vector3(0, 0.40, 1.36), fans: fanRotors, glbContainer: new THREE.Group() };
        coolingGroup.add(organs['cooling'].glbContainer);
        internalOrgansGroup.add(coolingGroup);

        // 4. TRANSMISIE & QUATTRO (TRANSMISSION) — Y 0.36, Z 0.45
        var transGroup = new THREE.Group();
        var gearMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
        var gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.55), gearMat);
        gearbox.position.set(0, 0.36, 0.45);
        transGroup.add(gearbox);

        var shaftMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.9, roughness: 0.2 });
        var driveShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.7, 16), shaftMat);
        driveShaft.position.set(0, 0.32, -0.6);
        driveShaft.rotation.x = Math.PI / 2;
        transGroup.add(driveShaft);

        var diff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), gearMat);
        diff.position.set(0, 0.32, -1.45);
        transGroup.add(diff);
        organs['transmission'] = { group: transGroup, center: new THREE.Vector3(0, 0.35, 0.1), driveShaft: driveShaft, glbContainer: new THREE.Group() };
        transGroup.add(organs['transmission'].glbContainer);
        internalOrgansGroup.add(transGroup);

        // 5. DPF & EVACUARE (DPF) — Y 0.28..0.32 (sub podea)
        var dpfGroup = new THREE.Group();
        var exhaustCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.28, 0.45, 0.8),
            new THREE.Vector3(0.16, 0.30, 0.2),
            new THREE.Vector3(0.16, 0.28, -0.7),
            new THREE.Vector3(0.22, 0.30, -1.7),
            new THREE.Vector3(0.26, 0.30, -1.95)
        ]);
        var exhMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.75, roughness: 0.35 });
        var exhPipe = new THREE.Mesh(new THREE.TubeGeometry(exhaustCurve, 32, 0.032, 12, false), exhMat);
        dpfGroup.add(exhPipe);

        var dpfCanisterMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, metalness: 0.65, roughness: 0.4 });
        var dpfCanister = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 16), dpfCanisterMat);
        dpfCanister.position.set(0.16, 0.28, -0.25);
        dpfCanister.rotation.x = Math.PI / 2;
        dpfGroup.add(dpfCanister);
        organs['dpf'] = { group: dpfGroup, center: new THREE.Vector3(0.16, 0.28, -0.25), dpfMat: dpfCanisterMat, glbContainer: new THREE.Group() };
        dpfGroup.add(organs['dpf'].glbContainer);
        internalOrgansGroup.add(dpfGroup);

        // 6. FRÂNE PE 4 ROȚI (BRAKES)
        var brakesGroup = new THREE.Group();
        var brakeRotors = [];
        var rotorMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, emissive: 0x000000, metalness: 0.95, roughness: 0.1 });
        var caliperMat = new THREE.MeshStandardMaterial({ color: 0xEF4444, metalness: 0.7, roughness: 0.3 });

        var wheelPositions = [
            [-0.78, 0.32,  1.35], // Față Stânga
            [ 0.78, 0.32,  1.35], // Față Dreapta
            [-0.78, 0.32, -1.35], // Spate Stânga
            [ 0.78, 0.32, -1.35], // Spate Dreapta
        ];
        wheelPositions.forEach(function(pos) {
            var rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), rotorMat);
            rotor.position.set(pos[0], pos[1], pos[2]);
            rotor.rotation.z = Math.PI / 2;
            brakesGroup.add(rotor);
            brakeRotors.push(rotor);

            var caliper = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.09), caliperMat);
            caliper.position.set(pos[0], pos[1] + 0.06, pos[2]);
            brakesGroup.add(caliper);
        });
        organs['brakes'] = { group: brakesGroup, center: new THREE.Vector3(0, 0.32, 1.35), rotors: brakeRotors, rotorMat: rotorMat, glbContainer: new THREE.Group() };
        brakesGroup.add(organs['brakes'].glbContainer);
        internalOrgansGroup.add(brakesGroup);

        // 7. BATERIE & ECU (BATTERY) — Y 0.50, Z 0.95 (carcasa baterie cu borne si modul ECU detaliat)
        var batteryGroup = new THREE.Group();

        // Carcasa bateriei din polimer texturat
        var batMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.65, metalness: 0.2 });
        var batMesh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.15, 0.16), batMat);
        batMesh.position.set(-0.28, 0.50, 0.95);
        batteryGroup.add(batMesh);

        // Capac superior baterie cu nervuri
        var batTop = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.02, 0.17), batMat);
        batTop.position.set(-0.28, 0.58, 0.95);
        batteryGroup.add(batTop);

        // Maner de transport pliabil
        var handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.015), batMat);
        handle.position.set(-0.28, 0.595, 0.95);
        batteryGroup.add(handle);

        // Borna Pozitiva (+) Rosie cu cablu gros spre demaror
        var posCapMat = new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.3 });
        var posPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 12), posCapMat);
        posPost.position.set(-0.34, 0.60, 0.90);
        batteryGroup.add(posPost);

        var posCableCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-0.34, 0.60, 0.90),
            new THREE.Vector3(-0.30, 0.52, 0.92),
            new THREE.Vector3(-0.22, 0.44, 0.95)
        );
        var posCable = new THREE.Mesh(new THREE.TubeGeometry(posCableCurve, 12, 0.008, 8, false), posCapMat);
        batteryGroup.add(posCable);

        // Borna Negativa (-) Albastra/Neagra cu cablu de masa la sasiu
        var negCapMat = new THREE.MeshStandardMaterial({ color: 0x1D4ED8, roughness: 0.3 });
        var negPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 12), negCapMat);
        negPost.position.set(-0.22, 0.60, 0.90);
        batteryGroup.add(negPost);

        var groundStrapCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-0.22, 0.60, 0.90),
            new THREE.Vector3(-0.20, 0.55, 0.86),
            new THREE.Vector3(-0.16, 0.48, 0.84)
        );
        var groundStrapMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
        var groundStrap = new THREE.Mesh(new THREE.TubeGeometry(groundStrapCurve, 12, 0.007, 8, false), groundStrapMat);
        batteryGroup.add(groundStrap);

        // Modul Bosch ECU in aluminiu periat cu conector cablaj
        var ecuMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.9, roughness: 0.2 });
        var ecuMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.04), ecuMat);
        ecuMesh.position.set(-0.28, 0.48, 0.78);
        batteryGroup.add(ecuMesh);

        var connectorMat = new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.5 });
        var connector = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.02), connectorMat);
        connector.position.set(-0.28, 0.43, 0.78);
        batteryGroup.add(connector);

        organs['battery'] = { group: batteryGroup, center: new THREE.Vector3(-0.28, 0.50, 0.95), glbContainer: new THREE.Group() };
        batteryGroup.add(organs['battery'].glbContainer);
        internalOrgansGroup.add(batteryGroup);

        // 8. SUSPENSIE PE 4 ROȚI (SUSPENSION)
        var suspGroup = new THREE.Group();
        var springs = [];
        var springMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, metalness: 0.9, roughness: 0.2 });
        wheelPositions.forEach(function(pos) {
            var spring = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 12, 8, true), springMat);
            spring.position.set(pos[0] * 0.78, 0.42, pos[2]);
            suspGroup.add(spring);
            springs.push(spring);
        });
        organs['suspension'] = { group: suspGroup, center: new THREE.Vector3(0, 0.45, 0), springs: springs, glbContainer: new THREE.Group() };
        suspGroup.add(organs['suspension'].glbContainer);
        internalOrgansGroup.add(suspGroup);

        // ── 6. PINI INTERACTIVI 3D ────────────────────────────────────────────
        var pinColors = {
            engine: 0x00FF66, turbo: 0xFF5500, cooling: 0x00E5FF, transmission: 0xFFB800,
            dpf: 0x9C27B0, brakes: 0xFF2A2A, battery: 0x00F0FF, suspension: 0xFFFF00
        };

        Object.keys(organs).forEach(function(key) {
            var org = organs[key];
            var pinMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 16, 16),
                new THREE.MeshBasicMaterial({ color: pinColors[key] || 0x00F0FF, wireframe: true })
            );
            pinMesh.position.copy(org.center);
            pinMesh.userData = { partId: key };
            pinsGroup.add(pinMesh);
        });

        // ── 7. ÎNCĂRCARE MODEL 3D GLB ACURA CDX FOTOREALIST ───────────────────
        var carMaterials = [];
        var gltfLoader = new THREE.GLTFLoader();
        var modelUrl = "${serverUrl}/models/acura_cdx.glb";

        gltfLoader.load(
            modelUrl,
            function(gltf) {
                var carScene = gltf.scene;

                // Calibrare automată a dimensiunilor pe șasiu (lungime ~4.2m)
                var bbox = new THREE.Box3().setFromObject(carScene);
                var size = bbox.getSize(new THREE.Vector3());
                var maxDim = Math.max(size.x, size.y, size.z);
                var scaleFactor = 4.2 / maxDim;
                carScene.scale.set(scaleFactor, scaleFactor, scaleFactor);

                var center = bbox.getCenter(new THREE.Vector3());
                carScene.position.x = -center.x * scaleFactor;
                carScene.position.y = -bbox.min.y * scaleFactor;
                carScene.position.z = -center.z * scaleFactor;

                // Detectare componente roți & colectare materiale PBR
                carScene.traverse(function(node) {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        var nodeName = (node.name || '').toLowerCase();
                        if (nodeName.indexOf('wheel') !== -1 || nodeName.indexOf('rim') !== -1 ||
                            nodeName.indexOf('tire') !== -1 || nodeName.indexOf('tyre') !== -1) {
                            var bBox = new THREE.Box3().setFromObject(node);
                            var bSize = bBox.getSize(new THREE.Vector3());
                            // Adăugăm la rotație doar dacă este o roată individuală compactă (< 0.65m)
                            // Evităm rotirea mesh-urilor globale unite ce conțin toate roțile (care ar orbita mașina)
                            if (bSize.x < 0.65 && bSize.z < 0.65 && bSize.y < 0.85) {
                                wheelMeshes.push(node);
                            }
                        }
                        if (node.material) {
                            var mat = node.material.clone();
                            // Reflexii fotorealiste showroom pentru vopsea
                            if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                                mat.roughness = Math.min(mat.roughness, 0.35);
                                mat.metalness = Math.max(mat.metalness, 0.45);
                            }
                            node.material = mat;
                            carMaterials.push({ mesh: node, originalMat: mat });
                        }
                    }
                });

                carModelRoot.add(carScene);
                loadingOverlay.style.opacity = '0';
                setTimeout(function() { loadingOverlay.style.display = 'none'; }, 400);
                sendToRN({ type: 'LOADED' });
                applyVisualMode(currentVisualMode);
            },
            function(xhr) {
                if (xhr.lengthComputable) {
                    var pct = xhr.loaded / xhr.total;
                    progressText.innerText = 'DESCARCARE MODEL 3D: ' + Math.round(pct * 100) + '%';
                    sendToRN({ type: 'LOAD_PROGRESS', progress: pct });
                }
            },
            function(err) {
                console.warn('Fallback la showroom procedural:', err);
                progressText.innerText = 'SHOWROOM ACTIVAT';
                setTimeout(function() { loadingOverlay.style.display = 'none'; }, 800);
                sendToRN({ type: 'LOADED' });
                applyVisualMode(currentVisualMode);
            }
        );

        // ── 8. SUPORT ÎNCĂRCARE .GLB PENTRU PIESE INDIVIDUALE ─────────────────
        var loadedGlbParts = {};
        function loadPartGlb(partId) {
            if (loadedGlbParts[partId] || !organs[partId]) return;
            loadedGlbParts[partId] = 'loading';

            var partUrl = "${serverUrl}/models/parts/" + partId + ".glb";
            gltfLoader.load(
                partUrl,
                function(gltf) {
                    var partScene = gltf.scene;
                    var bbox = new THREE.Box3().setFromObject(partScene);
                    var size = bbox.getSize(new THREE.Vector3());
                    var maxDim = Math.max(size.x, size.y, size.z);
                    var targetSize = 0.55; // Dimensiune optimă în spațiu
                    var scale = targetSize / Math.max(0.001, maxDim);
                    partScene.scale.set(scale, scale, scale);

                    var center = bbox.getCenter(new THREE.Vector3());
                    partScene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

                    partScene.traverse(function(node) {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    });

                    var container = organs[partId].glbContainer;
                    container.position.copy(organs[partId].center);
                    container.add(partScene);
                    loadedGlbParts[partId] = 'ready';

                    // Când piesa GLB e gata, ascundem geometria procedurală simplificată
                    organs[partId].group.children.forEach(function(child) {
                        if (child !== container) child.visible = false;
                    });
                },
                null,
                function(_) {
                    // Dacă GLB-ul nu e disponibil, păstrăm geometria CAD procedurală
                    loadedGlbParts[partId] = 'failed';
                }
            );
        }

        // ── 9. LOGICĂ MODURI VIZUALE (STUDIO / X-RAY / HOLOGRAM / ISOLATED) ───
        var currentVisualMode = "${visualMode}";
        var currentSelectedPart = null;
        var isExploded = false;

        function applyVisualMode(mode) {
            currentVisualMode = mode;
            if (mode === 'STUDIO_REALISTIC') {
                carModelRoot.visible = true;
                internalOrgansGroup.visible = false;
                pinsGroup.visible = false;
                carMaterials.forEach(function(item) {
                    item.mesh.material = item.originalMat;
                    item.mesh.material.transparent = false;
                    item.mesh.material.opacity = 1.0;
                    item.mesh.material.wireframe = false;
                });
            } else if (mode === 'XRAY_ANATOMY') {
                carModelRoot.visible = true;
                internalOrgansGroup.visible = true;
                pinsGroup.visible = true;
                Object.keys(organs).forEach(function(k) {
                    organs[k].group.visible = true;
                    loadPartGlb(k);
                });
                carMaterials.forEach(function(item) {
                    var m = item.mesh;
                    var name = (m.name || '').toLowerCase();
                    var isBody = name.indexOf('body') !== -1 || name.indexOf('door') !== -1 ||
                                 name.indexOf('fender') !== -1 || name.indexOf('bonnet') !== -1 ||
                                 name.indexOf('carpaint') !== -1 || name.indexOf('hood') !== -1;
                    if (isBody) {
                        m.material.transparent = true;
                        m.material.opacity = 0.24;
                        m.material.wireframe = false;
                        m.material.color.setHex(0x1A3A5A);
                    } else {
                        m.material.transparent = false;
                        m.material.opacity = 1.0;
                    }
                });
            } else if (mode === 'HOLOGRAM_WIREFRAME') {
                carModelRoot.visible = true;
                internalOrgansGroup.visible = true;
                pinsGroup.visible = true;
                carMaterials.forEach(function(item) {
                    item.mesh.material.transparent = true;
                    item.mesh.material.opacity = 0.55;
                    item.mesh.material.wireframe = true;
                    item.mesh.material.color.setHex(0x00F0FF);
                });
            } else if (mode === 'ISOLATED_PART_3D') {
                carModelRoot.visible = false;
                pinsGroup.visible = false;
                internalOrgansGroup.visible = true;
                Object.keys(organs).forEach(function(k) {
                    organs[k].group.visible = (k === currentSelectedPart);
                });
                if (currentSelectedPart && organs[currentSelectedPart]) {
                    loadPartGlb(currentSelectedPart);
                    controls.target.copy(organs[currentSelectedPart].center);
                }
            }
        }

        // ── 10. ANIMAȚIE EXPLOZIE 3D ──────────────────────────────────────────
        var explodeFactor = 0.0;
        function updateExplode(delta) {
            var target = isExploded ? 1.0 : 0.0;
            explodeFactor += (target - explodeFactor) * 0.1;
            if (currentSelectedPart === 'turbo' && organs['turbo']) {
                organs['turbo'].group.children.forEach(function(child, idx) {
                    if (child !== organs['turbo'].glbContainer) {
                        child.position.x = (idx === 0 ? 0.32 + explodeFactor * 0.45 : 0.32 - explodeFactor * 0.45);
                    }
                });
            }
            if (currentSelectedPart === 'engine' && organs['engine']) {
                pistons.forEach(function(p, idx) {
                    p.position.y = 0.48 + (explodeFactor * 0.4) + Math.sin(Date.now() * 0.01 + idx) * 0.03;
                });
            }
        }

        // ── 11. GESTIONARE MESAJE DIN REACT NATIVE ───────────────────────────
        function onRNMessage(msgStr) {
            try {
                var data = JSON.parse(msgStr);
                if (data.type === 'STATE_CHANGE') {
                    currentSelectedPart = data.selectedPart;
                    isExploded = !!data.exploded;
                    controls.autoRotate = !!data.autoRotate;
                    controls.autoRotateSpeed = 1.8;

                    if (data.cameraPreset === 'ENGINE_BAY') {
                        flyCameraTo(new THREE.Vector3(0, 1.4, 2.2), new THREE.Vector3(0, 0.5, 1.05));
                    } else if (data.cameraPreset === 'CHASSIS_BRAKES') {
                        flyCameraTo(new THREE.Vector3(1.6, 0.7, 1.8), new THREE.Vector3(0.78, 0.32, 1.35));
                    } else if (data.cameraPreset === 'HIGHWAY_CHASE') {
                        flyCameraTo(new THREE.Vector3(0, 1.2, -4.5), new THREE.Vector3(0, 0.45, 0));
                    } else if (data.cameraPreset === 'OVERVIEW') {
                        flyCameraTo(new THREE.Vector3(3.8, 1.8, 4.2), new THREE.Vector3(0, 0.45, 0));
                    }

                    if (currentSelectedPart) {
                        loadPartGlb(currentSelectedPart);
                    }

                    applyVisualMode(data.visualMode || currentVisualMode);
                } else if (data.type === 'TELEMETRY_UPDATE') {
                    telemetrySpeed = data.speed || 0;

                    // Reacție termică la turbină
                    if (organs['turbo'] && organs['turbo'].turbMat) {
                        var heat = Math.min(1.0, Math.max(0, (data.chraTemp - 300) / 450));
                        organs['turbo'].turbMat.emissive.setRGB(heat * 0.95, heat * 0.28, 0.0);
                    }
                    // Reacție termică la discuri de frână
                    if (organs['brakes'] && organs['brakes'].rotorMat) {
                        var bHeat = Math.min(1.0, Math.max(0, (data.brakeFluidTemp - 80) / 140));
                        organs['brakes'].rotorMat.emissive.setRGB(bHeat * 0.9, bHeat * 0.15, 0.0);
                    }
                    // Ventilatoare radiator
                    if (organs['cooling'] && organs['cooling'].fans) {
                        var fanSpeed = (data.coolantTemp > 90) ? 0.25 : 0.0;
                        organs['cooling'].fans.forEach(function(f) { f.rotation.z += fanSpeed; });
                    }
                    // Rotație cardan cu viteza
                    if (organs['transmission'] && organs['transmission'].driveShaft) {
                        organs['transmission'].driveShaft.rotation.y += (telemetrySpeed * 0.015);
                    }
                }
            } catch(e) {}
        }
        window.addEventListener('message', function(e) { onRNMessage(e.data); });
        document.addEventListener('message', function(e) { onRNMessage(e.data); });

        // ── 12. FLY-TO ANIMAT AL CAMEREI ──────────────────────────────────────
        var camTargetPos = null;
        var camTargetLook = null;
        function flyCameraTo(pos, look) {
            camTargetPos = pos;
            camTargetLook = look;
        }

        // ── 13. CLICK PE PINI 3D (RAYCASTING) ─────────────────────────────────
        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();
        window.addEventListener('pointerdown', function(e) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            var intersects = raycaster.intersectObjects(pinsGroup.children);
            if (intersects.length > 0) {
                var pId = intersects[0].object.userData.partId;
                sendToRN({ type: 'SELECT_PART', partId: pId });
            }
        });

        // ── 14. RENDER LOOP 60 FPS CU ROTAȚIE ROȚI PROPORȚIONALĂ CU VITEZA ────
        var clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            var delta = clock.getDelta();

            // Rotație roți proporțională cu viteza
            if (telemetrySpeed > 0) {
                var wheelRotDelta = telemetrySpeed * delta * 0.55;
                for (var w = 0; w < wheelMeshes.length; w++) {
                    wheelMeshes[w].rotation.x += wheelRotDelta;
                }
                for (var r = 0; r < brakeRotors.length; r++) {
                    brakeRotors[r].rotation.y += wheelRotDelta;
                }
            }

            // Rotație dinamică ventilatoare radiator
            if (organs['cooling'] && organs['cooling'].fans) {
                for (var fn = 0; fn < organs['cooling'].fans.length; fn++) {
                    organs['cooling'].fans[fn].rotation.z += delta * (telemetrySpeed > 0 ? 12 : 3);
                }
            }

            // Animație reciprocă lină pistoane motor
            if (pistons && pistons.length > 0) {
                var pTime = Date.now() * 0.015;
                for (var pi = 0; pi < pistons.length; pi++) {
                    pistons[pi].position.y = 0.44 + Math.sin(pTime + pi * 1.57) * 0.035;
                }
            }

            // Lerp cameră dacă este activ un fly-to
            if (camTargetPos) {
                camera.position.lerp(camTargetPos, 0.08);
                controls.target.lerp(camTargetLook, 0.08);
                if (camera.position.distanceTo(camTargetPos) < 0.05) {
                    camTargetPos = null;
                    camTargetLook = null;
                }
            }

            // Pulsare discretă a pinilor 3D
            if (pinsGroup.visible) {
                var t = Date.now() * 0.003;
                pinsGroup.children.forEach(function(p, i) {
                    var s = 1.0 + Math.sin(t + i) * 0.20;
                    p.scale.set(s, s, s);
                });
            }

            updateExplode(delta);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        // Resize handler
        window.addEventListener('resize', function() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    })();
    </script>
</body>
</html>
    `, [serverUrl, visualMode]);

    return (
        <View style={[styles.container, { height }, style]}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: htmlContent, baseUrl: serverUrl }}
                onMessage={handleMessage}
                style={styles.webView}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                mixedContentMode="always"
                scrollEnabled={false}
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
            />

            {/* Spinner Overlay când GLTF-ul se parsează pe GPU */}
            {isLoading && (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#00F0FF" />
                    <Text style={styles.loadingText}>
                        SHOWROOM 3D DIGITAL TWIN {loadProgress > 0 ? `(${loadProgress}%)` : ''}
                    </Text>
                </View>
            )}

            {/* Selector Rapid Moduri Vizuale Suprapuse — mutat la bottom: 8, right: 8 */}
            {showOverlayControls && (
                <View style={styles.overlayBar}>
                    {[
                        { id: 'STUDIO_REALISTIC', label: '🚗 REAL' },
                        { id: 'XRAY_ANATOMY',     label: '🔬 X-RAY' },
                        { id: 'HOLOGRAM_WIREFRAME', label: '🌐 CAD' },
                    ].map((btn) => (
                        <TouchableOpacity
                            key={btn.id}
                            style={[
                                styles.overlayBtn,
                                visualMode === btn.id && styles.overlayBtnActive,
                            ]}
                            onPress={() => {
                                onChangeVisualMode?.(btn.id);
                                const msg = JSON.stringify({
                                    type: 'STATE_CHANGE',
                                    visualMode: btn.id,
                                    selectedPart,
                                    exploded,
                                    cameraPreset,
                                    autoRotate,
                                });
                                webViewRef.current?.postMessage(msg);
                            }}
                        >
                            <Text
                                style={[
                                    styles.overlayBtnText,
                                    visualMode === btn.id && styles.overlayBtnTextActive,
                                ]}
                            >
                                {btn.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#04070D',
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
    },
    webView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingBox: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(4, 7, 13, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    loadingText: {
        color: '#00F0FF',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontWeight: '700',
        marginTop: 8,
        letterSpacing: 1.2,
    },
    // Mutat la bottom: 8, right: 8 pentru a elimina orice coliziune cu ordinea de aprindere
    overlayBar: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        flexDirection: 'row',
        gap: 6,
        zIndex: 10,
        backgroundColor: 'rgba(6, 12, 24, 0.85)',
        padding: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    overlayBtn: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: 'rgba(10, 20, 35, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.35)',
    },
    overlayBtnActive: {
        backgroundColor: '#00F0FF',
        borderColor: '#00F0FF',
    },
    overlayBtnText: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    overlayBtnTextActive: {
        color: '#040812',
        fontWeight: '900',
    },
});
