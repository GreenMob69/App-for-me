# PROJECT CONTEXT & ARCHITECTURE BIBLE FOR AI ASSISTANTS

> **Document Type**: Master Technical Specification & Architecture Blueprint
> **Target Audience**: Any AI Agent (Claude, Gemini, GPT, DeepSeek, Cursor, Copilot, etc.) tasked with maintaining, extending, refactoring, or generating code/features for this repository.
> **Language & Terminology**: Code comments, automotive domain descriptions, and UI strings are primarily in **Romanian**; architectural terms, variable names, and code tokens are in **English**.

---

## 1. Executive Summary & Scope

- **Project Name**: `telemetrie-licenta` (Automotive Telemetry, Diagnostics & Predictive Maintenance Platform).
- **Type**: Bachelor’s Thesis Project (*Lucrare de Licență*).
- **Platform Scope**: **Universal & Multi-Vehicle**. The platform is designed to be vehicle-agnostic across any standard OBD-II / EOBD vehicle (Diesel, Petrol, Hybrid, EV), supporting dynamic VIN onboarding, adaptive capabilities (`VehicleCapabilities.js`), and modular knowledge packs (`generic_diesel`, `generic_petrol`, `vag_tdi`).
- **Testbed / Prototype Vehicle (Hardware Validation)**:
  - **Model**: Audi A6 C4 (1994–1997), **2.5 TDI R5 (5 cilindri în linie / Inline-5)**, Engine Code: `AEL` (140 HP / 103 kW), Bosch EDC15M+ / MSA15 ECU. *(Note: AEL is an Inline-5 engine, NOT a V6; V6 2.5 TDI AFB/AKN appeared only on A6 C5).*
  - **Physical Acquisition vs. Simulation**:
    - **Physical Vehicle (K-Line)**: On the physical Audi A6 C4, diagnostics run over K-Line via the proprietary **VAG KWP1281 protocol** (baudrate 9600/1200 bps, reading a limited set of measuring blocks, no factory DPF).
    - **Universal Platform Simulation (SAE J1979 / CAN)**: The full high-frequency stream of 90+ PIDs (including DPF soot, rail pressure, torque, boost, and SAE J1979 modern OBD-II parameters) is simulated and validated via [`simulator.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/simulator.js) and dynamically adapted per car by [`VehicleCapabilities.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/backend/capabilities/VehicleCapabilities.js). This bridges legacy K-Line physical testing with modern high-speed automotive architectures.
  - **Fallback VIN**: `WAUZZZ4A1RN000000`. Used as the default identifier when no vehicle is explicitly selected. AI assistants must keep code modular and never hardcode Audi-specific assumptions into generic analytical engines.
- **Core Concept**: Replace professional automotive OBD-II scanners with a dedicated mobile application + intelligent backend that adds advanced analytics:
  1. Real-time multi-parameter telemetry stream (90+ PIDs).
  2. Trip-end comprehensive health scoring & driving style evaluation.
  3. Industrial rule-based diagnostic engine with probability ratings.
  4. Causal reasoning graph (separating root causes from symptom cascades).
  5. Predictive component failure forecasting (EGR, DPF, Turbo, Alternator, Fuel Pump, MAF, etc.).
  6. Dynamic per-vehicle baseline adaptation (moving average deviation).
  7. Digital Twin state representation.
  8. AI assistant with vehicle context injection (via Groq SDK / LLM).
  9. Offline storage & sync via ESP32 micro-SD card logging.
  10. Standalone React Native mobile application with biometric security & offline SQLite cache.

---

## 2. Technology Stack & Environment

| Layer | Technologies & Dependencies | Notes |
|---|---|---|
| **Backend Runtime** | Node.js (CommonJS), Express 5 (`^5.2.1`), HTTP + Socket.IO (`^4.8.3`) | Modular routes in `routes/`, server in `server.js` |
| **Database** | SQLite 3 (`sqlite3 ^6.0.1`) | Active file: `telemetrie_industriala.db` in `WAL` mode (`PRAGMA journal_mode=WAL;`) |
| **Telemetry Transport** | MQTT 5 (`mqtt ^5.15.2`), Private broker: `84.235.164.52:1883` | Mosquitto pe Oracle Cloud (fallback: `broker.emqx.io:1883`), topic: `telemetrie/obd2` |
| **AI / LLM Integration** | Groq SDK (`groq-sdk ^1.3.0`) | Model: Llama-3 / Mixtral for contextual Q&A in `GeminiService.js` |
| **PDF Generation** | PDFKit (`pdfkit ^0.19.1`) | Multi-page inspection & trip summary reports |
| **Mobile App (Frontend)** | React Native `0.81.5`, Expo `~54.0.8`, React `19.1.0` | Standalone APK via EAS Build (`eas.json`) |
| **Mobile Navigation** | `@react-navigation/native ^7.3.8`, bottom tabs + native stack | 4 primary tabs: STARE, LIVE, CURSE, VEHICUL |
| **Mobile State & Cache** | Context API, `@react-native-async-storage/async-storage`, `expo-sqlite` | Local offline trip cache in `localDB.js` |
| **Mobile Security** | `expo-local-authentication ^17.0.8` | Biometrics (FaceID/Fingerprint) + PIN fallback |
| **Mobile Charts & Gauges** | `react-native-gifted-charts ^1.4.77`, `react-native-svg 15.12.1` | Ring buffer (600 points = 10 min @ 1Hz) for zero-GC lag |
| **Cloud Deployment** | Oracle Cloud Infrastructure (OCI) Ubuntu VM (`84.235.164.52`) | Process manager: `pm2`, SSH key: `ssh-key-2026-07-17 (1).key` |
| **Hardware Firmware** | ESP32 C++ Arduino framework (`SDSyncModule.h`) | SPI SD Card (CS Pin 5), batch HTTP sync to `/api/sync/obd` |

---

## 3. High-Level Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATA ACQUISITION SOURCES                              │
│                                                                                 │
│   [ Physical Car (Audi / Generic) ]                [ Software Simulator ]       │
│        │                                                    │                   │
│        ├─ (Live Stream) ──> ESP32 WiFi                      ├─ simulator.js     │
│        │         │                                          │  (90+ PIDs)       │
│        │         ▼                                          │                   │
│        │   MQTT Broker (84.235.164.52:1883 - Mosquitto) <───┘                   │
│        │         │                                                              │
│        └─ (Offline Backup) ──> ESP32 SD Card (CSV)                              │
│                                     │                                           │
└─────────────────────────────────────┼───────────────────────────────────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
               ▼ (Live MQTT Stream)                          ▼ (Offline Batch Sync)
       handlers/mqttHandler.js                       routes/sync.js (/api/sync/obd)
               │                                             │
               │  PORNIRE: init trip in calatorii            │  Parse CSV batches
               │  MERS: write telemetrie_flux                │  Insert trip & flux
               │  OPRIRE: execute full pipeline              │  Compute trip_summary
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ SQLite Database (WAL Mode)│
                        │ telemetrie_industriala.db │
                        └─────────────┬─────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
            ▼                         ▼                         ▼
  [ Real-Time WebSockets ]   [ Analysis Pipeline ]     [ REST API Endpoints ]
    - telemetrie_live          backend/analyzers/        - /api/calatorii
    - alerta_live              backend/diagnostics/      - /api/vehicul
    - status_trip              backend/intelligence/     - /api/vehicles
                               backend/digitalTwin/      - /api/ai/expert
                               backend/reasoning/        - /api/sync
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │    MOBILE APPLICATION (React Native) │
                   │  - Live Gauges & Oscilloscope        │
                   │  - Natural Language Health Verdict   │
                   │  - Historical Trips & PDF Export     │
                   │  - Maintenance & Document Expirations│
                   │  - Groq AI Diagnostic Assistant      │
                   │  - Local SQLite Cache (Offline First)│
                   └──────────────────────────────────────┘
```

---

## 4. Exhaustive Physical Codebase Inventory

### 4.1. Root Directory
- **`server.js`**: Backend entrypoint. Boots Express 5, HTTP server, Socket.IO. Opens `telemetrie_industriala.db` in WAL mode, initializes tables & indexes, boots `startWatchdog()`, `createMqttClient()`, mounts all routes under `/api` and `/admin`.
- **`simulator.js`**: Standalone vehicle telemetry generator. Connects to the private Mosquitto broker on `84.235.164.52:1883` (configurable via `process.env.MQTT_BROKER_URL`, fallback: `broker.emqx.io`) and simulates a realistic 10-minute driving profile (idle, city acceleration, highway cruising, hard braking at seconds 310 & 430, thermal physics, injection quantities, DPF soot accumulation).
- **`package.json` & `package-lock.json`**: Backend dependencies (Express, CORS, SQLite3, MQTT, Socket.IO, Groq, PDFKit).
- **`.env` / `.env.example`**: Secrets configuration (`GROQ_API_KEY`, `PORT=3000`, `DB_PATH=./telemetrie_industriala.db`).
- **`GHID_RAPID_OBSIDIAN.md`**: Developer cheat sheet for terminal commands, Oracle Cloud SSH, and APK building.

### 4.2. Core Backend Modules (`backend/`)
#### `backend/analyzers/`
- **`config.js`**: **SINGLE POINT OF TRUTH** for physical constants. Defines `FIELD_MAP` (MQTT packet key mapping), `PID_CONFIG`, `THRESHOLD_CONFIG`, and `THRESHOLDS` (hard brake G `-0.40`, hard accel G `0.35`, overspeed `130 km/h`, diesel price `7.5 RON/L`, CO2 factor `2.68 kg/L`).
- **`HealthEngine.js`**: Calculates multi-dimensional vehicle health score. Supports both Universal mode (weighted sum of active subsystem scores from `PowertrainProfile`) and Legacy mode (`0.35 * engine + 0.25 * safety + 0.20 * driving + 0.20 * fuel`).
- **`SubsystemScorer.js`**: Granular health scorers for individual vehicle systems: Engine, Cooling, Lubrication, Turbo, Fuel, Electrical, DPF, Transmission.
- **`TrendEngine.js`**: Evaluates degradation trends across consecutive trips using linear regression / slope analysis (e.g. rising coolant temperature trend, falling MAF/boost).
- **`TripAnalyzer.js`**: Lightweight in-memory aggregator running on every live packet. Tracks time spent in RPM zones (Zone 1: <1500, Zone 2: 1500-2500, Zone 3: >2500), driving style (% smooth, % economic, % aggressive), and debounces transient events.
- **`TripSummary.js`**: Builds the final statistical summary of a trip (min, max, average for speed, RPM, coolant, oil, boost, MAF, voltage, fuel rate).
- **`index.js`**: Analyzer entrypoint. Exports `createAnalysis()`, `updateAnalyzer(trip, pachet)`, and `finalizeTripAnalysis(trip, opts)` which orchestrates the entire diagnostic pipeline at `OPRIRE`.

#### `backend/capabilities/`
- **`VehicleCapabilities.js`**: Inspects vehicle specs and coverage to derive capability flags: `hasTurbo`, `hasDPF`, `hasEGR`, `hasIntercooler`, `hasCatalyticConverter`, `fuelType` ('diesel'|'petrol'|'hybrid'|'ev'), `powertrainType`. Ensures non-applicable tests are skipped for petrol/EV.

#### `backend/diagnostics/`
- **`RuleEngine.js`**: Industrial diagnostic inference engine. Aggregates all rules, evaluates them against `DiagnosticContext`, applies knowledge pack rules, and outputs hypothesis probabilities (0-100%).
- **`DiagnosticStrategyRegistry.js`**: Detailed troubleshooting procedures and diagnostic checklists per subsystem (what sensor to inspect, expected multimeter readings, visual checks).
- **`EngineRules.js`**: Detects high RPM at low speed (clutch slip), high load with low MAF (air filter / MAF failure), idle RPM fluctuations (EGR stick).
- **`TurboRules.js`**: Detects boost under-pressure, over-boost, slow spooling / turbo lag, N75 valve sticking.
- **`FuelRules.js`**: High fuel rate deviation, injector delivery imbalance, rail pressure drop under load.
- **`CoolingRules.js`**: Thermostat stuck open (slow warm-up), thermostat stuck closed (overheating >100°C), thermal runaway.
- **`ElectricalRules.js`**: Alternator diode failure / undercharging (<13.2V), battery low cranking voltage (<11.8V), overcharging (>14.8V).
- **`DpfRules.js`**: Soot accumulation rate abnormal, differential pressure high, interrupted regeneration cycles.
- **`LambdaRules.js`**: Rich/lean air-fuel mixture anomalies, lambda sensor response time degradation.
- **`TransmissionRules.js`**: Gear-to-speed ratio mismatches, torque converter slip.
- **`DtcRules.js`**: Maps active OBD DTC codes directly to diagnostic hypotheses with 95-100% confidence.
- **`BehaviorRules.js`**: Aggressive driving penalties, kickdown abuse, excessive stationary idling.

#### `backend/digitalTwin/`
- **`VehicleDigitalTwin.js`**: Unified digital representation of vehicle status (identity, telemetry snapshot, subsystems health, diagnostic reasoning, predicted failures).
- **`VehicleDigitalTwinBuilder.js`**: Assembles the digital twin by querying the DB and running contextual diagnostics.
- **`DigitalTwinSnapshot.js`**: Creates timestamped frozen snapshots of vehicle health for historical comparisons.
- **`DigitalTwinSerializer.js`**: Serializes twin state into clean JSON for mobile and API consumption.

#### `backend/failures/`
- **`FailureLibrary.js`**: Loads and indexes JSON failure models.
- **`definitions/*.json`**: 11 industrial failure models:
  - `alternator_failure.json`
  - `battery_degradation.json`
  - `cooling_system.json`
  - `dpf_clogging.json`
  - `egr_carbon.json`
  - `fuel_pump.json`
  - `injector_wear.json`
  - `maf_degradation.json`
  - `timing_belt_wear.json`
  - `turbo_wear.json`
  - `vacuum_leak.json`

#### `backend/intelligence/`
- **`BaselineEngine.js`**: Computes moving average baselines per VIN for key sensors (RPM, MAF, boost, coolant, voltage). Detects slow sensor drift.
- **`CausalGraph.js` & `backend/reasoning/ReasoningEngine.js`**: Directed Acyclic Graph (DAG) isolating root causes from downstream cascading symptoms (e.g. MAF leak causes Lean Code, which causes Misfire — MAF is root cause, Misfire is effect).
- **`FaultPredictionEngine.js`**: Estimates 0-95% probability of component failure in the near future based on trend slopes and rule outputs.
- **`ExpertQueryEngine.js`**: Automotive query parser that answers driver questions with structured vehicle telemetry.
- **`GeminiService.js`**: Groq SDK wrapper calling LLMs (Llama-3/Mixtral) with vehicle telemetry prompts.
- **`SensorQualityEngine.js`**: Evaluates sensor reliability, identifying stuck values, noise, and unrealistic spikes.
- **`CorrelationEngine.js`**: Cross-sensor Pearson correlation (RPM vs MAF, Boost vs MAP, Speed vs Throttle).
- **`VehicleDNA.js`**: Persistent vehicle health fingerprint summarizing lifetime score averages.

#### `backend/knowledge/`
- **`KnowledgeBase.js`**: Rule repository loader.
- **`KnowledgePackRegistry.js`**: Registry for powertrain-specific knowledge packs (`generic_diesel`, `generic_petrol`, `vag_tdi`).
- **`KnowledgePackLoader.js`**: Dynamic loader for vehicle rule packs.
- **`rules.json`**: Pre-compiled automotive diagnostic rules.

#### `backend/pdf/`
- **`PDFReportGenerator.js`**: Generates professional multi-page vector PDF inspection reports using PDFKit.

#### `backend/powertrain/`
- **`PowertrainProfileRegistry.js`**: Powertrain configurations for ICE Diesel, ICE Petrol, Hybrid HEV, and Battery Electric (BEV).

#### `backend/recommendations/`
- **`RecommendationEngine.js`**: Generates actionable, prioritized driver recommendations (IMMEDIATE, NEXT_SERVICE, PREVENTIVE).

#### `backend/vehicle-profile/`
- **`index.js`**: Boots vehicle profile schemas, routes, and event listeners.
- **`schema.js`**: SQL DDL for vehicles, mileage log, workshops, service sessions, maintenance items, milestones, timeline, documents.
- **`routes.js`**: REST controllers for vehicles, workshops, service records, and maintenance countdowns.
- **`MaintenanceCalculator.js`**: Computes remaining km / days for oil, filters, timing belt, brake fluid.
- **`VehicleTimeline.js`**: Event-driven chronological vehicle history.
- **`MilestoneTracker.js`**: Detects and records odometer milestones (e.g. 100,000 km, 200,000 km).
- **`DocumentsModule.js`**: Tracks vehicle legal documents (ITP inspection, RCA insurance, Rovinieta vignette, CASCO) with expiration alerts.
- **`VinDecoder.js`**: VIN decoder parsing standard ISO 3779 VINs to extract manufacturer, model year, and engine.
- **`EventBus.js`**: Internal Node.js `EventEmitter` for decoupling trip completion, mileage updates, and alerts.

### 4.3. Services, Handlers & Middleware
- **`handlers/mqttHandler.js`**: MQTT message handler. Manages trip state machine:
  - `PORNIRE`: Creates active trip record in memory and inserts row into `calatorii`.
  - `MERS`: Writes row to `telemetrie_flux` and emits `telemetrie_live` via WebSocket.
  - `OPRIRE`: Gathers raw packets, executes `finalizeTripAnalysis()`, writes `trip_summary`, emits `status_trip` with full report, and fires `vehicleEventBus` events.
- **`services/vehicleSyncService.js`**: Atomic synchronization bridge between `vehicule` (core telemetry table) and `vehicles` (extended profile table). Exports `syncVehicleProfile(db, vin, data)` and `syncOdometer(db, vin, odometerKm, source, note)` with duplicate deduplication.
- **`services/activeTrips.js`**: In-memory map of ongoing trips indexed by VIN.
- **`services/dtcService.js`**: In-memory array of active Diagnostic Trouble Codes.
- **`services/tripInsights.js`**: Generates human-readable natural language insights for a completed trip.
- **`services/watchdog.js`**: Periodically checks for abandoned trips (>10 min without packets) and auto-closes them; deletes raw telemetry rows older than 90 days.
- **`middleware/auth.js`**: Simple token-based authorization middleware protecting `/admin` and destructive operations.

### 4.4. Hardware Layer (`esp32/`)
- **`esp32/SDSyncModule.h`**: Complete C++ Arduino class for ESP32 microcontrollers:
  - Micro-SD card logging using SPI (CS Pin 5).
  - Format: CSV (`timestamp_ms,rpm,viteza,temp_apa,voltaj,sarcina,consum_lh,boost`).
  - Automatic trip detection on first packet; marks end of trip on engine stop or 5-min stationary timeout.
  - Periodic background sync (`syncPending()`) sending batches of up to 200 rows to `POST http://84.235.164.52:3000/api/sync/obd`.
  - Moves synced CSVs from `/trips/` to `/done/`.

### 4.5. Mobile Application (`app mobile/telemetrie-app/`)
- **`App.js`**: Root component. Sets up `VehicleProvider` -> `AppRoot` -> `TelemetryProvider` -> `SecurityProvider` -> `SecurityGate` (`LockScreen`) -> `AppNavigator`.
- **`src/context/`**:
  - `LiveContext.js`: WebSocket subscriber. Maintains live telemetry state and a circular ring buffer of 600 history points.
  - `AlertContext.js`: Manages active alerts, audio/haptic feedback, and alert acknowledgment.
  - `VehicleContext.js`: Provides active vehicle identity (VIN, display name, fuel type) and vehicle switching.
  - `SecurityContext.js`: Handles biometric authentication, auto-lock timer, and PIN fallback.
  - `TelemetryContext.js`: Aggregates live and cached telemetry streams.
  - `NotificationContext.js`: Tracks unread notification badges.
  - `AppContext.js`: Top-level app connectivity state and navigation references.
- **`src/screens/`** (17 screens):
  - `LiveDashboardScreen.js`: Real-time instrument cluster with dynamic redline tachometer (temperature-adaptive: 2500 RPM on cold engine with `❄️ Motor rece` badge, 3200 RPM during warm-up, 4500 RPM optimal), SVG CircularGauge, RPM, Boost, Temperatures, and live line charts.
  - `StatusScreen.js`: The "Driver Assistant" screen. Shows a single natural language verdict ("Mașina ta este în formă excelentă"), health score, calm state, and global header with Search (`🔍`), Notifications (`🔔`), and Settings (`⚙️`).
  - `VehicleHealthScreen.js`: Subsystem health cards (Engine, Cooling, Turbo, DPF, Electrical), active fault predictions with `"✨ Întreabă AI"` deep-linking, and `CausalChainCard` visual root-cause-to-symptom diagram.
  - `SubsystemDetailScreen.js`: Deep dive into a specific subsystem's sensor values, rules, history, and contextual `"✨ Întreabă Inginerul AI"` consultation button.
  - `TripHistoryScreen.js`: Paginated logbook of past trips with offline SQLite caching, search, and filtering.
  - `TripDetailScreen.js`: Detailed analysis of a single trip: map route stats, eco score, driving style breakdown, events timeline, prediction cards with `"✨ Întreabă AI"`, and `CausalChainCard` cause-and-effect propagation diagram.
  - `TripReportScreen.js`: Modal report displayed immediately upon engine shutdown (`OPRIRE`).
  - `VehicleHubScreen.js`: 100% car-centric Digital Garage with top header bar (Search, Notifications, Settings) and 3 segmented sub-views: `MaintenanceScreen` (Mentenanță), `VehicleProfileScreen` (Profil & Acte), and `AIExpertScreen` (Asistent AI).
  - `MaintenanceScreen.js`: Visual countdowns for service items (oil change, timing belt, brake pads, filters) with color-coded urgency.
  - `VehicleProfileScreen.js`: Vehicle technical specifications, odometer history log, and legal documents expiration tracker (ITP, RCA, Rovinietă, CASCO).
  - `AIExpertScreen.js`: Interactive conversational diagnostic chat with the AI expert, supporting contextual deep-linking with auto-query from prediction/diagnostic cards.
  - `LockScreen.js`: Biometric FaceID/Fingerprint authentication screen with numeric PIN keypad.
  - `SettingsScreen.js`: Server URL configuration, biometric security settings, developer access to `UIPlaygroundScreen`, and database reset button. Accessed via top bar header (`⚙️`) across main screens.
  - `NotificationScreen.js`: Full-screen notification center for warnings, DTCs, and service reminders.
  - `GlobalSearchScreen.js`: Unified search across trips, DTC codes, maintenance records, and documentation.
  - `VehicleOnboardingScreen.js`: First-launch wizard for decoding VIN and adding a new vehicle.
  - `UIPlaygroundScreen.js`: Component showcase and testing canvas, displaying all foundational and vehicle UI components including `CausalChainCard`.
- **`src/components/ui/`**:
  - `CausalChainCard.js`: Reusable 3-stage visual diagram `[🔴 Cauză Rădăcină]` ➔ `[🟠 Efect Intermediar]` ➔ `[🟡 Simptom Observat]` with confidence badge, recommendation, and AI action trigger.
- **`src/services/`**:
  - `api.js`: Axios instance with interceptors, dynamic base URL, and timeout.
  - `socket.js`: Socket.IO client singleton with auto-reconnection.
  - `localDB.js`: Offline SQLite trip caching using `expo-sqlite`.
  - `vehicleService.js`: API helper for vehicle profile and service records.

---

## 5. Physical Hardware & Sensor Matrix

### 5.1. ESP32 Pinout & Connection
- **Microcontroller**: ESP32 DevKit V1 (38-pin or 30-pin)
- **SPI Interface to MicroSD Module**:
  - `GPIO 5`: Chip Select (CS)
  - `GPIO 18`: Serial Clock (SCK)
  - `GPIO 19`: Master In Slave Out (MISO)
  - `GPIO 23`: Master Out Slave In (MOSI)
  - `VCC`: 5V / 3.3V
  - `GND`: Ground
- **SD File Organization**:
  - `/trips/{timestamp_start}.csv`: Active or pending trips.
  - `/trips/{timestamp_start}_end{timestamp_end}.csv`: Closed trips awaiting WiFi sync.
  - `/done/{filename}.csv`: Successfully uploaded trips.

### 5.2. Core OBD-II / VAG Sensor Signal Matrix

| Signal Name | JSON Path | OBD-II PID / Channel | Physical Unit | Normal Operating Range |
|---|---|---|---|---|
| Engine Speed | `motor.rpm` | Mode 01, PID 0C | RPM | 750 – 850 (idle), 1500 – 3500 (cruise) |
| Vehicle Speed | `motor.speed` | Mode 01, PID 0D | km/h | 0 – 130 km/h |
| Engine Load | `motor.load` | Mode 01, PID 04 | % | 15 – 30% (idle), 40 – 80% (load) |
| Long. Acceleration | `motor.accel_g` | Internal / IMU | G ($m/s^2 / 9.81$) | -0.15 to +0.20 (smooth), <-0.40 (hard brake) |
| Engine Torque | `motor.torque_actual` | VAG Group 008 / EDC15 | Nm | 20 – 40 Nm (idle), 150 – 300 Nm (load) |
| Coolant Temp | `temperaturi.coolant` | Mode 01, PID 05 | °C | 85 – 92 °C (warn >95, crit >100) |
| Engine Oil Temp | `temperaturi.oil` | Mode 01, PID 5C | °C | 80 – 100 °C (warn >110, crit >120) |
| Intake Air Mass (MAF)| `aer.maf` | Mode 01, PID 10 | g/s | 3 – 6 g/s (idle), 20 – 120 g/s (load) |
| Manifold Pressure | `aer.map` | Mode 01, PID 0B | kPa | 95 – 105 kPa (atmo), up to 220 kPa |
| Turbo Boost Gauge | `aer.boost_actual` | Derived (`(map-101)/100`) | bar | 0.0 – 1.4 bar |
| ECU Battery Voltage | `baterie.ecu_volt` | Mode 01, PID 42 | V | 13.8 – 14.4 V (engine on), 12.4 – 12.7 V (off) |
| Instant Consumption | `combustibil.inst_cons`| Derived from Inj Qty | L/h (or L/100km) | 0.6 – 1.0 L/h (idle), 4.5 – 9.0 L/100km |
| DPF Soot Load | `dpf.soot_load` | VAG Group 068 | g or % | 0 – 25 g (normal), >45 g (needs regen) |

---

## 6. Mathematical Formulas & Analytical Algorithms

### 6.1. Health Scoring Engine (`HealthEngine.js`)
$$\text{Overall Health} = 0.35 \times \text{Engine} + 0.25 \times \text{Safety} + 0.20 \times \text{Driving} + 0.20 \times \text{Fuel}$$
*(All scores are clamped in the range $[0, 100]$)*

- **Driving Score**:
  $$\text{DrivingScore} = 100 - (\text{aggressivePct} \times 0.6) - \min\left(35, \frac{\text{harshEvents}}{\text{distanceKm}} \times 150\right) - (\text{kickdowns} \times 1)$$
  where $\text{harshEvents} = \text{hardBrakes} + \text{hardAccelerations} + \text{rapidDecelerations}$.

- **Safety Score**:
  $$\text{SafetyScore} = 100 - (\text{overspeeds} \times 4) - (\text{hardBrakes} \times 2) - (\text{rapidDecelerations} \times 1.5) - \min\left(15, \frac{\text{coolantTimeOver100}}{60} \times 3\right)$$

- **Eco Score (Live during trip)**:
  Starts at 100, penalized live:
  - Hard acceleration ($>0.35\text{ G}$): $-3\text{ pts}$
  - Hard brake ($<-0.40\text{ G}$): $-2\text{ pts}$
  - RPM over 3000: $-1\text{ pt}$ per 5-second window.

### 6.2. Fuel & Environmental Formulas
- **Fuel Volume**:
  $$\text{Total Liters} = \text{Idle Liters} + \text{Moving Liters}$$
  $$\text{Idle Liters} = \sum (\text{fuelRate (L/h)} \times \Delta t_{\text{hours}}) \quad \text{for } \text{speed} < 3 \text{ km/h}$$
- **Average Fuel Consumption**:
  $$\text{Consum Mediu (L/100km)} = \frac{\text{Total Liters}}{\text{Distance (km)}} \times 100$$
- **CO2 Emissions & Cost**:
  $$\text{CO}_2 \text{ (kg)} = \text{Total Liters} \times \text{EmissionFactor} \quad (\text{Diesel: } 2.68\text{ kg/L}, \text{Petrol: } 2.31\text{ kg/L})$$
  $$\text{Cost (RON)} = \text{Total Liters} \times \text{PricePerLiter} \quad (\text{Diesel: } 7.50\text{ RON/L})$$

### 6.3. Event Debouncing Algorithm
To avoid counting a continuous 3-second hard brake as 3 separate events:
```javascript
// Inside TripAnalyzer.js:
const isHardBraking = accelG < THRESHOLDS.HARD_BRAKE_G;
if (isHardBraking && !trip.state.wasHardBraking) {
    trip.summary.events.hardBrakes++; // Counted ONLY on rising edge
}
trip.state.wasHardBraking = isHardBraking;
```

---

## 7. Complete SQLite DDL Schema (`telemetrie_industriala.db`)

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. VEHICULE
CREATE TABLE IF NOT EXISTS vehicule (
    vin TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    tip_combustibil TEXT DEFAULT 'diesel',
    capacitate_rezervor_l REAL DEFAULT 80,
    odometru_calibrat_km REAL DEFAULT 0
);

-- 2. CALATORII (Trips)
CREATE TABLE IF NOT EXISTS calatorii (
    id_calatorie INTEGER PRIMARY KEY AUTOINCREMENT,
    vin TEXT NOT NULL,
    timestamp_start INTEGER NOT NULL,
    timestamp_end INTEGER,
    km_parcursi REAL DEFAULT 0,
    consum_total_l REAL DEFAULT 0,
    consum_mediu_100km REAL DEFAULT 0,
    scor_eco INTEGER DEFAULT 100,
    FOREIGN KEY (vin) REFERENCES vehicule(vin)
);

-- 3. TELEMETRIE_FLUX (Raw 1Hz Stream)
CREATE TABLE IF NOT EXISTS telemetrie_flux (
    id_flux INTEGER PRIMARY KEY AUTOINCREMENT,
    id_calatorie INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    rpm INTEGER,
    viteza_kmh INTEGER,
    sarcina_pct REAL,
    maf_gs REAL,
    map_kpa REAL,
    voltaj_v REAL,
    temp_apa_c REAL,
    temp_ulei_c REAL,
    accel_g REAL,
    consum_lh REAL,
    boost_bar REAL,
    dpf_soot REAL,
    gear INTEGER,
    torque_nm REAL,
    matrice_completa_json TEXT,
    FOREIGN KEY (id_calatorie) REFERENCES calatorii(id_calatorie)
);

-- 4. EVENIMENTE_ALERTE
CREATE TABLE IF NOT EXISTS evenimente_alerte (
    id_eveniment INTEGER PRIMARY KEY AUTOINCREMENT,
    id_calatorie INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    tip_eveniment TEXT NOT NULL,
    cod_dtc TEXT,
    valoare_masurata REAL,
    severitate TEXT NOT NULL,
    descriere TEXT,
    recunoscut_de_sofer BOOLEAN DEFAULT 0,
    FOREIGN KEY (id_calatorie) REFERENCES calatorii(id_calatorie)
);

-- 5. TRIP_SUMMARY (Post-trip aggregated statistics)
CREATE TABLE IF NOT EXISTS trip_summary (
    id_summary INTEGER PRIMARY KEY AUTOINCREMENT,
    id_calatorie INTEGER UNIQUE NOT NULL,
    durata_secunde INTEGER DEFAULT 0,
    timp_relanti_sec INTEGER DEFAULT 0,
    timp_mers_sec INTEGER DEFAULT 0,
    viteza_max REAL DEFAULT 0,
    viteza_medie REAL DEFAULT 0,
    rpm_max INTEGER DEFAULT 0,
    rpm_mediu INTEGER DEFAULT 0,
    coolant_max REAL DEFAULT 0,
    coolant_medie REAL DEFAULT 0,
    oil_max REAL DEFAULT 0,
    oil_medie REAL DEFAULT 0,
    boost_max REAL DEFAULT 0,
    boost_mediu REAL DEFAULT 0,
    maf_max REAL DEFAULT 0,
    maf_mediu REAL DEFAULT 0,
    voltaj_min REAL DEFAULT 0,
    voltaj_max REAL DEFAULT 0,
    hard_brakes INTEGER DEFAULT 0,
    hard_accelerations INTEGER DEFAULT 0,
    nr_alerte INTEGER DEFAULT 0,
    nr_dtc INTEGER DEFAULT 0,
    cost_combustibil REAL DEFAULT 0,
    emisii_co2 REAL DEFAULT 0,
    health_score INTEGER DEFAULT 100,
    trip_tag TEXT DEFAULT 'PERSONAL',
    raport_ai_json TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (id_calatorie) REFERENCES calatorii(id_calatorie)
);

-- 6. REALIMENTARI (Fuel Refills)
CREATE TABLE IF NOT EXISTS realimentari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    litri REAL NOT NULL,
    pret_pe_litru REAL NOT NULL DEFAULT 0,
    odometru_km REAL DEFAULT 0,
    notite TEXT DEFAULT ''
);

-- 7. PREDICTII_VALIDARE
CREATE TABLE IF NOT EXISTS predictii_validare (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin TEXT NOT NULL,
    prediction_hash TEXT NOT NULL,
    titlu TEXT,
    status TEXT DEFAULT 'ACTIVA',
    timestamp_creat INTEGER NOT NULL,
    timestamp_rezolvat INTEGER,
    UNIQUE(vin, prediction_hash)
);

-- 8. VEHICLES (Extended Vehicle Profile)
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin TEXT UNIQUE NOT NULL,
    make TEXT,
    model TEXT,
    variant TEXT,
    year INTEGER,
    color TEXT,
    plate_number TEXT,
    engine_code TEXT,
    displacement_cc INTEGER,
    power_kw INTEGER,
    power_hp INTEGER,
    torque_nm INTEGER,
    cylinders INTEGER,
    fuel_type TEXT,
    fuel_tank_liters REAL,
    transmission TEXT,
    gears INTEGER,
    drivetrain TEXT,
    emission_standard TEXT,
    co2_gkm INTEGER,
    purchase_date INTEGER,
    purchase_mileage_km INTEGER,
    purchase_price REAL,
    oil_capacity_liters REAL,
    oil_spec TEXT,
    coolant_capacity_liters REAL,
    timing_belt_interval_km INTEGER,
    spark_plug_interval_km INTEGER,
    vehicle_status TEXT DEFAULT 'UNKNOWN',
    status_reason TEXT,
    status_updated_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    custom_json TEXT
);

-- 9. MILEAGE_LOG
CREATE TABLE IF NOT EXISTS mileage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    odometer_km INTEGER NOT NULL,
    source TEXT NOT NULL,
    recorded_at INTEGER NOT NULL,
    note TEXT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- 10. MAINTENANCE_ITEMS
CREATE TABLE IF NOT EXISTS maintenance_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    item_type TEXT NOT NULL,
    title TEXT NOT NULL,
    interval_km INTEGER,
    interval_months INTEGER,
    last_service_mileage INTEGER,
    last_service_date INTEGER,
    urgency_status TEXT DEFAULT 'OK',
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    UNIQUE(vehicle_id, item_type)
);

-- 11. VEHICLE_DOCUMENTS
CREATE TABLE IF NOT EXISTS vehicle_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    document_number TEXT,
    issue_date INTEGER,
    expiry_date INTEGER NOT NULL,
    cost REAL DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- 12. VEHICLE_TIMELINE
CREATE TABLE IF NOT EXISTS vehicle_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'INFO',
    timestamp INTEGER NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Indexes for ultra-fast query latency
CREATE INDEX IF NOT EXISTS idx_calatorii_vin ON calatorii(vin, timestamp_start);
CREATE INDEX IF NOT EXISTS idx_flux_calatorie ON telemetrie_flux(id_calatorie, timestamp);
CREATE INDEX IF NOT EXISTS idx_trip_summary ON trip_summary(id_calatorie);
CREATE INDEX IF NOT EXISTS idx_evenimente_calatorie ON evenimente_alerte(id_calatorie);
CREATE INDEX IF NOT EXISTS idx_realimentari_vin ON realimentari(vin, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_predictii_vin ON predictii_validare(vin, status);
```

---

## 8. Invariants & Rules for AI Assistants

When developing, refactoring, or generating code, **you MUST follow these rules**:

1. **Maintain Universal Agnostic Architecture**:
   - The platform is **not** an Audi-only or diesel-only system. The Audi A6 C4 was merely the practical prototype/testbed car.
   - Any new diagnostic or analytical feature must check `VehicleCapabilities` (e.g. `hasTurbo`, `fuelType`, `hasDPF`) or query the vehicle profile from the database to ensure universal compatibility.
2. **Never Hardcode Physical Thresholds in Handlers/UI**:
   - All physical thresholds, fuel prices, and G-force triggers must reside exclusively in [`backend/analyzers/config.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/backend/analyzers/config.js).
3. **Preserve the Trip Lifecycle State Machine**:
   - `PORNIRE`: Initializes analysis in memory, opens DB trip record.
   - `MERS`: Appends to raw telemetry flux, streams via WebSocket.
   - `OPRIRE`: Runs `finalizeTripAnalysis()` **once**, inserts `trip_summary`, emits `status_trip` with STOP, and notifies event listeners.
4. **Debounce All Edge-Triggered Events**:
   - Harsh driving events (hard brakes, hard accelerations) must only increment on state transitions, never on sustained frames.
5. **Respect Mobile Context Partitioning**:
   - Do not merge `LiveContext`, `AlertContext`, `VehicleContext`, and `SecurityContext` into a monolithic context. They have strictly decoupled lifecycles.
6. **Mobile Ring Buffer Preservation**:
   - `LiveContext` uses a fixed-size ring buffer (600 points = 10 minutes) with a write pointer. Do not replace this with unbounded arrays or `.slice()` calls that cause garbage collection pauses on Android.
7. **All User-Facing Strings in Romanian**:
   - Keep user-facing notifications, status verdicts, and UI labels in Romanian (`ro.js` conventions).
8. **Cloud Deployment Target & Mosquitto**:
   - Host: Oracle Cloud VM (`ubuntu@84.235.164.52`), Port: `3000`, Process Manager: `pm2`.
   - **Private Mosquitto Broker**: Operational at `mqtt://84.235.164.52:1883`, default topic `telemetrie/obd2`. Replaces public `broker.emqx.io` for production security and isolation during live demos.
9. **Database Duality (`vehicule` vs. `vehicles`)**:
   - The database contains two vehicle tables:
     - `vehicule` (Romanian, PK: `vin TEXT`) — Used exclusively by core telemetry, trip sessions (`calatorii`), and live watchdog.
     - `vehicles` (English, PK: `id INTEGER AUTOINCREMENT`, `vin TEXT UNIQUE`) — Used by vehicle profile, timeline, maintenance items, and legal document tracking.
   - **MANDATORY HELPER**: All profile, fuel capacity, model, or odometer updates must pass through [`services/vehicleSyncService.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/services/vehicleSyncService.js) (`syncVehicleProfile`, `syncOdometer`) to atomically synchronize both tables and avoid drift.
10. **Legacy Naming — `GeminiService.js` (Uses Groq SDK)**:
    - [`backend/intelligence/GeminiService.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/backend/intelligence/GeminiService.js) uses `groq-sdk` with Llama-3 / Mixtral for low latency and high free-tier limits.
    - **DO NOT** attempt to install `@google/generative-ai` or rewrite this file. The filename `GeminiService.js` is historical/legacy and is imported across multiple modules.
11. **Event Loop & Memory Optimization at `OPRIRE`**:
    - Handled via in-memory reservoir sampling (`trip.sampledPackets`, max 600 points) during `MERS`. At `OPRIRE`, `finalizeTripAnalysis()` consumes the sampled buffer directly from RAM, eliminating blocking `SELECT *` and massive synchronous `JSON.parse()` loops.
    - Fallback queries use `LIMIT 1000`.
    - At `OPRIRE`, the trip distance (`trip.km`) is automatically accumulated into `vehicule.odometru_calibrat_km` and `mileage_log` via `syncOdometer`.
12. **Device Sync Security (`/api/sync/obd`)**:
    - The ESP32 sync route [`POST /api/sync/obd`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/routes/sync.js) strictly enforces the header `x-device-token: <DEVICE_SYNC_TOKEN>` (matching `process.env.DEVICE_SYNC_TOKEN` and `esp32/SDSyncModule.h`), rejecting unauthenticated requests with HTTP 401.

---

## 9. Core JSON Payload Schemas (Data Contracts)

### 9.1. Incoming MQTT Telemetry Packet (`pachet`)
Transmitted once per second to MQTT topic `telemetrie/obd2` or `licenta/audi_a6_c4/telemetrie`:
```json
{
  "ecu": {
    "vin": "WAUZZZ4A1RN000000",
    "protocol": "KWP1281"
  },
  "stare_motor": "MERS",
  "timestamp": 1720000000000,
  "motor": {
    "speed": 65,
    "rpm": 1820,
    "load": 42.5,
    "accel_g": 0.05,
    "torque_actual": 195
  },
  "temperaturi": {
    "coolant": 89.2,
    "oil": 93.0,
    "ambient": 19.5,
    "cat1": 240,
    "cat2": 215
  },
  "aer": {
    "maf": 22.4,
    "map": 142,
    "map_cmd": 145,
    "boost_actual": 0.41
  },
  "baterie": {
    "battery_volt": 12.6,
    "ecu_volt": 14.15
  },
  "combustibil": {
    "inst_cons": 5.2,
    "fuel_level_pct": 74.0,
    "inj_qty_mg": 18.2,
    "rail_press_bar": 650
  },
  "dpf": {
    "soot_load": 14.2,
    "diff_pressure_mbar": 4.5
  },
  "odometru": {
    "km_total": 328452.3,
    "trip_km": 14.2
  },
  "timp": {
    "run_time_sec": 850,
    "engine_hours": 4120.6
  },
  "transmisie": {
    "gear": 4
  },
  "dtc": [
    {
      "cod": "P0101",
      "modul": "ECU",
      "severitate": "WARNING",
      "descriere": "Mass Air Flow Circuit Range/Performance"
    }
  ]
}
```

### 9.2. Completed Trip AI Report Object (`raport_ai_json`)
Generated at `OPRIRE` by `finalizeTripAnalysis()` and stored as a JSON string in `trip_summary.raport_ai_json`:
```json
{
  "engine": {
    "maxRPM": 3420,
    "avgRPM": 1950,
    "highRPMTime": 14,
    "coolantMax": 92.5,
    "coolantAvg": 88.7,
    "longestFullLoadSeconds": 6
  },
  "cooling": {
    "coolantMax": 92.5,
    "coolantAvg": 88.7,
    "timeOver90": 240,
    "timeOver95": 0,
    "timeOver100": 0
  },
  "turbo": {
    "boostMax": 1.25,
    "boostAvg": 0.45,
    "timeOver1Bar": 18,
    "timeOver1_5Bar": 0
  },
  "fuel": {
    "totalLiters": 1.85,
    "idleLiters": 0.12,
    "movingLiters": 1.73,
    "avgPer100km": 6.8
  },
  "battery": {
    "voltageMin": 13.7,
    "voltageMax": 14.3,
    "voltageAvg": 14.1
  },
  "driving": {
    "smoothPct": 82,
    "economicPct": 76,
    "aggressivePct": 6,
    "hardBrakes": 1,
    "hardAccelerations": 2,
    "overspeeds": 0,
    "kickdowns": 1
  },
  "intelligence": {
    "confidence_report": {
      "overallScore": 92,
      "breakdown": {
        "integrity": 98,
        "sensorQuality": 94,
        "ruleReliability": 88
      }
    },
    "predictions": [
      {
        "component": "EGR_VALVE",
        "probability": 65,
        "severity": "MEDIUM",
        "timeHorizon": "2000-5000 km",
        "recommendation": "Curățare preventivă depuneri carbon supapă EGR"
      }
    ],
    "correlations": [
      {
        "pair": "rpm_vs_maf",
        "coefficient": 0.94,
        "status": "NORMAL"
      }
    ],
    "baseline_comparison": {
      "maf_deviation_pct": -4.2,
      "boost_deviation_pct": +1.5,
      "coolant_deviation_c": +0.8
    },
    "reasoning": {
      "rootCauses": ["AIR_FILTER_RESTRICTION"],
      "intermediate": ["LOW_MAF_AT_LOAD"],
      "effects": ["SLIGHT_FUEL_EFFICIENCY_DROP"],
      "summary": "Filtru de aer cu depuneri ușoare; debit MAF ușor sub baseline la sarcină mare.",
      "confidence": 85
    },
    "recommendations": [
      {
        "priority": 1,
        "failureId": "AIR_FILTER",
        "title": "Verificare filtru aer",
        "action": "Inspecție vizuală și înlocuire dacă este îmbâcsit",
        "urgency": "SOON"
      }
    ]
  }
}
```

### 9.3. Serialized Digital Twin Object (`DigitalTwinSerializer.toFrontend`)
Returned by `GET /api/vehicul/:vin/twin` for real-time mobile app rendering:
```json
{
  "vin": "WAUZZZ4A1RN000000",
  "identity": {
    "make": "Audi",
    "model": "A6 C4",
    "year": 1996,
    "engine": "2.5 TDI R5 (AEL)",
    "fuel": "DIESEL"
  },
  "specs": {
    "powerHp": 140,
    "displacementCc": 2461,
    "tankCapacityLiters": 80
  },
  "state": {
    "health": {
      "overallHealth": 91,
      "engineScore": 94,
      "fuelScore": 88,
      "drivingScore": 90,
      "safetyScore": 95,
      "scoringMethod": "universal"
    },
    "subsystems": [
      { "name": "Motor", "score": 94, "status": "EXCELLENT" },
      { "name": "Răcire", "score": 96, "status": "EXCELLENT" },
      { "name": "Turbo", "score": 89, "status": "GOOD" },
      { "name": "Alimentare", "score": 88, "status": "GOOD" },
      { "name": "Electric", "score": 92, "status": "EXCELLENT" }
    ],
    "odometerKm": 328452.3,
    "lastSeen": 1720000850000
  },
  "diagnostics": {
    "activeDtcCount": 0,
    "predictions": [
      {
        "component": "EGR_VALVE",
        "severity": "MEDIUM",
        "probability": 65
      }
    ],
    "recommendations": [
      {
        "title": "Verificare filtru aer",
        "urgency": "SOON",
        "driveAllowed": true
      }
    ]
  },
  "computed": {
    "hasActiveAlerts": false,
    "countImmediate": 0,
    "countSoon": 1,
    "countPlanned": 0,
    "overallHealth": 91,
    "engineScore": 94,
    "fuelScore": 88,
    "scoringMethod": "universal",
    "topRecommendation": {
      "title": "Verificare filtru aer",
      "urgency": "SOON"
    },
    "highSeverityCount": 0,
    "maintenanceOverdue": 0
  }
}
```

