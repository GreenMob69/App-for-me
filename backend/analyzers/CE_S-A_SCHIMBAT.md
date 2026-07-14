# Ce s-a schimbat în backend.js

`backend.js` e **modificat direct**, nu doar completat cu fișiere noi:
MQTT, SQLite, websocket, endpoint-urile existente — neatinse. Diferența:

1. **La PORNIRE**: în loc de ~20 câmpuri (`maxRPM`, `sumRPM`, `maxCoolant`, `hardBrakes`...), acum e un singur `trip.analysis = createAnalysis()`.
2. **La MERS**: tot blocul vechi de `Math.max(...)`/`sum += ...` e înlocuit cu un singur `updateAnalyzer(trip, pachet)`.
3. **La OPRIRE**: se calculează `finalizeTripAnalysis(trip)` și se salvează în `trip_summary` — tabelul care exista deja în schema ta de SQLite, dar în care nu se scria niciodată nimic. Am adăugat și o coloană `raport_ai_json` (cu migrare `ALTER TABLE` sigură, dacă ai deja `telemetrie_industriala.db` creat).
4. **Endpoint nou**: `GET /api/calatorii/:id/analiza` — întoarce rândul din `trip_summary` + obiectul AI decodat din JSON.

## Mapare cerințe → cod

| Cerința ta | Unde e implementată |
|---|---|
| 1. Stil de condus | `TripAnalyzer.js` → `drivingStyle.*` (smooth/constant/highRPM/highLoad + economic/agresiv) |
| 2. Zone RPM | `TripAnalyzer.js` → `rpmZones.*`, expuse ca procente în `TripSummary.js` |
| 3. Turbo | `THRESHOLD_CONFIG` (boost >1 bar, >1.5 bar) + PID generic pentru medie |
| 4. Temperaturi | `THRESHOLD_CONFIG` (coolant >90/95/100) |
| 5. Voltaj | sistemul generic de PID-uri (`pid.voltage.min/max/average`) |
| 6. Consum | `updateFuel()` — separat relanti vs. în mișcare |
| 7. AI Score | `HealthEngine.js` — Engine/Fuel/Driving/Safety + Overall Health |
| 8. Comportamente | `detectEvent()` — kickdown, accel/frânare bruscă, decelerare rapidă, overspeed (debounced, nu se numără de N ori pentru un eveniment susținut) |
| 9. KPI-uri | `longestIdleSeconds`, `longestFullLoadSeconds`, `highestTorque/MAF/Load` |
| 10. AI Ready | `buildAIReport()` — structura exactă cerută (`engine/cooling/turbo/fuel/battery/driving`), salvată în `trip_summary.raport_ai_json`, nefolosită încă |
| Orice PID cu min/max/medie | `PID_CONFIG`, generat automat din `FIELD_MAP` în `config.js` |
| Arhitectură separată | `backend/analyzers/` — `backend.js` nu mai are logică de analiză, doar MQTT/API/DB |

## Dacă un câmp din pachetul tău real diferă

Tot ce ține de "unde vine valoarea X în pachetul MQTT" e într-un singur loc:
`backend/analyzers/config.js` → `FIELD_MAP`. Am folosit exact structura din
`backend.js`-ul tău (`motor.rpm`, `temperaturi.coolant`, `aer.boost_actual`,
`baterie.ecu_volt`, `combustibil.inst_cons`, `dpf.soot_load`). Dacă simulatorul
tău trimite alt nume pentru vreunul, schimbi doar acolo.

**Notă:** nu am găsit un câmp separat de poziție-pedală (throttle/TPS) în
pachetul tău — am folosit `motor.load` ca proxy pentru kickdown și "full
throttle". Dacă ai/adaugi un PID de throttle real, schimbă în `config.js`
(`KICKDOWN_LOAD_PCT` → folosește noul PID) — o singură linie.

## Cum testezi rapid, fără MQTT

```bash
node backend/analyzers/demo.js
```

Rulează o cursă simulată și afișează exact obiectul `{ summary, health, ai }`
care se salvează la finalul unei curse reale.

## Ce NU am construit acum (rămâne pentru etapele următoare, cum ai planificat tu)

- Motorul de reguli (cele ~100 reguli, ex. "MAF mic + RPM mare + MAP mic = filtru aer")
- Rapoarte PDF/Excel, Smart Search, Tagging
- Trimiterea efectivă a `raport_ai_json` către GPT

`THRESHOLD_CONFIG` din `config.js` e deja generic (prag pe orice PID), deci
motorul de reguli se poate construi direct peste el, fără să reia treaba.
