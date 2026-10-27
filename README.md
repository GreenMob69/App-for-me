# 🚗 SISTEM DE TELEMETRIE OBD2 & DIGITAL TWIN 3D (V3 NEXT-GEN)
## 📋 Ghid Complet de Restaurare după Reinstalarea de Windows (Dependențe, SSH, Bază de Date, Modele 3D & Rețea)

> **IMPORTANT**: Citește această secțiune **ÎNAINTE** de a formata calculatorul! Anumite fișiere critice sunt ignorate intenționat de Git (`.gitignore`) pentru securitate și dimensiune și **NU se află pe GitHub**. Dacă nu le salvezi pe un stick USB / hard extern, le vei pierde definitiv!

---

## 🛑 PASUL 0: Ce TREBUIE să Salvezi pe un Stick USB ÎNAINTE de Formatare!

Copiază pe un stick USB extern următoarele 4 elemente cheie:

```
📁 STICK_USB_BACKUP/
├── 📁 .ssh/                                  <-- Cheile SSH (Oracle Cloud VM & GitHub)
│   ├── oracle-cloud/
│   │   ├── ssh-key-2026-07-17.key           <-- Cheia privată pentru serverul 84.235.164.52
│   │   └── README.txt
│   ├── known_hosts
│   └── (orice altă cheie privată id_rsa/id_ed25519)
│
├── 📄 .env                                    <-- Variabilele de mediu backend (GROQ API key, token-uri)
│   (Calea: telemetrie-licenta/.env)
│
├── 🗄️ telemetrie_industriala.db               <-- Baza de date SQLite (20 MB) cu toate cursele & vehiculele
│   (Calea: telemetrie-licenta/telemetrie_industriala.db)
│   *(Include și telemetrie_industriala.db-wal / telemetrie_industriala.db-shm dacă există)*
│
├── 🚘 models/                                 <-- Modelele 3D GLB (~120 MB) pentru Digital Twin WebGL
│   (Calea: telemetrie-licenta/app mobile/telemetrie-app/assets/models/)
│   ├── acura_cdx_2016__realistic_3d_car_model.glb
│   ├── acura_cdx_car.glb
│   ├── turbo.glb, car_disc_brake.glb, bosch_car_battery.glb etc.
│   └── parts/ (toate subcomponentele)
│
└── 📁 telemetrie-licenta/ (Întreg proiectul - fără folderul `node_modules` pentru viteză)
```

---

## 🛠️ PASUL 1: Instalare Programe & Medii de Rulare pe Noul Windows

După ce ai instalat un Windows proaspăt, instalează următoarele softuri:

### 1.1. Programe de Bază (Runas Administrator sau via Winget)
Poți deschide **PowerShell ca Administrator** și rula:

```powershell
# 1. Git for Windows
winget install --id Git.Git -e --source winget

# 2. Node.js LTS (Recomandat v20.x sau v22.x / v24.x)
winget install OpenJS.NodeJS.LTS

# 3. Python 3.11 sau 3.12 (necesar pentru compilarea modulelor native C/C++ precum sqlite3)
winget install Python.Python.3.11

# 4. VS Code
winget install Microsoft.VisualStudioCode

# 5. Java JDK 17 (opțional, dar recomandat dacă faci build native Android în viitor)
winget install EclipseAdoptium.Temurin.17.JDK
```

> ⚠️ **ATENȚIE la instalarea Python**: Bifează obligatoriu căsuța **"Add python.exe to PATH"**!

### 1.2. Pachete Globale NPM Necesare
După instalarea Node.js, deschide un terminal nou (PowerShell) și rulează:

```powershell
npm install -g eas-cli pm2 @gltf-transform/cli
```
* **`eas-cli`**: Utilizat pentru crearea de build-uri APK pe cloud Expo EAS.
* **`pm2`**: Utilizat pentru menținerea backend-ului pornit ca serviciu.
* **`@gltf-transform/cli`**: Utilizat pentru optimizarea texturilor și comprimarea modelelor 3D `.glb`.

---

## 🔑 PASUL 2: Restaurarea Cheilor SSH & Conectarea la Oracle Cloud

### 2.1. Copierea Cheilor SSH
1. Mergi în folderul tău de utilizator: `C:\Users\<NumeleTauUtilizator>\`
2. Dacă folderul `.ssh` nu există, creează-l.
3. Copiază folderul `oracle-cloud` și fișierele din backup-ul tău în `C:\Users\<NumeleTauUtilizator>\.ssh\`.

### 2.2. Reparare Permisiuni Cheie Privată pe Windows (Evită eroarea `UNPROTECTED PRIVATE KEY FILE`)
În PowerShell, navighează în folderul `.ssh\oracle-cloud` și rulează:

```powershell
cd "$HOME\.ssh\oracle-cloud"

# Resetare permisiuni și acordare drepturi exclusive utilizatorului tău:
icacls "ssh-key-2026-07-17.key" /inheritance:r
icacls "ssh-key-2026-07-17.key" /grant:r "$($env:USERNAME):(R)"
```

### 2.3. Test Conexiune SSH la Serverul din Cloud (Oracle VM)
Serverul tău de producție rulează pe IP-ul `84.235.164.52`. Conectează-te cu:

```powershell
ssh -i "$HOME\.ssh\oracle-cloud\ssh-key-2026-07-17.key" ubuntu@84.235.164.52
```

Odată conectat pe serverul Ubuntu, poți verifica statusul serviciilor:
```bash
# 1. Verifică brokerul MQTT Mosquitto:
sudo systemctl status mosquitto

# 2. Verifică backend-ul PM2 (dacă rulează instanța cloud):
pm2 status
```

---

## 💻 PASUL 3: Configurare Git & Clonare / Restaurare Proiect

### 3.1. Setare Identitate Git
```powershell
git config --global user.name "GreenMob"
git config --global user.email "bithit2004@gmail.com"
git config --global core.autocrlf true
```

### 3.2. Restaurare Proiect
Dacă ai salvat folderul complet de pe stick, copiază-l pe Desktop:
`C:\Users\<NumeleTauUtilizator>\Desktop\telemetrie-licenta`

Sau dacă vrei să-l clonezi de pe GitHub:
```powershell
cd "$HOME\Desktop"
git clone -b v3-next-gen https://github.com/GreenMob69/App-for-me.git telemetrie-licenta
cd telemetrie-licenta
```

### 3.3. Readucerea Fișierelor Ignorate din Backup
Copiază din backup-ul de pe stick:
1. Copiază fișierul `.env` în rădăcina `telemetrie-licenta\.env`.
2. Copiază fișierul `telemetrie_industriala.db` în rădăcina `telemetrie-licenta\`.
3. Copiază modelele `.glb` în `telemetrie-licenta\app mobile\telemetrie-app\assets\models\`.

Conținutul fișierului `.env` de referință (folosește cheile tale reale salvate pe stick):
```env
GROQ_API_KEY=gsk_your_groq_api_key_here_din_backup
PORT=3000
DB_PATH=./telemetrie_industriala.db
MQTT_BROKER_URL=mqtt://84.235.164.52:1883
MQTT_TOPIC=telemetrie/obd2
DEVICE_SYNC_TOKEN=telemetrie_esp32_sync_secret_2026
```

---

## 📦 PASUL 4: Instalare Dependențe (NPM Install)

Sistemul este împărțit în două proiecte Node.js independente: **Backend** (rădăcină) și **Frontend Mobil** (`app mobile/telemetrie-app`).

### 4.1. Instalare Dependențe Backend (Root)
Deschide terminalul în rădăcina proiectului:
```powershell
cd C:\Users\<NumeleTauUtilizator>\Desktop\telemetrie-licenta
npm install
```
*Instalează: Express, Socket.IO, MQTT, SQLite3, Groq-SDK (Llama 3 AI), PDFKit, CORS, Dotenv.*

### 4.2. Instalare Dependențe Aplicație Mobilă (Expo / React Native)
```powershell
cd "app mobile/telemetrie-app"
npm install
```
> 💡 **Notă**: Comanda va rula automat scriptul de `postinstall` (`node scripts/patch-expo-notifications.js`), care aplică patch-ul necesar pentru compatibilitatea `expo-notifications` în Expo Go SDK 57!

---

## 🌐 PASUL 5: Configurare Firewall Windows (Esențial pentru Telefon Mobil)

Când pornești serverul pe laptop, telefonul tău mobil trebuie să se poată conecta prin Wi-Fi la IP-ul laptopului (pe portul `3000` pentru REST/WebSocket și portul `8081` pentru Metro Bundler).

1. **Setează Rețeaua Wi-Fi ca „Private”**:
   - Mergi în Windows la *Settings -> Network & internet -> Wi-Fi -> (Numele Rețelei tale) -> Network profile type -> Bifează **Private***.
2. **Permite Node.js prin Firewall**:
   - Când pornești prima oară `node server.js` și `npx expo start`, va apărea fereastra Windows Defender Firewall: bifează ambele căsuțe (**Private networks** și **Public networks**) și apasă **Allow access**.
3. (Opțional) Deschide manual portul 3000 în PowerShell (Administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "Telemetrie Node Backend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "Expo Metro Bundler" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
   ```

---

## 🚀 PASUL 6: Cum Pornești Sistemul Complet

Pentru o sesiune completă de lucru sau demonstrație live, deschide **3 ferestre de terminal**:

### 🟢 Terminal 1: Backend Server (REST API, WebSocket & Servire 3D)
```powershell
cd C:\Users\<NumeleTauUtilizator>\Desktop\telemetrie-licenta
npm start
# sau: node server.js
```
*Serverul va asculta pe `http://localhost:3000` și pe IP-ul tău local (ex: `http://192.168.x.x:3000`).*
*Servește automat modelele 3D la `http://localhost:3000/models/acura_cdx.glb`.*

### 🟡 Terminal 2: Simulatorul de Telemetrie Live
```powershell
cd C:\Users\<NumeleTauUtilizator>\Desktop\telemetrie-licenta
node simulator.js
```
*Simulatorul se conectează la brokerul privat Mosquitto (`84.235.164.52:1883`) și emite profilul realist de condus (accelerații, temperaturi turbo/ulei, presiuni rail, forțe G, degradare DPF).*

### 🟣 Terminal 3: Aplicația Mobilă (Expo)
```powershell
cd "C:\Users\<NumeleTauUtilizator>\Desktop\telemetrie-licenta\app mobile\telemetrie-app"
npx expo start
```
* **Pe Telefon Fizic**: Asigură-te că telefonul este conectat pe **același Wi-Fi** cu laptopul. Deschide aplicația **Expo Go** pe Android/iOS și scanează codul QR din terminal.
* **Pe PC (Web Browser)**: Apasă tasta `w` în terminal pentru a deschide versiunea Web.

---

## 🖥️ Interfețe Web Suplimentare Disponibile în Browser

Cât timp Terminalul 1 (`server.js`) rulează, poți deschide direct în browserul de pe PC:

1. **Centru de Monitorizare Live & 3D Digital Twin**:
   👉 `http://localhost:3000/monitor`
   *(Model 3D fotorealist, telemetrie pe 32 de canale fizice, control scenarii avarie).*
2. **Dashboard Flotă / Fleet Overview**:
   👉 `http://localhost:3000/fleet`
3. **Documentație Arhitectură & Audit**:
   👉 Fisierele Markdown din rădăcină (`AI_MASTER_CONTEXT.md`, `DOCUMENTATIE_FRONTEND_MULTI_PARADIGMA_V3.md`).

---

## 🆘 Ghid de Depanare Rapidă (Troubleshooting)

| Problemă | Cauză probabilă | Soluție |
| :--- | :--- | :--- |
| **Telefonul nu se conectează la backend (`Network Error`)** | Laptopul și telefonul nu sunt pe același Wi-Fi, sau Firewall-ul Windows blochează portul 3000. | 1. Conectează ambele dispozitive la același Wi-Fi.<br>2. Verifică IP-ul laptopului cu `ipconfig`.<br>3. Oprește temporar firewall-ul sau adaugă regula pe portul 3000. |
| **`UNPROTECTED PRIVATE KEY FILE` la SSH** | Permisiunile fișierului `.key` pe Windows sunt prea permisive. | Rulează comanda din Pasul 2.2 (`icacls ... /inheritance:r`). |
| **Modelul 3D nu apare pe mașină (ecran negru/gol)** | Fișierele `.glb` nu au fost copiate în `assets/models/`. | Verifică existența fișierului `app mobile/telemetrie-app/assets/models/acura_cdx_car.glb`. |
| **Eroare la `sqlite3` la `npm install`** | Lipsă Python sau unelte C++ pe Windows. | Instalează Python 3.11 cu opțiunea "Add to PATH", apoi reîncearcă `npm install`. |
| **Simularea arată 0 km/h la final** | Funcția de zeroizare automată la oprire este activă (comportament normal și dorit). | Apasă `[ ▶ SIMULARE ]` sau pornește scenariul dorit din bara de sus a aplicației sau din `/monitor`. |
