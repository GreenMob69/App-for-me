# Project Bible — OBD-II Vehicle Telemetry Platform

## Ce este proiectul

Sistem complet de telemetrie auto, construit ca lucrare de licență. Preia date OBD-II în timp real de la un Audi A6 C4 2.5 TDI, le analizează cu un pipeline multi-nivel și le prezintă pe o aplicație mobilă React Native.

Proiectul demonstrează că un telefon mobil cu aplicație dedicată poate înlocui un scaner OBD profesional pentru uz zilnic, adăugând analize pe care scanerele standard nu le oferă: predicție defecțiuni, baseline adaptiv per vehicul, corelații inter-senzor și rapoarte inteligente de cursă.

## Vehiculul țintă

- **Model**: Audi A6 C4, 2.5 TDI V6 (motor AEL)
- **VIN**: `WAUZZZ4A1RN000000`
- **ECU**: Bosch EDC15M+ (protocol KWP1281 / SAE J1979)
- **Combustibil**: diesel, preț referință 7,5 RON/L
- **Emisii CO2**: 2,68 kg CO2/L motorină (factor standard)

Codul este scris pentru acest vehicul specific. Parametrii pot fi adaptați pentru alte mașini prin `backend/analyzers/config.js` (praguri) și `FIELD_MAP` (mapare PID-uri).

## Scopul aplicației

1. **Monitorizare live**: 90+ parametri OBD-II/VAG în timp real, cu osciloscop
2. **Raport de cursă**: la fiecare oprire — scor sănătate, stil de condus, consum, CO2, cost
3. **Sănătate vehicul**: dashboard cu subsisteme, predicții defecțiuni, evoluție în timp
4. **Asistent inteligent**: ecranul "Stare" — un singur verdict în limbaj natural, fără numere brute
5. **Logbook**: arhivă curse cu filtre, rapoarte lunare, etichete (personal/serviciu/testare)
6. **Profil vehicul**: istoric service, mentenanță predictivă, timeline evenimente, milestone-uri

## Principii de design

### Backend
- **Separare de responsabilitate strictă**: `backend.js` gestionează doar MQTT, DB și API. Toată analiza stă în `backend/analyzers/`, `backend/diagnostics/`, `backend/intelligence/`.
- **Un singur punct de configurare**: toate pragurile reglabile (`HARD_BRAKE_G`, `OVERSPEED_KMH`, prețul motorinei etc.) sunt în `backend/analyzers/config.js`. Nicio valoare "magică" împrăștiată în cod.
- **Pipeline la oprire, nu în timp real**: `finalizeTripAnalysis()` rulează o singură dată la `OPRIRE` cu toate datele brute. În timpul cursei, `updateAnalyzer()` face doar acumulare ieftină.
- **Debouncing evenimente**: un eveniment (frânare bruscă, accelerare) se numără o singură dată per "front crescător", nu la fiecare pachet cât timp condiția e activă.

### Frontend
- **MessageEngine ca voce unică**: tot textul user-facing trece prin `MessageEngine.js`. Niciun string hardcodat în componente.
- **Health Score e intern**: scorul numeric 0-100 nu apare ca informație primară. Utilizatorul vede un verdict ("Mașina ta e în formă excelentă"), nu un număr.
- **Context specializat**: LiveContext, AlertContext și AppContext au responsabilități disjuncte. Nu există un "god context".
- **Ring buffer pentru grafice**: istoricul de 600 de puncte (10 minute) e stocat ca array circular cu index de scriere, fără copiere la fiecare secundă.
- **Cache offline**: VehicleHealthScreen cachează ultimele date în AsyncStorage și le afișează instant la deschidere, chiar dacă serverul nu răspunde.

## Stack tehnologic

| Componenta | Tehnologie |
|---|---|
| Backend server | Node.js, Express 5 |
| Bază de date | SQLite 3 (un singur fișier `.db`) |
| Transport telemetrie | MQTT (broker public `broker.emqx.io`) |
| Transport app → server | HTTP REST + WebSocket (Socket.IO 4) |
| Aplicație mobilă | React Native 0.81, Expo 54 |
| Navigare | React Navigation 7 (bottom tabs + native stack) |
| Grafice | react-native-gifted-charts (LineChart, BarChart) |
| Gauge-uri | SVG custom (CircularGauge, HealthGauge) |
| State management | React Context API (fără Redux) |
| Stocare locală | AsyncStorage |
| Internalizare | Custom i18n (română, fișier `ro.js`) |

## Terminologie

| Termen | Definiție |
|---|---|
| **Pachet MQTT** | JSON cu ~90 parametri publicat pe topic-ul `licenta/audi_a6_c4/telemetrie` la fiecare secundă |
| **Cursă / Trip** | Sesiune de la `PORNIRE` la `OPRIRE`. ID unic în tabelul `calatorii`. |
| **Health Score** | Scor 0-100 calculat la finalul cursei: Engine 35% + Safety 25% + Driving 20% + Fuel 20% |
| **Eco Score** | Scor live 0-100, calculat simplu din penalizări (accelerări/frânări bruște). Nu e același cu Health Score. |
| **VehicleDNA** | Amprenta de sănătate a vehiculului: scoruri per subsistem + stare corelații, actualizată la fiecare cursă |
| **Baseline** | Media mobilă per VIN a parametrilor-cheie (RPM, MAF, boost, voltaj, coolant). Folosită pentru detectarea deviațiilor față de "normalul" vehiculului. |
| **Prediction** | Probabilitate 0-95% că o componentă se va defecta în viitor, calculată de `FaultPredictionEngine`. Nu e o diagnoză de defect existent. |
| **DTC** | Diagnostic Trouble Code — cod eroare OBD (ex: P0101). Lista activă e hardcodată în `eroriActiveDTC` din `backend.js` pentru demonstrație. |
| **PID** | Parameter ID — orice valoare măsurată (RPM, temperaturi, presiuni etc.) |
| **Debounce (event)** | Mecanism prin care un eveniment (frânare bruscă) se numără o singură dată per tranziție de la inactiv la activ, nu o dată per pachet |

## Structura proiectului

```
telemetrie-licenta/
├── backend.js                    # Server principal
├── simulator.js                  # Simulator 90+ PID-uri OBD
├── package.json                  # Dependențe Node.js
├── telemetrie_industriala.db     # Baza de date SQLite (runtime)
│
├── backend/
│   ├── analyzers/                # Pipeline analiză cursă (Nivel 3-5)
│   ├── diagnostics/              # Motor diagnostic bazat pe reguli
│   ├── intelligence/             # Analize avansate (baseline, predicții, corelații)
│   ├── knowledge/                # Baza de cunoștințe (rules.json)
│   └── vehicle-profile/          # Profil vehicul, service, mentenanță
│
└── app mobile/telemetrie-app/
    ├── App.js                    # Punct de intrare, onboarding, navigare root
    ├── src/
    │   ├── screens/              # 8 ecrane
    │   ├── components/           # Componente UI reutilizabile
    │   ├── context/              # AppContext, LiveContext, AlertContext
    │   ├── engine/               # MessageEngine (vocea aplicației)
    │   ├── mappers/              # statusMapper (date brute → model UI)
    │   ├── services/             # api.js, socket.js, vehicleService.js
    │   ├── utils/                # config.js (URL server, VIN), formatters.js
    │   └── i18n/                 # Traduceri română
    └── package.json
```

## Constrângeri cunoscute

1. **Vehicul unic**: codul suportă un singur VIN pe sesiune MQTT. Logica multi-vehicul există în DB (FK pe VIN) dar UI-ul e hardcodat pentru Audi A6.
2. **Broker MQTT public**: `broker.emqx.io` — nu există autentificare. Orice client poate publica pe topic.
3. **DTC hardcodate**: lista de erori DTC activă (`eroriActiveDTC` în `backend.js`) e statică. Stergerea funcționează, dar nu există integrare reală cu ECU pentru actualizare dinamică.
4. **SQLite single-file**: nu suportă concurență mare. Potrivit pentru un singur utilizator/dispozitiv.
5. **Baseline pornit de la zero**: la prima cursă nu există baseline. `FaultPredictionEngine` funcționează degradat (fără deviații față de normal) până la ~5 curse acumulate.
6. **Prețul motorinei**: hardcodat la 7,5 RON/L în `config.js`. Trebuie actualizat manual.
