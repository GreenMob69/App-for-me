# PROJECT CONTEXT & ARCHITECTURE BIBLE FOR AI ASSISTANTS (VERSION 1 - INITIAL)

> **Document Type**: Master Technical Specification & Architecture Blueprint — Initial Revision (v1)
> **Archived Date**: 15 Octombrie 2026
> **Status**: Arhivat (Pre-Audit) — Vezi `AI_MASTER_CONTEXT_v2.md` sau `AI_MASTER_CONTEXT.md` pentru versiunea curentă corectată.

---

## 1. Executive Summary & Purpose

- **Project Name**: `telemetrie-licenta` (Automotive Telemetry, Diagnostics & Predictive Maintenance Platform).
- **Type**: Bachelor’s Thesis Project (*Lucrare de Licență*).
- **Core Vehicle (Original Draft)**: Audi A6 C4, 2.5 TDI V6 (Engine code: `AEL`, Bosch EDC15M+ ECU, KWP1281 / SAE J1979 protocol, VIN: `WAUZZZ4A1RN000000`). *(Notă istorică: în v2 s-a corectat că AEL este R5 5 cilindri în linie și s-a nuanțat diagnoza K-Line vs simulare universală).*
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
| **Telemetry Transport** | MQTT 5 (`mqtt ^5.15.2`), Public broker: `mqtt://broker.emqx.io:1883` | Default topic: `telemetrie/obd2` (Simulator: `licenta/audi_a6_c4/telemetrie`) |
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
│        │   MQTT Broker (broker.emqx.io:1883) <──────────────┘                   │
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

*(Versiunea v1 s-a oprit aici fără schemele detaliate JSON și fără regulile de dualitate a bazei de date. Pentru arhitectura completă și schemele de payload, consultați `AI_MASTER_CONTEXT_v2.md`).*
