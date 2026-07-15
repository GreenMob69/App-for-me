# Arhitectura Comercială — OBD-II Diagnostic Platform

**Data**: 2026-07-15  
**Orizont de proiectare**: 3-5 ani  
**Constrângere**: fiecare concept nou rezolvă o problemă reală și este consumat de cel puțin două module existente

---

## 1. De ce e nevoie de o arhitectură comercială separată

`UNIVERSAL_PLATFORM_ARCHITECTURE.md` rezolvă universalizarea pentru vehicule ICE standard. Dar un produs comercial real trebuie să răspundă la întrebări pe care arhitectura universală nu le acoperă:

**Problema 1 — Diversitate de grupuri propulsoare**  
Un Tesla Model 3 nu are motor termic, nu are turbo, nu are DPF, nu are injecție diesel. HealthEngine actual calculează un scor "Engine" bazat pe RPM, boost, MAF, rail pressure. Aplicat pe un BEV, toate aceste câmpuri sunt absente — scorul devine 0 sau nedefinit. Același pipeline care funcționează perfect pe Audi A6 produce date fără sens pe un vehicul electric.

**Problema 2 — Cunoaștere specifică marcă**  
Un BMW E46 cu motor M54 are o problemă bine-documentată: pompa de apă din plastic cedează la 100-120k km, urmată aproape invariabil de termostat. Această cunoaștere nu există în regulile generice. Un VAG cu DSG are un pattern de uzură specific la cuplaj dublu la rece. Un Ford EcoBoost 1.0 are un pattern specific de supra-temperatură la capul de cilindri. Aceste cunoștințe sunt date, nu cod — și trebuie să fie actualizabile fără redeploy.

**Problema 3 — Pipeline rigid**  
Cele 16 etape din `finalizeTripAnalysis()` rulează întotdeauna toate, în aceeași ordine, cu aceeași logică. Un vehicul electric nu are nevoie de TurboRules, DpfRules, LambdaRules, CoolingRules (în forma actuală). Un vehicul fără turbo care rulează TurboRules poate genera fals-pozitive. Costul de calcul este mic, dar principial: un pipeline care execută etape irelevante nu este corect proiectat.

**Problema 4 — Degradare grațioasă opacă**  
Când un vehicul are PID-uri lipsă, analiza continuă silențios cu date incomplete. Utilizatorul vede un scor de sănătate 87/100 fără să știe că acel scor e bazat pe 12 din 45 de semnale disponibile teoretic. Calitatea diagnosticului nu este vizibilă.

**Problema 5 — Formula de scoring non-portabilă**  
Health Score = Engine×0.35 + Safety×0.25 + Driving×0.20 + Fuel×0.20 este o formulă proiectată pentru un diesel turbo. Pe un BEV, subsistemul "Engine" ar trebui să fie "Baterie" cu factori complet diferiți (SoC degradation, thermal management, regeneration efficiency). Pe un hibrid, ambele sisteme coexistă. Formula nu poate fi hardcodată dacă platforma suportă toate tipurile de propulsie.

---

## 2. Conceptele noi

Fiecare concept este o abstracție care rezolvă exact una dintre problemele de mai sus și nu mai mult.

---

### Concept 1 — VehicleCapabilities

**Problema rezolvată**: Problema 1 (diversitate propulsoare) + Problema 3 (pipeline rigid)

**Ce este**: Un set de capability flags și parametri care descriu ce poate și ce nu poate face un vehicul. Capabilities sunt derivate din VehicleDefinition dar sunt separate — sunt răspunsurile la întrebări de tipul "are acest vehicul turbo?", nu specificații tehnice.

**De ce nu e suficientă VehicleDefinition?**  
VehicleDefinition conține date: `engine.turbo = true`, `engine.fuel_type = "diesel"`. Capabilities conțin consecințele diagnostice: `canAnalyzeBoost = true`, `shouldRunDPFAnalysis = true`, `hasLambdaOxygen = true`. Distincția contează când o mașină are turbo dar nu are senzor de boost conectat la OBD — VehicleDefinition spune că are turbo, dar PIDCoverage (Concept 4) spune că semnalul nu este disponibil, deci `canAnalyzeBoost = false` chiar dacă turbo există fizic.

**Structura**:

```
VehicleCapabilities {
  // Propulsie termică
  hasICE: boolean                 // are motor cu ardere internă
  hasTurbo: boolean               // turbocompresor
  hasSupercharger: boolean        // compresor mecanic
  hasDPF: boolean                 // filtru particule diesel
  hasEGR: boolean                 // recirculare gaze ardere
  hasLambdaOxygen: boolean        // sonde lambda (B1S1, B2S1 etc.)
  hasVariableValvetiming: boolean // VVT/VANOS/Valvetronic
  hasDirectInjection: boolean     // injecție directă (GDI/FSI/TFSI/CDI)
  hasDualMassFlywheel: boolean    // volant amortizor (uzură specifică)
  
  // Propulsie electrică
  hasElectricMotor: boolean       // motor electric de tracțiune
  hasHVBattery: boolean           // baterie de înaltă tensiune
  hasRegenerativeBraking: boolean // frânare regenerativă
  hasThermalManagement: boolean   // sistem termic baterie (chiller)
  hasOnBoardCharger: boolean      // încărcare AC la bord
  hasDCFastCharge: boolean        // încărcare DC rapidă (CCS/CHAdeMO)
  
  // Transmisie
  hasAutomaticGearbox: boolean
  hasDCT: boolean                 // cutie cu dublu ambreiaj
  hasCVT: boolean                 // variator continuu
  hasAWD: boolean                 // tracțiune integrală
  
  // Semnale OBD disponibile (dinamic, actualizat după prima cursă)
  canAnalyzeBoost: boolean        // semnal boost_bar prezent în date reale
  canAnalyzeMAF: boolean          // semnal maf_g_s prezent
  canAnalyzeRailPressure: boolean
  canAnalyzeLambda: boolean
  canAnalyzeDPFSoot: boolean
  canAnalyzeHVBatterySOC: boolean
  canAnalyzeHVBatteryTemp: boolean
  
  // Tip propulsie (calculat din flags)
  powertrainType: "ICE"|"BEV"|"HEV"|"PHEV"|"MHEV"
}
```

**Consumatori**:
- `AdaptiveDiagnosticPipeline` — decide ce etape rulează
- `FaultPredictionEngine` — selectează care modele predictive se aplică
- `RuleEngine` — filtrează modulele de reguli relevante
- `HealthEngine` — selectează ScoringStrategy
- `CorrelationEngine` — selectează perechile de corelații relevante
- `LiveDashboardScreen` — ascunde taburile pentru sisteme inexistente (ex: tab "Turbo" pe NA)

**Regulă de derivare**:

```
hasTurbo = vdef.engine.aspiration ∈ ["turbo", "biturbo", "twinscroll"]
           AND (canAnalyzeBoost OR vdef.engine.turbo = true)

canAnalyzeBoost = hasTurbo AND pid_coverage.boost_bar = "available"

powertrainType:
  hasICE AND hasHVBattery AND hasElectricMotor → "PHEV" sau "HEV"
    dacă hasOnBoardCharger sau hasDCFastCharge → "PHEV"
    altfel → "HEV"
  hasICE AND hasElectricMotor (12V mild hybrid fără tracțiune electrica) → "MHEV"
  NOT hasICE AND hasHVBattery → "BEV"
  altfel → "ICE"
```

---

### Concept 2 — KnowledgePack

**Problema rezolvată**: Problema 2 (cunoaștere specifică marcă actualizabilă fără redeploy)

**Ce este**: Un bundle de cunoaștere diagnostică specific unui grup de vehicule (marcă, familie de motoare, sau powertrain type). KnowledgePack este date, nu cod — un obiect JSON structurat care poate fi încărcat, actualizat, și versionat independent de aplicație.

**De ce nu sunt suficiente regulile existente din `rules.json`?**  
`rules.json` conține reguli generice OBD-II. Nu știe că BMW M54 are o problemă specifică cu pompa de apă. Nu știe că VAG DSG 7 are un pattern de uzură diferit față de DSG 6. Nu știe că Ford EcoBoost 1.0 dezvoltă presiune excesivă în carterul motorului. Această cunoaștere este specifică, documentată în baze de date tehnice și forumuri de specialitate — nu poate fi capturată în reguli generice.

**Structura**:

```
KnowledgePack {
  id: string                     // "VAG_TDI_PD", "BMW_M54", "FORD_ECOBOOST_10"
  version: string                // "1.2.3"
  
  // Acoperire
  applies_to: {
    makes: string[]              // ["Audi", "VW", "Seat", "Skoda"]
    engine_codes?: string[]      // ["AEL", "AFB", "AVF"] sau null (toate)
    fuel_types?: string[]        // ["diesel"] sau null (toate)
    year_range?: [number, number] // [1994, 2005] sau null
    powertrain_types?: string[]  // ["ICE", "HEV"] sau null (toate)
  }
  
  // Cunoaștere despre defecțiuni cunoscute
  known_failure_patterns: KnownFailurePattern[]
  
  // Praguri ajustate față de defaults generice
  threshold_overrides: {
    // cheie = threshold name din VehicleCapabilities/ThresholdCalculator
    coolant_warning?: number     // ex: 100 în loc de 105 pentru M54 (pompă slabă)
    boost_max?: number
    rpm_high_penalty_pct?: number
    [key: string]: number
  }
  
  // Ponderi ajustate pentru scoring (față de defaults per powertrainType)
  scoring_weight_overrides: {
    engine?: number              // dacă motorul acestui pack e mai sensibil
    fuel?: number
    [subsystem: string]: number
  }
  
  // Intervale service specifice
  service_interval_overrides: {
    oil_change_km?: number
    timing_belt_km?: number
    [item: string]: number
  }
  
  // Modele de predecție suplimentare specifice acestui pack
  additional_fault_models: FaultModel[]
  
  // Reguli de diagnostic suplimentare
  additional_rules: DiagnosticRule[]
  
  // Baseline defaults specifice (mai precise decât genericele per fuel_type)
  baseline_overrides: {
    voltage?: number
    coolant?: number
    maf?: number
    boost?: number
    [signal: string]: number
  }
  
  // Metadata
  source: string                 // "internal" | "community" | "oem_data"
  confidence: "verified"|"community"|"experimental"
  last_updated: string
}

KnownFailurePattern {
  id: string
  name: string                   // "Pompă apă M54 — uzură prematură"
  description: string
  
  // Condiții care activează pattern-ul
  trigger_conditions: {
    min_km?: number              // activat după N km (ex: 90000)
    min_age_years?: number
    signal_thresholds?: { [signal: string]: { op: "gt"|"lt"|"delta", value: number } }
  }
  
  // Cum afectează scorul și predicțiile
  fault_model_params: {
    base_probability: number     // probabilitate de start (mai mare decât genericul)
    escalation_rate: number      // cu cât crește per 10k km
    severity: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"
    estimated_remaining_km?: number
  }
  
  // Ce să recomande utilizatorului
  recommendation: string
  action_urgency: "MONITOR"|"SCHEDULE"|"URGENT"|"IMMEDIATE"
}
```

**Consumatori**:
- `FaultPredictionEngine` — `known_failure_patterns` sunt modele suplimentare de predicție
- `RuleEngine` — `additional_rules` sunt reguli adiționale evaluate alături de cele generice
- `BaselineEngine` — `baseline_overrides` înlocuiesc defaults-urile generice
- `MaintenanceCalculator` — `service_interval_overrides` refinează intervalele
- `HealthEngine` — `scoring_weight_overrides` ajustează ponderile per pack
- `ThresholdCalculator` — `threshold_overrides` ajustează pragurile de alerta

**Cum se selectează KnowledgePack**:

```
KnowledgePackRegistry.resolve(vdef):
  1. Caută pack-uri unde applies_to.makes conține vdef.make
  2. Filtrează după engine_codes dacă specificat
  3. Filtrează după year_range dacă specificat
  4. Dacă găsit: returnează cel mai specific (engine_code > make-only)
  5. Dacă nu: returnează GenericKnowledgePack(vdef.engine.fuel_type)
  6. Merge packs dacă mai multe se aplică (ex: VAG_DIESEL + VAG_COMMON_RAIL)
```

**Exemple de packs incluse la lansare**:
- `GENERIC_DIESEL` — fallback orice diesel
- `GENERIC_PETROL_NA` — fallback benzinǎ aspirat natural
- `GENERIC_PETROL_TURBO` — fallback benzinǎ turbo
- `GENERIC_BEV` — fallback electric
- `VAG_TDI_PD` — Audi/VW pompe-duze
- `VAG_TDI_CR` — Audi/VW common rail
- `VAG_DSG` — cutii DSG (6 și 7 viteze)
- `BMW_M54` — N52, M54 (E46/E39/E60)
- `FORD_ECOBOOST_10` — EcoBoost 1.0 trei cilindri

---

### Concept 3 — AdaptiveDiagnosticPipeline

**Problema rezolvată**: Problema 3 (pipeline rigid care rulează etape irelevante)

**Ce este**: Un orchestrator de pipeline care construiește dinamic lista de etape executabile bazat pe VehicleCapabilities și KnowledgePack. Fiecare etapă a pipeline-ului declară ce capabilities necesită pentru a putea rula.

**De ce nu e suficient graceful degradation în fiecare modul?**  
Graceful degradation presupune că etapa se execută, verifică ce date are și returnează un rezultat parțial. Aceasta are două probleme: (1) etapa poate genera false positives când datele necesare lipsesc complet (TurboRules pe o mașină NA poate produce "boost anormal" dacă câmpul boost_bar e absent și tratatt ca 0), (2) CPU și timp consumat inutil. AdaptiveDiagnosticPipeline decide dacă o etapă se execută, nu etapa însuși.

**Structura unui PipelineStep**:

```
PipelineStep {
  id: string                     // "TURBO_RULES", "DPF_ANALYSIS", "HV_BATTERY_HEALTH"
  
  // Ce trebuie să aibă vehiculul pentru ca etapa să ruleze
  required_capabilities: string[] // ["hasTurbo", "canAnalyzeBoost"]
  required_any_of?: string[]      // OR logic: cel puțin unul din acestea
  
  // Ce produce etapa (pentru etapele dependente)
  produces: string[]             // ["turboHealth", "boostCorrelation"]
  
  // Ce consum etapa (din DiagnosticContext)
  consumes: string[]             // ["summary", "baseline", "rawPackets"]
  
  // Funcția de execuție
  execute: (ctx: DiagnosticContext) => Promise<Partial<DiagnosticContext>>
  
  // Comportament la skip
  skip_produces_defaults: { [key: string]: any }  // ce pune în context dacă e skipped
}
```

**Cum construiește pipeline-ul**:

```
AdaptiveDiagnosticPipeline.build(capabilities, knowledgePack):
  1. Pornește cu lista completă de 16 etape standard
  2. Adaugă etapele suplimentare din knowledgePack.additional_steps
  3. Filtrează etapele unde required_capabilities nu sunt satisfăcute
  4. Rezolvă ordinea prin dependency graph (produces → consumes)
  5. Returnează lista ordonată de etape executabile

AdaptiveDiagnosticPipeline.execute(steps, initialContext):
  1. Pentru fiecare etapă în ordine:
     a. Verifică din nou la runtime că datele necesare există în ctx
     b. Execută
     c. Merge rezultatul în DiagnosticContext
     d. Log: etapa, durată, ce a produs
  2. Returnează DiagnosticContext complet
```

**Exemplu — pipeline pentru BEV**:

```
Etape SKIPPED pentru BEV (capabilities lipsesc):
  × TurboRules          (needs hasTurbo)
  × DpfRules            (needs hasDPF)  
  × LambdaRules         (needs hasLambdaOxygen)
  × BoostCorrelation    (needs canAnalyzeBoost)
  × FuelSystemAnalysis  (needs hasICE)
  × GlowPlugPrediction  (needs hasICE + isDiesel)

Etape ADĂUGATE pentru BEV (din GENERIC_BEV KnowledgePack):
  + HVBatteryHealthEngine
  + RegenerationEfficiencyAnalyzer  
  + ThermalManagementAnalyzer
  + SoCDegradationPredictor
  + ChargingPatternAnalyzer
```

**Consumatori**:
- `finalizeTripAnalysis()` în `backend/analyzers/index.js` — înlocuiește lista hardcodată
- `RuleEngine` — primește lista de module active din pipeline, nu întotdeauna toate 10

---

### Concept 4 — PIDCoverage

**Problema rezolvată**: Problema 4 (degradare grațioasă opacă)

**Ce este**: Un modul care calculează și expune calitatea datelor disponibile pentru un vehicul specific. Răspunde la: "Câte din semnalele necesare pentru o analiză completă sunt disponibile?"

**De ce este un concept separat și nu o parte din DataIntegrityEngine?**  
DataIntegrityEngine verifică validitatea pachetelor primite (lipsă pachete, valori imposibile). PIDCoverage verifică acoperirea semnalelor față de contractul vehiculului. Sunt întrebări diferite: DataIntegrity = "sunt datele corecte?", PIDCoverage = "sunt datele suficiente?". Un vehicul poate trimite date perfect valide dar să lipsească complet semnalul de boost dacă ECU-ul nu îl expune — DataIntegrity nu detectează asta, PIDCoverage da.

**Structura**:

```
PIDCoverage {
  // Per semnal: status
  signals: {
    [signalName: string]: {
      status: "available"|"missing"|"derived"|"unavailable_for_vehicle"
      seen_in_pct_packets: number  // 0-100, câte pachete conțineau semnalul
      quality: "good"|"frozen"|"noisy"|"sparse"
    }
  }
  
  // Aggregate
  critical_signals_coverage: number   // % din semnalele critice disponibile
  analysis_confidence_factor: number  // 0.0-1.0, multiplicator pentru ConfidenceEngine
  
  // Ce analize sunt afectate
  degraded_analyses: string[]    // ["boost_analysis", "turbo_health", ...]
  unavailable_analyses: string[] // ["dpf_analysis"] — imposibil, nu degradat
  
  // Recomandare
  data_quality_message: string   // mesaj pentru utilizator despre calitatea datelor
}
```

**Cum se calculează**:

```
PIDCoverageEngine.compute(rawPackets, vehicleCapabilities):
  1. Pentru fiecare semnal din CTF schema:
     a. Verifică câte pachete conțin semnalul (seen_in_pct_packets)
     b. Dacă >80% pachete → "available"
     c. Dacă 20-80% → "sparse"
     d. Dacă <20% → "missing"
     e. Dacă capability este false pentru vehicul → "unavailable_for_vehicle"
  
  2. Clasifică semnale în critical / important / optional
     - critical: rpm, speed, coolant
     - important: maf, boost (dacă hasTurbo), battery_voltage
     - optional: oil_temp, gear, rail_pressure
  
  3. Calculează coverage score și analysis_confidence_factor
  
  4. Generează degraded_analyses și unavailable_analyses
```

**Consumatori**:
- `ConfidenceEngine` — `analysis_confidence_factor` intră în calculul scorului de încredere
- `ExplainabilityEngine` — explică de ce un scor e mai scăzut decât expected
- `DataIntegrityEngine` — rulează în tandem (pas 1 și 2 din pipeline rămân, PIDCoverage se adaugă ca pas 1b)
- `VehicleHealthScreen` / `SubsystemDetailScreen` — badge de calitate date vizibil utilizatorului
- `AdaptiveDiagnosticPipeline` — actualizează capabilities.canAnalyzeX după prima cursă reală

---

### Concept 5 — PowertrainProfile

**Problema rezolvată**: Problema 1 (BEV/HEV/PHEV au altă logică de sănătate) + Problema 5 (formula scoring non-portabilă)

**Ce este**: O specificație care descrie ce parametri definesc sănătatea pentru un tip de propulsie. Fiecare PowertrainProfile declară subsistemele sale, semnalele care le alimentează și ponderile pentru Health Score.

**De ce nu e suficient VehicleCapabilities?**  
VehicleCapabilities spune CE are vehiculul. PowertrainProfile spune CUM se măsoară sănătatea pentru ce are. Un BEV are `hasHVBattery = true` (capabilities), iar PowertrainProfile_BEV spune că subsistemul principal de sănătate este "Baterie" cu greutate 40%, cu semnalele `hv_soc_pct`, `hv_temp_avg`, `soc_degradation_rate`. Sunt responsabilități distincte.

**Structura**:

```
PowertrainProfile {
  type: "ICE"|"BEV"|"HEV"|"PHEV"|"MHEV"
  
  subsystems: SubsystemDefinition[]
  
  // Semnale de monitorizat în baseline
  baseline_signals: string[]     // ce semnale trackuiește BaselineEngine
  
  // Care ScoringStrategy se folosește
  scoring_strategy_id: string    // "ICE_DIESEL_SCORING", "BEV_SCORING", "HEV_SCORING"
  
  // Modele de predicție aplicabile
  applicable_fault_models: string[]  // IDs din FaultPredictionEngine
  
  // Ce corelații are sens să calculeze CorrelationEngine
  relevant_correlations: CorrelationPair[]
}

SubsystemDefinition {
  id: string                     // "engine", "battery", "electric_motor"
  display_name: string           // "Motor", "Baterie", "Motor Electric"
  
  // Ce semnale alimentează acest subsistem
  primary_signals: string[]      // ["rpm", "coolant_temp", "maf_g_s"]
  secondary_signals: string[]    // ["oil_temp", "boost_bar"]
  
  // Ponderea în Health Score overall
  weight: number                 // 0.0-1.0, suma tuturor = 1.0
  
  // Dacă subsistemul poate fi complet absent (skip graceful)
  required_capability?: string   // "hasICE" — dacă absent, subsistem absent
}
```

**Profile predefinite**:

```
PowertrainProfile_ICE_DIESEL_TURBO:
  subsystems:
    - engine        (rpm, coolant, maf, boost)        weight: 0.35
    - safety        (braking, overspeed, stability)   weight: 0.25
    - driving_style (acceleration, rpm_zones)         weight: 0.20
    - fuel_economy  (consumption, CO2, cost)          weight: 0.20
  baseline_signals: [rpm, maf, boost, voltage, coolant]
  applicable_fault_models: [ALTERNATOR, BATTERY, TURBO, INJECTORS, COOLING, AIR_INTAKE, FUEL_SYSTEM, DPF, EGR]

PowertrainProfile_ICE_PETROL_NA:
  subsystems:
    - engine        (rpm, coolant, maf, o2)           weight: 0.35
    - safety                                          weight: 0.25
    - driving_style                                   weight: 0.20
    - fuel_economy                                    weight: 0.20
  baseline_signals: [rpm, maf, voltage, coolant, o2_b1s1]
  applicable_fault_models: [ALTERNATOR, BATTERY, INJECTORS, COOLING, AIR_INTAKE, CATALYTIC_CONVERTER]
  // no TURBO, DPF, EGR models

PowertrainProfile_BEV:
  subsystems:
    - hv_battery    (soc, temp_avg, degradation)      weight: 0.40
    - electric_drive (efficiency, regen_ratio)         weight: 0.30
    - safety                                          weight: 0.20
    - thermal_mgmt  (cooling_effectiveness)           weight: 0.10
  baseline_signals: [hv_soc_pct, hv_temp_avg, energy_consumed_kwh, regen_ratio]
  applicable_fault_models: [HV_BATTERY_DEGRADATION, CHARGING_SYSTEM, THERMAL_MANAGEMENT, ELECTRIC_MOTOR_WEAR]

PowertrainProfile_HEV:
  subsystems:
    - ice_engine    (rpm, coolant)                    weight: 0.25
    - hv_battery    (soc, temp)                       weight: 0.25
    - hybrid_system (ice_ev_ratio, regen)             weight: 0.20
    - safety                                          weight: 0.15
    - fuel_economy  (combined consumption)            weight: 0.15
  applicable_fault_models: [ALTERNATOR, BATTERY, COOLING, HV_BATTERY_DEGRADATION, HYBRID_INVERTER]

PowertrainProfile_PHEV:
  // Similar cu HEV dar cu electric_range și charging_efficiency în plus
  subsystems:
    - ice_engine                                      weight: 0.20
    - hv_battery                                      weight: 0.30
    - charging_system                                 weight: 0.15
    - hybrid_system                                   weight: 0.15
    - safety                                          weight: 0.10
    - fuel_economy                                    weight: 0.10
```

**Consumatori**:
- `HealthEngine` — selectează formula și subsistemele din profile
- `FaultPredictionEngine` — rulează doar modelele din `applicable_fault_models`
- `BaselineEngine` — trackuiește semnalele din `baseline_signals`
- `CorrelationEngine` — calculează doar corelațiile din `relevant_correlations`
- `VehicleHealthScreen` — afișează subsistemele definite în profile (nu hardcodate)

---

### Concept 6 — ScoringStrategy

**Problema rezolvată**: Problema 5 (formula de scoring hardcodată nu funcționează pe toate tipurile de propulsie)

**Ce este**: O interfață + implementări concrete care calculează Health Score. Fiecare ScoringStrategy știe cum să calculeze scorul pentru un tip specific de powertrain. HealthEngine nu mai conține formula — deleghează la strategia selectată.

**Interfața**:

```
ScoringStrategy {
  id: string
  
  compute(signals, capabilities, powertrainProfile, knowledgePack):
    → HealthResult {
        overall: number           // 0-100
        subsystems: {
          [subsystemId: string]: SubsystemScore
        }
      }

  SubsystemScore {
    score: number                 // 0-100
    weight: number                // din PowertrainProfile
    factors: ScoringFactor[]      // ce a contribuit la scor
    missing_signals: string[]     // semnale absente care ar îmbunătăți precizia
  }

  ScoringFactor {
    signal: string
    value: number
    contribution: number          // +/- față de scor perfect
    explanation: string           // "RPM >3500 → 15% din cursă"
  }
}
```

**Implementări concrete**:

```
ICEDieselTurboScoringStrategy:
  - Engine score: penalizări RPM_ZONE3, coolant >105, boost deviation, MAF degradation
  - Fuel score: consum vs baseline, rail pressure stability
  - Safety score: hard brakes, hard accelerations, overspeed
  - Driving score: RPM zones distribution, idle excess, smooth acceleration ratio

ICEPetrolNAScoringStrategy:
  - Engine score: penalizări diferite (zone RPM diferite, fără boost), lambda deviation
  - Fuel score: consum vs baseline (fără rail pressure)
  - Safety, Driving: identice cu Diesel

BEVScoringStrategy:
  - Battery score: SoC range utilization, temperature management, degradation rate
  - Electric drive score: energy efficiency (Wh/km vs baseline), regen ratio
  - Safety score: similar ICE
  - Thermal score: coolant temp baterie (separat de motor termic)

HEVScoringStrategy:
  - Compune ICEDieselTurboScoringStrategy sau ICEPetrolNAScoringStrategy pentru componenta ICE
  - Adaugă BEV subscores pentru componenta electrică
  - Ice_EV_ratio score: cât de bine utilizatorul a folosit modul electric
```

**Cum selectează HealthEngine strategia**:

```
HealthEngine.analyze(ctx):
  strategy = ScoringStrategyRegistry.get(ctx.powertrainProfile.scoring_strategy_id)
  overrides = ctx.knowledgePack.scoring_weight_overrides
  result = strategy.compute(ctx.signals, ctx.capabilities, ctx.powertrainProfile, overrides)
  return result
```

**Consumatori**:
- `HealthEngine` — deleghează calculul complet
- `ExplainabilityEngine` — folosește `factors` din SubsystemScore pentru explicații
- `VehicleHealthScreen` — afișează subsistemele returnate de strategie (nu hardcodate în UI)

---

### Concept 7 — DiagnosticContext

**Problema rezolvată**: Coeziunea pipeline-ului — un singur obiect de context trece prin toate etapele, elimina parametrii împrăștiați

**Ce este**: Obiectul unic care călătorește prin toate etapele din AdaptiveDiagnosticPipeline. Fiecare etapă citește din el și adaugă propriile rezultate. Elimină necesitatea de a actualiza semnătura fiecărei funcții când se adaugă date noi în pipeline.

**De ce este un concept nou și nu o simplă modificare?**  
Acum `finalizeTripAnalysis()` apelează fiecare engine cu parametri diferiți: `HealthEngine.analyze(summary, baseline, dna)`, `FaultPredictionEngine.evaluate({ summary, baseline, trends, correlations })`, etc. Adăugarea `capabilities` sau `knowledgePack` necesită modificarea fiecărei semnături. DiagnosticContext este un "envelope" care conține tot — o singură modificare la envelope permite accesul din orice etapă.

**Structura**:

```
DiagnosticContext {
  // Input imutabil
  readonly trip: TripRecord
  readonly rawPackets: CTF[]
  readonly vehicleDefinition: VehicleDefinition
  readonly capabilities: VehicleCapabilities
  readonly powertrainProfile: PowertrainProfile
  readonly knowledgePack: KnowledgePack
  
  // Rezultate acumulate (populate pe măsură ce pipeline rulează)
  pidCoverage?: PIDCoverage
  dataIntegrity?: DataIntegrityResult
  sensorQuality?: SensorQualityResult
  summary?: TripSummary
  health?: HealthResult
  rules?: RulesResult
  confidence?: ConfidenceResult
  reliability?: ReliabilityResult
  conflicts?: ConflictsResult
  explanations?: ExplanationsResult
  correlations?: CorrelationsResult
  baseline?: BaselineResult
  detailedExplanations?: DetailedExplanationsResult
  faultPredictions?: FaultPredictionsResult
  vehicleDNA?: VehicleDNAResult
  aiReport?: AIReport
  
  // Metadata pipeline
  pipeline_steps_executed: string[]
  pipeline_steps_skipped: string[]
  pipeline_steps_skipped_reasons: { [step: string]: string }
  execution_time_ms: number
}
```

**Consumatori**:
- Toate cele 16 etape din pipeline (fiecare citește și scrie în context)
- `AdaptiveDiagnosticPipeline` (orchestrează crearea și pasarea contextului)
- API handler din `backend.js` (citește rezultatul final)

---

## 3. Cum interacționează conceptele noi

```
                         VehicleDefinition
                               │
                    ┌──────────┴──────────┐
                    │                     │
             VehicleCapabilities   KnowledgePack
                    │                     │
                    └──────────┬──────────┘
                               │
                       PowertrainProfile
                               │
                    ┌──────────┴──────────┐
                    │                     │
           ScoringStrategy    AdaptiveDiagnosticPipeline
                    │                     │
                    │            (build step list)
                    │                     │
                    └──────────┬──────────┘
                               │
                        DiagnosticContext
                               │
                    ┌──────────┼──────────┐
                    │          │          │
               PIDCoverage  HealthEngine  FaultPredictionEngine
               (pas 1b)     (folosește    (modele din profile
                             strategy)    + pack patterns)
                    │          │          │
                    └──────────┼──────────┘
                               │
                        Final AI Report
```

**Lanțul complet la sosirea unui pachet MQTT**:

```
1. NormalizerRegistry.normalize(rawPacket) → CTF
2. TripAnalyzer.update(trip, ctf)          → acumulare

La OPRIRE cursă:
3. VehicleDefinitionEngine.get(vin)         → vdef
4. VehicleCapabilities.derive(vdef, recentCoverage) → capabilities
5. KnowledgePackRegistry.resolve(vdef)      → knowledgePack
6. PowertrainProfile.select(capabilities)   → profile
7. ScoringStrategyRegistry.get(profile)     → strategy
8. DiagnosticContext.create(...)            → ctx (cu toate de mai sus)
9. AdaptiveDiagnosticPipeline.build(capabilities, knowledgePack) → steps
10. AdaptiveDiagnosticPipeline.execute(steps, ctx) → ctx complet
11. Salvare rezultate în DB
12. Emit via Socket.IO
```

---

## 4. Suport complet pentru tipuri de propulsie

### 4.1 ICE Diesel Turbo (starea actuală — zero modificări)

Capabilities: `hasICE, hasTurbo, hasDPF, hasEGR, hasLambdaOxygen`  
KnowledgePack: `VAG_TDI_CR` sau `GENERIC_DIESEL`  
Profile: `ICE_DIESEL_TURBO`  
Strategy: `ICEDieselTurboScoringStrategy`  
Pipeline: toate 16 etape, inclusiv TurboRules, DpfRules, LambdaRules

---

### 4.2 ICE Benzinǎ Aspirat Natural

Capabilities: `hasICE, hasLambdaOxygen` (fără hasTurbo, hasDPF, hasEGR)  
KnowledgePack: `GENERIC_PETROL_NA` sau specific (ex: `BMW_M54`)  
Profile: `ICE_PETROL_NA`  
Strategy: `ICEPetrolNAScoringStrategy`  
Pipeline: fără TurboRules, DpfRules. Adaugă CatalyticConverterRules (o2 monitoring)

**Diferențe față de Diesel**:
- RPM_ZONE_3 = 5500 (nu 3500)
- HealthEngine nu penalizează boost (nu există)
- FaultPredictionEngine rulează CATALYTIC_CONVERTER în loc de DPF
- BaselineEngine trackuiește o2_b1s1 în loc de rail_pressure

---

### 4.3 BEV (Battery Electric Vehicle)

Capabilities: `hasElectricMotor, hasHVBattery, hasRegenerativeBraking` (fără hasICE)  
KnowledgePack: `GENERIC_BEV`  
Profile: `BEV`  
Strategy: `BEVScoringStrategy`

**Semnale canonice noi în CTF pentru BEV**:

```
CTF extins pentru BEV:
  hv_soc_pct?: number            // State of Charge baterie HV (0-100%)
  hv_soc_usable_kwh?: number     // kWh utilizabili
  hv_capacity_kwh?: number       // capacitate nominală actuală (degradare)
  hv_temp_avg?: number           // temperatura medie baterie HV
  hv_temp_max?: number           // temperatura maximă celulă
  hv_temp_min?: number           // temperatura minimă celulă (imbalance)
  hv_voltage?: number            // tensiune pack HV
  hv_current?: number            // curent instant
  energy_consumed_kwh?: number   // energie consumată cursă
  energy_regen_kwh?: number      // energie recuperată cursă
  regen_ratio?: number           // regen / (consum + regen)
  range_estimated_km?: number    // autonomie estimată de ECU
  motor_efficiency_pct?: number  // eficiență motor electric
  inverter_temp?: number         // temperatura invertor
  onboard_charger_temp?: number
```

**Pipeline BEV (etape active)**:

```
Etape standard active:
  DataIntegrity, PIDCoverage, SensorQuality (adaptate pentru semnale BEV)
  TripSummary (adaptat: fără consum combustibil, adaugă kWh)
  HealthEngine (BEVScoringStrategy)
  ConfidenceEngine, ReliabilityEngine
  ExplainabilityEngine, DetailedExplainability
  BaselineEngine (semnale BEV)
  FaultPredictionEngine (modele BEV)
  VehicleDNA (adaptat)
  AIReport

Etape SKIPPED:
  TurboRules, DpfRules, LambdaRules, CoolingRules (ICE-specific)
  FuelSystemAnalysis, GlowPlugPrediction, InjectorWear
  BoostCorrelation, RailPressureAnalysis

Etape ADĂUGATE (din GENERIC_BEV pack):
  HVBatteryHealthEngine
  SoCDegradationPredictor
  RegenerationEfficiencyAnalyzer
  ThermalManagementAnalyzer
  BatteryCellImbalanceDetector
```

**Modele predictive BEV**:

```
HV_BATTERY_DEGRADATION:
  Semnale: hv_capacity_kwh trend, hv_soc_pct la aceleași condiții
  Predicție: km/ani până la 80% din capacitatea nominală (end-of-life standard)
  
THERMAL_MANAGEMENT_DEGRADATION:
  Semnale: hv_temp_max - hv_temp_min (cell imbalance), inverter_temp trend
  Predicție: eficiență sistem de răcire baterie
  
CHARGING_SYSTEM_WEAR:
  Semnale: charging rate over time, onboard_charger_temp
  Predicție: degradare OBC
  
ELECTRIC_MOTOR_WEAR:
  Semnale: motor_efficiency_pct trend, current vs torque ratio
  Predicție: uzură bobinaje / rulmenți
```

---

### 4.4 HEV (Hibrid non-plug-in)

Capabilities: `hasICE, hasElectricMotor, hasHVBattery, hasRegenerativeBraking`  
Profile: `HEV`  
Strategy: `HEVScoringStrategy` (compune ICE + BEV subscores)

Particularitate: subsistemul `hybrid_system` monitorizează:
- `ice_ev_split_ratio` — câte % din energie vine din electric vs termic
- `cold_start_electric_pct` — porniri la rece cu motor electric
- Dacă motorul termic pornește des la rece la temperaturi mari → probabil degradare baterie HV

---

### 4.5 PHEV (Plug-in Hybrid)

Similar cu HEV, plus:
- Semnale de încărcare: `charging_session_kwh`, `charging_duration`, `charging_efficiency`
- Predicție: degradare cicluri de încărcare vs uzura tipică pentru chimia bateriei (NMC, LFP etc.)
- Score suplimentar: "Utilizare mod electric" — utilizatorul care nu îl încarcă niciodată primește scor scăzut pe acest subsistem

---

### 4.6 MHEV (Mild Hybrid 48V)

Capabilities: `hasICE, hasElectricMotor` (fără `hasHVBattery` — bateria 48V nu e HV)  
Profile: `MHEV`

Semnale noi CTF:
```
belt_starter_generator_pct?: number  // % utilizare BSG
lv48_soc_pct?: number                // SoC baterie 48V
lv48_voltage?: number                // tensiune sistem 48V
```

Pipeline: predominant ICE, cu un modul suplimentar `BSGAnalyzer`.

---

## 5. Cum se adaugă un vehicul nou (procedura completă)

Adăugarea unui vehicul nou pe platforma comercială = completarea a 3 fișiere de date. Zero cod nou necesar dacă vehiculul se încadrează într-un tip de propulsie existent.

**Pasul 1**: Adaugă entry în `VehicleModelDatabase.js`:
```
Completezi: engine_codes, displacement, cylinders, fuel_type, aspiration,
            max_rpm, idle_rpm, protocols, supported_pids, timing_belt/chain
```

**Pasul 2**: Verifică dacă există un KnowledgePack potrivit. Dacă nu:
```
Creezi un KnowledgePack JSON cu:
  applies_to (make + model/engine),
  threshold_overrides (dacă diferă de generic),
  known_failure_patterns (probleme documentate),
  service_interval_overrides
```

**Pasul 3**: Verifică dacă există un Normalizer potrivit:
```
Dacă vehiculul folosește VAG protocol → VAGNormalizer (gata)
Dacă BMW → BMWNormalizer (gata)
Dacă alt protocol → scrii un normalizer nou (mapare câmpuri → CTF)
```

Dacă pasul 3 nu necesită un normalizer nou (>90% din cazuri), adăugarea unui vehicul nu necesită cod.

---

## 6. Extensibilitate — viitor fără refactorizare

### 6.1 Adăugare tip de propulsie nou (ex: hidrogen FCEV)

```
Ce se adaugă:
  1. Semnale noi în CTF: h2_pressure_bar, fuel_cell_voltage, h2_consumption_g_km
  2. PowertrainProfile_FCEV cu subsistemele sale
  3. FCEVScoringStrategy
  4. KnowledgePack GENERIC_FCEV cu modele predictive noi
  5. Capabilities flags: hasFuelCell, hasH2Tank

Ce NU se modifică:
  - AdaptiveDiagnosticPipeline (skip logic automat)
  - HealthEngine (deleghează la strategie)
  - Toate celelalte motoare (nu știu de FCEV)
  - API REST
  - Frontend (afișează subsistemele din profil)
```

### 6.2 Adăugare marcă nouă (ex: Toyota)

```
Ce se adaugă:
  1. Entry în VehicleModelDatabase (date tehnice)
  2. ToyotaKnowledgePack (probleme cunoscute HSD, timing chain, etc.)
  3. ToyotaNormalizer dacă folosesc protocol proprietar

Ce NU se modifică: nimic din motoarele de analiză
```

### 6.3 Adăugare model predictiv nou (ex: CATALYTIC_CONVERTER_AGING)

```
Ce se adaugă:
  1. Model nou în FaultPredictionEngine cu interfața FaultModel
  2. Capabilities flag nou: hasThreeWayCat
  3. Adaugat în applicable_fault_models din ICE_PETROL profiles

Ce NU se modifică: pipeline, scoring, contextul
```

### 6.4 Adăugare KnowledgePack din comunitate

```
Un mecanic specializat BMW poate contribui un pack cu:
  - Praguri ajustate pentru M54 (coolant_warning 98 în loc de 105)
  - Known failure patterns documentate din experiență
  - Service intervals specifice față de BMW official

Procesul: JSON validat → review → publicat în registry
Zero cod. Zero redeploy.
```

---

## 7. Arhitectura serviciului comercial

### 7.1 Structura fișierelor noi

```
backend/
├── capabilities/
│   ├── VehicleCapabilities.js         # Derivare capability flags
│   └── PIDCoverageEngine.js           # Calculare acoperire semnale
│
├── knowledge/
│   ├── KnowledgePackRegistry.js       # Încărcare și selectare packs
│   ├── packs/
│   │   ├── generic_diesel.json
│   │   ├── generic_petrol_na.json
│   │   ├── generic_petrol_turbo.json
│   │   ├── generic_bev.json
│   │   ├── generic_hev.json
│   │   ├── vag_tdi_pd.json
│   │   ├── vag_tdi_cr.json
│   │   ├── vag_dsg.json
│   │   └── bmw_m54.json
│   └── KnowledgePackValidator.js      # Schema validation la încărcare
│
├── powertrain/
│   ├── PowertrainProfile.js           # Profile predefinite + selector
│   ├── profiles/
│   │   ├── ice_diesel_turbo.js
│   │   ├── ice_petrol_na.js
│   │   ├── ice_petrol_turbo.js
│   │   ├── bev.js
│   │   ├── hev.js
│   │   ├── phev.js
│   │   └── mhev.js
│   └── scoring/
│       ├── ScoringStrategyRegistry.js
│       ├── ICEDieselTurboScoringStrategy.js
│       ├── ICEPetrolNAScoringStrategy.js
│       ├── BEVScoringStrategy.js
│       └── HEVScoringStrategy.js
│
├── pipeline/
│   ├── AdaptiveDiagnosticPipeline.js  # Orchestrator dinamic
│   ├── DiagnosticContext.js           # Envelope context
│   └── steps/                         # Fiecare etapă ca PipelineStep
│       ├── DataIntegrityStep.js
│       ├── PIDCoverageStep.js         # Nou
│       ├── SensorQualityStep.js
│       ├── TripSummaryStep.js
│       ├── HealthEngineStep.js
│       ├── ... (celelalte etape existente, rewrapped)
│       ├── HVBatteryHealthStep.js     # Nou (BEV)
│       └── RegenerationEfficiencyStep.js  # Nou (BEV/HEV)
│
├── normalizers/                        # (din UNIVERSAL_PLATFORM_ARCHITECTURE)
│   ├── VAGNormalizer.js
│   ├── BMWNormalizer.js
│   ├── GenericOBD2Normalizer.js
│   └── NormalizerRegistry.js
│
└── vehicle-profile/                    # (existent, modificat)
    ├── VehicleDefinitionEngine.js
    ├── VehicleModelDatabase.js
    ├── VinDecoder.js
    ├── ThresholdCalculator.js
    ├── MaintenanceCalculator.js
    ├── VehicleStatus.js
    ├── EventBus.js
    ├── VehicleTimeline.js
    ├── MilestoneTracker.js
    └── routes.js
```

### 7.2 Modificări la motoarele existente (rezumat)

| Modul | Modificare | Efort |
|-------|-----------|-------|
| `finalizeTripAnalysis()` | Înlocuiește lista hardcodată cu `AdaptiveDiagnosticPipeline` | Mediu |
| `HealthEngine` | Deleghează la `ScoringStrategy` | Mic |
| `FaultPredictionEngine` | Filtrează modele după `capabilities.applicable_fault_models` | Mic |
| `CorrelationEngine` | Filtrează perechi după `powertrainProfile.relevant_correlations` | Mic |
| `BaselineEngine` | Trackuiește semnalele din `powertrainProfile.baseline_signals` | Mic |
| `RuleEngine` | Filtrează module după capabilities + adaugă reguli din KnowledgePack | Mic-Mediu |
| `ConfidenceEngine` | Multiplică cu `pidCoverage.analysis_confidence_factor` | Mic |
| `ExplainabilityEngine` | Citește `factors` din SubsystemScore | Mic |
| `TripAnalyzer` | Consumă CTF (din UNIVERSAL_PLATFORM) | Mediu |
| `MaintenanceCalculator` | Citește intervale din KnowledgePack + VehicleDefinition | Mic |

### 7.3 Modificări la frontend

| Componentă | Modificare |
|-----------|-----------|
| `VehicleHealthScreen` | Subsistemele vin din `powertrainProfile.subsystems`, nu hardcodate |
| `SubsystemDetailScreen` | Afișează badge PIDCoverage pentru transparența datelor |
| `LiveDashboardScreen` | Tab-uri filtrare după capabilities (fără "Turbo" pe NA/BEV) |
| `TripReportScreen` | Câmpuri adaptate per powertrain (kWh pe BEV, combustibil pe ICE) |
| `VehicleOnboardingScreen` | Wizard complet cu tip propulsie, completare câmpuri lipsă |

---

## 8. Riscuri specifice arhitecturii comerciale

**Risc: Complexitate configurare KnowledgePack**  
Un KnowledgePack greșit (threshold prea agresiv, model predictiv necalibrat) produce diagnostice incorecte pentru toți utilizatorii cu acel vehicul. Mitigare: versioning strict, environment de staging cu vehicule test, rollback automat la versiunea anterioară dacă rata de false positives crește.

**Risc: PowertrainProfile incomplet pentru PHEV**  
PHEV-urile sunt foarte diverse (Toyota Prius PHEV cu HSD, VW Golf GTE cu eDrive, BMW 330e cu eDrive). Un profil generic poate să nu reflecte corect comportamentul fiecărei arhitecturi. Mitigare: `PowertrainProfile` are câmpuri de override per make+model, similar KnowledgePack.

**Risc: PIDCoverage calculat greșit la prima cursă**  
La prima cursă nu știm ce PIDs va expune vehiculul. Capabilities derivate din VehicleDefinition pot indica `canAnalyzeBoost = true` dar ECU-ul să nu expună semnalul. PIDCoverage corectează capabilities după prima cursă reală. Mitigare: DiagnosticContext conține `capabilities_source: "derived"|"observed"`, ConfidenceEngine penalizează prima cursă.

**Risc: DiagnosticContext prea mare în memorie**  
Un context care conține `rawPackets` (600 pachete CTF × ~80 câmpuri) poate fi semnificativ (600 × 80 × 8 bytes ≈ 375 KB per cursă). Mitigare: `rawPackets` este referință la array-ul din memorie (nu copiat), eliberat după execuția pipeline-ului.

**Risc: Backward compatibility la schimbarea ScoringStrategy**  
Un Health Score de 87 pe `ICEDieselTurboScoringStrategy_v1` poate deveni 82 pe `_v2` dacă ponderile se schimbă, fără ca vehiculul să fie diferit. TrendEngine ar detecta o "degradare" falsă. Mitigare: `HealthResult` include `strategy_version`; TrendEngine nu compară scoruri calculate cu strategy versions diferite.

---

## 9. Ordinea implementării (arhitectura comercială completă)

Aceasta continuă după Sprint 5 din `UNIVERSAL_PLATFORM_ARCHITECTURE.md`.

```
SPRINT 6 — Contextul și pipeline-ul adaptiv
  1. DiagnosticContext.js (envelope)
  2. Rewrap etapele existente ca PipelineStep cu declared capabilities
  3. AdaptiveDiagnosticPipeline.js (build + execute)
  4. Înlocuiește finalizeTripAnalysis() cu pipeline-ul adaptiv
  Test: Audi → rezultate identice, pipeline log afișează etapele executate

SPRINT 7 — Capabilities și Coverage
  1. VehicleCapabilities.js (derivare din VehicleDefinition)
  2. PIDCoverageEngine.js + PIDCoverageStep
  3. ConfidenceEngine: integrare analysis_confidence_factor
  4. UI: badge calitate date în SubsystemDetailScreen
  Test: simulare PID lipsă → scor confidence scade → UI afișează badge

SPRINT 8 — KnowledgePack
  1. KnowledgePackRegistry.js + validator
  2. GENERIC_DIESEL, GENERIC_PETROL_NA, GENERIC_BEV (packs JSON)
  3. VAG_TDI_CR pack (pentru Audi existent — reproduce exact comportamentul actual)
  4. FaultPredictionEngine: integrare known_failure_patterns
  5. RuleEngine: adaugă additional_rules din pack
  Test: Audi cu VAG_TDI_CR pack → rezultate identice sau îmbunătățite vs generic

SPRINT 9 — PowertrainProfile și ScoringStrategy
  1. PowertrainProfile (ICE_DIESEL_TURBO, ICE_PETROL_NA, BEV)
  2. ScoringStrategyRegistry + ICEDieselTurboScoringStrategy
  3. HealthEngine: deleghează la strategie
  4. BaselineEngine, CorrelationEngine: filtrare per profil
  5. VehicleHealthScreen: subsisteme din profil
  Test: Audi → scor identic cu strategia ICEDieselTurbo

SPRINT 10 — Suport BEV complet
  1. CTF extins cu semnale BEV
  2. BEVScoringStrategy + HEVScoringStrategy
  3. PowertrainProfile_BEV + PowertrainProfile_HEV
  4. GENERIC_BEV KnowledgePack cu modele predictive BEV
  5. HVBatteryHealthStep, SoCDegradationPredictor
  6. Simulator BEV minimal (pentru test)
  Test: simulare BEV → health score cu subsisteme baterie + drive, fără motor/boost/DPF

SPRINT 11 — Comercializare fundație
  1. KnowledgePack versioning + rollback
  2. VehicleModelDatabase extins (20+ vehicule comune)
  3. API: GET /api/knowledge-packs (listing packs disponibile)
  4. API: POST /api/knowledge-packs (contribuție community, cu validare)
  5. Multi-tenant: user_id pe vehicles table
  Durată: 5-7 zile
```

---

## 10. Tabel complet — concept → probleme rezolvate → consumatori

| Concept | Problema rezolvată | Consumatori (min 2) |
|---------|-------------------|---------------------|
| VehicleCapabilities | BEV/HEV nu au aceleași sisteme ca ICE; pipeline rigid | AdaptivePipeline, FaultPredictionEngine, RuleEngine, HealthEngine, CorrelationEngine, LiveDashboard UI |
| KnowledgePack | Cunoaștere marcă-specifică, actualizabilă fără cod | FaultPredictionEngine, RuleEngine, BaselineEngine, MaintenanceCalculator, HealthEngine (weight overrides) |
| AdaptiveDiagnosticPipeline | Pipeline execută etape irelevante, false positives pe vehicule incompatibile | finalizeTripAnalysis (înlocuit), RuleEngine (module filtrate) |
| PIDCoverage | Degradare grațioasă opacă; utilizatorul nu știe calitatea datelor | ConfidenceEngine, ExplainabilityEngine, AdaptivePipeline (actualizare capabilities), UI (badge) |
| PowertrainProfile | Formula de scoring non-portabilă; subsisteme UI hardcodate | HealthEngine, BaselineEngine, CorrelationEngine, VehicleHealthScreen, TripReportScreen |
| ScoringStrategy | Health Score ICE nu se aplică pe BEV/HEV | HealthEngine (deleghează), ExplainabilityEngine (folosește factors), VehicleHealthScreen (afișează subsisteme) |
| DiagnosticContext | Semnături inconsistente prin pipeline; adăugarea de date noi = modificare peste tot | Toate cele 16+ etape din pipeline, backend.js (citește rezultatul final) |
