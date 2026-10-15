---
tags:
  - licenta
  - telemetrie
  - cheat-sheet
  - deployment
  - expo
  - oracle-cloud
date: 2026-10-15
---

# 🚗 Telemetrie Licență — Ghid Rapid & Deployment

Ghid de readaptare rapidă pentru pornirea serverului, rularea aplicației în mod de dezvoltare, actualizarea codului și compilarea unui nou fișier `.apk`.

---

## 📌 1. Date Cheie de Conectare (Cheat Sheet)

| Resursă | Valoare / Detaliu |
|---|---|
| **Furnizor Cloud** | Oracle Cloud Infrastructure (OCI) — Instanță Ubuntu |
| **Adresă IP Server** | `84.235.164.52` |
| **Utilizator SSH** | `ubuntu` |
| **Cheie SSH pe laptop** | `C:\Users\tfl\.ssh\ssh-key-2026-07-17 (1).key` |
| **Port Backend REST & WS** | `3000` (`http://84.235.164.52:3000`) |
| **Broker MQTT Privat** | `84.235.164.52:1883` (Mosquitto pe Oracle Cloud VM) |
| **Bază de date activă** | `telemetrie_industriala.db` (SQLite) |

---

## 🖥️ 2. Conectare și Administrare Server Cloud (Oracle)

### 2.1. Conectare prin SSH
Deschide **PowerShell** sau **Command Prompt** pe laptop și rulează:

```powershell
ssh -i "C:\Users\tfl\.ssh\ssh-key-2026-07-17 (1).key" ubuntu@84.235.164.52
```

> [!TIP]
> Dacă vrei să te conectezi printr-un singur click în viitor, poți crea pe Desktop o scurtătură sau un fișier `connect.bat` cu comanda de mai sus.

### 2.2. Verificarea și Controlul Backend-ului pe Server
După ce te-ai conectat pe server:

```bash
# 1. Vezi dacă procesul rulează cu PM2 (managerul de procese)
pm2 list

# 2. Vezi log-urile în timp real (erori, cereri HTTP, conexiuni WebSocket)
pm2 logs

# 3. Repornește serverul după un update
pm2 restart all

# 4. Dacă serverul e oprit și vrei să-l pornești:
cd /home/ubuntu/App-for-me
pm2 start server.js --name "telemetrie"
pm2 save

# 5. Verifică dacă portul 3000 ascultă cereri:
sudo ss -tulpn | grep 3000
```

---

## 💻 3. Rulare Locală pe Laptop (Mod Dezvoltare & Testare)

Dacă vrei să lucrezi și să testezi modificările local pe PC, fără a atinge serverul din cloud:

### 3.1. Pornire Backend Local
În rădăcina proiectului (`c:\Users\tfl\Desktop\telemetrie-licenta`):
```powershell
# Pornește serverul Express & WebSocket pe localhost:3000
node server.js
```

### 3.2. Pornire Simulator OBD-II (Trimitere date de test)
Într-un terminal separat:
```powershell
# Emite pachete MQTT pe ciclul de condus Audi A6 C4
node simulator.js
```

> [!WARNING] Atenție la Topic-ul MQTT!
> Asigură-te că `simulator.js` și `handlers/mqttHandler.js` au același topic setat (ex: `licenta/audi_a6_c4/telemetrie` sau `telemetrie/obd2`), altfel backend-ul nu va procesa pachetele trimise de simulator.

---

## 📱 4. Aplicația Mobilă (React Native / Expo)

Folderul aplicației se află în: `app mobile/telemetrie-app/`.

### 4.1. Rulare în Mod Dezvoltare (Expo Go / Live Reload)
Pentru a modifica ecrane/componente și a vedea modificările instant pe telefon:

1. Asigură-te că telefonul și laptopul sunt în **aceeași rețea Wi-Fi**.
2. Deschide terminalul în folderul aplicației:
   ```powershell
   cd "c:\Users\tfl\Desktop\telemetrie-licenta\app mobile\telemetrie-app"
   npx expo start
   ```
3. Deschide aplicația **Expo Go** pe telefon și scanează codul QR apărut în terminal.
4. *Dacă ai erori de cache*: rulează `npx expo start -c` (șterge cache-ul Metro).

---

## 📦 5. Cum Compilezi un Fișier `.apk` Nou (EAS Build)

Proiectul este configurat cu **EAS (Expo Application Services)** prin fișierul `eas.json`.

### Pasul 1: Autentificare în contul Expo (dacă nu ești deja logat)
```powershell
cd "c:\Users\tfl\Desktop\telemetrie-licenta\app mobile\telemetrie-app"
npx eas login
```

### Pasul 2: Compilare APK Direct Instalabil
Rulează profilul `preview` (acesta generează un `.apk` standalone, gata de instalat pe orice telefon Android):

```powershell
npx eas build -p android --profile preview
```

### Pasul 3: Descărcare și Instalare
- Procesul de compilare rulează pe serverele cloud Expo (durează aproximativ 5–10 minute).
- La final, în consolă primești un **link direct de descărcare** și un **cod QR**.
- Deschizi link-ul de pe telefon, descarci fișierul `.apk` și îl instalezi direct peste versiunea veche.

> [!NOTE]
> În fișierul `src/utils/config.js`, adresa de server pentru Android este deja setată pe `http://84.235.164.52:3000`. Astfel, APK-ul nou compilat va ști automat să comunice direct cu instanța ta Oracle Cloud.

---

## 🔄 6. Fluxul Complet de Actualizare (Workflow după o pauză lungă)

### Scenariul A: Ai modificat Backend-ul (Node.js / Reguli / Bază de Date)
- [ ] 1. Testezi modificările local pe laptop (`node server.js`).
- [ ] 2. Salvezi modificările în Git:
  ```powershell
  git add .
  git commit -m "Descrierea modificarilor"
  git push origin main
  ```
- [ ] 3. Te conectezi prin SSH la serverul Oracle:
  ```powershell
  ssh -i "C:\Users\tfl\.ssh\ssh-key-2026-07-17 (1).key" ubuntu@84.235.164.52
  ```
- [ ] 4. Actualizezi codul pe server și repornești procesul în siguranță:
  ```bash
  cd /home/ubuntu/App-for-me
  git reset --hard HEAD
  git pull origin main
  npm rebuild sqlite3
  node scripts/seed_golden_demo.js
  pm2 restart all
  pm2 logs telemetrie --lines 20
  ```

---

### Scenariul B: Ai modificat Aplicația Mobilă (UI / Ecrane / Logica Frontend)
- [ ] 1. Testezi modificările pe telefon prin `npx expo start`.
- [ ] 2. Salvezi codul în Git (`git commit` și `git push`).
- [ ] 3. Generezi noul `.apk`:
  ```powershell
  cd "app mobile/telemetrie-app"
  npx eas build -p android --profile preview
  ```
- [ ] 4. Scanezi codul QR generat la final cu camera telefonului și instalezi noul APK.

---

## 🛠️ 7. Depanare Rapidă (Troubleshooting)

- **Aplicația pe telefon spune "Nu se poate conecta la server"**:
  1. Verifică dacă instanța Oracle Cloud este pornită din consola web Oracle.
  2. Conectează-te prin SSH și rulează `pm2 list` (asigură-te că statusul este `online`).
  3. Verifică dacă IP-ul serverului nu s-a schimbat (dacă instanța a fost oprită/repornită fără IP static rezervat).
- **Eroare la `eas build`**:
  - Asigură-te că ești logat cu `npx eas login`.
  - Verifică `eas whoami` pentru a vedea dacă sesiunea e validă.
- **Porturile 3000 (Backend API/WS) sau 1883 (Mosquitto MQTT) blocate**:
  - În Oracle Cloud, verifică **Security List** (Ingress Rules) pentru Virtual Cloud Network (VCN): porturile `3000` (TCP) și `1883` (TCP) trebuie să aibă reguli Ingress deschise pentru `0.0.0.0/0`.
  - Pe instanța Ubuntu, verifică dacă firewall-ul permite traficul: `sudo iptables -L INPUT -n -v | grep 1883` (sau `sudo ufw status`). Dacă portul 1883 este blocat sau nu are regula de Ingress deschisă în Oracle Cloud, ESP32 și simulatorul de pe laptop nu se vor putea conecta la broker.

---

## 🎯 8. Comenzi Rapide pentru Susținerea Licenței (Live Demo)

### 8.1. Simulare accelerată (10 minute comprimate în 20 secunde)
În rădăcina proiectului (`c:\Users\tfl\Desktop\telemetrie-licenta`):

```powershell
# Cursa normală accelerată (15-30 secunde)
node simulator.js --duration 600 --speed 20 --scenario default

# Scenariu 1: Defect Turbină (underboost / N75) -> declanșează diagnosticul AI
node simulator.js --duration 300 --speed 15 --scenario fault_turbo

# Scenariu 2: Supraîncălzire Sistem Răcire (108°C) -> declanșează alerte critice
node simulator.js --duration 300 --speed 15 --scenario fault_cooling

# Scenariu 3: Defect Alternator (subîncărcare < 13.2V)
node simulator.js --duration 300 --speed 15 --scenario fault_alternator

# Scenariu 4: Condus Agresiv (frânări bruște ABS, kickdown, depășire viteză)
node simulator.js --duration 300 --speed 15 --scenario aggressive
```

### 8.2. Generare instantă Raport PDF (pentru ultima cursă)

```powershell
node scripts/export_pdf.js
```

*(Generează automat fișierul `raport_cursa_<id>.pdf` în proiect, gata de deschis pe ecran în fața comisiei).*
