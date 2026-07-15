# Arhitectura Platformei Universale OBD-II

**Data**: 2026-07-15  
**Versiunea curentă**: Audi A6 C4 specific (v1.0)  
**Versiunea țintă**: Platformă universală OBD-II (v2.0)  
**Constrângere cheie**: Evoluție incrementală — nicio linie existentă nu se rupe fără înlocuitor funcțional

---

## 1. Viziunea arhitecturală

### 1.1 De la ce plecăm

Sistemul actual este un monolith specializat: fiecare layer (MQTT consumer, TripAnalyzer, HealthEngine, CorrelationEngine, maintenance intervals) cunoaște implicit că vehiculul este un Audi A6 C4 2.5 TDI diesel. Cunoașterea aceasta e dispersată în cod sub forma:

- Path-uri hardcodate: `p.motor.rpm`, `p.temperaturi.coolant`, `p.aer.boost_actual`
- Praguri hardcodate: RPM >3500 = penalizare (logic diesel), coolant normal 88°C, boost normal ~1.4 bar
- Intervale service hardcodate: timing belt 120k km (nu există pe motoare benzinice moderne)
- String-uri hardcodate: `"Audi A6 C4 2.5 TDI AEL"`, topic MQTT `licenta/audi_a6_c4/telemetrie`
- Baseline defaults hardcodate: `baseline_voltage=14.1`, `baseline_coolant=88.0`

### 1.2 Unde ajungem

Același sistem, dar cunoașterea despre vehicul este **izolată într-un singur modul**: `VehicleDefinitionEngine`. Toate celelalte motoare primesc vehiculul ca parametru și nu știu nimic despre el în afara a ceea ce le transmite definiția.

```
ÎNAINTE:
  TripAnalyzer → știe că câmpul rpm e la path "motor.rpm" (Audi/VAG)
  HealthEngine → știe că >3500 RPM e penalizare (diesel Audi)
  CorrelationEngine → știe că boost-maf normal e 0.95 (turbo diesel)

DUPĂ:
  TripAnalyzer → primește FIELD_MAP din VehicleDefinition
  HealthEngine → primește RPM_THRESHOLD_HIGH din VehicleDefinition
  CorrelationEngine → primește CORRELATION_NORMS din VehicleDefinition
```

### 1.3 Principiul de bază

**Vehicle Definition este singurul loc care știe ce vehicul este conectat.**  
Toate motoarele de analiză sunt parametrizate prin definiție, nu prin cunoaștere internă.

---

## 2. Noua arhitectură — vedere de ansamblu

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATE BRUTE INTRARE                           │
│                                                                     │
│  Simulator Audi    Simulator BMW    Adaptor ELM327    ELM327 real   │
│       │                 │                │                │         │
│       └─────────────────┴────────────────┴────────────────┘         │
│                              │ MQTT / Serial / BT                   │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    VEHICLE RESOLUTION CHAIN                          │
│                                                                      │
│  1. VIN Decoder (ISO 3779)     → make, model, year, country          │
│  2. VehicleDefinitionEngine    → full vehicle spec + thresholds      │
│  3. Manual Fallback (UI)       → user provides missing fields        │
│                                                                      │
│  Output: VehicleDefinition object (immutable per session)            │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    PID NORMALIZATION LAYER                           │
│                                                                      │
│  Raw packet (orice format) → Canonical Telemetry Format              │
│                                                                      │
│  NormalizerRegistry                                                  │
│  ├── VAGNormalizer   (Audi, VW, Seat, Skoda)                        │
│  ├── BMWNormalizer   (BMW, Mini, Rolls-Royce)                       │
│  ├── FordNormalizer  (Ford, Lincoln)                                │
│  ├── GenericOBD2Normalizer  (fallback standard SAE J1979)           │
│  └── [extensibil: MercedesNormalizer, ToyotaNormalizer, ...]        │
│                                                                      │
│  Output: packet canonical { rpm, speed, coolant, maf, ... }         │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    PIPELINE ANALIZĂ (existent, parametrizat)         │
│                                                                      │
│  TripAnalyzer → HealthEngine → RuleEngine → ConfidenceEngine →      │
│  ReliabilityEngine → RuleConflictResolver → ExplainabilityEngine →  │
│  CorrelationEngine → BaselineEngine → FaultPredictionEngine →        │
│  VehicleDNA → AI Report                                             │
│                                                                      │
│  Fiecare motor primește VehicleDefinition ca parametru              │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         API + MOBILE APP                             │
│  (nemodificat în esență; UI primește vehicleInfo din /api/vehicles)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module noi

### 3.1 VehicleDefinitionEngine

**Locație**: `backend/vehicle-profile/VehicleDefinitionEngine.js`  
**Rol**: Singurul modul care produce o definiție completă a vehiculului. Toți ceilalți consumatori primesc output-ul lui.

**Responsabilități**:
- Combină datele decodate din VIN cu datele introduse manual de utilizator
- Produce un obiect `VehicleDefinition` complet și imutabil
- Oferă valori default rezonabile pentru câmpurile necunoscute
- Expune metode de interogare: `getThreshold(key)`, `getServiceInterval(type)`, `getSupportedPIDs()`, `getCorrelationNorms()`

**Structura VehicleDefinition**:

```
VehicleDefinition {
  // Identitate
  vin: string
  make: string                    // "Audi", "BMW", "Ford", ...
  model: string                   // "A6", "3 Series", "Focus", ...
  variant: string                 // "C4", "E46", ...
  year: number
  
  // Motorazare
  engine: {
    code: string                  // "AEL", "M54B25", "DURATEC"
    displacement_cc: number       // 2500, 2494, 1800
    cylinders: number             // 6, 6, 4
    fuel_type: "diesel"|"petrol"|"hybrid"|"electric"
    aspiration: "turbo"|"na"|"supercharged"
    max_rpm: number               // 4500, 7000, 6500
    idle_rpm: number              // 700, 750, 800
    normal_coolant_temp: number   // 88, 90, 92
    turbo: boolean
  }
  
  // Transmisie
  drivetrain: {
    gearbox: "manual"|"automatic"|"dct"|"cvt"
    drive: "fwd"|"rwd"|"awd"
    gears: number
  }
  
  // Protocoale și PID-uri
  protocols: string[]             // ["SAE_J1979", "VAG_KWP1281", "UDS"]
  manufacturer_extension: string  // "VAG" | "BMW" | "FORD" | null
  supported_pids: string[]        // lista de PID-uri cunoscute pentru model
  
  // Praguri (inima universalizării)
  thresholds: {
    rpm_zone1: number             // RPM limita ralanti (ex: 1500)
    rpm_zone2: number             // RPM limita medie (ex: 2500)
    rpm_zone3: number             // RPM limita înaltă (ex: 3500 diesel / 5000 benzinǎ)
    rpm_high_penalty_pct: number  // % timp >zone3 care generează penalizare
    coolant_warning: number       // temperatura de alertă (ex: 105)
    coolant_critical: number      // temperatura critică (ex: 110)
    boost_min: number             // boost minim normal (ex: 0.0 pentru NA)
    boost_max: number             // boost maxim normal (ex: 2.1 bar)
    voltage_min: number           // voltaj minim normal (ex: 13.5)
    voltage_normal: number        // voltaj de referință (ex: 14.1)
    oil_temp_normal: number       // temperatura ulei normal (ex: 90)
    overspeed_kmh: number         // limita pentru penalizare viteză
  }
  
  // Baseline defaults (prima cursă)
  baseline_defaults: {
    voltage: number
    coolant: number
    maf?: number
    boost?: number
    rpm_idle?: number
  }
  
  // Corelații normale (pentru CorrelationEngine)
  correlation_norms: {
    coolant_oil: number           // 0.92 diesel turbo, poate fi 0.88 NA
    rpm_fuel: number              // 0.98 diesel, ~0.95 benzinǎ
    boost_maf?: number            // null dacă NA
    anomaly_thresholds: {
      boost_maf_min?: number      // sub ce valoare e anomalie
      coolant_oil_min: number
    }
  }
  
  // Intervale service (per vehicul)
  service_intervals: {
    oil_change_km: number
    oil_change_months: number
    air_filter_km: number
    fuel_filter_km?: number       // null la motoare cu filtru lifetime
    timing_belt_km?: number       // null la motoare cu lanț
    timing_chain_km?: null        // null la motoare cu curea
    spark_plugs_km?: number       // null la motoare diesel
    glow_plugs_km?: number        // null la motoare benzinaă
    brake_fluid_months: number
    coolant_months: number
    transmission_oil_km?: number
    dpf_km?: number               // null dacă nu are DPF
  }
  
  // Costuri combustibil (pentru consum și CO2)
  fuel_params: {
    price_per_liter: number       // RON/L, default per fuel_type
    co2_kg_per_liter: number      // factor emisii, default per fuel_type
    avg_consumption_l100: number  // consum mediu estimat pentru baseline
  }
  
  // Metadata
  is_complete: boolean            // false dacă au rămas câmpuri necunoscute
  missing_fields: string[]        // câmpuri care trebuie completate manual
  source: "vin_auto"|"manual"|"partial"
}
```

**Cum produce definiția** (chain of responsibility):

```
1. VinDecoder.decodeVin(vin)
   → make, model, year (deja funcțional)
   
2. VehicleModelDatabase.lookup(make, model, year, engine_code)
   → completează engine specs, protocols, supported_pids
   
3. FuelTypeDefaults.apply(fuel_type)
   → completează baseline fuel_params cu valori standard per combustibil
   
4. ThresholdCalculator.compute(engine_specs)
   → calculează praguri specifice motorului (diesel vs benzinǎ, turbo vs NA)
   
5. ServiceIntervalCalculator.compute(make, model, engine, fuel)
   → intervale service corecte pentru vehicul
   
6. ManualOverride.apply(user_provided_fields)
   → suprascrie orice câmp cu datele introduse manual de utilizator
   
7. Completeness.check(definition)
   → setează is_complete și missing_fields
```

---

### 3.2 VehicleModelDatabase

**Locație**: `backend/vehicle-profile/VehicleModelDatabase.js`  
**Rol**: Baza de date de specificații vehicule. Echivalentul unui catalog auto digital.

**Responsabilități**:
- Lookup după (make, model, year, engine_code optional)
- Returnează specs parțiale sau complete
- Permite adăugare facilă de vehicule noi (un obiect JSON)

**Structura internă**:

```
vehicles_db = {
  "VAG": {
    "Audi": {
      "A6_C4": {
        years: [1994, 1997],
        engines: {
          "AEL": {
            displacement_cc: 2500, cylinders: 6,
            fuel_type: "diesel", aspiration: "turbo",
            max_rpm: 4500, idle_rpm: 700,
            normal_coolant_temp: 88,
            protocols: ["SAE_J1979", "VAG_KWP1281"],
            supported_pids: ["rpm","speed","coolant","maf","boost",...],
            timing_belt_km: 120000,
            spark_plugs_km: null,  // diesel
            glow_plugs_km: 80000
          }
        }
      }
    },
    "VW": { ... },
    "Seat": { ... }
  },
  "BMW_GROUP": {
    "BMW": {
      "3_Series_E46": { ... }
    }
  },
  "FORD": { ... }
}
```

Inițial: Audi A6 C4 complet definit. Celelalte vehicule cu date generice per producător.

---

### 3.3 PID Normalization Layer

**Locație**: `backend/normalizers/`  
**Rol**: Transformă orice format de pachet MQTT/serial în formatul canonic intern.

**Formatul canonic** (Canonical Telemetry Format — CTF):

```
CTF {
  timestamp: number
  engine_state: "PORNIRE"|"MERS"|"OPRIRE"
  vin: string
  
  // Câmpuri canonice — toate opționale
  rpm?: number
  speed_kmh?: number
  engine_load_pct?: number
  throttle_pct?: number
  
  coolant_temp?: number
  oil_temp?: number
  intake_air_temp?: number
  
  maf_g_s?: number
  map_kpa?: number
  boost_bar?: number
  
  fuel_instant_l100?: number
  fuel_rail_pressure_bar?: number
  
  o2_b1s1_v?: number
  o2_b2s1_v?: number
  
  battery_voltage?: number
  
  gear?: number
  
  dtc_codes?: string[]
  
  // Câmpuri extinsă producător (opționale)
  vag_ext?: { ... }    // câmpuri VAG suplimentare
  bmw_ext?: { ... }    // câmpuri BMW suplimentare
  ford_ext?: { ... }   // câmpuri Ford suplimentare
  
  // Metadata normalizare
  _normalizer: string  // "VAG" | "BMW" | "GENERIC"
  _missing_pids: string[]  // câmpuri care nu au putut fi citite
}
```

**NormalizerRegistry**:

```
NormalizerRegistry {
  normalizers: Map<string, INormalizer>
  
  register(name, normalizer): void
  resolve(raw_packet): string     // detectează tipul din structura pachetului
  normalize(raw_packet, vdef): CTF
}
```

**VAGNormalizer** (mapare exactă cu FIELD_MAP actual):

```
VAGNormalizer {
  map: {
    rpm:           "motor.rpm"
    speed_kmh:     "motor.speed"
    coolant_temp:  "temperaturi.coolant"
    oil_temp:      "temperaturi.oil"
    maf_g_s:       "aer.maf"
    boost_bar:     "aer.boost_actual"
    map_kpa:       "aer.map"
    battery_voltage: "baterie.ecu_volt"
    fuel_instant:  "combustibil.inst_cons"
    rail_pressure: "combustibil.rail_press"
    gear:          "transmisie.gear"
    dtc_codes:     "dtc"
    vin:           "ecu.vin"
    engine_state:  "stare_motor"
  }
}
```

**GenericOBD2Normalizer** (fallback pentru mașini fără normalizator specific):

```
GenericOBD2Normalizer {
  // Încearcă variante comune de path-uri
  // Dacă tot nu găsește: lăsă câmpul absent (graceful degradation)
}
```

---

### 3.4 ThresholdCalculator

**Locație**: `backend/vehicle-profile/ThresholdCalculator.js`  
**Rol**: Calculează pragurile dinamice ale vehiculului din specificațiile motorului.

**Logică**:

```
DIESEL turbo:
  rpm_zone3 = min(engine.max_rpm × 0.78, 3500)
  rpm_high_penalty_pct = 15
  boost_max = 2.1
  
BENZINA aspirat natural:
  rpm_zone3 = engine.max_rpm × 0.75
  rpm_high_penalty_pct = 20   // penalizare mai mică la benzinǎ sport
  boost_max = 0               // nu există boost
  boost_min = 0

BENZINA turbo:
  rpm_zone3 = min(engine.max_rpm × 0.72, 5500)
  boost_max = 1.8
  
ELECTRIC:
  rpm_zone3 = null            // nu are sens
  boost_* = null
  coolant_warning = 65        // temperature baterie, nu motor
```

---

### 3.5 ManufacturerExtensionRegistry

**Locație**: `backend/normalizers/extensions/`  
**Rol**: Gestionează PID-uri non-standard specifice producătorilor.

**Extensii planificate**:

```
VAGExtension:
  - PID-uri KWP1281: injecție, EGR specific VAG, boost VAG
  - Coduri DTC format VAG (P, C, B, U + 4 cifre hex)
  
BMWExtension:
  - PID-uri BMW ISTA specifice
  - Coduri eroare BMW format
  
FordExtension:
  - PIDs ForScan specifice
  
GenericExtension (fallback):
  - Doar SAE J1979 standard
  - Mode 01 PIDs standard
```

---

## 4. Modificări la modulele existente

### 4.1 backend.js

**Modificări necesare**:

| Acum | După |
|------|------|
| Topic MQTT hardcodat `licenta/audi_a6_c4/telemetrie` | Topic configurat per vehicul: `licenta/{vin}/telemetrie` sau generic `licenta/telemetrie` |
| String `"Audi A6 C4 2.5 TDI AEL"` hardcodat | Citit din `VehicleDefinition.make + model + engine.code` |
| VIN `WAUZZZ4A1RN000000` hardcodat | Citit din pachetul MQTT (câmpul canonical `vin`) |
| Apel direct `finalizeTripAnalysis(db, tripId, vin)` | `finalizeTripAnalysis(db, tripId, vin, vehicleDefinition)` |

**Ce nu se modifică**: toate endpoint-urile REST, logica MQTT consumer, structura `calatoriiActive`, Socket.IO broadcasting.

---

### 4.2 backend/analyzers/config.js

**Modificări necesare**:

| Acum | După |
|------|------|
| `FIELD_MAP` hardcodat cu path-uri VAG | `FIELD_MAP` eliminat — înlocuit de `VAGNormalizer.map` |
| `RPM_ZONE_1/2/3` hardcodate | Citite din `VehicleDefinition.thresholds` |
| `DIESEL_PRICE_PER_LITER`, `DIESEL_CO2_KG_PER_LITER` hardcodate | Citite din `VehicleDefinition.fuel_params` |
| `OVERSPEED_KMH` hardcodat | Citit din `VehicleDefinition.thresholds.overspeed_kmh` |

`config.js` rămâne pentru constante care nu țin de vehicul: `HARD_ACCEL_G`, `HARD_BRAKE_G`, `RAPID_DECEL_G`, `IDLE_SPEED_KMH` (acestea sunt comportamentale, nu specifice vehiculului).

---

### 4.3 backend/analyzers/TripAnalyzer.js

**Modificări necesare**:

`createAnalysis()` și `updateAnalyzer(trip, pachet)` primesc un al treilea parametru: `vehicleDefinition`.

Funcția `getPath(pachet, field)` bazată pe `FIELD_MAP` este înlocuită cu accesul direct la câmpurile canonice ale CTF. Pachetul primit de TripAnalyzer nu mai este pachetul raw VAG, ci CTF deja normalizat.

**Deci**: TripAnalyzer nu mai știe nimic despre structura pachetului brut. Primește doar CTF + VehicleDefinition.

---

### 4.4 backend/analyzers/HealthEngine.js

**Modificări necesare**:

```
ACUM:
  if (rpm > 3500) penalizare   // hardcodat pentru diesel Audi

DUPĂ:
  if (rpm > vdef.thresholds.rpm_zone3) penalizare
  if (pctTimeAboveZone3 > vdef.thresholds.rpm_high_penalty_pct) penalizare
```

Formulele HealthEngine rămân identice (ponderile 35/25/20/20). Doar pragurile devin parametrizate.

---

### 4.5 backend/analyzers/TrendEngine.js

**Modificări necesare**: minime. TrendEngine lucrează cu valori numerice (voltaj, MAF, coolant) deja extrase. Singura modificare: pragul `voltage < 13.8` devine `voltage < vdef.thresholds.voltage_min`.

---

### 4.6 backend/intelligence/CorrelationEngine.js

**Modificări necesare**: cele mai substanțiale din toate modulele.

```
ACUM (hardcodat VAG):
  p.temperaturi?.coolant    → p.coolant_temp  (câmp CTF)
  p.motor?.rpm              → p.rpm
  p.aer?.boost_actual       → p.boost_bar
  p.aer?.maf                → p.maf_g_s
  
  // Valorile normale hardcodate:
  coolant-oil normal: 0.92
  rpm-fuel normal: 0.98
  boost-maf normal: 0.95

DUPĂ:
  // Path-uri: folosesc câmpurile canonice CTF direct
  // Valorile normale: citite din vdef.correlation_norms
  
  coolant_oil_normal = vdef.correlation_norms.coolant_oil
  rpm_fuel_normal = vdef.correlation_norms.rpm_fuel
  boost_maf_normal = vdef.correlation_norms.boost_maf  // null dacă NA
  
  // Dacă boost_maf_normal e null → sar corelația boost-maf (graceful degradation)
```

---

### 4.7 backend/intelligence/BaselineEngine.js

**Modificări necesare**:

```
ACUM:
  baseline_voltage = 14.1  // hardcodat
  baseline_coolant = 88.0  // hardcodat

DUPĂ:
  baseline_voltage = vdef.baseline_defaults.voltage
  baseline_coolant = vdef.baseline_defaults.coolant
```

La prima cursă, definiția vehiculului furnizează valorile de start. Baseline-ul se adaptează ulterior prin moving average, exact ca acum.

---

### 4.8 backend/intelligence/FaultPredictionEngine.js

**Modificări necesare**: minime. Modelele predictive lucrează cu deviații față de baseline (deja relativizate) și cu valori numerice brute. Singura modificare: modelul `TURBO_WEAR` verifică `hasBoost = vdef.engine.turbo` și skip dacă false (graceful degradation pentru motoare fără turbo).

Similar: `DPF_CLOGGING` și `EGR_DETERIORATION` verifică dacă vehiculul are DPF/EGR conform definiției.

---

### 4.9 backend/diagnostics/RuleEngine.js + modulele de reguli

**Modificări necesare**: fiecare modul de reguli primește `vdef` și poate interoga `vdef.thresholds` în loc de valori hardcodate.

Exemplu: `TurboRules` verifică `ctx.vdef.engine.turbo` înainte de a evalua reguli despre boost. Dacă `false` → returnează `[]` (graceful degradation).

---

### 4.10 backend/vehicle-profile/MaintenanceCalculator.js

**Modificări necesare**: `DEFAULT_INTERVALS` hardcodate → înlocuite cu `vdef.service_intervals`.

`seedMaintenanceItems(db, vehicleId, vehicleSpecs)` primește `vehicleDefinition` în loc de `vehicleSpecs` generic și folosește intervalele din definiție.

---

### 4.11 simulator.js

**Nu se modifică**. Simulatorul Audi rămâne intact și continuă să publice în formatul VAG. El devine primul simulator specific, cu posibilitatea de a adăuga simulatoare pentru alte vehicule fără a-l atinge.

Un simulator BMW, de exemplu, ar publica pe un topic diferit și în formatul BMW — VAGNormalizer nu ar fi selectat pentru el, ci BMWNormalizer.

---

### 4.12 Frontend (App.js, contexte, ecrane)

**Modificări minime la frontend**:

- `VehicleOnboardingScreen`: adaugă câmpuri pentru informații vehicul (make/model dacă VIN nu le poate determina)
- `SettingsScreen` / ecran profil vehicul: afișează datele decodate din `VehicleDefinition`
- `LiveDashboardScreen`: ascunde tab-ul "Turbo" dacă `vehicle.engine.turbo === false`
- `getVin()` în `utils/config.js`: citit din AsyncStorage (deja planificat în ROADMAP.md)

Restul frontend-ului nu se modifică — primește același format de date de la API.

---

## 5. Compatibilitate cu codul existent

### 5.1 Ce rămâne 100% nemodificat

- Toate endpoint-urile REST și contractele lor
- Schema bazei de date (niciun tabel nou obligatoriu în faza 1)
- Socket.IO events și structura lor
- Structura `TripReport` și toate câmpurile din API response
- `MessageEngine.js` și `statusMapper.js` — lucrează cu scoruri finale, nu cu praguri
- `i18n/ro.js`
- Toate componentele UI React Native
- Simulatorul Audi

### 5.2 Ce se modifică dar rămâne compatibil

- `finalizeTripAnalysis()` primește un parametru în plus (`vehicleDefinition`) — backward compatible dacă e opțional cu default la definiția Audi existentă
- `TripAnalyzer.updateAnalyzer()` primește CTF în loc de raw packet — schema internă a accumulatorilor rămâne identică
- `BaselineEngine` folosește defaults din definiție — rezultatele sunt identice pentru Audi (valorile defaults sunt aceleași)

### 5.3 Strategie de compatibilitate pentru migrare

**Faza de tranziție**: backend.js injectează definiția Audi hardcodat ca valoare default pentru toate apelurile. Comportamentul este identic cu cel actual. Nicio funcționalitate nu se pierde.

---

## 6. Migrare incrementală

### Faza 0 — Pregătire (fără modificări funcționale)
**Scop**: infrastructura nouă fără să schimbe comportamentul actual

1. Creează `VehicleDefinitionEngine.js` cu definiția completă Audi A6 C4 AEL
2. Creează `VehicleModelDatabase.js` cu un singur entry: Audi A6 C4
3. Creează `VAGNormalizer.js` cu exact același FIELD_MAP ca în `config.js`
4. Creează `NormalizerRegistry.js` care returnează VAGNormalizer pentru orice input (pentru acum)
5. Adaugă `ThresholdCalculator.js` care reproduce exact valorile hardcodate din `config.js`

**Test**: toate testele trec, comportamentul este identic.

---

### Faza 1 — Normalizare (impact minim)
**Scop**: pachetul care circulă în pipeline devine CTF

1. `backend.js`: aplică `NormalizerRegistry.normalize(rawPacket)` imediat după primirea de la MQTT
2. `TripAnalyzer`: actualizat să consume CTF (câmpuri canonice, nu path-uri VAG)
3. `CorrelationEngine`: actualizat să citească câmpuri CTF din `rawPackets`

**Test**: cursele Audi produc rezultate identice cu faza 0.

---

### Faza 2 — Parametrizare praguri (fără impact utilizator)
**Scop**: motoarele de analiză citesc praguri din VehicleDefinition, nu din config.js

1. `HealthEngine`: RPM_ZONE_3 și rpm_high_penalty_pct din definiție
2. `TrendEngine`: voltage_min din definiție
3. `CorrelationEngine`: correlation_norms din definiție
4. `BaselineEngine`: baseline_defaults din definiție
5. `RuleEngine` + module: vdef injectat, turbo/dpf/egr checks

**Test**: rezultatele pentru Audi sunt identice (definiția conține exact valorile hardcodate).

---

### Faza 3 — Parametrizare service intervals
**Scop**: MaintenanceCalculator citește intervale din VehicleDefinition

1. `MaintenanceCalculator`: DEFAULT_INTERVALS înlocuite cu `vdef.service_intervals`
2. `seedMaintenanceItems`: primește vehicleDefinition

**Test**: pentru vehicule Audi, intervalele sunt identice cu cele hardcodate.

---

### Faza 4 — VIN Resolution complet
**Scop**: onboarding universal pentru orice vehicul

1. `VinDecoder` extins cu lookup în `VehicleModelDatabase`
2. `POST /api/vehicles` returnează `VehicleDefinition` completă sau `missing_fields` dacă incompletă
3. `VehicleOnboardingScreen` arată formular pentru câmpurile lipsă
4. `VehicleDefinitionEngine` salvează definiția în `vehicles` table (coloană JSON `vehicle_definition`)

**Test**: un VIN de BMW produce o definiție parțială cu `missing_fields` populat.

---

### Faza 5 — Al doilea simulator (validare finală)
**Scop**: demonstrează că arhitectura funcționează cu un vehicul diferit

1. Creează `simulator_bmw.js` care publică în format BMW
2. Adaugă `BMWNormalizer.js`
3. Adaugă definiție BMW în `VehicleModelDatabase`
4. Testează: cursă BMW produce health score, predicții, mentenanță corecte pentru BMW

Aceasta este **dovada concretă** că arhitectura universală funcționează.

---

## 7. Riscuri

### 7.1 Risc înalt

**Ruperea corelațiilor existente (CorrelationEngine)**  
CorrelationEngine lucrează cu `rawPackets` — array-ul de pachete brute acumulate pe toată cursa. Dacă aceste pachete devin CTF în Faza 1, dar CorrelationEngine continuă să acceseze path-uri VAG (`p.motor.rpm`), calculele vor returna `undefined` pentru toate valorile.

*Mitigare*: Faza 1 trebuie să actualizeze CorrelationEngine simultan cu normalizarea pachetelor. Nu se poate face în pași separați.

---

**Pierderea PID-urilor VAG-specifice (VAG extensions)**  
Simulatorul Audi publică câmpuri VAG care nu există în standardul OBD-II (ex: `transmisie.gear`, `vvt`, `senzori_extra`). Dacă CTF nu include un câmp `vag_ext` pentru acestea, se pierd date care sunt afișate în modul Expert al LiveDashboard.

*Mitigare*: CTF include câmpul `vag_ext` (obiect passthrough pentru câmpuri non-standard). `VAGNormalizer` copiază tot ce nu mapează la câmpuri canonice în `vag_ext`. Motoarele de analiză ignoră `vag_ext`; LiveDashboard îl afișează direct.

---

### 7.2 Risc mediu

**VehicleModelDatabase incompletă la lansare**  
Dacă un utilizator conectează un BMW și definiția lipsește, toate pragurile vor fi generic defaults. Predicțiile vor fi mai puțin precise.

*Mitigare*: `GenericOBD2Defaults` ca fallback rezonabil per fuel_type. UI indică explicit "Date vehicul incomplete — rezultatele pot fi imprecise". `missing_fields` populat ghidează utilizatorul.

---

**Baseline invalidat la schimbarea vehiculului**  
`vehicle_profile` table stochează baseline per VIN. Dacă un utilizator schimbă vehiculul dar păstrează VIN-ul greșit, baseline-ul devine irelevant.

*Mitigare*: la adăugarea unui vehicul nou (POST /api/vehicles), baseline-ul pentru acel VIN este resetat sau marcat ca "neîncălzit".

---

**Performanță la normalizare**  
NormalizerRegistry rulează la fiecare pachet MQTT (1/secundă). Dacă normalizatorul este complex, poate adăuga latență.

*Mitigare*: normalizatoarele sunt pur funcționale (fără I/O, fără DB calls). La 1 pachet/secundă, latența este neglijabilă chiar și cu 100 de câmpuri de mapat.

---

### 7.3 Risc scăzut

**Fragmentarea VehicleModelDatabase**  
Dacă fiecare contribuitor adaugă vehicule în format diferit, baza de date devine inconsistentă.

*Mitigare*: schema `VehicleDefinition` este validată la insert (toate câmpurile obligatorii trebuie prezente sau `null` explicit, niciodată absent).

---

**Simulatorul Audi produce acum pachete "legacy"**  
Simulatorul publică în format VAG — după universalizare, backend-ul normalizează automat. Nicio modificare necesară la simulator.

---

## 8. Ordinea implementării (recomandată)

```
SPRINT 1 — Fundație (nicio modificare vizibilă pentru utilizator)
  1. VehicleDefinitionEngine.js cu definiția Audi completă
  2. VehicleModelDatabase.js (un singur entry)
  3. ThresholdCalculator.js (reproduce valorile actuale)
  4. VAGNormalizer.js + NormalizerRegistry.js
  5. CTF schema definită (jsdoc, nu TypeScript)
  Durată estimată: 2-3 zile
  Test: pornește backend — comportament identic cu actuala

SPRINT 2 — Normalizare pipeline (Faza 1)
  1. backend.js: aplică normalizer pe raw packet
  2. TripAnalyzer: consumă câmpuri CTF
  3. CorrelationEngine: câmpuri CTF (obligatoriu simultan cu 2!)
  4. FaultPredictionEngine: verificări turbo/dpf/egr
  Durată estimată: 2-3 zile
  Test: cursă completă Audi → rezultate identice

SPRINT 3 — Parametrizare (Faza 2 + 3)
  1. HealthEngine: praguri din vdef
  2. BaselineEngine: defaults din vdef
  3. TrendEngine: voltage_min din vdef
  4. RuleEngine: vdef injectat în module reguli
  5. MaintenanceCalculator: intervale din vdef
  Durată estimată: 2-3 zile
  Test: Audi → rezultate identice

SPRINT 4 — VIN Resolution (Faza 4)
  1. VinDecoder: extins cu VehicleModelDatabase lookup
  2. POST /api/vehicles: returnează VehicleDefinition / missing_fields
  3. VehicleOnboardingScreen: formular completare date lipsă
  4. Salvare vdef în vehicles table
  Durată estimată: 3-4 zile
  Test: onboarding VIN Audi → definiție completă automată
        onboarding VIN BMW → definiție parțială + prompt UI

SPRINT 5 — Validare (Faza 5)
  1. simulator_bmw.js minimal (câteva PID-uri standard)
  2. BMWNormalizer.js
  3. Definiție BMW generică în VehicleModelDatabase
  4. Test end-to-end cu ambele simulatoare simultan
  Durată estimată: 2-3 zile
  Test: două VIN-uri simultane → cursă Audi și cursă BMW → date separate corecte

SPRINT 6 — Comercializare fundație (opțional, post-licență)
  1. ManufacturerExtensionRegistry formalizat
  2. GenericOBD2Normalizer robustizat
  3. VehicleModelDatabase extins cu 10+ vehicule comune
  4. API pentru contribuție vehicule noi
  Durată estimată: 5-7 zile
```

---

## 9. Design pentru comercializare (2-3 ani)

### 9.1 Ce trebuie adăugat (nu acum, dar arhitectura permite)

**Multi-tenant**: fiecare utilizator are vehiculele sale. `vehicles` table adaugă `user_id` FK. Toate query-urile filtrate per user.

**Cloud sync**: SQLite local → PostgreSQL în cloud. Schimbarea e la nivel de driver DB, nu la nivel de logică. BaselineEngine, TrendEngine lucrează identic.

**Marketplace de definiții vehicule**: utilizatorii pot contribui definiții pentru vehiculele lor. `VehicleModelDatabase` devine un serviciu cu API de contribuție și review.

**OBD-II adapter BT/WiFi**: în loc de MQTT din simulator, date vin direct de la un ELM327 via BLE sau WiFi. `NormalizerRegistry` primește un `ELM327Normalizer` care mapează răspunsurile AT commands la CTF.

**Abonament premium**: `FaultPredictionEngine` și `VehicleDNA` sunt funcționalități care justifică un tier premium. Arhitectura de module separate permite gate-keeping per funcționalitate.

### 9.2 Ce nu trebuie schimbat

- Formatul CTF — compatibil înainte
- Schema tabelelor core (calatorii, trip_summary, etc.)
- API REST — versioning cu prefix `/v2/` pentru breaking changes
- MessageEngine + i18n — extensibil cu noi limbi fără modificarea logicii

---

## 10. Rezumat modificări per fișier

| Fișier | Tip modificare | Sprint |
|--------|---------------|--------|
| `backend/vehicle-profile/VehicleDefinitionEngine.js` | **NOU** | 1 |
| `backend/vehicle-profile/VehicleModelDatabase.js` | **NOU** | 1 |
| `backend/vehicle-profile/ThresholdCalculator.js` | **NOU** | 1 |
| `backend/normalizers/VAGNormalizer.js` | **NOU** | 1 |
| `backend/normalizers/NormalizerRegistry.js` | **NOU** | 1 |
| `backend/normalizers/extensions/VAGExtension.js` | **NOU** | 1 |
| `backend/normalizers/GenericOBD2Normalizer.js` | **NOU** | 2 |
| `simulator_bmw.js` | **NOU** | 5 |
| `backend/normalizers/BMWNormalizer.js` | **NOU** | 5 |
| `backend.js` | **MODIFICAT** (minor) | 2 |
| `backend/analyzers/config.js` | **MODIFICAT** (FIELD_MAP eliminat) | 2 |
| `backend/analyzers/TripAnalyzer.js` | **MODIFICAT** (CTF input) | 2 |
| `backend/intelligence/CorrelationEngine.js` | **MODIFICAT** (CTF + vdef norms) | 2 |
| `backend/analyzers/HealthEngine.js` | **MODIFICAT** (praguri din vdef) | 3 |
| `backend/intelligence/BaselineEngine.js` | **MODIFICAT** (defaults din vdef) | 3 |
| `backend/analyzers/TrendEngine.js` | **MODIFICAT** (minor, voltage_min) | 3 |
| `backend/diagnostics/RuleEngine.js` | **MODIFICAT** (vdef injectat) | 3 |
| `backend/vehicle-profile/MaintenanceCalculator.js` | **MODIFICAT** (intervale din vdef) | 3 |
| `backend/vehicle-profile/VinDecoder.js` | **MODIFICAT** (lookup VehicleModelDatabase) | 4 |
| `backend/vehicle-profile/routes.js` | **MODIFICAT** (minor, returnează vdef) | 4 |
| `app mobile/.../VehicleOnboardingScreen.js` | **MODIFICAT** (câmpuri vehicul lipsă) | 4 |
| `simulator.js` | **NEMODIFICAT** | — |
| `backend/intelligence/FaultPredictionEngine.js` | **MODIFICAT** (minor, skip turbo/dpf) | 2 |
| Tot frontend-ul (ecrane, componente, contexte) | **NEMODIFICAT** | — |
| Schema DB | **NEMODIFICATĂ** (coloană JSON opțională în sprint 4) | 4 |
| Toate endpoint-urile REST | **NEMODIFICATE** | — |
