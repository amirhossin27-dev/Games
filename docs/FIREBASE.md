# Firebase für Joyboy einrichten (ca. 10 Minuten)

> **Erledigt:** Joyboy nutzt das Projekt `joyboy-916f0`. Adresse und API-Key stehen in `src/net/config.ts`. Diese Anleitung bleibt für ein neues Projekt oder eine eigene Kopie der App.

Für die Online-Spielzimmer (bis zu 4 Kinder, jedes am eigenen Gerät) und die Spielstände in der Cloud braucht Joyboy ein eigenes, kostenloses Firebase-Projekt. Der kostenlose Tarif „Spark“ reicht, eine Kreditkarte ist nicht nötig.

## 1. Projekt anlegen

1. [console.firebase.google.com](https://console.firebase.google.com) öffnen und mit einem Google-Konto anmelden.
2. **Projekt erstellen** → Name: `joyboy` → weiter.
3. **Google Analytics: ausschalten** (für eine Kinder-App nicht nötig) → **Projekt erstellen**.

## 2. Realtime Database anlegen

1. Links im Menü **Build → Realtime Database** → **Datenbank erstellen**.
2. Standort: **Belgien (europe-west1)** – die Daten bleiben in der EU.
3. Sicherheitsregeln: **Im gesperrten Modus starten** → **Aktivieren**.
4. Oben auf den Reiter **Regeln** wechseln, alles löschen und den kompletten Inhalt von [`database.rules.json`](../database.rules.json) einfügen → **Veröffentlichen**.
5. Oben im Reiter **Daten** steht die Adresse der Datenbank, z. B. `https://joyboy-1a2b3-default-rtdb.europe-west1.firebasedatabase.app` – die brauche ich.

## 3. Anonyme Anmeldung einschalten

Damit jedes Kind seinen eigenen, geschützten Spielstand hat – ganz ohne E-Mail oder Passwort:

1. Links **Build → Authentication** → **Jetzt starten**.
2. Reiter **Anmeldemethode** → **Anonym** → **Aktivieren** → **Speichern**.
3. Falls Firebase ein „Upgrade auf Identity Platform“ anbietet: nicht nötig. Und falls es dort eine Option „Automatische Bereinigung anonymer Konten“ gibt: **ausgeschaltet lassen** – sonst gehen Spielstände nach 30 Tagen verloren.

## 4. Web-App registrieren (API-Key)

1. Links oben auf das Zahnrad → **Projekteinstellungen** → Reiter **Allgemein**.
2. Unten bei **Meine Apps** auf das Web-Symbol **`</>`** tippen.
3. Spitzname: `Joyboy Web` → Firebase Hosting **nicht** einrichten → **App registrieren**.
4. Es erscheint ein Code-Block mit `firebaseConfig`. Daraus brauche ich:
   - `apiKey` (beginnt mit `AIza…`)
   - `databaseURL` (die Adresse aus Schritt 2)

## 5. Mir schicken

Die beiden Werte (`apiKey` und `databaseURL`) einfach in den Chat kopieren.

> **Ist das sicher?** Ja. Der API-Key ist kein Geheimnis – er steckt in jeder Web-App und kennzeichnet nur das Projekt. Geschützt wird alles durch die Regeln aus Schritt 2: Jedes Kind kann nur seinen eigenen Spielstand und seinen eigenen Platz im Spielzimmer schreiben, nur der Gastgeber den Spielstand, und ein Zimmer sehen nur der Gastgeber und die Kinder, die er hereingelassen hat. Wer klingelt, sieht nur, ob er reindarf, und Name und Tier des Gastgebers. Namen und Tiere prüft auch die Datenbank (derselbe Wortfilter wie in der App).

Optional, für mehr Schutz vor Missbrauch des Keys: In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) beim Key „Browser key (auto created by Firebase)“ unter **Anwendungseinschränkungen → Websites** die Adresse `https://amirhossin27-dev.github.io/*` eintragen (und für lokale Tests `http://localhost:*`).

## Was die Regeln erlauben

| Bereich | Lesen | Schreiben |
| --- | --- | --- |
| `profiles/<Kind>/public` – Name, Avatar, Sterne für die Rangliste | alle angemeldeten Geräte | nur das Kind selbst, Name und Tier werden geprüft |
| `profiles/<Kind>/private` – Spielstand, Einstellungen | nur das Kind selbst | nur das Kind selbst |
| `rooms/<Code>/info` – Gastgeber, Spiel, wer reingelassen wurde | alle im Zimmer und wer geklingelt hat | nur der Gastgeber; ist er 20 s weg, übernimmt ein reingelassenes Kind |
| `rooms/<Code>/seats/<Kind>` – eigener Platz, Züge, Herzschlag | alle im Zimmer; wer klingelt, nur den eigenen und den des Gastgebers | nur das Kind selbst, Name und Tier werden geprüft |
| `rooms/<Code>/state` – Spielstand der Runde | alle im Zimmer | nur der Gastgeber |
| `rooms/<Code>/chat/<id>` – Chat des Zimmers | alle im Zimmer | neue Nachrichten nur unter eigenem Namen, Text geht durch den Wortfilter (max. 60 Zeichen); ändern nicht, wegräumen nur der Gastgeber |
| `presence/<Kind>` – online, in welchem Zimmer | wer das Konto kennt (Spielfreunde); auflisten geht nicht | nur das Kind selbst |
| `invites/<Kind>/<Absender>` – Einladung ins Zimmer | nur das eingeladene Kind | nur der Absender; das eingeladene Kind darf sie löschen |
| neues Zimmer | – | nur, wenn der Code frei oder seit 2 Stunden unbenutzt ist |

## Regeln ändern

`database.rules.json` wird mit `npm run rules` gebaut – die Wortliste für Namen und die Tiere kommen dabei aus `src/lib/names.ts`, die zusätzlichen Chat-Wörter aus `src/lib/chat.ts`. Ein Test meldet sich, wenn die Datei nicht mehr zu den Wortlisten passt. Nach jeder Änderung den neuen Inhalt in der Firebase-Konsole unter **Realtime Database → Regeln** einfügen und **Veröffentlichen**, sonst gelten auf dem Server noch die alten Regeln.

`npm run test:rules` startet den Firebase-Emulator (braucht Java) und probiert gut 50 Fälle durch – z. B. dass ein Kind vor der Tür den Chat nicht lesen kann, dass Telefonnummern im Chat abgelehnt werden und dass nur der Gastgeber ein geschlossenes Zimmer wieder öffnen kann ([`scripts/test-rules.mjs`](../scripts/test-rules.mjs)).
