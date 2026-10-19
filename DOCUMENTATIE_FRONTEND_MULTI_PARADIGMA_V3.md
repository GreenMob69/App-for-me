# DOCUMENTAȚIE TEHNICĂ: ARHITECTURA FRONTEND MULTI-PARADIGMĂ (v3-NEXT-GEN)
**Platformă Avansată de Telemetrie Auto, Diagnoză OBD-II și Digital Twin 3D**  
*Document pregătit pentru evaluare, audit arhitectural și optimizare de către un AI / Senior Frontend Architect.*

---

## 1. Context Tehnic și Stack Tehnologic

* **Framework Principal**: React Native `0.86.3` / React `19.2.3` / Expo SDK `57.0.0`
* **Randare Grafică & Vectorială**: `react-native-svg` (`15.15.4`), motor de proiecție matematică 3D pe matrice de rotație, animații native `Animated` cu `useNativeDriver: true`
* **Sistem de Siguranță Ecran (Insets)**: `react-native-safe-area-context` (`5.7.0`) împachetat într-un hook de siguranță `useSafeInsets.js`
* **Transmisie Date Live**: `socket.io-client` (`4.8.3`), flux de date la frecvența de 1Hz cu buclă de netezire 60 FPS (`useSmoothedTelemetry.js`)
* **Stocare Locală & Caching**: `@react-native-async-storage/async-storage` (`2.2.0`)
* **Feedback Haptic**: Modulul nativ `Vibration` din React Native calibrat pentru impulsuri tactile (`hapticFeedback.js`)
* **Backend Sursă**: Node.js + Express, bază de date SQLite în mod WAL, motor de fizică empirică [`PhysicsEngine.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/PhysicsEngine.js) (32 de observatori virtuali și modele de fiabilitate Weibull), telecomandă de simulare internă la `/api/simulator`.

---

## 2. Arhitectura Industrială Decuplată (Separation of Concerns)

Pentru a permite comutarea instantanee între 5 paradigme vizuale radical diferite fără coliziuni de cod, memorie sau randare, s-a implementat o arhitectură pe 4 straturi strict independente:

```mermaid
flowchart TD
    subgraph Layer1 ["1. DATA & PHYSICS LAYER (Backend & Socket)"]
        RawOBD[Senzori OBD-II / CAN-Bus 1Hz] --> Ingestion[handlers/mqttHandler.js]
        Sim[Simulator In-Process /api/simulator] --> Ingestion
        Ingestion --> Physics[PhysicsEngine.js - 32 Modele Fizice]
        Physics --> SocketStream[Socket.IO Broadcast]
    end

    subgraph Layer2 ["2. ADAPTER LAYER (Single Source of Truth)"]
        SocketStream --> LiveContext[LiveContext.js]
        LiveContext --> TelemetryAdapter[src/hooks/useNormalizedTelemetry.js]
        TelemetryAdapter --> SafeData[Obiect Normalizat, Tipat, Fără Null-Pointer]
    end

    subgraph Layer3 ["3. DESIGN TOKENS & SAFETY LAYER"]
        ThemeRegistry[src/theme/paradigmThemes.js] --> Tokens[Culori, Fonturi, Tabular-Nums, Anti-Overflow]
        SafeAreaHelper[src/hooks/useSafeInsets.js] --> Insets[PaddingTop Dinamic anti-Notch / Punch-Hole]
    end

    subgraph Layer4 ["4. VIEW PARADIGMS LAYER (Stateless Views)"]
        SafeData & Tokens & Insets --> P1[ClassicV2 - 12 Taburi HMI]
        SafeData & Tokens & Insets --> P2[NothingMinimal - Calm Tech]
        SafeData & Tokens & Insets --> P3[RetroAudi96 - Digifiz VFD]
        SafeData & Tokens & Insets --> P4[F1Cyberdeck - Race Console]
        SafeData & Tokens & Insets --> P5[SpatialCanvas - 3D Digital Twin]
    end
```

### Componentele Cheie ale Decuplării:
1. **Adapterul Unic** ([`src/hooks/useNormalizedTelemetry.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/hooks/useNormalizedTelemetry.js)):
   - Nicio paradigmă nu accesează direct proprietăți brute de rețea.
   - Hook-ul normalizează și pre-calculează: `speed`, `rpm`, `gear`, `boost`, `coolantTemp`, `oilTemp`, `exhaustTemp`, `chraTemp`, `batteryVoltage`, `batterySoH`, `fuelLevel`, `fuelRate`, `brakeFluidTemp`, `brakeEnergyTrip`, `gForceLat`, `gForceLong`, `weibullRul`, `minRulKm`, `breakdownRisk`, `sankey`, `criticalAlerts`, `activeCylinder`.
   - Asigură valori implicite sigure (*null-safety*), prevenind crash-urile de tip `undefined is not an object`.
2. **Registrul de Tokeni de Design** ([`src/theme/paradigmThemes.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/theme/paradigmThemes.js)):
   - Izolează strict paletele de culori, suprafețele, accentele și fonturile pentru fiecare stil.
   - Conține reguli tipografice obligatorii: `fontVariant: ['tabular-nums']` (cifre cu lățime fixă) și `adjustsFontSizeToFit` cu `numberOfLines={1}` pentru prevenirea oricărui overflow pe ecrane înguste.
3. **Hook-ul de Siguranță a Decupajului** ([`src/hooks/useSafeInsets.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/hooks/useSafeInsets.js)):
   - Rezolvă excepția `No safe area value available`.
   - Încearcă să citească insets-urile din `<SafeAreaProvider>`, iar dacă providerul nu este inițializat, returnează automat `StatusBar.currentHeight` (Android) sau `44` (iOS).
4. **Comutatorul Global și Selectorul la Pornire**:
   - Starea `uiParadigm` (`'CLASSIC_V2' | 'NOTHING_MINIMAL' | 'RETRO_AUDI_96' | 'F1_CYBERDECK' | 'SPATIAL_CANVAS'`) este stocată în [`AppContext.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/context/AppContext.js) și persistată în `AsyncStorage`.
   - Modalul [`ExperienceLauncherModal.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/components/ExperienceLauncherModal.js) permite schimbarea stilului oricând prin butonul dedicat `[ 🎨 STIL ]`.
5. **Telecomandă de Simulare Live direct din Telefon** ([`CloudSimulatorModal.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/components/CloudSimulatorModal.js)):
   - Butonul `[ 🎮 DEMO ]` este montat uniform pe toate stilurile și declanșează 7 scenarii reale de avarie în motorul fizic (`normal`, `fault_turbo`, `mountain_brakes`, `black_ice`, `dpf_regen`, `diesel_runaway`, `worn_injectors`).

---

## 3. Analiza Detaliată a Celor 5 Paradigme Vizuale

---

### Stilul 1: `CLASSIC_V2` (Centrul de Comandă Diagnostic — 12 Taburi)
* **Fișiere principale**: [`App.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/App.js), [`LiveDashboardScreen.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/screens/LiveDashboardScreen.js), [`StatusScreen.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/screens/StatusScreen.js)
* **Concept & Filozofie**: Hub profesional de laborator auto și diagnoză de atelier. Prioritizează exhaustivitatea datelor, ceasurile rotunde analogic-digitale, istoricul grafic și analiza avariilor OBD-II.
* **Elemente Vizuale & Interactive Cheie**:
  - **Selector Persona**: Comutator instant între *Mod Rapid* (panou esențial șofer) și *Mod Pro* (afișaj extins cu toți senzorii VAG).
  - **4 Geometrii de Cockpit Selectabile**: `AUDI_RS`, `TESLA_MINIMAL`, `NIGHT_HUD` (cu mod oglindire parbriz `scaleX: -1`), `MOTORSPORT`.
  - **Osciloscop Dual-Channel**: Comparare live pe aceeași axă de timp (ex: Presiune Turbo Cerută vs Măsurată).
  - **Fuziune Senzorială (Observatori Virtuali)**: Fișă tehnică detaliată la atingerea oricărui senzor cu toleranțe OEM, formule matematice și asistent AI integrat.
  - **Antet Unificat**: Conține butoanele tactile `[ 🎮 DEMO ]` și `[ 🎨 STIL ]`.

---

### Stilul 2: `NOTHING_MINIMAL` (Calm Tech & Puncte Dot-Matrix)
* **Fișier principal**: [`MinimalNothingParadigm.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/screens/paradigms/MinimalNothingParadigm.js)
* **Concept & Filozofie**: Inspirat de Teenage Engineering și Nothing OS. „Design prin absență” — elimină orice element nenecesar, afișând doar datele vitale fără a distrage atenția de la drum.
* **Elemente Vizuale & Interactive Cheie**:
  - **OLED True Black (`#000000`)**: Pixelii negri sunt 100% stinși pe panouri OLED, reducând consumul de baterie sub 2%/oră.
  - **Glyph Interface Matrix**: O bară de 7 LED-uri albe Nothing plasată în partea de sus care luminează proporțional cu RPM-ul și accelerația (ultimul LED devine roșu la turație maximă).
  - **Vitezometru Monumental 88px**: Cu cifre tabulare îngroșate și indicator de treaptă în capsulă minimalistă.
  - **Ritm Termic Bio-Mecanic (Linie ECG)**: Traseu dinamic SVG generat procedural în funcție de ritmul termic al motorului și presiunea boost.
  - **Modul „Ghost Drive” (`[ GHOST ]`)**: Când mașina merge constant sau staționează fără alerte, interfața se estompează la 8% opacitate; se reaprinde instantaneu la accelerare sau erori.
  - **Oglindire Parbriz HUD (`[ 🪞 HUD ]`)**: Inversează ecranul pe orizontală (`scaleX: -1`) pentru așezarea telefonului pe bord noaptea.
  - **Bandă Perforată de Combustibil**: 10 puncte dot-matrix care se golesc proporțional cu litrii din rezervor.
  - **The Red Pill Alert**: Alertă Nothing Red (`#D71920`) cu animație de pulsare ciclică și tap-to-expand pentru explicația defecțiunii.
  - **Jog-Wheel Selector Inferior (01 .. 05)**: Comutare rapidă între Vitals, EGT/Termic, G-Force, RUL Weibull și Eficiență Eco.

---

### Stilul 3: `RETRO_AUDI_96` (Audi A6 C4 1996 Digifiz VFD)
* **Fișier principal**: [`RetroAudi96Paradigm.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/screens/paradigms/RetroAudi96Paradigm.js)
* **Concept & Filozofie**: Omagiu adus erei de aur a ingineriei germane Audi/VDO din anii '90. Simulează un panou electronic fluorescent în vid (VFD) chihlimbar/portocaliu, cu textură de sticlă fumurie și mecanică analogică.
* **Elemente Vizuale & Interactive Cheie**:
  - **Segmente Stinse VFD („Ghost Segments”)**: Segmentele numerice inactive sunt vizibile cu o opacitate fină de `0.07`, reproducând exact fizica panourilor VFD stinse.
  - **Turometru Stepped 25 Blocuri LED**: Scară diagonală gradată cu zone verde (`0-14`), chihlimbar (`15-20`) și roșu (`21-24`).
  - **Reostat de Luminozitate Zi/Noapte (`☀️ TAG` / `🌙 NACHT`)**: Ajustează luminozitatea de la portocaliu incandescent la chihlimbar discret de noapte.
  - **Odometru Mecanic Animat cu Tamburi**: Afișează kilometrajul total și trip-ul în casete negre cu cifre albe în relief.
  - **Butoane Ciupercă Audi C4 (Push-Pins)**: Butonul stânga resetează contorul de trip la `0.0`, butonul dreapta schimbă modurile bordcomputer-ului.
  - **Audi Autocheck System**: La pornire rulează o secvență automată de autodiagnoză pe 3 trepte (`BREMSE` $\rightarrow$ `ÖLDRUCK` $\rightarrow$ `OK`).
  - **Ceas Digital Quartz LCD & Martor Fulg de Nea (❄️)**: Ceas 24h și avertizare automată de polei la temperaturi sub 3°C.
  - **Coloane Verticale LED VFD**: Indicatori pe 10 segmente pentru `KÜHLMITTEL` (antigel), `ÖL-TEMP`, `LADEDRUCK` (boost) și `KRAFTSTOFF` (combustibil).

---

### Stilul 4: `F1_CYBERDECK` (Telemetrie de Competiție Zero-Scroll)
* **Fișier principal**: [`F1CyberdeckParadigm.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/screens/paradigms/F1CyberdeckParadigm.js)
* **Concept & Filozofie**: Consolă hiper-densă de pilotaj și telemetrie pitwall (WEC / Formula 1 / Hypercar). Zero-scroll strict (`flex: 1` pe un singur ecran), accente neon cibernetice (`#00F0FF`, `#00FF66`, `#FFB800`, `#FF2A2A`), borduri tăiate și densitate maximă de informație.
* **Elemente Vizuale & Interactive Cheie**:
  - **Bara Superioară Aerisită cu Safe Insets**: Butoane cu tap-target de 44px (`[ 🎮 DEMO ]`, `[ ⮌ CLASIC ]`, `[ 🎨 STIL ]` evidențiat în galben).
  - **15-LED Shift Light Bar F1**: Secvență verde $\rightarrow$ galben $\rightarrow$ roșu $\rightarrow$ albastru flash la 4500 RPM însoțită de impuls haptic dublu.
  - **Selector Mod Sesiune (`RACE` / `QUAL` / `PIT`)**: Schimbă paleta și prioritățile de afișare.
  - **Grilă de 6 Micro-Monitoare Active Simultan**:
    1. *M1 — Nucleu Telemetrie & G-Radar*: Treaptă `[D3]` de 22px, viteză mare, turație și radar vectorial 2D cu cercul de aderență Kamm.
    2. *M2 — Osciloscop Dual-Channel*: Curbe SVG live pentru Boost Bar (cyan continuu) și RPM (galben punctat).
    3. *M3 — Matrice Termică Engine DNA (3x3)*: 9 celule termice și electrice cu colorare dinamică (verde/roșu).
    4. *M4 — Balanță Sankey & CHRA Turbo*: Bară tricoloră a fluxului de căldură utilă vs evacuare vs răcire + cronometru de răcire la ralanti pentru turbină.
    5. *M5 — Fiabilitate Weibull & RUL*: Kilometraj până la prima pană iminentă, probabilitate de defectare și ROI B2B (€/an economisiți).
    6. *M6 — Terminal Bosch UDS & Kalman*: Jurnal live stil consolă cu starea steady-state, încrederea diagnosticului și pachetele de telemetrie.
  - **Mecanism Decuplat „Tap-to-Maximize”**:
    - Atingerea corpului monitorului **NU** mai declanșează zoom accidental.
    - Maximizarea se activează exclusiv prin butonul dedicat **`[ ⤢ ]`** din colț.
    - Fereastra mărită conține un buton proeminent: **`◀ ÎNAPOI LA TOATE CELE 6 MONITOARE`**.

---

### Stilul 5: `SPATIAL_CANVAS` (Spațiu Tridimensional Interactiv — "Fix ca la Tesla")
* **Fișier principal**: [`SpatialCanvasParadigm.js`](file:///c:/Users/tfl/Desktop/telemetrie-licenta/app%20mobile/telemetrie-app/src/screens/paradigms/SpatialCanvasParadigm.js)
* **Concept & Filozofie**: Dublură digitală tridimensională a vehiculului (Digital Twin), inspirată de interfața Tesla Model S/Cybertruck și Apple CarPlay 2.0.
* **Elemente Vizuale & Interactive Cheie**:
  - **Motor Matematic Tridimensional Nativ**:
    - Elimină dependențele externe instabile (evitând erorile Metro legate de pachete ESM ca `three`).
    - Calculează în timp real proiecția perspectivă 3D a punctelor lumii reale pe ecranul 2D:
      $$x' = x \cos(\theta) - z \sin(\theta), \quad z' = x \sin(\theta) + z \cos(\theta)$$
      $$y'' = y \cos(\phi) - z' \sin(\phi), \quad z'' = y \sin(\phi) + z' \cos(\phi)$$
      $$X = X_{center} + \frac{x' \cdot d}{z'' + d_{cam}}, \quad Y = Y_{center} - \frac{y'' \cdot d}{z'' + d_{cam}}$$
  - **Control Trecere 360° prin Atingere (Orbit Control)**: `PanResponder` permite rotirea fluidă a mașinii cu degetul din orice unghi.
  - **Caroserie Volumetrică cu Shading Metalic PBR**: Capotă, parbriz transparent din sticlă cyan, plafon aerodinamic, lunetă și stopuri LED roșii.
  - **4 Roți 3D Active**: Se învârt la 60 FPS proporțional cu viteza vehiculului ($v$).
  - **Unghi de Virare**: Roțile din față virează pe orizontală conform forței G laterale.
  - **Shader Termic pe Frâne**: Discurile din spatele jantelor își schimbă culoarea din cyan (`#00F0FF`) în galben (`#FFB800`) și roșu incandescent (`#FF2A2A`) odată cu creșterea temperaturii calculate de observatorul de frânare.
  - **Fascicul de Faruri 3D Volumetric**: Proiectat înainte pe grila de perspectivă a solului.
  - **4 Camere Cinematic Pre-calibrate**: `1. GENERAL` (vedere 3/4), `2. MOTOR` (vedere capotă), `3. FRÂNE` (vedere roți și etrieri), `4. PILOT` (perspectivă din spate tip highway chase).
  - **Secvență Aprindere Cilindri (1-2-4-5-3)**: Monitorizare live a ciclului motorului de 5 cilindri.
  - **Sertare Holografice Inferioare (Glass Drawers)**: Casete tactile din sticlă pentru *Parametri Vitali*, *Frâne & Turbină*, *Fiabilitate Weibull*.

---

## 4. Provocări Tehnice Rezolvate în Această Versiune

| Problemă Raportată | Cauză Tehnică | Soluție Arhitecturală Implementată |
| :--- | :--- | :--- |
| **`Unable to resolve "three"` (Metro Error 500)** | Versiunea Three.js folosea `exports` ESM necompatibile nativ cu resolverul Metro din Expo Go. | Înlocuit cu un motor de proiecție 3D matematică peste `react-native-svg`. Zero erori de bundling, 60 FPS garantat pe orice telefon. |
| **`No safe area value available`** | `<SafeAreaProvider>` nu era montat la rădăcina arborelui în `App.js`. | Împachetat `AppRoot` în `<SafeAreaProvider>` și creat hook-ul de siguranță `useSafeInsets.js` cu fallback la `StatusBar.currentHeight`. |
| **Elemente suprapuse sub bara de stare (F1)** | Lipsa padding-ului de siguranță împotriva notch-ului și punch-hole-ului. | Aplicat `paddingTop: Math.max(insets.top, 24)` și reorganizat antetul în 2 rânduri curate. |
| **„Orice aș apăsa îmi apare aceeași fereastră”** | Întreaga celulă a fiecărui monitor din F1 avea `onPress` către modulul mărit. | Decuplat `onPress` de la corpul monitorului. Maximizarea se face acum doar prin butonul `[ ⤢ ]`, cu buton mare de întoarcere `◀ ÎNAPOI`. |
| **Comutare blocată între stiluri** | Crash-ul de compilare Metro îngheța aplicația pe ecranul vechi din cache. | Rezolvat bundling-ul, făcut butonul `[ 🎨 STIL ]` galben cu zonă de tap mărită (44px) și validat selectorul `ExperienceLauncherModal`. |

---

## 5. Ghid de Întrebări pentru AI-ul Consultat (Review Checklist)

Dacă transmiți această documentație unui AI sau specialist de Frontend pentru sfaturi, iată **întrebările cheie pe care merită să le adresezi**:

1. **Performanță & Micro-Optimizări la 60 FPS**:
   > *„În `SpatialCanvasParadigm.js` folosim proiecție matematică 3D recalculată în useMemo la rotire. Ar fi recomandată migrarea acestui canvas către `@shopify/react-native-skia` pentru a rula complet pe thread-ul GPU fără a atinge thread-ul JS?”*
2. **Ergonomie & Interacțiuni în Timpul Condusului**:
   > *„Având în vedere că aplicația este utilizată într-un suport auto la volan, ce îmbunătățiri de accesibilitate și dimensiuni optime ale butoanelor (hitSlop) recomanzi pentru modul `F1_CYBERDECK` și `NOTHING_MINIMAL`?”*
3. **Tranziții între Paradigme**:
   > *„În acest moment comutarea între stiluri se face prin montare/demontare condiționată în `App.js`. Cum am putea introduce o animație fluidă de tip cross-fade sau shared element transition fără a încărca memoria RAM cu mai multe stiluri active simultan?”*
4. **Sistem de Design Modular (Design Tokens)**:
   > *„Cum putem extinde registrul din `paradigmThemes.js` astfel încât utilizatorul să poată ajusta culorile de accent neon (ex: schimbarea din Cyan în Roșu Motorsport) fără a altera structura de bază a temei?”*
