# Firebase für Joyboy einrichten (ca. 10 Minuten)

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

> **Ist das sicher?** Ja. Der API-Key ist kein Geheimnis – er steckt in jeder Web-App und kennzeichnet nur das Projekt. Geschützt wird alles durch die Regeln aus Schritt 2: Jedes Kind kann nur seinen eigenen Spielstand und seinen eigenen Platz im Spielzimmer schreiben, nur der Gastgeber den Spielstand, und Zimmer sind nur mit dem passenden Zimmer-Code lesbar.

Optional, für mehr Schutz vor Missbrauch des Keys: In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) beim Key „Browser key (auto created by Firebase)“ unter **Anwendungseinschränkungen → Websites** die Adresse `https://amirhossin27-dev.github.io/*` eintragen (und für lokale Tests `http://localhost:*`).

## Was die Regeln erlauben

| Bereich | Lesen | Schreiben |
| --- | --- | --- |
| `profiles/<Kind>/public` – Name, Avatar, Sterne für die Rangliste | alle angemeldeten Geräte | nur das Kind selbst |
| `profiles/<Kind>/private` – Spielstand, Einstellungen | nur das Kind selbst | nur das Kind selbst |
| `rooms/<Code>/info` – Gastgeber, Spiel, wer reingelassen wurde | wer den Code kennt | nur der Gastgeber; ist er 20 s weg, übernimmt ein Mitspieler |
| `rooms/<Code>/seats/<Kind>` – eigener Platz, Züge, Herzschlag | wer den Code kennt | nur das Kind selbst |
| `rooms/<Code>/state` – Spielstand der Runde | wer den Code kennt | nur der Gastgeber |
| neues Zimmer | – | nur, wenn der Code frei oder seit 2 Stunden unbenutzt ist |
