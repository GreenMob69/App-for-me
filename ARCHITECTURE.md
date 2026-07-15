# Architecture — OBD-II Telemetry Platform

## Diagrama sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                         Simulator                               │
│  simulator.js — publică 90+ PID-uri la fiecare secundă          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ MQTT publish
                           ▼
                  broker.emqx.io (public)
                  topic: licenta/audi_a6_c4/telemetrie
                           │ MQTT subscribe
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       backend.js                                │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────────┐  │
│  │ MQTT Client │   │  SQLite DB   │   │    Express + CORS   │  │
│  │             │   │              │   │    REST API (:3000)  │  │
│  │  PORNIRE ──►├──►│ INSERT trip  │   │                     │  │
│  │  MERS     ──├──►│ INSERT flux  │   │  /api/calatorii/*   │  │
│  │  OPRIRE   ──├──►│ UPDATE trip  │   │  /api/vehicul/*     │  │
│  └─────────────┘   │ INSERT summ. │   │  /api/rapoarte/*    │  │
│                    └──────────────┘   │  /api/vehicle-prof. │  │
│                                       └─────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Socket.IO Server                      │   │
│  │  emit('telemetrie_live', pachet)  — la fiecare pachet   │   │
│  │  emit('alerta_live', alert)       — la frânare/DTC      │   │
│  │  emit('status_trip', {START|STOP}) — la pornire/oprire  │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP REST + WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  React Native App (Expo)                        │
│                                                                 │
│  TelemetryProvider                                              │
│  ├── AppContext    — viewMode, navigationRef, tripReport        │
│  ├── AlertContext  — alertsList, unreadCount, latestAlert       │
│  └── LiveContext   — isConnected, liveData, ring buffer 600pt   │
│                                                                 │
│  Tab Navigator                                                  │
│  ├── STARE  → StatusScreen → VehicleHealthScreen                │
│  │                        → SubsystemDetailScreen              │
│  ├── LIVE   → LiveDashboardScreen (essential/expert/osciloscop) │
│  ├── CURSE  → TripHistoryScreen → TripDetailScreen              │
│  └── SETARI → SettingsScreen                                    │
│                                                                 │
│  Modal Stack                                                    │
│  └── TripReportScreen (auto-push la oprire cursă)               │
└─────────────────────────────────────────────────────────────────┘
```

## Fluxul datelor — de la senzor la telefon

### 1. Cursă activă (fiecare secundă)

```
simulator.js
  └─ publish MQTT { stare_motor: "MERS", motor: {rpm, speed, ...}, ... }
       └─ backend.js: client.on('message')
            ├─ INSERT INTO telemetrie_flux (toți parametrii + matrice_completa_json)
            ├─ updateAnalyzer(trip, pachet)   ← acumulare ieftină, fără calcule grele
            ├─ detectare hard brake (compare events.hardBrakes)
            │    └─ dacă da: INSERT INTO evenimente_alerte
            │             io.emit('alerta_live', {...})
            └─ io.emit('telemetrie_live', { ...pachet, km_parcursi, scor_eco })
                 └─ LiveContext.onTelemetrie(data)
                      ├─ setLiveData(data)        → re-render gauge-uri
                      └─ bufferRef[idx] = flattenedData  → ring buffer pentru grafice
```

### 2. Oprire cursă (pipeline complet)

```
backend.js: eveniment_motor === "OPRIRE"
  └─ SELECT matrice_completa_json FROM telemetrie_flux WHERE id_calatorie = ?
       └─ finalizeTripAnalysis(trip, { db, vin, dtcList, rawPackets })
            │
            ├─  1. validateTripData(rawPackets)         → DataIntegrityEngine
            ├─  2. analyzeSensorQuality(rawPackets)     → SensorQualityEngine
            ├─  3. buildTripSummary(trip)               → TripSummary
            ├─  4. calculateHealthScore(summary)        → HealthEngine
            ├─  5. evaluateDiagnostics(summary, dtcList)→ RuleEngine (10 module)
            ├─  6. buildConfidenceReport(diagnostics)   → ConfidenceEngine
            ├─  7. buildReliabilityReport(...)          → ReliabilityEngine
            ├─  8. resolveConflicts(diagnostics, ...)   → RuleConflictResolver
            ├─  9. generateExplainabilityLedger(summary)→ ExplainabilityEngine
            ├─ 10. analyzeTripCorrelations(rawPackets)  → CorrelationEngine
            ├─ 11. updateAndCompareBaseline(db, vin, summary) → BaselineEngine (async)
            ├─ 12. buildReliabilityReport (cu baseline) → ReliabilityEngine
            ├─ 13. generateDetailedExplainability(...)  → DetailedExplainability
            ├─ 14. generatePredictions({summary, baseline, trends, ...}) → FaultPredictionEngine
            ├─ 15. generateVehicleDNA(health, baseline, correlations) → VehicleDNA
            └─ 16. buildAIReport(summary, health) → ai object
                   └─ ai.intelligence = { toate rezultatele de mai sus }
  │
  ├─ UPDATE calatorii SET timestamp_end, km_parcursi, consum_total_l, consum_mediu_100km, scor_eco
  ├─ INSERT INTO trip_summary (toate statisticile + raport_ai_json)
  ├─ vehicleEventBus.emit('TRIP_COMPLETED' | 'LONG_TRIP', {...})
  │    ├─ VehicleTimeline ← stochează evenimentul
  │    └─ VehicleStatus.computeVehicleStatus() ← recalculează READY/ATTENTION/INSPECTION
  └─ io.emit('status_trip', { status: 'STOP', report: tripReport })
       └─ LiveContext.onStatusTrip(data)
            ├─ setTripReport(data.report)
            ├─ clearChartHistory()
            └─ navigationRef.navigate('TripReport', { report })
```

### 3. Ecranul Stare (polling la deschidere)

```
StatusScreen.loadStatus()
  └─ vehicleService.fetchFullStatus()
       ├─ GET /api/vehicul/:vin/health      → HealthEngine + VehicleDNA date
       └─ GET /api/vehicul/:vin/tendinte    → TrendEngine (ultimele 20 curse)
  └─ mapStatusData(health, trends)          → statusMapper.js
       └─ MessageEngine.*                  → text în română
  └─ setStatusModel(model)                 → render StatusScreen
```

## Schema bazei de date

### Tabele core telemetrie

```
vehicule
  vin TEXT PK, model TEXT, tip_combustibil, capacitate_rezervor_l

calatorii
  id_calatorie PK, vin FK, timestamp_start, timestamp_end,
  km_parcursi, consum_total_l, consum_mediu_100km, scor_eco

telemetrie_flux
  id_flux PK, id_calatorie FK, timestamp,
  rpm, viteza_kmh, sarcina_pct, maf_gs, map_kpa, voltaj_v,
  temp_apa_c, temp_ulei_c, accel_g, consum_lh, boost_bar,
  dpf_soot, gear, torque_nm,
  matrice_completa_json TEXT    ← pachetul MQTT complet (~90 parametri)

evenimente_alerte
  id_eveniment PK, id_calatorie FK, timestamp,
  tip_eveniment, cod_dtc, valoare_masurata, severitate, descriere

trip_summary
  id_summary PK, id_calatorie FK (UNIQUE),
  durata_secunde, timp_relanti_sec, timp_mers_sec,
  viteza_max/medie, rpm_max/mediu, coolant_max/medie,
  oil_max/medie, boost_max/mediu, maf_max/mediu,
  voltaj_min/max, hard_brakes, hard_accelerations,
  nr_alerte, nr_dtc, cost_combustibil, emisii_co2,
  health_score, trip_tag,
  raport_ai_json TEXT           ← obiect AI complet (toate motoarele de inteligență)
```

### Tabel baseline adaptiv

```
vehicle_profile
  vin PK, model,
  baseline_rpm, baseline_maf, baseline_boost,
  baseline_voltage, baseline_coolant,
  total_learned_trips
```

### Tabele vehicle profile (7 tabele)

```
vehicles          — identitate, motor, transmisie, specificații service, status calculat
mileage_log       — log kilometraj (sursă: SERVICE, MANUAL, OBD)
service_sessions  — vizite la atelier (cost total, data, kilometraj)
service_items     — operațiuni individuale per sesiune
maintenance_items — stare calculată per tip (status: OK/DUE_SOON/OVERDUE/UNKNOWN,
                    wear_percent, remaining_km, remaining_days)
workshops         — ateliere înregistrate
milestones        — repere vehicul (100k km, 1 an proprietate etc.)
```

### Tabele vehicle timeline

```
vehicle_timeline  — toate evenimentele (TRIP_COMPLETED, SERVICE_ADDED, AI_PREDICTION,
                    LONG_TRIP, MILESTONE etc.) cu sursa și referință
```

## Module backend — responsabilități

### `backend/analyzers/`

| Fișier | Responsabilitate |
|---|---|
| `config.js` | **Toate** pragurile și maparea câmpurilor MQTT → PID |
| `TripAnalyzer.js` | Acumulare per pachet (min/max/medie, zone RPM, ralanti, consum, stiluri, evenimente) |
| `HealthEngine.js` | Calcul scoruri: engineScore, fuelScore, drivingScore, safetyScore, overallHealth |
| `TripSummary.js` | Construire obiect `summary` structurat din `trip.analysis` |
| `TrendEngine.js` | Analiză transversală ultimele N curse (comparare ferestre temporale) |
| `index.js` | Orchestrator pipeline 16 pași la OPRIRE |

### `backend/diagnostics/`

RuleEngine evaluează toate regulile din 10 module. Fiecare regulă are:
- `condition(context)` → boolean
- `hypotheses[]` → `[{ cause, points }]`
- `system` → categoria (MOTOR, TURBO, COMBUSTIBIL etc.)

Pragul de raportare: `probability >= 20%` (points/maxPossiblePoints × 100).

### `backend/intelligence/`

| Motor | Ce face |
|---|---|
| `BaselineEngine` | Moving average per VIN pentru RPM/MAF/boost/voltaj/coolant. La prima cursă inițializează, la următoarele actualizează și calculează deviații. |
| `ConfidenceEngine` | Scor global de încredere în diagnostic, din numărul și consistența regulilor declanșate |
| `CorrelationEngine` | Pearson r între perechi de senzori (boost-MAF, coolant-oil etc.) din rawPackets |
| `DataIntegrityEngine` | Validare pachete brute: timestamp gaps, valori imposibile, câmpuri lipsă |
| `DetailedExplainability` | Explicație per regulă/diagnostic cu factori, deviații față de baseline, referință tendințe |
| `ExplainabilityEngine` | Ledger deduceri Health Score (ce a penalizat fiecare scor cu câte puncte) |
| `FaultPredictionEngine` | 9 modele predictive (alternator, baterie, turbo, injectoare, răcire, admisie, combustibil, DPF, EGR). Returnează probabilitate + factori + estimare distanță/zile rămase |
| `ReliabilityEngine` | Scor fiabilitate per diagnoză (calitate senzori + confirmare DTC + comparație baseline) |
| `RuleConflictResolver` | Separă diagnostice rezolvate de cele ambigue (semne contradictorii) |
| `SensorQualityEngine` | Calitate per senzor: variabilitate, valori imposibile, freeze frames |
| `VehicleDNA` | Amprenta vehiculului: scoruri per subsistem, stare corelații, sumar AI |

### `backend/vehicle-profile/`

| Fișier | Responsabilitate |
|---|---|
| `EventBus.js` | EventEmitter domain events (SERVICE_ADDED, TRIP_COMPLETED, AI_PREDICTION etc.) |
| `MaintenanceCalculator.js` | Recalculare automată status/wear/remaining pentru toate maintenance_items la orice eveniment relevant |
| `MilestoneTracker.js` | Detectare și persistare milestone-uri (prima cursă, 10k km, timing belt la scadență etc.) |
| `VehicleStatus.js` | Calcul READY/ATTENTION/INSPECTION din 4 verificări simultane (items overdue, docs expirate, health score, predicții HIGH) |
| `VehicleTimeline.js` | Persistare și query timeline evenimente vehicul |
| `VinDecoder.js` | Parsare VIN conform ISO 3779 (WMI, VDS, VIS, an fabricație) |
| `schema.js` | Definiții SQL pentru cele 7 tabele nucleu + migrări |
| `routes.js` | Toate endpoint-urile REST pentru CRUD vehicul + service + mentenanță + documente + cost dashboard |

## API REST — referință rapidă

### Telemetrie

| Method | Endpoint | Descriere |
|---|---|---|
| GET | `/api/calatorii` | Toate cursele |
| GET | `/api/calatorii/filtrate` | Filtrare: startDate, endDate, hasAlerts, hasDTC, tempOver, tag |
| GET | `/api/calatorii/:id` | Detaliu cursă (rezumat + alerte + date_grafic) |
| GET | `/api/calatorii/:id/analiza` | Trip summary + AI JSON |
| GET | `/api/calatorii/:id/report` | Raport formatat (stats, driving, insights, predictions) |
| PUT | `/api/calatorii/:id/tag` | Setare tag: BUSINESS / PERSONAL / TESTARE |
| GET | `/api/vehicul/:vin/statistici` | Statistici lifetime (total km, litri, eco mediu) |
| GET | `/api/vehicul/:vin/diagnoza` | DTC active + stare sistem electric |
| POST | `/api/vehicul/:vin/stergere-erori` | Stergere DTC |
| GET | `/api/vehicul/:vin/health` | Dashboard sănătate (scores, subsisteme, predicții, timeline) |
| GET | `/api/vehicul/:vin/health/:system` | Detaliu subsistem (motor/electric/turbo/combustibil/stil_condus) |
| GET | `/api/vehicul/:vin/tendinte` | TrendEngine (ultimele N curse, default 20) |
| GET | `/api/rapoarte/lunar/:year/:month` | Raport lunar agregat cu defalcare pe tag |

### Vehicle Profile

| Method | Endpoint | Descriere |
|---|---|---|
| POST | `/api/vehicles` | Creare vehicul |
| GET | `/api/vehicles` | Listă vehicule |
| GET | `/api/vehicles/:id` | Detaliu vehicul |
| PUT | `/api/vehicles/:id` | Actualizare vehicul |
| POST | `/api/vehicles/:id/mileage` | Adăugare citire odometru |
| POST | `/api/vehicles/:id/service` | Adăugare sesiune service |
| GET | `/api/vehicles/:id/maintenance` | Lista maintenance items cu status |
| GET | `/api/vehicles/:id/history` | Istoric service complet |
| GET | `/api/vehicles/:id/cost-dashboard` | Dashboard costuri (total, pe categorie, anual) |
| GET | `/api/vehicles/:id/timeline` | Timeline evenimente vehicul |
| GET | `/api/vehicles/:id/milestones` | Milestone-uri realizate |
| GET | `/api/decode-vin/:vin` | Decodare VIN |

## WebSocket — evenimente

### Server → Client

| Event | Payload | Când |
|---|---|---|
| `telemetrie_live` | `{ ...pachet_mqtt, km_parcursi, scor_eco }` | La fiecare pachet MERS (~1/secundă) |
| `alerta_live` | `{ tip, g?, scor_curent?, descriere? }` | La frânare bruscă sau DTC cleared |
| `status_trip` | `{ status: 'START', id_calatorie }` | La PORNIRE |
| `status_trip` | `{ status: 'STOP', id_calatorie, health_score, report }` | La OPRIRE (după pipeline complet) |

## Arhitectura aplicației mobile

### Ierarhia contextelor

```
TelemetryProvider
├── AppContext
│   ├── viewMode: 'COCKPIT' | 'CHART'
│   ├── selectedMetric: string (osciloscop)
│   ├── activeTemplate: 'DIGITAL' | 'CLASSIC'
│   ├── navigationRef: React Navigation ref
│   └── tripReport: obiect raport curent
├── AlertContext
│   ├── alertsList: Alert[]
│   ├── unreadCount: number
│   ├── latestAlert: Alert | null
│   └── markAlertsAsRead()
└── LiveContext
    ├── isConnected: boolean
    ├── liveData: pachet_mqtt curent
    ├── chartVersion: number (trigger re-render grafic)
    └── getChartHistory(): DataPoint[] (din ring buffer)
```

### Ring buffer (LiveContext)

- Dimensiune: 600 puncte = 10 minute la 1 pachet/secundă
- Implementare: array fix + `writeIndexRef` (index circular), fără re-alocare
- La citire: reconstruiește ordinea cronologică din `writeIndex` curent
- Resetat la `status_trip STOP` (noua cursă începe cu buffer gol)

### Navigarea la finalul cursei

La primirea `status_trip { status: 'STOP', report }`:
1. `LiveContext` stochează raportul în `AppContext.tripReport`
2. `LiveContext` resetează ring buffer-ul
3. `navigationRef.current.navigate('TripReport', { report })` — push modal din orice tab activ

### Ecranul StatusScreen — logica de afișare

```
screenState: 'loading' | 'error' | 'empty' | 'success'

La success, statusModel.evaluation determină layout-ul:
  EXCELLENT, GOOD (fără observații) → CalmState (ecran aproape gol)
  PROBLEM, CRITICAL                 → UrgentBanner (prima observație) + ObservationCard-uri restante
  GOOD (cu observații), ATTENTION   → ObservationCard-uri direct
  
Mereu afișat (când nu e calm):
  - StatusHeader (verdictul)
  - LongTripReady (Pot pleca în drum lung?)
  - UpcomingTimeline (Ce se apropie)
  - ComparisonSection (față de cursele anterioare)
  - LastTrip
```

### Ecranul LiveDashboardScreen — moduri de vizualizare

| Mod | Descriere |
|---|---|
| Esențial (default) | 6 gauge-uri circulare SVG (viteză, turație, consum, temp apă, boost, voltaj) + EcoScore + Treaptă |
| Expert (90+ PID) | Categorii cu tab-uri: Motor, Temperaturi, Aer & Turbo, Combustibil, Lambda, Emisii & DPF, Transmisie, ECU |
| Osciloscop | LineChart cu 10 metrici selectabile, zoom X/Y, auto-scale, crosshair tooltip |
| Template CLASSIC | Înlocuiește cardurile text cu CircularGauge pentru fiecare parametru din Expert mode |

## HealthEngine — formula completă

```javascript
// Penalizări Engine Score (din 100)
score -= min(30, timeOver100°C_minute * 6)    // -6 pct/minut supraîncălzire
score -= min(15, timeOver95°C_minute * 2.5)
score -= min(10, timeOver90°C_minute * 1)
score -= min(20, (over3500rpm_pct - 15) * 0.6) // penalizare dacă >15% timp la >3500 RPM

// Penalizări Fuel Score (din 100)
score -= min(30, aggressivePct * 0.5)
score -= min(20, max(0, idleRatio - 10%) * 0.6)

// Penalizări Driving Score (din 100)
score -= aggressivePct * 0.6
score -= min(35, (hardEvents / km) * 100 * 1.5)
score -= kickdowns * 1

// Penalizări Safety Score (din 100)
score -= overspeeds * 4
score -= hardBrakes * 2
score -= rapidDecelerations * 1.5
score -= min(15, timeOver100°C_minute * 3)

// Overall Health
overall = engine*0.35 + safety*0.25 + driving*0.20 + fuel*0.20
```
