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
 * RealisticCar3DView — Motor WebGL2 PBR Three.js fotorealist
 * Încarcă modelul 3D Acura CDX (`.glb`), integrează cele 8 subsisteme mecanice 3D
 * animate anatomic și oferă moduri X-Ray, Wireframe și Inspector Explodat 3D.
 */
export default function RealisticCar3DView({
    visualMode = 'XRAY_ANATOMY', // 'STUDIO_REALISTIC' | 'XRAY_ANATOMY' | 'HOLOGRAM_WIREFRAME' | 'ISOLATED_PART_3D'
    selectedPart = null,         // 'engine' | 'turbo' | 'cooling' | 'transmission' | 'dpf' | 'brakes' | 'battery' | 'suspension'
    exploded = false,            // true -> desface piesa în subansambluri 3D în spațiu
    cameraPreset = 'OVERVIEW',   // 'OVERVIEW' | 'ENGINE_BAY' | 'CHASSIS_BRAKES' | 'HIGHWAY_CHASE'
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

    // Notifică WebView-ul la schimbarea modului, părții selectate sau camerei
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

    // Transmite datele de telemetrie către bucla WebGL pentru reacție termică și rotații
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

    // Tratează mesajele primite din WebView (selectare pin, progres încărcare)
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
            // Ignoră mesaje nemodelate
        }
    }, [onSelectPart]);

    // Șablonul HTML5 + WebGL Three.js complet autonom
    const htmlContent = useMemo(() => `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; -webkit-user-select: none; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: #04070D; }
        #webgl-canvas { width: 100%; height: 100%; display: block; }
        #loading-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            background: #04070DEE; color: #00F0FF; font-family: monospace; font-size: 11px;
            letter-spacing: 1.5px; z-index: 10; pointer-events: none; transition: opacity 0.4s ease;
        }
        .spinner {
            width: 32px; height: 32px; border: 2px solid #00F0FF22;
            border-top: 2px solid #00F0FF; border-radius: 50%;
            animation: spin 0.8s linear infinite; margin-bottom: 12px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>

    <!-- Încărcare Three.js r128 cu fallback automat CDN -->
    <script src="${serverUrl}/three.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';"></script>
    <script src="${serverUrl}/OrbitControls.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';"></script>
    <script src="${serverUrl}/GLTFLoader.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';"></script>
</head>
<body>
    <div id="loading-overlay">
        <div class="spinner"></div>
        <div id="progress-text">INITIALIZARE MOTOR 3D...</div>
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

        // ── 1. INITIALIZARE SCENA & RENDERER THREE.JS ─────────────────────────
        var scene = new THREE.Scene();
        scene.background = new THREE.Color(0x04070D);

        var camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(3.8, 1.8, 4.2);

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        var controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.maxPolarAngle = Math.PI / 2 + 0.05;
        controls.minDistance = 1.2;
        controls.maxDistance = 12.0;
        controls.target.set(0, 0.5, 0);

        // ── 2. ILUMINARE DE STUDIO FOTOREALISTA (PBR STUDIO LIGHTING) ─────────
        var hemiLight = new THREE.HemisphereLight(0xD8E5F8, 0x0A0F1A, 0.85);
        scene.add(hemiLight);

        var keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.6);
        keyLight.position.set(5, 8, 5);
        keyLight.castShadow = true;
        scene.add(keyLight);

        var fillLight = new THREE.DirectionalLight(0x00E5FF, 0.7);
        fillLight.position.set(-6, 4, -4);
        scene.add(fillLight);

        var rimLight = new THREE.DirectionalLight(0xFFB800, 0.6);
        rimLight.position.set(0, 6, -6);
        scene.add(rimLight);

        // Contact shadow plane sub roți
        var shadowPlaneGeo = new THREE.PlaneGeometry(6, 6);
        var shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.45 });
        var shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = 0.01;
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);

        // Grid fin stil CAD
        var grid = new THREE.GridHelper(10, 20, 0x00F0FF, 0x122238);
        grid.position.y = 0.0;
        scene.add(grid);

        // ── 3. GRUPURI DE ENTITĂȚI ────────────────────────────────────────────
        var carModelRoot = new THREE.Group();
        scene.add(carModelRoot);

        var internalOrgansGroup = new THREE.Group();
        scene.add(internalOrgansGroup);

        var pinsGroup = new THREE.Group();
        scene.add(pinsGroup);

        // ── 4. CONSTRUCȚIA CELOR 8 SUBSISTEME MECANICE 3D INTERNE ─────────────
        var organs = {};

        // 1. MOTOR (ENGINE) — Bloc 5-Cilindri + Pistoane mobile
        var engineGroup = new THREE.Group();
        var blockMat = new THREE.MeshStandardMaterial({ color: 0x2A313D, metalness: 0.85, roughness: 0.35 });
        var blockMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 1.0), blockMat);
        blockMesh.position.set(0, 0.65, 1.25);
        engineGroup.add(blockMesh);

        var headMat = new THREE.MeshStandardMaterial({ color: 0xC8D3E0, metalness: 0.9, roughness: 0.2 });
        var headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.95), headMat);
        headMesh.position.set(0, 0.95, 1.25);
        engineGroup.add(headMesh);

        // 5 Pistoane 3D
        var pistons = [];
        var pistonMat = new THREE.MeshStandardMaterial({ color: 0xE0E6ED, metalness: 0.95, roughness: 0.15 });
        for (var i = 0; i < 5; i++) {
            var pMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), pistonMat);
            pMesh.position.set(0, 0.72, 0.85 + i * 0.19);
            engineGroup.add(pMesh);
            pistons.push(pMesh);
        }
        organs['engine'] = { group: engineGroup, center: new THREE.Vector3(0, 0.75, 1.25) };
        internalOrgansGroup.add(engineGroup);

        // 2. TURBOCHARGER (TURBINĂ CHRA)
        var turboGroup = new THREE.Group();
        var compMat = new THREE.MeshStandardMaterial({ color: 0x90A4AE, metalness: 0.9, roughness: 0.2 });
        var compHousing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.06, 16, 24), compMat);
        compHousing.position.set(0.38, 0.72, 1.1);
        compHousing.rotation.y = Math.PI / 2;
        turboGroup.add(compHousing);

        var turbMat = new THREE.MeshStandardMaterial({ color: 0x3E2723, emissive: 0x000000, metalness: 0.7, roughness: 0.5 });
        var turbHousing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.055, 16, 24), turbMat);
        turbHousing.position.set(0.38, 0.72, 0.95);
        turbHousing.rotation.y = Math.PI / 2;
        turboGroup.add(turbHousing);
        organs['turbo'] = { group: turboGroup, center: new THREE.Vector3(0.38, 0.72, 1.05), turbMat: turbMat };
        internalOrgansGroup.add(turboGroup);

        // 3. RĂCIRE (COOLING) — Radiator + Intercooler + 2 Ventilatoare
        var coolingGroup = new THREE.Group();
        var radMat = new THREE.MeshStandardMaterial({ color: 0x37474F, metalness: 0.6, roughness: 0.4 });
        var radiator = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.08), radMat);
        radiator.position.set(0, 0.55, 1.95);
        coolingGroup.add(radiator);

        var fanMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.8 });
        var fan1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16), fanMat);
        fan1.position.set(-0.22, 0.55, 1.9);
        fan1.rotation.x = Math.PI / 2;
        var fan2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16), fanMat);
        fan2.position.set(0.22, 0.55, 1.9);
        fan2.rotation.x = Math.PI / 2;
        coolingGroup.add(fan1);
        coolingGroup.add(fan2);
        organs['cooling'] = { group: coolingGroup, center: new THREE.Vector3(0, 0.55, 1.95), fans: [fan1, fan2] };
        internalOrgansGroup.add(coolingGroup);

        // 4. TRANSMISIE & QUATTRO (TRANSMISSION) — Cutie, Cardan, Diferențial
        var transGroup = new THREE.Group();
        var gearMat = new THREE.MeshStandardMaterial({ color: 0x455A64, metalness: 0.8, roughness: 0.3 });
        var gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, 0.65), gearMat);
        gearbox.position.set(0, 0.48, 0.55);
        transGroup.add(gearbox);

        var shaftMat = new THREE.MeshStandardMaterial({ color: 0x78909C, metalness: 0.9, roughness: 0.2 });
        var driveShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 16), shaftMat);
        driveShaft.position.set(0, 0.38, -0.6);
        driveShaft.rotation.x = Math.PI / 2;
        transGroup.add(driveShaft);

        var diff = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), gearMat);
        diff.position.set(0, 0.38, -1.55);
        transGroup.add(diff);
        organs['transmission'] = { group: transGroup, center: new THREE.Vector3(0, 0.45, 0.2), driveShaft: driveShaft };
        internalOrgansGroup.add(transGroup);

        // 5. DPF & EVACUARE (DPF) — Traseu eșapament + Canistră DPF
        var dpfGroup = new THREE.Group();
        var exhaustCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.35, 0.65, 0.9),
            new THREE.Vector3(0.18, 0.4, 0.3),
            new THREE.Vector3(0.18, 0.35, -0.8),
            new THREE.Vector3(0.25, 0.38, -1.9),
            new THREE.Vector3(0.3, 0.38, -2.15)
        ]);
        var exhMat = new THREE.MeshStandardMaterial({ color: 0x9E9E9E, metalness: 0.7, roughness: 0.4 });
        var exhPipe = new THREE.Mesh(new THREE.TubeGeometry(exhaustCurve, 32, 0.04, 12, false), exhMat);
        dpfGroup.add(exhPipe);

        var dpfCanisterMat = new THREE.MeshStandardMaterial({ color: 0x424242, emissive: 0x000000, metalness: 0.6, roughness: 0.5 });
        var dpfCanister = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.48, 16), dpfCanisterMat);
        dpfCanister.position.set(0.18, 0.37, -0.2);
        dpfCanister.rotation.x = Math.PI / 2;
        dpfGroup.add(dpfCanister);
        organs['dpf'] = { group: dpfGroup, center: new THREE.Vector3(0.18, 0.37, -0.2), dpfMat: dpfCanisterMat };
        internalOrgansGroup.add(dpfGroup);

        // 6. FRÂNE PE 4 ROȚI (BRAKES)
        var brakesGroup = new THREE.Group();
        var brakeRotors = [];
        var rotorMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, emissive: 0x000000, metalness: 0.95, roughness: 0.1 });
        var caliperMat = new THREE.MeshStandardMaterial({ color: 0xD50000, metalness: 0.7, roughness: 0.3 });

        var wheelPositions = [
            [-0.78, 0.35,  1.35], // Față Stânga
            [ 0.78, 0.35,  1.35], // Față Dreapta
            [-0.78, 0.35, -1.35], // Spate Stânga
            [ 0.78, 0.35, -1.35], // Spate Dreapta
        ];
        wheelPositions.forEach(function(pos) {
            var rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 24), rotorMat);
            rotor.position.set(pos[0], pos[1], pos[2]);
            rotor.rotation.z = Math.PI / 2;
            brakesGroup.add(rotor);
            brakeRotors.push(rotor);

            var caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.12), caliperMat);
            caliper.position.set(pos[0], pos[1] + 0.08, pos[2]);
            brakesGroup.add(caliper);
        });
        organs['brakes'] = { group: brakesGroup, center: new THREE.Vector3(0, 0.35, 1.35), rotors: brakeRotors, rotorMat: rotorMat };
        internalOrgansGroup.add(brakesGroup);

        // 7. BATERIE & ECU (BATTERY)
        var batteryGroup = new THREE.Group();
        var batMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.7 });
        var batMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.25), batMat);
        batMesh.position.set(-0.35, 0.85, 1.15);
        batteryGroup.add(batMesh);

        var ecuMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.08), new THREE.MeshStandardMaterial({ color: 0x00E5FF, metalness: 0.8, roughness: 0.2 }));
        ecuMesh.position.set(-0.38, 0.75, 0.85);
        batteryGroup.add(ecuMesh);
        organs['battery'] = { group: batteryGroup, center: new THREE.Vector3(-0.35, 0.85, 1.15) };
        internalOrgansGroup.add(batteryGroup);

        // 8. SUSPENSIE PE 4 ROȚI (SUSPENSION)
        var suspGroup = new THREE.Group();
        var springs = [];
        var springMat = new THREE.MeshStandardMaterial({ color: 0xFFB800, metalness: 0.9, roughness: 0.2 });
        wheelPositions.forEach(function(pos) {
            var spring = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.35, 12, 8, true), springMat);
            spring.position.set(pos[0] * 0.78, pos[1] + 0.2, pos[2]);
            suspGroup.add(spring);
            springs.push(spring);
        });
        organs['suspension'] = { group: suspGroup, center: new THREE.Vector3(0, 0.55, 0), springs: springs };
        internalOrgansGroup.add(suspGroup);

        // ── 5. PINI INTERACTIVI 3D ────────────────────────────────────────────
        var pinColors = {
            engine: 0x00FF66, turbo: 0xFF5500, cooling: 0x00E5FF, transmission: 0xFFB800,
            dpf: 0x9C27B0, brakes: 0xFF2A2A, battery: 0x00F0FF, suspension: 0xFFFF00
        };

        Object.keys(organs).forEach(function(key) {
            var org = organs[key];
            var pinMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.065, 16, 16),
                new THREE.MeshBasicMaterial({ color: pinColors[key] || 0x00F0FF, wireframe: true })
            );
            pinMesh.position.copy(org.center);
            pinMesh.userData = { partId: key };
            pinsGroup.add(pinMesh);
        });

        // ── 6. ÎNCĂRCARE MODEL 3D GLB ACURA CDX FOTOREALIST ───────────────────
        var carMaterials = [];
        var gltfLoader = new THREE.GLTFLoader();
        var modelUrl = "${serverUrl}/models/acura_cdx.glb";

        gltfLoader.load(
            modelUrl,
            function(gltf) {
                var carScene = gltf.scene;

                // Calibrare dimensiune și centrare automată pe șasiu
                var bbox = new THREE.Box3().setFromObject(carScene);
                var size = bbox.getSize(new THREE.Vector3());
                var maxDim = Math.max(size.x, size.y, size.z);
                var scaleFactor = 4.2 / maxDim;
                carScene.scale.set(scaleFactor, scaleFactor, scaleFactor);

                var center = bbox.getCenter(new THREE.Vector3());
                carScene.position.x = -center.x * scaleFactor;
                carScene.position.y = -bbox.min.y * scaleFactor;
                carScene.position.z = -center.z * scaleFactor;

                // Colectare materiale pentru comutare X-Ray / Studio PBR / Wireframe
                carScene.traverse(function(node) {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        if (node.material) {
                            var mat = node.material.clone();
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
                console.warn('Eroare incarcare GLB:', err);
                progressText.innerText = 'MODEL PROCEDURAL ACTIVAT';
                setTimeout(function() { loadingOverlay.style.display = 'none'; }, 1000);
                sendToRN({ type: 'LOADED' });
            }
        );

        // ── 7. LOGICĂ MODURI VIZUALE (STUDIO / X-RAY / HOLOGRAM / ISOLATED) ───
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
                Object.keys(organs).forEach(function(k) { organs[k].group.visible = true; });
                carMaterials.forEach(function(item) {
                    var m = item.mesh;
                    var name = (m.name || '').toLowerCase();
                    var isBody = name.indexOf('body') !== -1 || name.indexOf('door') !== -1 || name.indexOf('fender') !== -1 || name.indexOf('bonnet') !== -1 || name.indexOf('carpaint') !== -1;
                    if (isBody) {
                        m.material.transparent = true;
                        m.material.opacity = 0.22;
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
                    item.mesh.material.opacity = 0.5;
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
                    controls.target.copy(organs[currentSelectedPart].center);
                }
            }
        }

        // ── 8. ANIMATIE EXPLOZIE 3D (EXPLODED VIEW ASSEMBLY) ─────────────────
        var explodeFactor = 0.0;
        function updateExplode(delta) {
            var target = isExploded ? 1.0 : 0.0;
            explodeFactor += (target - explodeFactor) * 0.1;
            if (currentSelectedPart === 'turbo' && organs['turbo']) {
                organs['turbo'].group.children.forEach(function(child, idx) {
                    child.position.x = (idx === 0 ? 0.38 + explodeFactor * 0.45 : 0.38 - explodeFactor * 0.45);
                });
            }
            if (currentSelectedPart === 'engine' && organs['engine']) {
                pistons.forEach(function(p, idx) {
                    p.position.y = 0.72 + (explodeFactor * 0.5) + Math.sin(Date.now() * 0.01 + idx) * 0.04;
                });
            }
        }

        // ── 9. GESTIONARE EVENIMENTE DE LA REACT NATIVE ───────────────────────
        function onRNMessage(msgStr) {
            try {
                var data = JSON.parse(msgStr);
                if (data.type === 'STATE_CHANGE') {
                    currentSelectedPart = data.selectedPart;
                    isExploded = !!data.exploded;
                    controls.autoRotate = !!data.autoRotate;
                    controls.autoRotateSpeed = 2.0;

                    if (data.cameraPreset === 'ENGINE_BAY') {
                        flyCameraTo(new THREE.Vector3(0, 1.4, 2.4), new THREE.Vector3(0, 0.7, 1.25));
                    } else if (data.cameraPreset === 'CHASSIS_BRAKES') {
                        flyCameraTo(new THREE.Vector3(1.6, 0.8, 1.8), new THREE.Vector3(0.78, 0.35, 1.35));
                    } else if (data.cameraPreset === 'HIGHWAY_CHASE') {
                        flyCameraTo(new THREE.Vector3(0, 1.2, -4.5), new THREE.Vector3(0, 0.6, 0));
                    } else if (data.cameraPreset === 'OVERVIEW') {
                        flyCameraTo(new THREE.Vector3(3.8, 1.8, 4.2), new THREE.Vector3(0, 0.5, 0));
                    }

                    applyVisualMode(data.visualMode || currentVisualMode);
                } else if (data.type === 'TELEMETRY_UPDATE') {
                    // Reacție termică la turbină
                    if (organs['turbo'] && organs['turbo'].turbMat) {
                        var heat = Math.min(1.0, Math.max(0, (data.chraTemp - 300) / 450));
                        organs['turbo'].turbMat.emissive.setRGB(heat * 0.95, heat * 0.28, 0.0);
                    }
                    // Reacție termică la frâne
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
                        organs['transmission'].driveShaft.rotation.y += (data.speed * 0.015);
                    }
                }
            } catch(e) {}
        }
        window.addEventListener('message', function(e) { onRNMessage(e.data); });
        document.addEventListener('message', function(e) { onRNMessage(e.data); });

        // ── 10. FLY-TO ANIMAT AL CAMEREI ──────────────────────────────────────
        var camTargetPos = null;
        var camTargetLook = null;
        function flyCameraTo(pos, look) {
            camTargetPos = pos;
            camTargetLook = look;
        }

        // ── 11. CLICK PE PINI 3D (RAYCASTING) ─────────────────────────────────
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

        // ── 12. RENDER LOOP 60 FPS ───────────────────────────────────────────
        var clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            var delta = clock.getDelta();

            // Lerp cameră dacă este activ un fly-to
            if (camTargetPos) {
                camera.position.lerp(camTargetPos, 0.08);
                controls.target.lerp(camTargetLook, 0.08);
                if (camera.position.distanceTo(camTargetPos) < 0.05) {
                    camTargetPos = null;
                    camTargetLook = null;
                }
            }

            // Pulsare vizuală pini
            var t = Date.now() * 0.003;
            pinsGroup.children.forEach(function(p, i) {
                var s = 1.0 + Math.sin(t + i) * 0.22;
                p.scale.set(s, s, s);
            });

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
                        SE ÎNCARCĂ MODELUL 3D ACURA CDX {loadProgress > 0 ? `(${loadProgress}%)` : ''}
                    </Text>
                </View>
            )}

            {/* Selector Rapid Moduri Vizuale Suprapuse */}
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
    overlayBar: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        gap: 6,
        zIndex: 10,
    },
    overlayBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(6, 12, 22, 0.75)',
        borderWidth: 1,
        borderColor: 'rgba(0, 240, 255, 0.3)',
    },
    overlayBtnActive: {
        backgroundColor: 'rgba(0, 240, 255, 0.25)',
        borderColor: '#00F0FF',
    },
    overlayBtnText: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    overlayBtnTextActive: {
        color: '#00F0FF',
    },
});
