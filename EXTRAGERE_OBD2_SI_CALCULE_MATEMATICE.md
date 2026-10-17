# DOSAR TEHNIC DE INGINERIE AUTOMOTIVE
# EXTRAGEREA DATELOR OBD-II / CAN-BUS ȘI APARATUL MATEMATIC DE ANALIZĂ TELEMETRICĂ

> **Documentație Tehnică de Specialitate & Fundamentare Matematică**  
> **Proiect Licență:** Sistem Inteligent Universal de Telemetrie Auto, Diagnoză Preictivă și Smart Mobility  
> **Platformă:** ESP32 (Hardware Data Logger) + Node.js Engine (Backend Processing) + React Native (Mobile Client)  
> **Standarde Industriale:** SAE J1979, ISO 15031-5, ISO 15765-4 (CAN), ISO 14229 (UDS), ISO 14230 (KWP2000), VAG KWP1281  

---

## CUPRINS GENERAL

1. [PARTEA I: ACHIZIȚIA ȘI EXTRAGEREA DATELOR OBD-II / CAN-BUS](#partea-i-achiziția-și-extragerea-datelor-obd-ii--can-bus)
   - 1.1. Arhitectura Hardware de Achiziție (ESP32, Tranceiver CAN/K-Line)
   - 1.2. Protocoale de Comunicație Suportate și Inițializare AT/ELM327
   - 1.3. Modurile de Diagnoză Standardizate SAE J1979
   - 1.4. Matricea Completă a PID-urilor OBD-II Standard Extrase (Tabel Hex, Decodare, Formule)
   - 1.5. Extragerea Parametrilor Avansați pe K-Line (KWP1281 / Bosch EDC15)
   - 1.6. Matricea Exhaustivă a Telemetriei Live la 1Hz (Structura Pachetului JSON)
   - 1.7. Protocolul Binar M2M de 96 Octeți & Verificare Integritate CRC16-CCITT
2. [PARTEA II: APARATUL MATEMATIC ȘI MODELELE FIZICE ALE SISTEMELOR DE PROPULSIE](#partea-ii-aparatul-matematic-și-modelele-fizice-ale-sistemelor-de-propulsie)
   - 2.1. Filtrarea Semnalelor Discrete: Filtru Kalman 1D
   - 2.2. Termodinamică & Mecanica Fluidelor (Admisie, Densitate Aer, MAF, MAP)
   - 2.3. Eficiența Volumetrică ($\eta_v$) și Coeficientul de Umplere
   - 2.4. Raportul Aer-Combustibil ($AFR$) și Factorul Lambda Virtual ($\lambda$)
   - 2.5. Virtual Dyno: Puterea Termodinamică ($BHP$, $kW$, $CP$) și Cuplul la Volantă ($Nm$)
   - 2.6. Cinematica Longitudinală la Roată & Rezistențele la Înaintare (Aerodinamică, Rulare, Inerție)
   - 2.7. Transmisia și Auto-Învățarea Rapoartelor de Viteză; Detecția Patinării Ambreiajului
   - 2.8. Dinamica Supraalimentării: Analiza Erorii de Boost și Separarea Defecțiunilor Turbo/VNT/Furtun
   - 2.9. Permeabilitatea Filtrului de Particule (DPF): Legea Darcy-Forchheimer & Indicele $R_{DPF}$
   - 2.10. Termodinamica Răcirii și Comportamentul Termostatului
   - 2.11. Modelul de Degradare Termică și Chimică a Uleiului (Cinetica Arrhenius)
   - 2.12. Consumul Specific Efectiv de Combustibil (BSFC - Brake Specific Fuel Consumption)
   - 2.13. Analiza Circuitului Electric: Căderi de Tensiune, Rezistența Internă $R_{int}$, Sănătatea Bateriei ($SoH$) și Diode Ripple
   - 2.14. Modelul Termic și Uzura Frânelor: Disipare Energie Cinetică & Legea Archard
   - 2.15. Recircularea Gazelor de Evacuare (EGR Mass Fraction) & Detecție Calaminare
   - 2.16. Diagnoza Pompei de Înaltă Presiune (Common Rail) & Stabilitatea Regulatorului DRV
   - 2.17. Randamentul Termic al Intercooler-ului (IC Efficiency & Heat Soak)
   - 2.18. Protecție Anti-Cocsificare Turbină la Oprire (CHRA Core Temp & Cooldown Timer)
   - 2.19. Bilanțul Termodinamic Sankey în Timp Real (Energy Split: Mecanic, Evacuare, Răcire)
   - 2.20. Putere Corectată Atmosferic conform Standardului SAE J1349
   - 2.21. Fuziune Senzorială pentru Panta Drumului și Estimarea Sarcinii Utile (Payload)
   - 2.22. Indicele de Stabilitate la Ralanti & Diagnoza Volantei cu Masă Dublă (DMF)
3. [PARTEA III: CALCULUL PANTELOR, REZOLUȚIA UNIVERSALĂ A VEHICULELOR ȘI SMART MOBILITY](#partea-iii-calculul-pantelor-rezoluția-universală-a-vehiculelor-și-smart-mobility)
   - 3.1. Estimarea Pantei Drumului ($\theta\%$) din Balanța Forțelor Fără Senzor Dedicat
   - 3.2. Detecția Rezistențelor Anormale la Rulare (Coast-Down Drag Anomaly / Caliper Blocat)
   - 3.3. Rezoluția Universală a Parametrilor Fizici pentru Orice Mașină (Anvelope, Suprafață Frontală Hucho, Masă, Praguri Termice)
   - 3.4. Fizica Senzorilor Smart Mobility: Sentry Guard, Înclinare Platformă, Pothole Radar și eCall Crash SOS
4. [PARTEA IV: MATEMATICA SCORURILOR DE SĂNĂTATE ȘI MODELUL DE FIABILITATE WEIBULL](#partea-iv-matematica-scorurilor-de-sănătate-și-modelul-de-fiabilitate-weibull)
   - 4.1. Algoritmul de Calcul al Scorurilor de Subsistem cu Date Parțiale (Coverage & Neutral Bayesian Prior)
   - 4.2. Ponderarea Calității Senzorilor (Sensor Quality & Reliability Index)
   - 4.3. Distribuția Weibull cu 2 Parametri pentru Estimarea Ramei de Defectare $R(t)$ și $P_{fail}$
   - 4.4. Modelul Economic B2B: Prevenirea Defecțiunilor Catastrofale și Rentabilitatea Investiției (ROI)

---

# PARTEA I: ACHIZIȚIA ȘI EXTRAGEREA DATELOR OBD-II / CAN-BUS

## 1.1. Arhitectura Hardware de Achiziție (ESP32)

Achiziția datelor de la bordul autovehiculului este realizată de un modul hardware dedicat, bazat pe microcontrolerul **ESP32** (Dual-Core Xtensa LX6 @ 240 MHz, 520 KB SRAM, 4 MB Flash).

```
 +-----------------------------------------------------------------------+
 |                         VEHICUL (ECU / GATEWAY)                       |
 +-----------------------------------------------------------------------+
               │ (PIN 6: CAN-H)                        │ (PIN 7: K-LINE)
               │ (PIN 14: CAN-L)                       │ (PIN 4/5: GND)
               ▼                                       ▼
    ┌───────────────────────┐               ┌───────────────────────┐
    │  Transceiver CAN      │               │  Transceiver K-Line   │
    │  SN65HVD230 / MCP2551 │               │  L9637D / ISO 9141-2  │
    └──────────┬────────────┘               └──────────┬────────────┘
               │ (3.3V CAN-RX / CAN-TX)                │ (UART RX/TX)
               ▼                                       ▼
 +───────────────────────────────────────────────────────────────────────+
 |                        MICROCONTROLER ESP32                           |
 |                                                                       |
 |   Core 0: Achiziție Timp Real & Filtrare Hardware                    |
 |     ├── CAN Controller SJA1000 integrat (ISO 11898-2)                 |
 |     ├── Driver UART hardware pentru K-Line (10400 baud / 5-baud init) |
 |     └── Senzor IMU MPU6050 (I2C) + Receptor GPS GNSS (UART 9600)      |
 |                                                                       |
 |   Core 1: Bufferizare, Criptare & Comunicații                         |
 |     ├── Logger Local MicroSD (SPI CS=GPIO5) - Buffer Circular         |
 |     ├── Modul MQTT Telemetrie Binară / JSON (WiFi / Modem 4G LTE)     |
 |     └── Serviciu HTTP POST Sync (`/api/sync/obd`)                     |
 +───────────────────────────────────────────────────────────────────────+
```

---

## 1.2. Protocoale de Comunicație Suportate și Inițializare

Sistemul suportă atât arhitecturi de date moderne (CAN bus de mare viteză), cât și autovehicule din generațiile anterioare (K-Line):

1. **ISO 15765-4 (CAN 2.0B - 500 kbps, 11-bit / 29-bit ID)**: Utilizat pe autovehicule fabricate după 2004–2008.
   - Pinii OBD-II: Pin 6 (`CAN High`), Pin 14 (`CAN Low`).
   - Rata de transfer: 500 kbit/s (sau 250 kbit/s pe anumite modele).
2. **ISO 14230-4 (KWP2000 - Key Word Protocol)**: 10.4 kbit/s.
3. **ISO 9141-2 (K-Line)**: 10.4 kbit/s cu inițializare la 5 baud.
4. **Volkswagen KWP1281**: Protocol de diagnoză specific grupului VAG pentru calculatoare Bosch EDC15M/V/P, utilizat pe linia K (Pin 7).

### Secvența de Inițializare AT/ELM327 (Interfață Emulator/Microcontroler)
```text
AT Z         -> Resetare procesor interfață
AT E0        -> Echo dezactivat (pentru reducerea traficului pe magistrală)
AT L0        -> Line feeds dezactivate
AT SP 0      -> Căutare automată protocol (Automatic Protocol Detection)
0100         -> Cerere PID 0100 (interogare suport PID-uri 0x01-0x20)
```

---

## 1.3. Modurile de Diagnoză Standardizate SAE J1979

| Mod (Hex) | Denumire Standard SAE J1979 | Descriere Funcțională în Sistem |
| :---: | :--- | :--- |
| **`01`** | **Current Powertrain Diagnostic Data** | Interogare continuă (1–10 Hz) pentru senzorii motorului (RPM, viteză, temperaturi, presiuni). |
| **`02`** | **Powertrain Freeze Frame Data** | Extragerea instantaneului parametrilor din momentul exact în care ECU a stocat un DTC critic. |
| **`03`** | **Emission-Related Diagnostic Trouble Codes** | Citirea codurilor active de eroare (DTC) confirmate. |
| **`04`** | **Clear/Reset Emission-Related Diagnostic Info** | Ștergerea memoriei de erori DTC și resetarea stărilor monitoarelor I/M. |
| **`07`** | **Pending Diagnostic Trouble Codes** | Citirea codurilor de eroare temporare (apărute pe ciclul curent de condus). |
| **`09`** | **Request Vehicle Information** | Extragerea seriei de șasiu (VIN - PID `02`) și identificatorului de calibrare (Cal ID - PID `04`). |
| **`0A`** | **Permanent Diagnostic Trouble Codes** | Citirea codurilor de eroare permanente care nu pot fi șterse prin comanda Mod 04. |

---

## 1.4. Matricea Completă a PID-urilor OBD-II Standard Extrase

Fiecare cerere de Mod 01 trimite pe CAN frame-ul cu ID `0x7DF` (interogare broadcast funcțională), iar ECU-ul motor răspunde cu ID `0x7E8`. Răspunsul conține octeții de date $A, B, C, D$.

Tabelul de mai jos reflectă **exact formulele matematice implementate** pentru decodarea valorilor brute de la senzorii fizici:

| Mod/PID | Octeți | Semnal Tehnic | Formulă Matematică de Decodare | Domeniu Valori | Unitate |
| :---: | :---: | :--- | :--- | :---: | :---: |
| `01 04` | 1 ($A$) | **Calculated Engine Load** | $\text{Load} = \frac{A}{2.55} = \frac{A \cdot 100}{255}$ | $0 \dots 100$ | $\%$ |
| `01 05` | 1 ($A$) | **Engine Coolant Temp (ECT)** | $T_{coolant} = A - 40$ | $-40 \dots +215$ | $^{\circ}\text{C}$ |
| `01 0B` | 1 ($A$) | **Intake Manifold Abs. Pressure (MAP)** | $P_{MAP} = A$ | $0 \dots 255$ | $\text{kPa}$ |
| `01 0C` | 2 ($A, B$) | **Engine Speed (RPM)** | $RPM = \frac{256 \cdot A + B}{4}$ | $0 \dots 16\,383.75$ | $\text{rot/min}$ |
| `01 0D` | 1 ($A$) | **Vehicle Speed (VSS)** | $v = A$ | $0 \dots 255$ | $\text{km/h}$ |
| `01 0E` | 1 ($A$) | **Ignition Timing Advance** | $\alpha_{ign} = \frac{A}{2} - 64$ | $-64 \dots +63.5$ | $^{\circ}$ CA |
| `01 0F` | 1 ($A$) | **Intake Air Temperature (IAT)** | $T_{IAT} = A - 40$ | $-40 \dots +215$ | $^{\circ}\text{C}$ |
| `01 10` | 2 ($A, B$) | **Mass Air Flow (MAF)** | $\dot{m}_{air} = \frac{256 \cdot A + B}{100}$ | $0 \dots 655.35$ | $\text{g/s}$ |
| `01 11` | 1 ($A$) | **Throttle Position (TPS)** | $TPS = \frac{A \cdot 100}{255}$ | $0 \dots 100$ | $\%$ |
| `01 1F` | 2 ($A, B$) | **Run Time Since Engine Start** | $t_{run} = 256 \cdot A + B$ | $0 \dots 65\,535$ | $\text{secunde}$ |
| `01 23` | 2 ($A, B$) | **Fuel Rail Gauge Pressure (Diesel)**| $P_{rail} = 10 \cdot (256 \cdot A + B)$ | $0 \dots 655\,350$ | $\text{kPa}$ |
| `01 2F` | 1 ($A$) | **Fuel Level Input** | $Fuel = \frac{A \cdot 100}{255}$ | $0 \dots 100$ | $\%$ |
| `01 33` | 1 ($A$) | **Barometric Pressure** | $P_{baro} = A$ | $0 \dots 255$ | $\text{kPa}$ |
| `01 42` | 2 ($A, B$) | **Control Module Voltage (ECU)** | $V_{ECU} = \frac{256 \cdot A + B}{1000}$ | $0 \dots 65.535$ | $\text{V}$ |
| `01 43` | 2 ($A, B$) | **Absolute Engine Load** | $\text{Load}_{abs} = \frac{256 \cdot A + B}{2.55}$ | $0 \dots 25\,700$ | $\%$ |
| `01 5C` | 1 ($A$) | **Engine Oil Temperature** | $T_{oil} = A - 40$ | $-40 \dots +215$ | $^{\circ}\text{C}$ |
| `01 5E` | 2 ($A, B$) | **Engine Fuel Rate** | $\dot{V}_{fuel} = \frac{256 \cdot A + B}{20} = 0.05 \cdot (256 A + B)$ | $0 \dots 3276.75$ | $\text{L/h}$ |
| `01 7C` | 9 ($A \dots I$) | **DPF Differential Pressure** | $\Delta P_{DPF} = \frac{256 \cdot B + C}{10} - 3276.8$ | $-3276 \dots +3276$ | $\text{mbar}$ |

---

## 1.5. Extragerea Parametrilor Avansați pe K-Line (KWP1281 / Bosch EDC15)

Pe motoarele din grupul VAG (ex: 1.9 TDI ALH/ASV/ARL, 2.5 TDI AEL/AKN), parametrii detaliați nu sunt disponibili prin SAE J1979 generic, ci prin blocuri de valori de măsură (**MWB - Messwertblöcke**):

* **MWB Grup 001 (Injecție de bază)**:
  - Câmp 1: Turație motor ($RPM$) $[rot/min]$
  - Câmp 2: Cantitate injectată efectivă ($Inj_{qty}$) $[mg/stroke]$
  - Câmp 3: Tensiune senzor cursă ac pompă injecție ($Modulating\,Piston\,Voltage$) $[V]$
  - Câmp 4: Temperatura lichid răcire ($T_{coolant}$) $[^{\circ}C]$
* **MWB Grup 003 (Recirculare Gaze - EGR & MAF)**:
  - Câmp 1: Turație motor ($RPM$)
  - Câmp 2: MAF Țintă (Specificat ECU) $[mg/stroke]$
  - Câmp 3: MAF Actual (Măsurat debitmetru) $[mg/stroke]$
  - Câmp 4: Ciclu de sarcină electrovalvă N18 EGR $[0 \dots 100\%]$
* **MWB Grup 008 (Limitatoare de Cuplu și Fum)**:
  - Câmp 1: Turație motor ($RPM$)
  - Câmp 2: Cerință cuplu pedală șofer (Driver's Request) $[mg/stroke]$
  - Câmp 3: Limitare cuplu turație (Torque Limitation) $[mg/stroke]$
  - Câmp 4: Limitare fum funcție de MAF (Smoke Map Limitation) $[mg/stroke]$
* **MWB Grup 011 (Reglare Presiune Turbină - N75)**:
  - Câmp 1: Turație motor ($RPM$)
  - Câmp 2: Presiune supraalimentare specificată (Target MAP) $[mbar]$
  - Câmp 3: Presiune supraalimentare actuală (Actual MAP) $[mbar]$
  - Câmp 4: Ciclu de lucru electrovalvă VNT N75 $[0 \dots 100\%]$

---

## 1.6. Matricea Exhaustivă a Telemetriei Live la 1Hz (Structura Pachetului JSON)

La fiecare secundă ($1\text{ Hz}$), microcontrolerul sau emulatorul agregă datele într-un pachet complet structurat pe 14 subsisteme:

```json
{
  "stare_motor": "MERS",
  "timestamp": 1729158400000,
  "gps": {
    "lat": 44.432300,
    "lon": 26.106300,
    "alt": 78.5,
    "heading": 42.0,
    "speed_kmh": 65
  },
  "accelerometru": {
    "accel_x": 0.05,
    "accel_y": 0.02,
    "accel_z": 1.01,
    "tilt_pitch": -0.2,
    "tilt_roll": 0.1
  },
  "motor": {
    "rpm": 1850,
    "speed": 65,
    "load": 52,
    "throttle_pos": 40,
    "accel_g": 0.05
  },
  "temperaturi": {
    "coolant": 88.5,
    "oil": 92.0,
    "iat": 24.5,
    "ambient": 18.0,
    "cat1": 310.0,
    "cat2": 285.0
  },
  "aer": {
    "maf": 45.2,
    "map": 185.0,
    "map_cmd": 182.0,
    "baro": 101.0
  },
  "combustibil": {
    "level": 68.5,
    "rail_press": 98000,
    "rail_press_bar": 980,
    "inj_qty_mg": 28.5,
    "inst_cons": 5.4
  },
  "dpf": {
    "diff_pressure_mbar": 8.5,
    "soot_load": 14.2
  },
  "baterie": {
    "ecu_volt": 14.15,
    "battery_volt": 14.20
  },
  "transmisie": {
    "gear": 4,
    "slip": 0
  },
  "dtc": {
    "count": 0,
    "codes": "NONE"
  },
  "ecu": {
    "vin": "WAUZZZ4A1RN000000",
    "protocol": "SAE J1979 / CAN 500kbps"
  }
}
```

---

## 1.7. Protocolul Binar M2M de 96 Octeți & Integritate CRC16-CCITT

Pentru a reduce traficul de date GSM în aplicațiile de flotă (B2B), pachetul JSON de aproximativ $1450\text{ octeți}$ este serializat binar într-o structură fixă de **exact 96 de octeți**:

### Harta Memoriei Pachetului Binar (Byte Layout)

```
Offset  Lungime Tip Date      Semnal / Parametru          Scalare & Offset
---------------------------------------------------------------------------------
0..1    2 B     uint8[2]      Magic Header (0xAA, 0x55)   Identificator sincronizare cadru
2..5    4 B     uint32 BE     Timestamp UTC               Secunde de la epoca Unix
6..7    2 B     uint16 BE     RPM                         Direct [rot/min]
8       1 B     uint8         Viteză vehicul              Direct [km/h]
9       1 B     uint8         Sarcina motor (Load)        Direct [0..100%]
10      1 B     uint8         Treaptă de viteză (Gear)    Direct [0..8]
11      1 B     uint8         Poziție pedală accelerație   Direct [0..100%]
12..13  2 B     uint16 BE     Cuplu motor (Torque)        Direct [Nm]
14..15  2 B     uint16 BE     Debitmetru aer (MAF)        $MAF \cdot 10$ [$0.1\text{ g/s}$]
16..17  2 B     uint16 BE     Presiune admisie (MAP)      Direct [kPa]
18..19  2 B     uint16 BE     Presiune comandată (Boost)  Direct [kPa]
20..21  2 B     uint16 BE     Cantitate injectată (Inj)   $Inj \cdot 10$ [$0.1\text{ mg/str}$]
22..23  2 B     uint16 BE     Consum instantaneu          $Consum \cdot 10$ [$0.1\text{ L/h}$]
24..25  2 B     uint16 BE     Presiune Common Rail        Direct [bar]
26      1 B     uint8         Temp. Lichid Răcire         $T_{coolant} + 40$ [$^{\circ}\text{C}$]
27      1 B     uint8         Temp. Ulei Motor            $T_{oil} + 40$ [$^{\circ}\text{C}$]
28      1 B     uint8         Temp. Admisie (IAT)         $T_{IAT} + 40$ [$^{\circ}\text{C}$]
29..30  2 B     uint16 BE     Temp. Catalizator 1 (Cat1)  Direct [$^{\circ}\text{C}$]
31..32  2 B     uint16 BE     Temp. Catalizator 2 (Cat2)  Direct [$^{\circ}\text{C}$]
33..34  2 B     uint16 BE     Tensiune ECU                $V_{ECU} \cdot 100$ [$0.01\text{ V}$]
35..36  2 B     uint16 BE     Tensiune Baterie            $V_{bat} \cdot 100$ [$0.01\text{ V}$]
37..38  2 B     uint16 BE     Presiune Diferențială DPF   $\Delta P_{DPF} \cdot 10$ [$0.1\text{ mbar}$]
39..40  2 B     uint16 BE     Masă Funingine DPF (Soot)   $Soot \cdot 10$ [$0.1\text{ g}$]
41..42  2 B     int16 BE      Accelerație longitudinală   $A_x \cdot 100$ [$0.01\text{ G}$]
43..44  2 B     uint16 BE     Putere Virtual Dyno         $Power \cdot 10$ [$0.1\text{ CP}$]
45..46  2 B     uint16 BE     Air-Fuel Ratio (AFR)        $AFR \cdot 10$ [$0.1$]
47..48  2 B     uint16 BE     Lambda Virtual ($\lambda$)  $\lambda \cdot 1000$ [$0.001$]
49      1 B     uint8         Eficiență Volumetrică       Direct [$\eta_v\%$]
50..51  2 B     uint16 BE     BSFC                        Direct [$\text{g/kWh}$]
52..53  2 B     uint16 BE     Factor Uzură Ulei Arrhenius $k_{wear} \cdot 100$
54      1 B     uint8         State of Health Baterie     Direct [$SoH\%$]
55..56  2 B     uint16 BE     Rezistență Internă Baterie  $R_{int} \cdot 100$ [$0.01\text{ m}\Omega$]
57      1 B     int8          Panta Drumului (Grade)      Direct [signed $\%$]
58..59  2 B     uint16 BE     Putere Frânare              $P_{brake} \cdot 10$ [$0.1\text{ kW}$]
60..61  2 B     uint16 BE     Energie Frâne Cursă         $E_{brake} \cdot 100$ [$0.01\text{ MJ}$]
62      1 B     uint8         Temp. Estimată Discuri Frână$T_{disc} + 40$ [$^{\circ}\text{C}$]
63      1 B     uint8         Fracție Masică EGR          Direct [$EGR\%$]
64..65  2 B     int16 BE      Deviație Presiune Rail      $Dev \cdot 10$ [signed $0.1\%$]
66..67  2 B     uint16 BE     Ripple Tensiune Alternator  $V_{rip} \cdot 1000$ [$1\text{ mV}$]
68..71  4 B     uint32 BE     Bitfield Flaguri Stare      Bit 0: DPF Regen, Bit 1: Drag, Bit 2: Smoke, Bit 3: Slip
72..75  4 B     uint32 BE     Km Echivalenți Uzură Ulei   $Km_{eq} \cdot 10$ [$0.1\text{ km}$]
76..77  2 B     uint16 BE     Risc Weibull Ulei 3000km    $P_{fail} \cdot 10$ [$0.1\%$]
78..79  2 B     uint16 BE     Risc Weibull DPF 3000km     $P_{fail} \cdot 10$ [$0.1\%$]
80..81  2 B     uint16 BE     Risc Weibull Turbo 3000km   $P_{fail} \cdot 10$ [$0.1\%$]
82..83  2 B     uint16 BE     Risc Weibull Frâne 3000km   $P_{fail} \cdot 10$ [$0.1\%$]
84..85  2 B     uint16 BE     Risc Weibull Baterie 3000km $P_{fail} \cdot 10$ [$0.1\%$]
86..89  4 B     uint32 BE     ROI Total Flotă Prevenire   Direct [$\text{Euro}$]
90..93  4 B     uint32 BE     Economie Cartelă SIM        Direct [$1450 = 14.50\text{ Euro}$]
94..95  2 B     uint16 BE     Checksum CRC16-CCITT        Polinom $0x1021$, val. inițială $0xFFFF$
---------------------------------------------------------------------------------
Total: 96 Octeți per Cadru Telemetric
```

### Eficiența Compresiei și Economia GSM
$$\text{Rata de Compresie} = \left( 1 - \frac{96\text{ bytes}}{1450\text{ bytes}} \right) \times 100\% = 93.38\%$$
La un regim de funcționare de $8\text{ ore/zi}$, $22\text{ zile/lună}$ la $1\text{ Hz}$ ($633\,600\text{ pachete}$):
- Volum lunar format JSON: $\frac{633\,600 \times 1450}{1024 \times 1024} \approx 876.1\text{ MB/lună}$
- Volum lunar format Binar: $\frac{633\,600 \times 96}{1024 \times 1024} \approx 58.0\text{ MB/lună}$
- Economie directă de lățime de bandă: **$818.1\text{ MB}$ economisiți lunar per autovehicul**.

### Algoritmul de Verificare a Integrității CRC16-CCITT
```javascript
function crc16Ccitt(buffer, length) {
    let crc = 0xFFFF;
    const len = length || (buffer.length - 2);
    for (let i = 0; i < len; i++) {
        crc ^= (buffer[i] << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc;
}
```

---

# PARTEA II: APARATUL MATEMATIC ȘI MODELELE FIZICE ALE SISTEMELOR DE PROPULSIE

## 2.1. Filtrarea Semnalelor Discrete: Filtru Kalman 1D

Semnalele analogice achiziționate prin ADC sau raportate pe magistrala OBD (în special debitul de aer $MAF$ și tensiunea la bornele bateriei $V_{bat}$) conțin zgomot alb de eșantionare și pulsații electromagnetice.

Pentru a preveni declanșarea eronată a alertelor fără a introduce întârzierea de fază specifică unei medii mobile lente, este implementat un **Filtru Kalman Unidimensional**:

### Ecuațiile Recursive Kalman 1D:
1. **Actualizarea Predicției (Time Update)**:
   $$x_{k|k-1} = x_{k-1|k-1}$$
   $$P_{k|k-1} = P_{k-1|k-1} + Q$$
   unde $Q$ este covarianța zgomotului de proces (instabilitatea fizică reală a semnalului).

2. **Calculul Factorului de Amplificare Kalman (Gain)**:
   $$K_k = \frac{P_{k|k-1}}{P_{k|k-1} + R}$$
   unde $R$ este covarianța zgomotului de măsurare (eroarea senzorului/instabilitatea ADC).

3. **Corecția Stării Măsurate (Measurement Update)**:
   $$x_{k|k} = x_{k|k-1} + K_k \cdot (z_k - x_{k|k-1})$$

4. **Actualizarea Covarianței Erorii de Estimare**:
   $$P_{k|k} = (1 - K_k) \cdot P_{k|k-1}$$

### Parametrizarea în Sistem:
- **Debitmetru MAF**: $Q = 0.05$, $R = 1.2$, $P_0 = 2.0$. Filtrează turbulențele aerodinamice din carcasa filtrului de aer menținând răspunsul instantaneu la călcarea accelerației.
- **Tensiune Baterie**: $Q = 0.01$, $R = 0.2$, $P_0 = 0.5$. Permite măsurarea căderii de tensiune fără a fi influențată de zgomotul de comutație al injectoarelor.

---

## 2.2. Termodinamică & Mecanica Fluidelor (Admisie, Densitate Aer)

Pentru a evalua performanța pneumatică a motorului, densitatea aerului la intrarea în galeria de admisie este calculată aplicând **ecuația de stare a gazelor ideale**:

$$P \cdot V = m \cdot R_{spec} \cdot T \implies \rho_{air} = \frac{P_{MAP} \cdot 10^3}{R_{spec} \cdot T_{IAT\_K}}$$

unde:
- $P_{MAP}$: Presiunea absolută din galeria de admisie $[\text{kPa}]$
- $R_{spec} = 287.058\text{ J/(kg}\cdot\text{K)}$: Constanta specifică a gazului pentru aerul uscat
- $T_{IAT\_K} = T_{IAT} + 273.15$: Temperatura absolută a aerului la admisie $[\text{K}]$
- $\rho_{air}$: Densitatea aerului comprimat $[\text{kg/m}^3]$

La presiune atmosferică ($101.3\text{ kPa}$) și $20^{\circ}\text{C}$, $\rho_{air} \approx 1.204\text{ kg/m}^3$. La o suprapresiune turbo de $1.5\text{ bar}$ ($P_{MAP} = 250\text{ kPa}$) și $T_{IAT} = 45^{\circ}\text{C}$, densitatea crește la:
$$\rho_{air} = \frac{250 \cdot 1000}{287.058 \cdot (45 + 273.15)} = \frac{250\,000}{91\,326} \approx 2.737\text{ kg/m}^3$$

---

## 2.3. Eficiența Volumetrică ($\eta_v$) și Coeficientul de Umplere

Eficiența volumetrică reprezintă raportul dintre masa reală de aer aspirată în cilindri și capacitatea teoretică geometrică maximă a motorului:

### Debitul Teoretic de Aer:
La un motor în 4 timpi, volumul de cilindree $V_{disp}$ este umplut complet o dată la fiecare două rotații ale arborelui cotit ($120\text{ secunde/ciclu}$):
$$\dot{m}_{theo}\text{ [g/s]} = \frac{RPM \cdot V_{disp}\text{ [L]} \cdot \rho_{air}\text{ [kg/m}^3]}{120}$$

### Eficiența Volumetrică Reală:
$$\eta_v\text{ [\%]} = \left( \frac{\dot{m}_{MAF\_filtrat}}{\dot{m}_{theo}} \right) \times 100$$

- **Separarea Matematică de Recircularea EGR**:
  Când supapa EGR este deschisă la sarcini parțiale, gazele inerte de eșapament înlocuiesc o parte din aerul proaspăt, scăzând debitul măsurat de debitmetru ($MAF$) chiar dacă cilindrii sunt plini. Pentru a nu confunda recircularea normală EGR cu o problemă mecanică de respirație, sistemul calibrează și memorează în sesiune **Eficiența Volumetrică de Referință ($\eta_{v, ref}$)** printr-un filtru adaptiv IIR **exclusiv în regimurile în care EGR este comandat 100% închis** ($\text{Load} > 70\%$ și $RPM > 1800$):
  $$\eta_{v, ref}^{(t)} = 0.98 \cdot \eta_{v, ref}^{(t-1)} + 0.02 \cdot \left(\frac{\eta_v}{100}\right)$$
  Această valoare calibrată este utilizată ulterior ca reper de bază în ecuația debitului masic recirculat prin EGR.

- **Interpretare Diagnoză**:
  - $\eta_v \in [85\% \dots 105\%]$: Motor turbo diesel în parametri optimi de respirație.
  - $\eta_v < 70\%$ la sarcină mare: Filtru de aer colmatat, depuneri de calamină pe supapele de admisie sau geometrie variabilă blocată pe deschis.
  - $\eta_v > 115\%$: Pierdere masivă de aer comprimat după debitmetru (furtun intercooler fisurat).

---

## 2.4. Raportul Aer-Combustibil ($AFR$) și Factorul Lambda Virtual ($\lambda$)

La motoarele diesel, cantitatea de aer aspirată per ciclu per cilindru este:
$$MAF_{stroke}\text{ [mg/cursă]} = \frac{\dot{m}_{MAF}\text{ [g/s]} \cdot 120\,000}{RPM \cdot n_{cilindri}}$$

### Raportul Aer/Combustibil ($AFR$):
$$AFR = \frac{MAF_{stroke}\text{ [mg]}}{Inj_{qty}\text{ [mg]}}$$

### Factorul de Exces de Aer Virtual ($\lambda$):
Pentru motorină, raportul stoechiometric este $AFR_{stoech} \approx 14.5 : 1$:
$$\lambda = \frac{AFR}{14.5}$$

### Criteriul Fizic de Fum Negru (Smoke Emission Risk):
Un motor diesel fără buclă închisă pe sonda lambda începe să producă particule dense de funingine (carbon nears) dacă amestecul devine prea bogat sub sarcină:
$$\text{SmokeRisk} = \begin{cases} \mathbf{TRUE}, & \text{dacă } \text{Load} > 50\% \text{ și } AFR < 16.5 \ (\lambda < 1.138) \\ \mathbf{FALSE}, & \text{în caz contrar} \end{cases}$$

---

## 2.5. Virtual Dyno: Puterea Termodinamică și Cuplul la Volantă

Sistemul calculează puterea dezvoltată de motor direct din energia chimică a combustibilului injectat, aplicând corecții dinamice pentru pierderile termice, de frecare și pompaj.

### Debitul Masic de Combustibil:
$$\dot{m}_{fuel}\text{ [g/s]} = \frac{Inj_{qty}\text{ [mg]} \cdot n_{cilindri} \cdot \left(\frac{RPM}{120}\right)}{1000}$$
$$\dot{m}_{fuel\_h}\text{ [g/h]} = \dot{m}_{fuel} \cdot 3600$$

### Modelul Randamentului Termic Dinamic ($\eta_{brake}$):
Punctul de bază pentru un motor diesel cu injecție directă este $\eta_{base} = 0.365$ ($36.5\%$). Acesta este modulat prin trei coeficienți de corecție:

1. **Factorul Lambda ($f_\lambda$)**:
   $$f_\lambda = \begin{cases} \max\left(0.75, \, 1.0 - (1.25 - \lambda) \cdot 0.8\right), & \lambda < 1.25 \text{ (ardere incompletă)} \\ \max\left(0.70, \, 1.0 - (\lambda - 3.0) \cdot 0.1\right), & \lambda > 3.0 \text{ (amestec ultra-sărac)} \\ 1.0, & 1.25 \le \lambda \le 3.0 \end{cases}$$

2. **Factorul Frecării la Rece ($f_{temp}$)**: Vâscozitatea ridicată a uleiului rece absoarbe lucru mecanic util:
   $$f_{temp} = \begin{cases} \max\left(0.70, \, 0.70 + 0.30 \cdot \frac{T_{oil}}{75}\right), & T_{oil} < 75^{\circ}\text{C} \\ 1.0, & T_{oil} \ge 75^{\circ}\text{C} \end{cases}$$

3. **Factorul Pierderilor de Pompaj la Turații Înalte ($f_{pump}$)**:
   $$f_{pump} = \begin{cases} \max\left(0.85, \, 1.0 - \frac{RPM - 3000}{2000} \cdot 0.15\right), & RPM > 3000 \\ 1.0, & RPM \le 3000 \end{cases}$$

$$\eta_{brake} = 0.365 \cdot f_\lambda \cdot f_{temp} \cdot f_{pump}$$

### Puterea Termodinamică Calculată:
Puterea calorică inferioară a motorinei este $H_i = 42.6\text{ MJ/kg} = 42.6\text{ kW}\cdot\text{s/g}$:
$$P_{kW} = \dot{m}_{fuel}\text{ [g/s]} \cdot 42.6 \cdot \eta_{brake}$$
$$P_{CP} = P_{kW} \cdot 1.35962$$

### Cuplul Motor la Volantă:
$$M_{Nm} = \frac{P_{kW} \cdot 9549}{RPM}$$

---

## 2.6. Cinematica Longitudinală la Roată & Rezistențele la Înaintare

Pentru validarea puterii sau estimarea tracțiunii când datele de injecție lipsesc, sistemul aplică legea a II-a a dinamicii:

$$F_{propulsie} = F_{aero} + F_{rulare} + F_{inclinare} + F_{inertie}$$

1. **Rezistența Aerodinamică cu Densitate Atmosferică Dinamică**:
   În locul unei valori constante ideale de $1.225\text{ kg/m}^3$, densitatea aerului ambiental este recalculată în timp real din presiunea barometrică și temperatura ambiantă:
   $$\rho_{aer\_amb} = \frac{P_{baro} \cdot 1000}{287.058 \cdot (T_{ambient} + 273.15)}\text{ [kg/m}^3]$$
   $$F_{aero} = \frac{1}{2} \cdot \rho_{aer\_amb} \cdot C_d \cdot A \cdot v_{ms}^2$$
   unde $C_d$ este coeficientul de formă aerodinamică ($0.27 \dots 0.35$), iar $A$ este suprafața frontală Hucho.
2. **Rezistența la Rulare a Anvelopelor**:
   $$F_{rulare} = m \cdot g \cdot C_{rr}$$
   unde $C_{rr} \approx 0.013$ pentru pneuri standard de stradă.
3. **Forța de Inerție la Accelerație**:
   $$F_{inertie} = m \cdot a = m \cdot (a_g \cdot 9.81)$$

Puterea absorbită la roată este:
$$P_{wheel\_kW} = \frac{(F_{aero} + F_{rulare} + \max(0, F_{inertie})) \cdot v_{ms}}{1000}$$

---

## 2.7. Transmisia și Auto-Învățarea Rapoartelor de Viteză

Pentru a detecta patinarea ambreiajului sau a convertizorului de cuplu fără a necesita codarea manuală a fiecărei cutii de viteze, modulul reține un vector de adaptare:

$$R_{obs} = \frac{RPM}{v\text{ [km/h]}}$$

Când sarcina motorului este redusă ($\text{Load} < 35\%$, rulare liberă fără patinare), raportul de transmisie este actualizat printr-un filtru IIR:
$$R_{gear}^{(t)} = 0.95 \cdot R_{gear}^{(t-1)} + 0.05 \cdot R_{obs}$$

### Detecția Patinării Ambreiajului (Clutch Slip):
Sub sarcină mare ($\text{Load} > 70\%$) în treptele superioare ($\text{Gear} \ge 3$):
$$RPM_{teoretic} = v\text{ [km/h]} \cdot R_{gear}$$
$$\text{ClutchSlip\%} = \left( \frac{RPM_{real} - RPM_{teoretic}}{RPM_{teoretic}} \right) \times 100$$
Dacă $\text{ClutchSlip\%} > 6.0\%$, este confirmată patinarea mecanică a discului de ambreiaj.

---

## 2.8. Dinamica Supraalimentării: Analiza Erorii de Boost

Sistemul monitorizează în permanență diferența dintre presiunea solicitată de mapa de injecție din ECU ($P_{MAP\_cmd}$) și presiunea fizică furnizată de turbină ($P_{MAP}$):

$$\Delta P_{boost} = P_{MAP} - P_{MAP\_cmd}\text{ [kPa]}$$

### Arborele de Decizie pentru Diagnoza Fizică:
La sarcină $\text{Load} > 45\%$ și $RPM > 1400$:
1. **$\Delta P_{boost} > +22.0\text{ kPa}$ (Overboost persistent)**:
   - Diagnostic: `VNT_N75_SPIKE`
   - Cauză fizică: Depuneri de funingine pe paletele geometriei variabile (VNT blocat mecanic) sau electrovalva N75 defectă pe circuitul de vacuum.
2. **$\Delta P_{boost} < -25.0\text{ kPa}$ (Underboost persistent)**:
   - Se testează simultan eficiența volumetrică $\eta_v$:
     - Dacă $\eta_v > 80.0\% \implies$ Diagnostic: `INTERCOOLER_BOOST_LEAK` (Aerul intră prin debitmetru dar se pierde prin furtun/fisură intercooler înainte de admisie).
     - Dacă $\eta_v \le 80.0\% \implies$ Diagnostic: `TURBO_UNDERBOOST_WEAR` (Uzură avansată a lagărelor sau axului turbinei).

---

## 2.9. Permeabilitatea Filtrului de Particule (DPF): Legea Darcy-Forchheimer

Căderea de presiune pe un filtru monolitic ceramic poros (Cordierit / Carbură de Siliciu) este guvernată de legea **Darcy-Forchheimer**:

$$\frac{\Delta P}{L} = \frac{\mu}{k_1} \cdot v_s + \frac{\rho_{exh}}{k_2} \cdot v_s^2$$

unde $v_s = \frac{Q_{vol}}{A_{DPF}}$ este viteza superficială a gazelor, iar $k_1, k_2$ sunt permeabilitățile vâscoase și inerțiale.

### Debitul Volumetric Real al Gazelor de Evacuare:
Densitatea gazelor de eșapament la temperatura catalizatorului $T_{cat}$ este:
$$\rho_{exh} = \frac{352.9}{T_{cat\_K}}\text{ [kg/m}^3]$$
$$Q_{vol}\text{ [m}^3\text{/h]} = \frac{\dot{m}_{MAF}\text{ [g/s]} \cdot 3.6}{\rho_{exh}}$$

### Indicele Rezistenței Hidraulice ($R_{DPF}$):
$$R_{DPF} = \left( \frac{\Delta P_{mbar}}{Q_{vol}} \right) \times 100$$

- **Interpretare Stare DPF**:
  - $R_{DPF} < 5.0$: `CLEAN` (Filtru regenerat complet).
  - $5.0 \le R_{DPF} < 10.0$: `NORMAL` (Grad mediu de încărcare).
  - $10.0 \le R_{DPF} < 18.0$: `WARNING_SOOT` (Necesară regenerare activă).
  - $R_{DPF} \ge 18.0$: `CRITICAL_CLOGGED` (Risc iminent de intrare în Limp Mode).

### Detecția Regenerării Active pe Bază de Exotermie Catalitică:
$$\Delta T_{cat} = T_{cat2} - T_{cat1}$$
Dacă $T_{cat1} > 530^{\circ}\text{C}$ sau $(\Delta T_{cat} > 40^{\circ}\text{C} \text{ și } T_{cat2} > 450^{\circ}\text{C})$, ECU a activat post-injecția pentru regenerare termică forțată.

---

## 2.10. Termodinamica Răcirii și Comportamentul Termostatului

1. **Ecartul Ulei-Apă**:
   $$\Delta T_{oil-water} = T_{oil} - T_{coolant}$$
   Dacă după $10\text{ minute}$ de funcționare la viteză de croazieră ($v > 50\text{ km/h}$) $\Delta T_{oil-water} > 22.0^{\circ}\text{C}$, termoflotul (schimbătorul de căldură ulei-antigel) este colmatat sau parțial blocat (`RESTRICTED_HEAT_EXCHANGE`).

2. **Detecție Termostat Blocat pe Deschis**:
   Sistemul integrează volumul de combustibil ars de la pornire:
   $$\text{FuelBurned} = \int \dot{V}_{inst} \, dt$$
   Dacă $\text{FuelBurned} > 0.5\text{ Litri}$, viteza $v > 70\text{ km/h}$, dar $T_{coolant} < 70^{\circ}\text{C}$, termostatul este blocat mecanic pe circuitul mare (`THERMOSTAT_STUCK_OPEN`).

---

## 2.11. Modelul de Degradare Termică și Chimică a Uleiului (Cinetica Arrhenius)

Uzurarea uleiului de motor nu este liniară cu kilometrajul parcurs. Rata degradării este modelată pe baza **ecuației Arrhenius** pentru reacțiile de oxidare, corelată cu diluția cu motorină la porniri reci și forfecarea mecanică:

1. **Factorul de Oxidare Termică ($k_{ox}$)**: Reacția de degradare se dublează la fiecare $10^{\circ}\text{C}$ peste temperatura nominală de $95^{\circ}\text{C}$:
   $$k_{ox} = 2^{\frac{\max(0, \, T_{oil} - 95)}{10}}$$
2. **Factorul de Diluție la Rece ($k_{dil}$)**: Condensarea combustibilului nears pe pereții cilindrilor reci:
   $$k_{dil} = 1 + 1.5 \cdot \frac{\max(0, \, 65 - T_{coolant})}{65}$$
3. **Factorul Forfecării Vâscoase la Turații Mari ($k_{shear}$)**:
   $$k_{shear} = \begin{cases} \min\left(2.5, \, \left(\frac{RPM}{2000}\right)^{1.4}\right), & RPM > 2000 \\ 1.0, & RPM \le 2000 \end{cases}$$

### Coeficientul Instantaneu de Stres al Uleiului:
$$f_{oil\_wear} = k_{ox} \cdot k_{dil} \cdot k_{shear}$$

### Kilometri Echivalenți de Uzură:
$$\Delta Km_{eq} = \Delta Km_{real} \cdot f_{oil\_wear}$$
$$Km_{oil\_total} = \int v\text{ [km/h]} \cdot f_{oil\_wear} \, dt$$
Un parcurs urban de $5000\text{ km}$ cu porniri dese la rece și regenerări DPF întrerupte poate echivala cu peste $11\,200\text{ km}$ reali de uzură a pachetului de aditivi.

---

## 2.12. Consumul Specific Efectiv de Combustibil (BSFC)

Consumul specific exprimă eficiența cu care motorul convertește combustibilul în lucru mecanic util la arbore:

$$BSFC\text{ [g/(kW}\cdot\text{h)]} = \frac{\dot{m}_{fuel\_h}\text{ [g/h]}}{P_{kW}}$$

- Motoare diesel moderne: $BSFC_{optim} \approx 205 \dots 220\text{ g/kWh}$ (randament $38 \dots 41\%$).
- Regimuri ineficiente (sarcină parțială la rece sau turație excesivă): $BSFC > 320\text{ g/kWh}$.

---

## 2.13. Analiza Circuitului Electric: Căderi de Tensiune, Baterie și Alternator

1. **Căderea de Tensiune pe Cablaj (Releul 109 / Puncte de Masă)**:
   $$\Delta V_{drop} = |V_{bat} - V_{ECU}|$$
   Dacă $\Delta V_{drop} > 0.75\text{ V}$, contactele releului de alimentare principal sau îmbinările de masă sunt corodate (`GROUND_WIRING_DROP`).

2. **Rezistența Internă a Bateriei la Pornire ($R_{int}$)**:
   În momentul acționării demarorului ($50 < RPM < 600$), curentul absorbit $I_{crank}$ nu este considerat arbitrar la $300\text{ A}$, ci este scalat direct funcție de cilindreea motorului și tipul de combustibil (raportul de compresie fiind mult mai mare la diesel, $\approx 18:1$ vs $\approx 10:1$ la benzină):
   $$I_{crank}\text{ [A]} = \max\left(150, \, \min\left(650, \, V_{disp}\text{ [L]} \times (isDiesel \ ? \ 120 : 75)\right)\right)$$
   $$R_{int}\text{ [m}\Omega\text{]} = \left( \frac{V_{repaus} - V_{crank\_min}}{I_{crank}} \right) \cdot 1000 \cdot \left[ 1 - 0.012 \cdot (20 - T_{ambient}) \right]$$

3. **Starea de Sănătate a Bateriei (State of Health - $SoH\%$)**:
   Bateria nouă prezintă $R_{int} \approx 4.0\text{ m}\Omega$. Când rezistența internă atinge $14\text{ m}\Omega$, bateria își pierde capacitatea de pornire la rece:
   $$SoH\text{ [\%]} = \max\left(20, \, \min\left(100, \, 100 - (R_{int} - 4.0) \cdot 7.5\right)\right)$$

4. **Detecția Punctelor de Diode Străpunse în Alternator (Diode Ripple Proxy)**:
   Sistemul calculează abaterea pătratică medie (RMS) a tensiunii față de estimarea Kalman:
   $$V_{ripple}\text{ [V]} = \sqrt{\frac{1}{N} \sum_{i=1}^N (V_{ECU}^{(i)} - \hat{V}_{Kalman}^{(i)})^2}$$
   Dacă $V_{ripple} > 0.35\text{ V}$ la $RPM > 1000$, una dintre diodele punții redresoare este scurtcircuitată (`ALTERNATOR_DIODE_FAULT`).

---

## 2.14. Modelul Termic și Uzura Frânelor: Disipare & Legea Archard

1. **Puterea Netă de Frânare**:
   La decelerații $a_g < -0.12\text{ G}$, se scade efectul frânei de motor ($\approx 0.06\text{ G}$):
   $$a_{frane} = |a_g| - 0.06$$
   $$P_{brake}\text{ [kW]} = \frac{m \cdot a_{frane} \cdot 9.81 \cdot v_{ms}}{1000}$$

2. **Energia Cinetică Disipată pe Cursă**:
   $$E_{brake}\text{ [MJ]} = \sum \frac{P_{brake}\text{ [kW]} \cdot \Delta t\text{ [s]}}{1000}$$

3. **Modelul Termic al Discului de Frână (Capacitate Calorică & Convecție)**:
   Temperatura discului $T_{disc}$ crește strict din **energia termică eliberată în pasul curent de frânare** $\Delta E_{heat}^{(t)} = P_{brake}\text{ [kW]} \cdot \Delta t \cdot 0.70$ (puntea față absorbind $70\%$ din efortul total), raportată la capacitatea calorică a discurilor față ($C_{th} = m_{discuri} \cdot c_p \approx 14\text{ kg} \times 0.46\text{ kJ/(kg}\cdot\text{K)} = 6.44\text{ kJ/K}$):
   $$\Delta T_{heat}^{(t)} = \frac{P_{brake}^{(t)} \cdot \Delta t \cdot 0.70}{6.44}\text{ [}^{\circ}\text{C]}$$
   Discul se răcește simultan prin convecție forțată dependentă de viteza mașinii:
   $$R_{cooling} = 0.015 \cdot \left( 1 + \frac{v_{ms}}{20} \right) \cdot \Delta t$$
   $$T_{disc}^{(t)} = \max\left(T_{ambient}, \, T_{disc}^{(t-1)} + \Delta T_{heat}^{(t)} - (T_{disc}^{(t-1)} - T_{ambient}) \cdot \min(0.5, R_{cooling})\right)$$
   Când pedala de frână este eliberată ($P_{brake} = 0$), $\Delta T_{heat}^{(t)} = 0$ și temperatura discului coboară asimptotic spre temperatura mediului ambiant.

4. **Modelul de Uzură a Plăcuțelor (Legea Archard)**:
   Conform teoriei tribologice Archard, volumul de material abrazat este proporțional cu lucrul mecanic al forțelor de frecare. Un set nou de plăcuțe absoarbe nominal $E_{nominal} \approx 45.0\text{ MJ}$ de energie:
   $$\text{BrakeWear\%} = \left( \frac{E_{brake\_total}}{45.0\text{ MJ}} \right) \times 100$$

---

## 2.15. Recircularea Gazelor de Evacuare (EGR Mass Fraction) & Detecție Calaminare

Fracția masică a gazelor de eșapament recirculate în admisie este determinată prin deficitul de aer proaspăt măsurat de debitmetru, raportat la eficiența volumetrică învățată pe vehicul ($\eta_{v, ref}$):

$$EGR\text{ [\%]} = \max\left(0, \, \min\left(60, \, \left( 1 - \frac{\dot{m}_{MAF\_filtrat}}{\dot{m}_{theo} \cdot \eta_{v, ref}} \right) \times 100\right)\right)$$

- **Diagnoză Fizică**:
  - La regim parțial ($1400 \le RPM \le 2200$, $\text{Load} \in [20\% \dots 50\%]$): Dacă $EGR < 3\% \implies$ `EGR_STUCK_CLOSED_OR_BLANKED` (Supapa este blocată pe închis sau anulată mecanic cu flanșă oarbă).
  - La sarcină plină ($\text{Load} > 75\%$): Dacă $EGR > 15\% \implies$ `EGR_STUCK_OPEN_CARBON` (Supapa nu se închide complet din cauza calaminei, cauzând pierdere gravă de putere și fum negru).

---

## 2.16. Diagnoza Pompei de Înaltă Presiune (Common Rail) & DRV

Sistemul calculează presiunea țintă nominală pe baza unui model bivariat calibrat:
$$P_{rail\_target}\text{ [bar]} = 280 + \left(\frac{RPM}{4000}\right) \cdot 380 + \left(\frac{Inj_{qty}}{50}\right) \cdot 740$$

$$\text{Deviație\%} = \left( \frac{P_{rail\_actual} - P_{rail\_target}}{P_{rail\_target}} \right) \times 100$$

- **Stabilitatea Regulatorului la Ralanti**:
  Dacă la ralanti ($500 < RPM < 950$, $v < 3\text{ km/h}$) fluctuația presiunii $(\max(P_{rail}) - \min(P_{rail})) > 35\text{ bar}$, regulatorul de presiune de pe rampă (DRV) sau electrovalva de dozaj (IMV) prezintă histerezis mecanic (`DRV_IMV_VALVE_UNSTABLE`).

---

## 2.17. Randamentul Termic al Intercooler-ului (IC Efficiency & Heat Soak)

Aerul comprimat de roata compresor a turbosuflantei se încălzește conform legii transformării adiabatice. Pentru a măsura starea radiatoarelor de aer (intercooler aer-aer sau aer-apă) fără senzori suplimentari, sistemul deduce temperatura teoretică de ieșire din compresor:

### Temperatura Aerului la Ieșirea din Compresor:
$$PR = \max\left(1.0, \, \frac{P_{MAP}}{P_{baro}}\right)$$
$$T_{comp\_out}\text{ [}^{\circ}\text{C]} = (T_{ambient} + 273.15) \cdot \left[ 1 + \frac{1}{\eta_{comp}} \cdot \left( PR^{\frac{\gamma - 1}{\gamma}} - 1 \right) \right] - 273.15$$
unde $\eta_{comp} \approx 0.72$ (randamentul izentropic tipic al compresorului radial), iar $\frac{\gamma - 1}{\gamma} \approx \frac{1.4 - 1}{1.4} \approx 0.2857$.

### Eficiența Termică Reală a Intercooler-ului:
$$\eta_{IC}\text{ [\%]} = \left( \frac{T_{comp\_out} - T_{IAT}}{T_{comp\_out} - T_{ambient}} \right) \times 100$$
- **Criteriu Diagnoză Heat Soak**: Când $P_{MAP} > 135\text{ kPa}$, $v > 60\text{ km/h}$ și $\eta_{IC} < 55.0\%$, se activează starea `HEAT_SOAK_OR_CLOGGED` (intercooler acoperit cu noroi/ulei pe interior sau debit de aer de răcire insuficient).

---

## 2.18. Protecție Anti-Cocsificare Turbină la Oprire (CHRA Core Temp & Cooldown Timer)

Oprirea imediată a motorului după rulare în sarcină mare întrerupe fluxul de ulei de la pompă, în timp ce căldura reziduală din carcasă migrează în miezul lagărului (CHRA - Center Housing Rotating Assembly), ducând la carbonizarea uleiului sintetic și distrugerea lagărelor hidrodinamice.

### Modelul Termic de Estimare a Miezului CHRA:
$$T_{CHRA}^{(t)} = 0.96 \cdot T_{CHRA}^{(t-1)} + 0.04 \cdot (0.55 \cdot T_{cat1} + 0.45 \cdot T_{oil})$$

### Cronometrul de Răcire la Ralanti (Turbo Cooldown Timer):
Dacă temperatura miezului depășește $260^{\circ}\text{C}$ (pragul de piroliză a uleiului de motor):
$$t_{cooldown}\text{ [secunde]} = \max\left(0, \, \text{round}\left((T_{CHRA} - 260) \cdot 0.75\right)\right)$$
Dacă $t_{cooldown} > 15\text{ secunde}$, aplicația afișează o avertizare vizuală cu timpul rămas necesar de menținere la ralanti înainte de oprirea contactului.

---

## 2.19. Bilanțul Termodinamic Sankey în Timp Real (Energy Split)

Sistemul calculează distribuția energiei primare introduse prin combustibil în trei componente fundamentale:

1. **Puterea Chimică Totală a Combustibilului**:
   $$\dot{Q}_{fuel}\text{ [kW]} = \dot{m}_{fuel}\text{ [g/s]} \cdot 42.6\text{ kW}\cdot\text{s/g}$$
2. **Puterea Termică Pierdută pe Eșapament**:
   $$\dot{m}_{exh}\text{ [g/s]} = \dot{m}_{MAF} + \dot{m}_{fuel}$$
   $$P_{exh}\text{ [kW]} = \frac{\dot{m}_{exh} \cdot 1.08\text{ [kJ/(kg}\cdot\text{K)]} \cdot \max(0, \, T_{cat1} - T_{ambient})}{1000}$$
3. **Procentele Bilanțului Energetic (Conservarea Energiei)**:
   $$\eta_{mecanic}\% = \left( \frac{P_{kW\_thermo}}{\dot{Q}_{fuel}} \right) \times 100 \quad [30\% \dots 42\%]$$
   $$\eta_{evacuare}\% = \left( \frac{P_{exh}}{\dot{Q}_{fuel}} \right) \times 100 \quad [18\% \dots 35\%]$$
   $$\eta_{racire\_frecare}\% = 100 - (\eta_{mecanic}\% + \eta_{evacuare}\%) \quad [30\% \dots 45\%]$$

---

## 2.20. Putere Corectată Atmosferic conform Standardului SAE J1349

Puterea dezvoltată de motoarele cu ardere internă depinde de altitudine, presiune atmosferică și temperatura aerului ambiant. Pentru a permite comparabilitatea datelor telemetrice măsurate la mare sau la munte, sistemul aplică **factorul de corecție standard SAE J1349**:

$$CF_{SAE} = 1.180 \cdot \left[ \left( \frac{99.0}{P_{baro}\text{ [kPa]}} \right) \cdot \sqrt{\frac{T_{ambient} + 273.15}{298.15}} \right] - 0.180$$
clamped în intervalul $[0.85 \dots 1.25]$.

$$P_{SAE}\text{ [CP]} = P_{dyno} \cdot CF_{SAE}$$

---

## 2.21. Fuziune Senzorială pentru Panta Drumului și Estimarea Sarcinii Utile (Payload)

1. **Fuziune Complementară Pantă**:
   Panta dedusă din echilibrul forțelor dinamice ($\theta_{force}\%$) este fuzionată cu panta unghiulară citită din accelerometrul IMU ($\theta_{imu}\% = \tan(\alpha_{pitch}) \times 100$):
   $$\theta_{fused}\% = \begin{cases} 0.60 \cdot \theta_{force}\% + 0.40 \cdot \theta_{imu}\%, & v > 15\text{ km/h} \text{ și } M > 20\text{ Nm} \\ \theta_{imu}\%, & \text{în staționare sau frână de motor} \end{cases}$$

2. **Estimarea Masei Suplimentare de Încărcătură (Payload Estimator)**:
   Pe drum orizontal ($|\theta_{fused}| < 1.5\%$), când vehiculul accelerează energic în treptele medii ($v > 20\text{ km/h}$, $a_g > 0.12\text{ G}$):
   $$m_{calculat} = \frac{F_{drive} - F_{aero} - F_{roll}}{a_g \cdot 9.81}$$
   $$\Delta m_{payload} = m_{calculat} - m_{proprie\_vehicul}$$
   Valoarea este filtrată în timp real:
   $$m_{payload}^{(t)} = 0.95 \cdot m_{payload}^{(t-1)} + 0.05 \cdot \max(0, \, \min(900, \, \Delta m_{payload}))$$

---

## 2.22. Indicele de Stabilitate la Ralanti & Diagnoza Volantei cu Masă Dublă (DMF)

La regim de ralanti cald ($v < 2\text{ km/h}$, $T_{coolant} > 70^{\circ}\text{C}$, $600 \le RPM \le 1050$), sistemul monitorizează dispersia turației prin deviația standard $RPM_{std}$ pe o fereastră glisantă de 10 eșantioane:

$$RPM_{medie} = \frac{1}{N} \sum_{i=1}^N RPM_i, \quad RPM_{std} = \sqrt{\frac{1}{N} \sum_{i=1}^N (RPM_i - RPM_{medie})^2}$$

$$Index_{stabilitate} = \max(0, \, \min(100, \, 100 - RPM_{std} \cdot 2.5))$$

- **Criteriu Alertă Volantă DMF Defectă**:
  Dacă $RPM_{std} > 26.0\text{ RPM}$ și accelerometrul transversal înregistrează vibrație rezonantă $|A_y| > 0.07\text{ G}$, se emite avertizarea de dezechilibru mecanic al volantei bi-masice (`DMF_IMBALANCE_WARNING`).

---

# PARTEA III: CALCULUL PANTELOR, REZOLUȚIA UNIVERSALĂ A VEHICULELOR ȘI SMART MOBILITY

## 3.1. Estimarea Pantei Drumului ($\theta\%$) din Balanța Forțelor Fără Senzor Dedicat

Fără a necesita senzori giroscopici scumpi, panta drumului se deduce comparând forța de tracțiune la roată ($F_{drive}$) cu forțele de rezistență estimate pe drum plat ($F_{flat}$):

### Forța de Tracțiune la Roată:
$$F_{drive} = \frac{M_{motor}\text{ [Nm]} \cdot i_{treapta} \cdot i_{diferential} \cdot \eta_{transmisie}}{r_{roata}}$$

### Forțele Rezistente pe Drum Orizontal:
$$F_{flat} = m \cdot (a_g \cdot 9.81) + m \cdot g \cdot C_{rr} + \frac{1}{2} \rho C_d A v^2$$

### Panta Drumului în Procente:
$$\Delta F = F_{drive} - F_{flat}$$
$$\theta\text{ [\%]} = \left( \frac{\Delta F}{m \cdot g} \right) \times 100$$
Valoarea este limitată fizic în intervalul $[-25\% \dots +25\%]$.

---

## 3.2. Detecția Rezistențelor Anormale la Rulare (Coast-Down Drag Anomaly)

În regim de frână de motor completă (**Overrun Fuel Cut-Off**: $Inj_{qty} < 0.5\text{ mg}$, $v > 35\text{ km/h}$, clapeta de accelerație eliberată), decelerarea normală pe drum drept este de $-0.05\text{ G} \dots -0.12\text{ G}$.

Dacă decelerația depășește constant valoarea:
$$a_g < -0.18\text{ G}$$
sistemul identifică o forță parazită de frecare mecanică: `BRAKE_CALIPER_OR_BEARING_DRAG` (etrier de frână blocat pe disc sau rulment de roată gripat).

---

## 3.3. Rezoluția Universală a Parametrilor Fizici pentru Orice Mașină

Modulul `VehiclePhysicsResolver.js` adaptează dinamic toate constantele de calcul pentru orice profil de vehicul:

### 1. Decodarea Dimensiunii Anvelopelor și Calculul Razei Dinamice
Format specificat: $\text{Lățime [mm]} / \text{Talon [\%]} \ \text{R} \ \text{Jantă [inch]}$ (ex: `225/50 R17`):
$$h_{flanc}\text{ [mm]} = \text{Lățime} \times \left( \frac{\text{Talon}}{100} \right)$$
$$D_{janta}\text{ [mm]} = \text{Jantă [inch]} \times 25.4$$
$$D_{total}\text{ [mm]} = D_{janta} + 2 \cdot h_{flanc}$$
Ținând cont de deformarea elastică a pneului sub sarcina verticală a mașinii ($\approx 3\%$ aplatizare):
$$r_{roata}\text{ [m]} = \left( \frac{D_{total}}{2} \right) \times 0.97 \times 10^{-3}$$

### 2. Formula Aerodinamică Hucho pentru Suprafața Frontală ($A$)
$$A\text{ [m}^2\text{]} \approx 0.84 \times \left( \frac{\text{Lățime [mm]}}{1000} \right) \times \left( \frac{\text{Înălțime [mm]}}{1000} \right)$$

### 3. Matricea Pragurilor Termice și de Turație per Tip de Propulsie

| Parametru Fizic | Diesel Turbo | Benzină Aspirat / Turbo | Hibrid (HEV/PHEV) | Electric (BEV) |
| :--- | :---: | :---: | :---: | :---: |
| **Ralanti Nominal ($RPM$)** | $800$ | $750$ | $800$ | $0$ |
| **Turație Maximă ($Redline$)** | $4\,800$ | $6\,500$ | $6\,200$ | $16\,000$ |
| **Prag Turație Înaltă ($Stres$)**| $3\,500$ | $5\,000$ | $4\,800$ | $12\,000$ |
| **Temp. Optimă Antigel ($^{\circ}\text{C}$)**| $82 \dots 93$ | $88 \dots 103$ | $82 \dots 98$ | $20 \dots 38$ (Baterie) |
| **Temp. Avertizare ($^{\circ}\text{C}$)** | $98$ | $108$ | $103$ | $48$ |
| **Temp. Critică ($^{\circ}\text{C}$)** | $105$ | $114$ | $110$ | $58$ |
| **Boost Nominal ($\text{bar}$)** | $1.35$ | $0.95$ | $0.85$ | $0.00$ |

---

## 3.4. Fizica Senzorilor Smart Mobility

```
             ┌───────────────────────────────────────────────────┐
             │            MODUL SMART MOBILITY & SECURITATE      │
             └─────────────────────────┬─────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
  [SENTRY GUARD]               [POTHOLE RADAR]               [eCALL CRASH SOS]
  Contact OPRIT                În deplasare ($v \ge 20$)      În deplasare ($v > 30$)
  - Șoc: $|A_{xy}| \ge 0.65G$  - Șoc Z: $A_z \ge 1.75G$       - Impact: $A_x \le -2.80G$
  - Înclinare: $\Delta\theta \ge 3.5^\circ$  - Coordonate GPS salvate  - Numărătoare 30s SOS
```

### 1. Alertă Șoc în Parcare (Sentry Guard):
Motorul este oprit ($RPM = 0$). Se monitorizează accelerația pe planul orizontal:
$$A_{horiz} = \sqrt{A_x^2 + A_y^2}$$
$$\text{AlertSentry} = \mathbf{TRUE} \iff A_{horiz} \ge 0.65\text{ G}$$

### 2. Alertă Înclinare / Furt de Roți / Ridicare pe Platformă:
Unghiul absolut de înclinare este calculat prin funcția trigonometrică $\arctan$:
$$\theta = \arctan\left( \frac{A_x}{\sqrt{A_y^2 + A_z^2}} \right) \cdot \frac{180}{\pi}$$
$$\text{AlertTilt} = \mathbf{TRUE} \iff |\theta_t - \theta_0| \ge 3.5^{\circ}$$

### 3. Radarul Gropilor din Carosabil (Pothole Heatmap):
La trecerea cu viteză ($v \ge 20\text{ km/h}$) peste o denivelare adâncă sau groapă în asfalt, forța de reacțiune a suspensiei generează o accelerare verticală bruscă pe axa Z:
$$\text{PotholeDetected} = \mathbf{TRUE} \iff A_z \ge 1.75\text{ G}$$
Sistemul captează automat coordonatele $(\text{Latitudine}, \text{Longitudine})$ și transmite evenimentul către server pentru harta comunitară de gropi.

### 4. Sistemul Automat eCall SOS la Accident:
În cazul unui impact frontal sever la viteză ridicată ($v > 30\text{ km/h}$), decelerația longitudinală depășește pragul de distrugere mecanică:
$$\text{CrashDetected} = \mathbf{TRUE} \iff A_x \le -2.80\text{ G}$$
Se declanșează instantaneu modalul de urgență cu numărătoare inversă de $30\text{ de secunde}$ pentru apelarea automată a serviciului de urgență 112 și transmiterea coordonatelor GPS prin SMS.

---

# PARTEA IV: MATEMATICA SCORURILOR DE SĂNĂTATE ȘI MODELUL DE FIABILITATE WEIBULL

## 4.1. Algoritmul de Calcul al Scorurilor cu Date Parțiale

Fiecare subsistem primește un scor de sănătate cuprins între $0$ și $100$. Când anumiți senzori lipsesc (de exemplu, un vehicul fără senzor DPF sau fără debitmetru de mare precizie), sistemul utilizează o **abordare bayesiană cu beneficiul incertitudinii**:

$$Score_{subsystem} = RawScore \cdot Coverage + NEUTRAL \cdot (1 - Coverage)$$

unde:
- $RawScore \in [0 \dots 100]$: Scorul dedus exclusiv din senzorii fizici prezenți.
- $Coverage \in [0.0 \dots 1.0]$: Fracția parametrilor cheie disponibili pentru acel subsistem.
- $NEUTRAL = 70$: Prior neutru (dacă motorul funcționează și nu avem date contrare, presupunem o stare acceptabilă de $70\%$).

### Exemple de Calcul al Acoperirii ($Coverage$):
- **Motor ($ENGINE$)**:
  $$Coverage = \left(\text{are } RPM \ ? \ 0.5 : 0\right) + \left(\text{are } ZoneTurație \ ? \ 0.5 : 0\right)$$
- **Transmisie ($TRANSMISSION$)**:
  $$Coverage = \left(\text{are } RPM \ ? \ 0.5 : 0\right) + \left(\text{are } Viteza \ ? \ 0.5 : 0\right)$$

---

## 4.2. Ponderarea Calității Senzorilor (Sensor Reliability Index)

Încrederea finală a sistemului în diagnosticul emis este calculată prin produsul dintre acoperire și calitatea măsurării:

$$Confidence\text{ [\%]} = Coverage \cdot Reliability \cdot 100$$

unde $Reliability \in [0.0 \dots 1.0]$ este extras din `SensorQualityEngine` (măsurând lipsa întreruperilor de semnal, erorile de paritate și constanța eșantionării).

---

## 4.3. Distribuția Weibull cu 2 Parametri pentru Fiabilitate

Pentru predicția duratei de viață reziduale și a probabilității de cedare a componentelor critice pe următorii $\Delta t = 3000\text{ km}$, se utilizează **distribuția de probabilitate Weibull**:

### Funcția de Fiabilitate $R(t)$ (Supraviețuire):
$$R(t) = \exp\left( -\left( \frac{t \cdot s}{\eta} \right)^\beta \right)$$

unde:
- $t$: Kilometrajul curent acumulat de componentă $[\text{km}]$
- $s$: Factorul dinamic de stres operațional ($s \ge 0.1$) calculat din telemetrie (temperatură, presiuni anormale, șocuri)
- $\eta$ (Eta): Parametrul de scară (durata de viață nominală la care $63.2\%$ din componente cedează) $[\text{km}]$
- $\beta$ (Beta): Parametrul de formă (panta Weibull):
  - $\beta < 1$: Rata defectelor scade în timp (defecțiuni juvenile / de fabricație).
  - $\beta = 1$: Rata defectelor este constantă (defecțiuni pur aleatorii).
  - $\beta > 1$: Rata defectelor crește exponențial (uzură fizică, oboseală de material).

### Parametrii Calibrați ai Componentelor:

| Componentă | Parametru Scară ($\eta$) | Parametru Formă ($\beta$) | Factor de Stres ($s$) din Telemetrie |
| :--- | :---: | :---: | :--- |
| **Ulei Motor** | $15\,000\text{ km}$ | $2.8$ | $s = \max(0.8, \, f_{oil\_wear})$ |
| **Filtru DPF** | $180\,000\text{ km}$ | $3.2$ | $s = \max(0.8, \, R_{DPF} / 6.0)$ |
| **Turbosuflantă** | $220\,000\text{ km}$ | $2.5$ | $s = 1.0 + \frac{|\Delta P_{boost}|}{30} + \max\left(0, \, \frac{T_{cat1} - 450}{100}\right) + Penalty_{cold\_oil}$ |

*Notă*: Pentru turbosuflantă, se utilizează valoarea absolută $|\Delta P_{boost}|$ (deoarece și o pierdere de presiune prin furtun spart forțează turbina la supraturare periculosă), iar dacă șoferul solicită turații mari cu motorul rece ($T_{oil} < 65^{\circ}\text{C}$ și $RPM > 2200$), se aplică penalizarea masivă de forfecare $Penalty_{cold\_oil} = +1.5$.
| **Plăcuțe Frână** | $45\,000\text{ km}$ | $1.9$ | $s = \max\left(0.8, \, \frac{T_{disc}}{120} \cdot \left(1 + \frac{P_{brake}}{60}\right)\right)$ |
| **Acumulator** | $80\,000\text{ km}$ | $2.2$ | $s = \max\left(0.8, \, \frac{R_{int}}{5.0} \cdot (AlternatorFault \ ? \ 2.5 : 1.0)\right)$ |

### Probabilitatea de Defectare în Următorii $3000\text{ km}$:
Probabilitatea condiționată ca o piesă care a supraviețuit până la $t_1$ să cedeze înainte de $t_2 = t_1 + 3000\text{ km}$ este:
$$P_{fail}\text{ [\%]} = \left( 1 - \frac{R(t_2)}{R(t_1)} \right) \times 100$$

Nivelul de risc raportat în interfață:
$$\text{Risc} = \begin{cases} \mathbf{HIGH}, & P_{fail} \ge 35\% \\ \mathbf{MEDIUM}, & 15\% \le P_{fail} < 35\% \\ \mathbf{LOW}, & P_{fail} < 15\% \end{cases}$$

---

## 4.4. Modelul Economic B2B: Prevenirea Defecțiunilor Catastrofale și ROI

Rentabilitatea economică (ROI) a sistemului este calculată prin însumarea costurilor reparațiilor catastrofale evitate prin oprire preventivă înainte de ruperea mecanică:

### Matricea Costurilor Salvate per Incident:
$$ROI_{daune}\text{ [Euro]} = \sum C_{prevenit}$$
- **Ulei degradat extrem ($P_{fail} \ge 35\%$)**: $+1450\text{ €}$ (Evitare calare cuzineți arbore cotit și blocare motor).
- **DPF colmatat critic ($P_{fail} \ge 35\%$)**: $+1200\text{ €}$ (Evitare distrugere termică fagure ceramic și înlocuire DPF nou OEM).
- **Turbină cu joc pe ax ($P_{fail} \ge 35\%$)**: $+1100\text{ €}$ (Evitare rupere palete compresor și aspirare piese în cilindri).
- **Frâne supraîncălzite ($P_{fail} \ge 35\%$)**: $+380\text{ €}$ (Evitare ovalizare/șanțuire discuri de frână ventilate).
- **Baterie/Alternator ($P_{fail} \ge 35\%$)**: $+320\text{ €}$ (Evitare tractare pe platformă și supratensiune în calculatorul de injecție).

### Economia Anuală de Combustibil prin Corecția BSFC:
$$\Delta Fuel\text{ [L/100km]} = \max\left(0, \, (BSFC - 205) \cdot 0.015\right)$$
La un rulaj mediu de flotă comercială de $40\,000\text{ km/an}$ și un preț de $1.50\text{ €/Litre}$:
$$EconomieCombustibil\text{ [€/an]} = \Delta Fuel \times 400 \times 1.50$$

$$ROI_{Total\_Flota}\text{ [Euro]} = ROI_{daune} + EconomieCombustibil$$

---

## CONCLUZIE TEHNICĂ

Prezenta arhitectură demonstrează că un sistem de telemetrie modern nu trebuie să fie un simplu afișaj pasiv de ceasuri de bord, ci un **sistem cibernetic complet de observare fizică și predicție statistică**. 

Prin combinarea extracției pe magistrala de date (SAE J1979 / K-Line) la nivel de microcontroler cu ecuațiile termodinamice, filtrarea Kalman și distribuțiile de probabilitate Weibull, aplicația furnizează atât siguranță activă în timp real (Smart Mobility), cât și optimizare financiară concretă pentru utilizatorul final și flotele comerciale.
