#pragma once
/**
 * SDSyncModule.h — Logare pe microSD + sync automat la server
 *
 * Utilizare:
 *   SDSyncModule sdSync;
 *
 *   void setup() {
 *       sdSync.begin(5);                    // CS pin = GPIO 5
 *       sdSync.setServer("http://84.235.164.52:3000", "VIN_MASINA_TAL");
 *   }
 *
 *   void loop() {
 *       // Apelat la fiecare secundă când motorul e pornit:
 *       sdSync.logRow(rpm, viteza, tempApa, voltaj, sarcina, consumLh, boost);
 *
 *       // Apelat când motorul se opreşte:
 *       sdSync.endTrip();
 *
 *       // Apelat periodic când ai conexiune la server:
 *       if (wifiConnected) sdSync.syncPending();
 *   }
 */

#include <SD.h>
#include <SPI.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ─── Configuraţie ────────────────────────────────────────────────────────────

#define SYNC_MAX_ROWS_PER_REQUEST  200   // rânduri trimise odată (memorie RAM)
#define SYNC_PING_INTERVAL_MS    30000   // verificare server la 30s
#define TRIP_IDLE_TIMEOUT_MS    300000   // 5 min staţionat = cursă încheiată

// ─────────────────────────────────────────────────────────────────────────────

class SDSyncModule {
public:

    // ── Iniţializare ─────────────────────────────────────────────────────────

    bool begin(uint8_t csPin = 5) {
        _csPin = csPin;
        if (!SD.begin(_csPin)) {
            Serial.println("[SD] Card nedetectat sau eroare init.");
            return false;
        }
        if (!SD.exists("/trips")) SD.mkdir("/trips");
        if (!SD.exists("/done"))  SD.mkdir("/done");
        Serial.println("[SD] Iniţializat OK.");
        return true;
    }

    void setServer(const char* baseUrl, const char* vin) {
        _serverUrl = String(baseUrl);
        _vin       = String(vin);
    }

    // ── Logare date OBD ──────────────────────────────────────────────────────

    /**
     * Apelat la fiecare ciclu de citire OBD (ex. la 1s).
     * Dacă nu există o cursă activă, o porneşte automat.
     */
    void logRow(int rpm, float viteza, float tempApa, float voltaj,
                float sarcina = 0, float consumLh = 0, float boost = 0) {

        if (!_tripActive) _startTrip();

        File f = SD.open(_currentFile, FILE_APPEND);
        if (!f) {
            Serial.println("[SD] Nu pot scrie în fişier.");
            return;
        }

        unsigned long ts = millis() + _tripStartWall;
        f.printf("%lu,%.0f,%.1f,%.1f,%.2f,%.2f,%.2f,%.2f\n",
            ts, (float)rpm, viteza, tempApa, voltaj, sarcina, consumLh, boost);
        f.close();

        _lastActivityMs = millis();
        _rowCount++;
    }

    /**
     * Apelat la oprirea motorului sau detectarea staţionării prelungite.
     */
    void endTrip() {
        if (!_tripActive) return;
        _tripActive = false;

        // Scrie timestamp_end în primul rând (header extins)
        // — marcăm finalul în denumirea fişierului
        String doneFile = _currentFile;
        doneFile.replace(".csv", "_end" + String(_tripStartWall + millis()) + ".csv");
        SD.rename(_currentFile.c_str(), doneFile.c_str());

        Serial.printf("[SD] Cursă încheiată: %s (%d rânduri)\n",
            doneFile.c_str(), _rowCount);

        _currentFile = "";
        _rowCount    = 0;
    }

    /**
     * Verifică în loop dacă cursele nesincronizate pot fi trimise.
     * Apelat periodic când WiFi e conectat.
     */
    void syncPending() {
        if (_vin.isEmpty() || _serverUrl.isEmpty()) return;
        if (millis() - _lastSyncCheckMs < SYNC_PING_INTERVAL_MS) return;
        _lastSyncCheckMs = millis();

        if (!_pingServer()) return;  // server indisponibil

        File dir = SD.open("/trips");
        File entry;
        while ((entry = dir.openNextFile())) {
            if (entry.isDirectory()) { entry.close(); continue; }
            String name = String(entry.name());
            if (!name.endsWith(".csv")) { entry.close(); continue; }
            entry.close();

            String path = "/trips/" + name;
            Serial.printf("[SYNC] Trimit: %s\n", path.c_str());

            if (_syncFile(path)) {
                // Mută în /done/ după sync reuşit
                String donePath = "/done/" + name;
                SD.rename(path.c_str(), donePath.c_str());
                Serial.printf("[SYNC] OK: %s → /done/\n", name.c_str());
            }
        }
        dir.close();
    }

    /**
     * Apelat în loop() — închide automat cursa dacă maşina e staţionată > 5 min.
     */
    void update() {
        if (_tripActive && (millis() - _lastActivityMs > TRIP_IDLE_TIMEOUT_MS)) {
            Serial.println("[SD] Timeout staţionare — cursă încheiată automat.");
            endTrip();
        }
    }

private:

    uint8_t       _csPin          = 5;
    String        _serverUrl      = "";
    String        _vin            = "";
    String        _currentFile    = "";
    bool          _tripActive     = false;
    int           _rowCount       = 0;
    unsigned long _tripStartWall  = 0;   // epoch ms estimat
    unsigned long _lastActivityMs = 0;
    unsigned long _lastSyncCheckMs = 0;

    // ── Intern ────────────────────────────────────────────────────────────────

    void _startTrip() {
        _tripStartWall = millis();  // fallback dacă nu ai NTP
        // Dacă ai NTP configurat: _tripStartWall = (unsigned long)time(nullptr) * 1000UL;

        _currentFile = "/trips/" + String(_tripStartWall) + ".csv";

        File f = SD.open(_currentFile, FILE_WRITE);
        if (f) {
            f.println("timestamp_ms,rpm,viteza,temp_apa,voltaj,sarcina,consum_lh,boost");
            f.close();
        }

        _tripActive     = true;
        _rowCount       = 0;
        _lastActivityMs = millis();

        Serial.printf("[SD] Cursă nouă: %s\n", _currentFile.c_str());
    }

    bool _pingServer() {
        HTTPClient http;
        http.begin(_serverUrl + "/api/ping");
        http.setTimeout(3000);
        int code = http.GET();
        http.end();
        return (code == 200);
    }

    /**
     * Citeşte un fişier CSV şi îl trimite la server în batches.
     * Returnează true dacă totul a mers bine.
     */
    bool _syncFile(const String& path) {
        File f = SD.open(path.c_str());
        if (!f) return false;

        // Extrage trip_start din numele fişierului (ex: /trips/1720000000.csv)
        String name = path;
        name.replace("/trips/", "");
        name.replace(".csv", "");
        // Dacă are sufixul _endTIMESTAMP
        int endIdx = name.indexOf("_end");
        unsigned long tripEnd = 0;
        if (endIdx > 0) {
            tripEnd = name.substring(endIdx + 4).toInt();
            name    = name.substring(0, endIdx);
        }
        unsigned long tripStart = name.toInt();

        // Sari header-ul
        f.readStringUntil('\n');

        bool allOk = true;
        while (f.available()) {
            // Citeşte batch de SYNC_MAX_ROWS_PER_REQUEST rânduri
            DynamicJsonDocument doc(32768);
            doc["vin"]        = _vin;
            doc["trip_start"] = (unsigned long long)tripStart;
            if (tripEnd > 0)
                doc["trip_end"] = (unsigned long long)tripEnd;

            JsonArray rows = doc.createNestedArray("rows");
            int count = 0;

            while (f.available() && count < SYNC_MAX_ROWS_PER_REQUEST) {
                String line = f.readStringUntil('\n');
                line.trim();
                if (line.isEmpty()) continue;

                // Parse CSV: ts,rpm,viteza,temp_apa,voltaj,sarcina,consum_lh,boost
                float vals[8] = {0};
                int   col = 0;
                int   start = 0;
                for (int i = 0; i <= (int)line.length() && col < 8; i++) {
                    if (i == (int)line.length() || line[i] == ',') {
                        vals[col++] = line.substring(start, i).toFloat();
                        start = i + 1;
                    }
                }

                JsonObject row = rows.createNestedObject();
                row["ts"]       = (unsigned long long)vals[0];
                row["rpm"]      = (int)vals[1];
                row["viteza"]   = vals[2];
                row["temp_apa"] = vals[3];
                row["voltaj"]   = vals[4];
                if (vals[5] > 0) row["sarcina"]   = vals[5];
                if (vals[6] > 0) row["consum_lh"] = vals[6];
                if (vals[7] > 0) row["boost"]     = vals[7];

                count++;
            }

            if (count == 0) break;

            // Trimite batch
            String body;
            serializeJson(doc, body);

            HTTPClient http;
            http.begin(_serverUrl + "/api/sync/obd");
            http.addHeader("Content-Type", "application/json");
            http.setTimeout(15000);
            int code = http.POST(body);

            if (code != 200) {
                Serial.printf("[SYNC] Eroare HTTP %d\n", code);
                allOk = false;
            }
            http.end();

            if (!allOk) break;
        }

        f.close();
        return allOk;
    }
};
