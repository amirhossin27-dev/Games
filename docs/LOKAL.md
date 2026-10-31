# Lokal an Joyboy arbeiten

## Starten

Im Terminal im Projektordner:

```powershell
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Danach http://127.0.0.1:5174 öffnen. Änderungen im Quellcode werden automatisch im Browser aktualisiert. Einen im Terminal gestarteten Server mit Strg+C beenden.

## Prüfen

```powershell
npm test
npm run build
```

Der Build enthält den TypeScript-Check und erzeugt die fertige App in `dist/`.
Nach einem neuen Checkout Abhängigkeiten mit `npm ci` exakt aus `package-lock.json` installieren.
Lokales Setup geprüft mit Node.js 24.15.0 und npm 11.12.1.

## Online-Funktionen

Für den lokalen Start ist keine `.env`-Datei nötig. Online ist standardmäßig aus und wird im Elternbereich aktiviert.
Die Standardkonfiguration in `src/net/config.ts` verwendet das bestehende Firebase-Projekt `joyboy-916f0`. Auch eine lokal gestartete App greift bei aktivierten Online-Funktionen darauf zu.
Für ein separates Firebase-Testprojekt können dessen Werte in `.env.local` stehen:

```dotenv
VITE_JOYBOY_API_KEY=API_KEY_DES_TESTPROJEKTS
VITE_JOYBOY_DB_URL=https://DATENBANK_DES_TESTPROJEKTS.firebasedatabase.app
```

Danach den Entwicklungsserver neu starten. VITE-Variablen sind im Browser sichtbar und dürfen keine privaten Zugangsdaten enthalten.
Weitere Hinweise: [FIREBASE.md](FIREBASE.md).

## Datenbankregeln separat testen

`npm run test:rules` braucht zusätzlich Java und lädt Firebase CLI sowie den Datenbank-Emulator herunter. Java ist bei der Ersteinrichtung nicht verfügbar gewesen; diese Emulator-Tests wurden deshalb nicht ausgeführt. Für Arbeiten an Datenbankregeln Java einrichten und die Tests zusätzlich ausführen. Der Emulator-Test verwendet das Demo-Projekt `demo-joyboy`.

## Git

Für Änderungen einen eigenen Branch verwenden und anschließend einen Pull Request nach `main` erstellen.
Ein Push auf `main` löst die Veröffentlichung über GitHub Actions aus.

Drei Spiellogik-Dateien heißen jetzt `muncher-logic.ts`, `runner-logic.ts` und `solitaire-logic.ts`, damit TypeScript sie unter Windows eindeutig von den gleichnamigen React-Komponenten unterscheiden kann.
