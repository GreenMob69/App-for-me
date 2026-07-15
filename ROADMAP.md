# Roadmap — OBD-II Telemetry Platform

## Ce este implementat

### Backend

#### Infrastructură
- [x] Server MQTT subscriber (broker.emqx.io, topic `licenta/audi_a6_c4/telemetrie`)
- [x] Express REST API pe portul 3000
- [x] Socket.IO pentru WebSocket bidirectional
- [x] SQLite cu schema relațională completă (9 tabele core telemetrie + 7 tabele vehicle profile + timeline)
- [x] Migrări safe la startup (`ALTER TABLE ... ADD COLUMN`, ignorate dacă coloana există deja)
- [x] Gestiune curse active în memorie (`calatoriiActive[vin]`)

#### Pipeline analiză cursă
- [x] **Nivel 3 — TripAnalyzer**: acumulare per pachet (PID min/max/medie, zone RPM, ralanti, full load, consum separat ralanti/mers, stil de condus, events cu debounce, kickdown, overspeed, distanță)
- [x] **Nivel 4 — HealthEngine**: scoruri Engine, Fuel, Driving, Safety, Overall (cu formule documentate și justificate pentru licență)
- [x] **Nivel 5 — TrendEngine**: analiză transversală pe ferestre temporale, 4 avertizări predictive (electric, admisie, răcire, consum)
- [x] **Pipeline finalizare** (16 pași la OPRIRE): DataIntegrity → SensorQuality → TripSummary → HealthEngine → RuleEngine → ConfidenceEngine → ReliabilityEngine → RuleConflictResolver → ExplainabilityEngine → CorrelationEngine → BaselineEngine → Reliability (cu baseline) → DetailedExplainability → FaultPredictionEngine → VehicleDNA → AI Report

#### Diagnostic pe bază de reguli
- [x] RuleEngine cu sistem de punctaj probabilistic (prag 20% pentru raportare)
- [x] 10 module de reguli: EngineRules, TurboRules, FuelRules, CoolingRules, ElectricalRules, DpfRules, LambdaRules, TransmissionRules, DtcRules, BehaviorRules
- [x] Baza de cunoștințe statică (`rules.json`)

#### Intelligence engines
- [x] BaselineEngine: moving average adaptiv per VIN, deviații față de normal
- [x] ConfidenceEngine: scor global de încredere în diagnostic
- [x] CorrelationEngine: corelații Pearson inter-senzor din rawPackets
- [x] DataIntegrityEngine: validare pachete brute (gaps, valori imposibile)
- [x] DetailedExplainability: explicații per regulă cu factori, deviații, referință tendințe
- [x] ExplainabilityEngine: ledger deduceri Health Score
- [x] FaultPredictionEngine: 9 modele predictive cu probabilitate, severitate, estimare km/zile rămase
- [x] ReliabilityEngine: fiabilitate per diagnoză
- [x] RuleConflictResolver: separare diagnostic rezolvat vs. ambiguu
- [x] SensorQualityEngine: calitate per senzor (variabilitate, freeze frames)
- [x] VehicleDNA: amprenta vehiculului

#### API REST
- [x] `GET /api/calatorii` — toate cursele
- [x] `GET /api/calatorii/filtrate` — filtrare multidimensională (date, alerte, DTC, temperatură, tag)
- [x] `GET /api/calatorii/:id` — detaliu cursă (cu date grafic decodate din JSON blob)
- [x] `GET /api/calatorii/:id/analiza` — trip_summary + AI JSON
- [x] `GET /api/calatorii/:id/report` — raport formatat complet
- [x] `PUT /api/calatorii/:id/tag` — etichete BUSINESS/PERSONAL/TESTARE
- [x] `GET /api/vehicul/:vin/statistici` — statistici lifetime
- [x] `GET /api/vehicul/:vin/diagnoza` — DTC + stare electrică
- [x] `POST /api/vehicul/:vin/stergere-erori` — clear DTC
- [x] `GET /api/vehicul/:vin/health` — dashboard sănătate complet
- [x] `GET /api/vehicul/:vin/health/:system` — detaliu subsistem (5 sisteme)
- [x] `GET /api/vehicul/:vin/tendinte` — raport tendințe TrendEngine
- [x] `GET /api/rapoarte/lunar/:year/:month` — sinteză lunară agregată
- [x] Vehicle Profile CRUD complet (vehicles, service, maintenance, mileage, timeline, milestones, workshops)

#### Vehicle Profile module
- [x] Schema SQL 7 tabele (vehicles, mileage_log, service_sessions, service_items, maintenance_items, workshops, milestones)
- [x] VinDecoder (ISO 3779) — make, an fabricație, cod motor din VIN
- [x] MaintenanceCalculator — recalculare automată status/wear/remaining la orice eveniment relevant
- [x] VehicleStatus (READY/ATTENTION/INSPECTION) din 4 criterii simultane
- [x] EventBus domain events (SERVICE_ADDED, TRIP_COMPLETED, LONG_TRIP, AI_PREDICTION etc.)
- [x] VehicleTimeline — persistare și query toate evenimentele vehiculului
- [x] MilestoneTracker — detectare și celebrare repere importante
- [x] Intervale implicite pentru 13 tipuri de mentenanță (ajustate per tip de combustibil)

### Frontend (React Native / Expo)

#### Onboarding
- [x] Verificare `@vehicle_id` la startup
- [x] `VehicleOnboardingScreen` la prima rulare

#### Navigare
- [x] Bottom tabs: STARE, LIVE, CURSE, SETARI
- [x] StatusStack: StatusScreen → VehicleHealthScreen → SubsystemDetailScreen
- [x] Modal: TripReportScreen (push automat la oprire cursă)
- [x] ErrorBoundary pe fiecare tab

#### Ecrane
- [x] **StatusScreen**: asistent inteligent cu verdict principal, CalmState/UrgentBanner/ObservationCard-uri, secțiuni comparative și de mentenanță
- [x] **VehicleHealthScreen**: gauge principal sănătate, grid subsisteme, predicții, timeline health, card ultima cursă, cache offline
- [x] **SubsystemDetailScreen**: concluzii, factori explicativi, evoluție temporală, comparație baseline, corelații, recomandare
- [x] **LiveDashboardScreen**: mod esențial (6 KPI gauge), mod expert (90+ PID în 8 categorii tab), osciloscop cu 10 metrici, zoom X/Y, template digital/classic, modal notificări
- [x] **TripHistoryScreen**: statistici totale, filtre rapide (alerte, DTC, temperatură, tag, dată), toggle listă/grafic, raport lunar cu share, modal tag
- [x] **TripReportScreen**: raport post-cursă cu scoruri, statistici, stil condus, insights, predicții active
- [x] **TripDetailScreen**: detaliu cursă individuală
- [x] **SettingsScreen**: configurare URL server (cu persistare AsyncStorage)

#### Componente
- [x] CircularGauge (SVG, arc progress cu culori dinamice)
- [x] HealthGauge (gauge principal cu arcuri per subsistem)
- [x] HealthTimeline (grafic evoluție health score în timp)
- [x] SubsystemCard (card subsistem cu scor, trend, indicator predicție)
- [x] PredictionCard (card predicție cu severitate, probabilitate, recomandare)
- [x] StatusHeader (verdict principal cu evaluare colorată)
- [x] CalmState (ecran "totul e bine" cu ultima cursă)
- [x] UrgentBanner (banner alert principal pentru stări critice/probleme)
- [x] ObservationCard (card observație cu evidence, explicație, acțiune, confidence badge)
- [x] ComparisonSection (narativ inteligent față de cursele anterioare)
- [x] UpcomingTimeline (cronologie mentenanță viitoare)
- [x] ConfidenceBadge (indicatort calitate diagnostic)
- [x] ErrorBoundary (fallback UI pentru erori JavaScript neașteptate)

#### Logică
- [x] MessageEngine — toate mesajele user-facing în română (6 reguli de ton documentate)
- [x] statusMapper — transformare date brute → model UI
- [x] i18n română (ro.js) — toate string-urile UI centralizate
- [x] Ring buffer 600 puncte pentru grafice osciloscop
- [x] Auto-navigate la TripReport la oprire cursă

---

## Ce nu este implementat (sau parțial)

### Limitări cunoscute

- **DTC în timp real**: lista `eroriActiveDTC` din `backend.js` e statică (hardcodată). Stergerea funcționează. Nu există feed real de la ECU.
- **Multi-vehicul în UI**: DB-ul suportă multiple VIN-uri, dar UI-ul e hardcodat pentru Audi A6 C4. `getVin()` returnează un singur VIN.
- **TrendEngine integrat în pipeline**: `TrendEngine.analyzeTrends()` e disponibil ca endpoint separat, dar nu e apelat în `finalizeTripAnalysis()`. Predicțiile din `FaultPredictionEngine` nu beneficiază de `trends` la finalul cursei (primit `null`).
- **Documents în vehicle profile**: schema suportă documente (asigurare, ITP, vinieta) dar routes le pot să nu fie complet expuse în UI.
- **Rapoarte exportabile**: share-ul din raportul lunar exportează text simplu. Nu există PDF sau export CSV.
- **Notificări push**: alertele live ajung pe telefon doar dacă app-ul e deschis. Nu există background notifications.

---

## Direcții posibile de extindere

Toate sunt bazate pe infrastructura deja existentă, nu necesită refactoring major.

### Prioritate înaltă (lipsesc și ar adăuga valoare imediată)

**1. Integrare TrendEngine în pipeline**
- La `finalizeTripAnalysis()`, apelează `analyzeTrends(db, vin, 20)` înainte de pasul 14 (FaultPredictions)
- Transmite rezultatul ca `trends` — FaultPredictionEngine deja are cod pentru `ctx.trends?.voltage?.trend` etc.
- Impact: predicțiile devin mult mai precise, folosind tendințe confirmate pe multiple curse

**2. Export PDF raport lunar**
- Backend: endpoint nou care agregă datele lunare și generează HTML/PDF
- Frontend: share PDF în loc de text din `TripHistoryScreen`

**3. Notificări push la finalul cursei**
- Expo Notifications (deja în ecosistem) — trimite push când `status_trip STOP` cu health_score < 75

**4. Selector vehicul în UI**
- `getVin()` să citească din AsyncStorage `@vehicle_id`
- `VehicleOnboardingScreen` deja setează `@vehicle_id`
- Restul: conectare VIN → vehicul din `vehicles` table

### Prioritate medie

**5. Grafice temporale pe SubsystemDetailScreen**
- Endpoint deja returnează `evolution` (ultimele 10 curse: health_score, voltaj, coolant, boost)
- Adaugă un LineChart mic per parametru în `SubsystemDetailScreen`

**6. Notificare mentenanță**
- `maintenance_items` are `remaining_km` și `remaining_days`
- La `status_trip STOP`, verifică dacă vreun item intră în zona DUE_SOON și emite alerta

**7. Comparație combustibil pe rute**
- TripHistoryScreen are filtrare pe dată; adaugă filtrare pe interval de km/oră de zi
- Compară consumul în contexte similare

**8. Profil vizual vehicul complet**
- Ecran nou: imaginea mașinii + toate datele din `vehicles` (specs, achiziție, documente)
- Date VIN decodate deja disponibile prin `VinDecoder`

### Prioritate scăzută / exploratorii

**9. Suport multi-vehicul real**
- Selector vehicul în header, persistat în AsyncStorage
- Toate endpoint-urile deja au `:vin` parametru

**10. Lambda / EGR / Rail Pressure în analize**
- `FIELD_MAP` în `config.js` are comentarii pentru extindere (lambda, egr, oilPressure)
- Adăugarea unui PID nou = o linie în `FIELD_MAP`, nimic altceva

**11. Comparație cursă cu cursă**
- Endpoint nou: `GET /api/calatorii/:id1/compare/:id2`
- Compară parametrii-cheie, stilul de condus și scorurile între două curse

**12. Alertă live pentru supraîncălzire**
- În bucla `MERS` din `backend.js`, verifică `t.coolant > 100` și emite `alerta_live`
- Similar cu mecanismul deja existent pentru hard brakes

**13. Backup & sincronizare DB**
- Export SQLite prin `/api/admin/backup`
- Util pentru testare pe mai multe dispozitive

---

## Structura unui sprint minim pentru prezentarea licenței

Dacă se mai adaugă funcționalitate înainte de prezentare, ordinea recomandată:

1. **TrendEngine în pipeline** — demonstrează că sistemul îmbunătățit predicțiile pe baza istoriei (argument academic solid)
2. **Export raport PDF** — ceva concret de arătat în demonstrație
3. **Grafice evoluție pe SubsystemDetail** — vizual impresionant, date deja disponibile, ușor de implementat
