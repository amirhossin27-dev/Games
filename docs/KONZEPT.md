# Joyboy – Konzept & Umsetzungsplan

> **Status:** Freigegeben. Phase 1, 2 und 3 sind umgesetzt (siehe Abschnitt 9). Phase 4 (Ausbau) läuft: Die drei neuen Lernspiele sind fertig.
> **Designvorschläge:** [Design-Leinwand „Joyboy Designkonzepte“](https://claude.ai/artifact/VLqZ1nyDz3JxvtXe7zGeB6) – gewählt wurde **Richtung C „Papierwelt“**.

## Entscheidungen (Freigabe)

- **Design:** Richtung C „Papierwelt“ – Papier, Klebeband, Notizzettel, Grandstander als Titel- und Andika als Leseschrift.
- **Phase 2** enthält zusätzlich Schiffe versenken, Stadt-Land-Fluss und alle Arcade-Spiele.
- **Sprache:** zunächst nur Deutsch.
- **GitHub Pages** ist auf „GitHub Actions“ gestellt.
- **Neu: Spielzeit-Limit** mit Eltern-Passwort, 12 Stunden Pause nach Ablauf und sichtbarem Timer (Abschnitt 7a).

---

## 1. Die Idee

**Joyboy** ist eine Lern-Spiele-App für Kinder. Sie läuft im Browser, lässt sich auf iPhone, iPad und Android wie eine normale App auf den Home-Bildschirm legen und wird kostenlos über GitHub Pages veröffentlicht. Kinder spielen allein, gegen den Computer („Robo“), zusammen an einem Gerät oder **mit bis zu 4 Kindern online, jedes am eigenen Gerät, live synchron**. Jedes Kind hat einen Spielernamen, einen Tier-Avatar und einen Spielstand, der dauerhaft gespeichert wird.

### Leitprinzipien

| Prinzip | Was das konkret heißt |
| --- | --- |
| **Lesen ist keine Voraussetzung** | Joy (das Maskottchen) liest alles vor, wichtige Dinge haben Symbole, Zimmer-Codes bestehen aus Tieren statt Buchstaben. |
| **Sofort verstehen** | Jedes Spiel hat ein Tutorial mit 3–5 Schritten, Zeigehand und Probezug. |
| **Kurze Runden** | 1–5 Minuten pro Spiel, jederzeit pausierbar, laufende Online-Spiele lassen sich fortsetzen. |
| **Belohnen statt Druck** | Sterne, Level und Abzeichen. Keine Verlust-Bestrafung, Robo passt sich an. |
| **Sicher** | Kein Chat, keine Werbung, keine Käufe, keine Tracker, nur Spitznamen. |
| **Große Ziele** | Tippflächen ≥ 48 px, hohe Kontraste (WCAG AA), Farbe nie allein als Unterscheidung (Antworten haben zusätzlich Formen). |

### Zielgruppe

Kinder von **4 bis 12 Jahren**, eingeteilt beim Einrichten in vier Altersstufen (4–5, 6–7, 8–9, 10+). Die Altersstufe stellt automatisch Schwierigkeit, Robo-Stärke, Vorlesen und Zählhilfen ein. Eltern können das jederzeit ändern.

---

## 2. Was wir aus Arta übernehmen

Arta hat eine ausgereifte Spiele-Ecke (34 Spiele, Regeln mit KI, Online-Modus, PWA). Diese Erfahrungen fließen direkt ein:

| Learning aus Arta | So nutzt Joyboy es |
| --- | --- |
| **Regeln als reine Funktionen** (`TurnDef`: `init`, `turn`, `apply`, `outcome`, `cpu`) – daraus entstehen automatisch „Ein Handy“, „Gegen KI“ und „Online“. | Bleibt das Herzstück, wird aber von 2 auf **1–4 Spieler** erweitert (Plätze 0–3 statt `p1`/`p2`). Dieselben Funktionen treiben auch die Tutorials an. |
| **Firebase Realtime Database ohne SDK** (nur REST + Server-Sent Events) – kleine App, läuft auf iOS und Android. | Gleiche Technik, eigenes Firebase-Projekt für Joyboy. |
| **Ein Schreiber pro Datenknoten** (jedes Handy schreibt nur seinen eigenen Kanal) – keine Schreibkonflikte. | Jedes Kind schreibt nur seinen eigenen Platz im Zimmer, der Gastgeber den Spielstand. |
| **Gastgeber rechnet, Nummern zählen hoch** (`seq`/`ack`) – es gilt immer der neueste Stand. | Unverändert übernommen, für 4 Plätze verallgemeinert. |
| **Laufende Partie fortsetzen**, Einladungen mit Ablaufzeit. | „Euer Spiel läuft noch – weiterspielen?“ auf dem Startbildschirm. |
| **Sichtschutz** bei verdeckten Karten an einem Gerät. | Bleibt, kindgerecht: „Gib das Tablet an Eule weiter – nicht spicken!“ |
| **PWA-Details:** `base: './'`, iOS-Meta-Tags, Safe-Area, `100dvh`, Ton erst nach erster Berührung (iOS), Touch-Lock im Spiel, Service Worker „erst Netz, dann Cache“. | 1:1 übernommen. |
| **GitHub Actions:** erst Tests, dann Build, dann Veröffentlichung. | 1:1 übernommen. |
| **Computer-Gegner** für fast alle Spiele vorhanden. | Werden zu „Robo“ mit drei Stärken, passend zum Alter. |

**Was neu dazukommt:** bis zu 4 Spieler, Anwesenheit (wer ist online?), Gastgeber-Wechsel, Robo springt bei Verbindungsabbruch ein, Profile mit Avatar und dauerhaften Spielständen, Tutorials, Lernspiele, Kinderschutz.

---

## 3. Spiele-Katalog

### 3.1 Aus Arta übernommen (kindgerecht umgestaltet)

Romantik-Elemente (Herzen, Liebes-Gutscheine, Einsätze) fallen weg und werden durch Sterne und Abzeichen ersetzt. Geschützte Markennamen werden durch eigene Namen ersetzt.

| Spiel in Joyboy | In Arta | Lernziel | Alter | Spieler |
| --- | --- | --- | --- | --- |
| Tic-Tac-Toe | Tic-Tac-Toe | Logik, vorausdenken | 4+ | 2 |
| Vier gewinnt | Vier gewinnt | Logik, Muster erkennen | 5+ | 2 |
| Paare finden | Pärchen-Memory | Gedächtnis | 4+ | 1–4 |
| Ludo | Mensch ärgere dich nicht | Zählen, Regeln, fair verlieren | 5+ | 2–4 |
| Mau-Mau | Mau-Mau | Farben, Zahlen, Regeln | 6+ | 2–4 |
| Farbwechsel | Uno | Farben, Zahlen | 6+ | 2–4 |
| Würfelglück | Kniffel | Addieren, Wahrscheinlichkeit | 8+ | 1–4 |
| Stadt-Land-Fluss | Stadt Land Fluss | Rechtschreibung, Wissen | 8+ | 2–4 |
| Wer ist es? | Wer ist wer? | Fragen stellen, ausschließen | 6+ | 2 |
| Schiffe versenken | Schiffe versenken | Koordinaten (A3, B5 …) | 7+ | 2 |
| Dame, Mühle, Schach | Dame, Mühle, Schach | Strategie | 7+ / 7+ / 8+ | 2 |
| Bewegungs-Würfel | Fitness-Würfel | Bewegung, Zählen | 4+ | 1–4 |
| Ton-Echo | Herz-Simon | Gedächtnis, Musik | 4+ | 1 + Wettkampf |
| 2048 | 2048 | Verdoppeln, Planen | 8+ | 1 + Wettkampf |
| Minen-Detektiv | Minesweeper | Logisches Schließen | 9+ | 1 + Wettkampf |
| Klötzchen | Herz-Tetris | Raumvorstellung | 6+ | 1 + Wettkampf |
| Schlange, Flappy, Hüpfer, Mampfer, Breakout, Tempel-Lauf, Weltraum-Abwehr | Herz-Schlange, Flappy Herz, Herz-Hüpfer, Herz-Mampfer, Herz-Breakout, Tempel-Lauf, Herz-Invaders | Reaktion, Koordination | 5+ | 1 + Wettkampf |
| Ball-Blitz | Ball-Blitz | Winkel und Abpraller einschätzen | 7+ | 1 + Wettkampf |
| Pong-Duell, Blitz-Duell | Pong-Duell, Blitz-Duell | Reaktion, gegenübersitzen | 5+ | 2 an einem Gerät |
| Solitär | Solitär | Reihenfolgen, Geduld | 8+ | 1 |
| Joy-Kart | Herz-Kart | Reaktion | 6+ | 1–2 (später bis 4) |

**Nicht übernommen:** Herz-Strike (Paintball-Shooter) und Herz-Fighter (Prügelspiel) – nicht kindgerecht. Amors Pfeile (Vögel abschießen) – höchstens später als „Ballon-Platzen“. Rommé – zu komplex für die Zielgruppe.

### 3.2 Neue Lernspiele

Alle laufen auf einer gemeinsamen **Aufgaben-Engine**: Ein Generator erzeugt passend zur Altersstufe Aufgaben, alle Kinder antworten gleichzeitig, wer schnell und richtig ist, bekommt Punkte. Dadurch funktionieren sie automatisch allein, gegen Robo, an einem Gerät (reihum) und online mit 4 Kindern.

| Lernspiel | Inhalt | Alter |
| --- | --- | --- |
| **Rechen-Rallye** | Plus/Minus bis 10, 20, 100, später Einmaleins. Zählhilfe mit Zehnerfeldern. | 5–10 |
| **Buchstaben-Jagd** | Bild + Anlaut: „Mit welchem Buchstaben beginnt *Apfel*?“ – mit Vorlesen. | 4–7 |
| **Uhr-Profi** | Uhrzeit ablesen: volle, halbe, Viertelstunden, Minuten. | 6–9 |
| **Wort-Baumeister** | Silben oder Buchstaben zum Wort ordnen. | 6–9 |
| **Welt-Quiz** | Tiere, Natur, Länder und Flaggen, Körper. | 7–12 |
| **English Words** | Englische Wörter mit Bild und Aussprache. | 6–10 |

### 3.3 Spielarten im Mehrspieler-Modus

1. **Abwechselnd** (Ludo, Mau-Mau, Vier gewinnt …): Wer dran ist, macht seinen Zug, alle sehen ihn sofort.
2. **Gleichzeitig** (Lernspiele, Stadt-Land-Fluss): Alle antworten zur selben Zeit, der Gastgeber wertet aus.
3. **Wettkampf** (Arcade-Spiele): Alle spielen dieselbe Runde (gleicher Zufalls-Startwert) auf dem eigenen Gerät, oben läuft live die Punkteliste mit. Das braucht keine Echtzeit-Physik über das Netz und funktioniert deshalb auch mit 4 Kindern zuverlässig.

---

## 4. Tutorials

Jedes Spiel bringt eine kleine Tutorial-Beschreibung mit (3–5 Schritte). Ein Schritt besteht aus:

- **Text** in Kindersprache (max. ca. 12 Wörter), den Joy in einer Sprechblase sagt und **vorliest** (Web Speech API, deutsche Stimme; für 4–7-Jährige automatisch an).
- **Szene:** das echte Spielbrett in einem vorbereiteten Zustand. Weil die Regeln reine Funktionen sind, ist eine Szene einfach ein Spielstand – es gibt keine extra Animationen zu pflegen.
- **Hervorhebung + Zeigehand**, die auf das Wichtige tippt oder wischt.
- **Probezug** im letzten Schritt: Das Kind macht den Zug selbst, die Regel-Funktion prüft ihn. Klappt es, gibt es Lob („Super, du bist bereit!“), sonst einen Hinweis.

Ablauf:

- Beim ersten Öffnen eines Spiels startet das Tutorial automatisch (überspringbar).
- In jedem Spiel gibt es oben einen **?-Knopf**.
- Im Spielzimmer sehen die anderen „**Lernt die Regeln**“ – man kann trotzdem starten.
- Für die Kleinsten zeigt der **Robo-Tipp** auf Wunsch einen möglichen Zug (kommt aus der vorhandenen KI-Funktion).
- Wer 5 Tutorials abschließt, bekommt das Abzeichen **„Regel-Kenner“**.

---

## 5. Mehrspieler: bis zu 4 Kinder, live

### 5.1 Überblick

```
  Tablet (Gastgeber)          Handy 2              Handy 3              Handy 4
  ┌──────────────┐        ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ rechnet die  │        │ zeigt Stand, │     │ zeigt Stand, │     │ zeigt Stand, │
  │ Regeln       │        │ sendet Züge  │     │ sendet Züge  │     │ sendet Züge  │
  └──────┬───────┘        └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
         │ schreibt: Spielstand  │ schreibt: eigenen Platz (Züge, bereit, online)
         ▼                       ▼                    ▼                    ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  Firebase Realtime Database · /rooms/<Code>     (alle hören per Live-Stream)   │
  └──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Spielzimmer & Zimmer-Code

- Ein Kind tippt **„Zimmer öffnen“** und wählt ein Spiel. Es bekommt einen Code aus **6 Tieren** (z. B. Fuchs · Frosch · Löwe · Panda · Hase · Wal). Mit 16 Tieren gibt es 16,7 Millionen Codes.
- Die anderen tippen **„Code eingeben“** und tippen die 6 Tiere an. Das klappt auch für Kinder, die noch nicht lesen. Alternativ: Link teilen oder QR-Code scannen.
- **Klingel-Prinzip:** Wer neu ins Zimmer will, erscheint beim Gastgeber als „Panda möchte mitspielen – reinlassen?“. Bekannte Spielfreunde dürfen direkt rein. So kann niemand Fremdes durch Raten eines Codes einfach mitspielen.
- Freie Plätze kann der Gastgeber mit **Robo** füllen.
- Mit „Spiel starten“ schließt das Zimmer für Neue. Nach 2 Stunden ohne Aktivität verfällt es.

### 5.3 So bleiben alle synchron

1. Alle Geräte im Zimmer hören über **einen** Live-Stream (Server-Sent Events) auf `/rooms/<Code>`. Änderungen kommen typischerweise in 0,1–0,3 Sekunden an.
2. **Der Gastgeber führt den Spielstand.** Er schreibt ihn mit einer fortlaufenden Nummer (`seq`).
3. Die anderen schreiben ihre Züge nur in **ihren eigenen Platz** (`acts`, nummeriert).
4. Der Gastgeber prüft jeden Zug mit der Regel-Funktion `apply()`, schreibt den neuen Stand und bestätigt („bis Zug 7 übernommen“). Ungültige Züge werden einfach ignoriert.
5. Jedes Gerät zeigt immer den Stand mit der höchsten Nummer.

Weil jeder Knoten genau einen Schreiber hat, gibt es keine Konflikte – das ist das bewährte Arta-Prinzip, nur für 4 Plätze.

### 5.4 Wenn etwas schiefgeht

| Situation | Verhalten |
| --- | --- |
| Ein Kind verliert kurz die Verbindung | Jeder Platz meldet sich alle 5 s („Herzschlag“). Nach 15 s Stille wird der Avatar grau („verbindet …“). Ist das Kind gerade dran, macht **Robo nach 20 s den Zug** für es („Robo hilft Panda“). Kommt es zurück, spielt es nahtlos weiter. |
| Der Gastgeber fällt aus | Nach 15 s übernimmt automatisch das Kind mit der kleinsten Platznummer. Weil der ganze Spielstand in der Datenbank liegt, geht es einfach weiter. |
| App geschlossen | Beim nächsten Öffnen: „Euer Ludo läuft noch – weiterspielen?“ |
| Gar kein Internet | Allein, gegen Robo und an einem Gerät funktionieren immer. Online-Knöpfe sagen freundlich „Gerade kein Internet“. |

### 5.5 Datenmodell

```
/profiles/<uid>/public     Name, Avatar, Farbe, Level, Sterne, Wochensterne, Abzeichen
/profiles/<uid>/private    Altersstufe, Statistik je Spiel, Spielfreunde, Einstellungen
/rooms/<code>/info         Gastgeber, Spiel, Stufe, Status (Warten/Spielt/Fertig), reingelassene Kinder
/rooms/<code>/seats/<uid>  Platz 0–3, Name, Avatar, bereit, Tutorial gesehen, Herzschlag, Züge, Reaktion
/rooms/<code>/state        Spielstand, Nummer, bestätigte Züge je Kind
```

### 5.6 Sicherheitsregeln (Skizze)

- `profiles/<uid>/public`: lesen alle angemeldeten Geräte, schreiben nur `<uid>` selbst.
- `profiles/<uid>/private`: nur `<uid>` selbst.
- `rooms/<code>/seats/<uid>`: schreibt nur `<uid>` selbst.
- `rooms/<code>/info` und `state`: schreibt nur der Gastgeber; ein neuer Gastgeber darf übernehmen, wenn der Herzschlag des alten älter als 20 s ist (die Regeln kennen die Serverzeit `now`).
- Ein Zimmer lesen nur der Gastgeber und reingelassene Kinder. Wer klingelt, sieht nur `info` und den Platz des Gastgebers.
- Größen und Formate werden validiert (Code genau 6 Zeichen, max. 4 Plätze, Spielstand max. 64 KB). Namen und Tiere prüft die Datenbank mit demselben Wortfilter wie die App.

### 5.7 Mengen & Kosten

Der kostenlose Firebase-Tarif („Spark“) erlaubt 100 gleichzeitige Verbindungen, 1 GB Speicher und 10 GB Download pro Monat. Joyboy öffnet einen Live-Stream **nur, solange ein Kind in einem Zimmer ist** – Profile werden ohne Dauerverbindung gespeichert. Damit reichen die Grenzen für rund 25 gleichzeitig laufende 4er-Zimmer. Wird es mehr, genügt der Wechsel auf den nutzungsbasierten Tarif.

---

## 6. Profile & dauerhafte Spielstände

- **Einrichten:** Spielername (Vorschlag per Würfel, z. B. „Flinker Fuchs“, „Mutige Eule“), Tier-Avatar (9 Tiere inkl. Robo), Lieblingsfarbe, Altersstufe. Keine E-Mail, kein Passwort.
- **Mehrere Kinder an einem Gerät:** bis zu 6 Profile, beim Start fragt Joy „Wer spielt?“.
- **Anonyme Anmeldung:** Jedes Profil bekommt im Hintergrund ein anonymes Firebase-Konto (zwei REST-Aufrufe, kein SDK). Damit kann nur das eigene Gerät den eigenen Spielstand verändern.
- **Speicherung:** sofort lokal (funktioniert offline) und nach jedem Spiel zusätzlich in der Cloud. Geht der Browser-Speicher verloren, ist der Spielstand nicht weg.
- **Spielerpass:** QR-Code im Elternbereich, um ein Profil auf ein neues Gerät mitzunehmen (enthält den Anmelde-Schlüssel – deshalb nur für Eltern sichtbar).
- **Fortschritt:** Sterne pro Spiel (0–3), Level mit Namen (Neuling, Entdecker, Profi …), 8+ Abzeichen (Rechen-Profi, Gedächtnis-Ass, Regel-Kenner, Teamplayer …), Tagesaufgabe.
- **Rangliste der Woche:** Wer schon einmal zusammen in einem Zimmer gespielt hat, wird automatisch Spielfreund. Die Rangliste zeigt die Wochensterne der Spielfreunde – ohne Freundschaftsanfragen, ohne Suche nach Fremden.

---

## 7. Kinderschutz & Datenschutz

- **Kein freier Chat** – nur 5 feste Reaktionen (Daumen hoch, Lachen, Staunen, Herz, Super).
- **Spitznamen statt echter Namen:** Namensvorschläge per Würfel, Hinweis „Nimm einen Spitznamen“, Wortfilter, max. 16 Zeichen. Im Elternbereich lässt sich „nur Vorschlags-Namen“ einschalten.
- **Klingel-Prinzip** im Spielzimmer, Zimmer schließen beim Spielstart.
- **Elternbereich mit Passwort:** Spielzeit-Limit, Vorlesen, Ton, nur Vorschlags-Namen, Profile löschen, Online an/aus (Standard: aus) mit Löschen der Online-Daten, Spielerpass.
- **Datensparsam:** Spielername, Avatar, Altersstufe und Spielstände – sonst nichts. Keine Werbung, keine Käufe, keine Tracker.
- **Schriften werden mit der App ausgeliefert** (kein Abruf bei Google Fonts – DSGVO).

---

## 7a. Spielzeit-Limit

- Eltern legen im Elternbereich ein **Passwort** fest (gespeichert nur als PBKDF2-Hash) und bekommen einmalig einen **Notfall-Code**.
- Limit wählbar: aus, 15, 30, 45, 60, 90 oder 120 Minuten pro **12-Stunden-Fenster** (das Fenster beginnt mit der ersten Spielsekunde).
- Gezählt wird, solange die App sichtbar geöffnet ist – nicht im Elternbereich.
- Die **Restzeit** steht oben in der App und im Spiel; bei 5 und 1 Minute erinnert Joy (Hinweis + Vorlesen).
- Ist die Zeit aufgebraucht, endet das laufende Spiel und Joyboy zeigt **12 Stunden** lang den Pausen-Bildschirm mit Countdown.
- Mit dem Passwort können Eltern **15 Minuten schenken**, die **Sperre aufheben** oder das Limit ändern.
- Gegen das Vorstellen der Geräte-Uhr prüft Joyboy die Zeit über den `Date`-Header von GitHub Pages. Eine Pause endet und ein neues Fenster beginnt nur mit geprüfter Zeit – ohne Internet bleibt die Pause, bis das Gerät wieder online ist oder die Eltern sie aufheben.
- Das Limit gilt für das ganze Gerät, also für alle Kinder darauf zusammen (pro Kind ließe es sich mit einem neuen Profil umgehen).

---

## 8. Technik

| Bereich | Lösung |
| --- | --- |
| App | React 19 + TypeScript, gebaut mit Vite (wie Arta) |
| Tests | Vitest für Regeln, Aufgaben-Generatoren, Sync-Logik |
| Installierbar | PWA: Manifest, Icons (inkl. maskable + Apple-Touch-Icon), Service Worker für Offline, iOS-Standalone-Meta-Tags, In-App-Hilfe „Zum Home-Bildschirm“ für iOS und Android |
| Veröffentlichung | GitHub Actions: Tests → Build → GitHub Pages, erreichbar unter `https://amirhossin27-dev.github.io/Games/` |
| Echtzeit & Cloud | Firebase Realtime Database + anonyme Anmeldung, nur REST und Server-Sent Events. Adresse und API-Key in einer Konfigurationsdatei bzw. per `VITE_JOYBOY_DB_URL` / `VITE_JOYBOY_API_KEY`. Ohne Konfiguration laufen alle Offline-Modi. |
| Ton & Sprache | WebAudio-Klänge (aus Arta), Vorlesen per Web Speech API |

### Projektstruktur

```
src/
  app/        App-Gerüst, Navigation, Theme, Eltern-Tor
  ui/         Design-System: Knöpfe, Karten, Avatar, Joy, Icons
  profile/    Profile, Avatare, Sterne, Level, Abzeichen, Spielerpass
  net/        Firebase (Anmeldung, Datenbank, Live-Stream), Zimmer, Herzschlag
  engine/     useGame (1–4 Spieler), Robo, Wettkampf, Tutorial-Engine, Sounds
  learn/      Aufgaben-Generatoren: Mathe, Buchstaben, Uhr, Wörter, Wissen
  games/      je Spiel: Regeln (logic.ts), Ansicht (View.tsx), Tutorial (tutorial.ts)
  screens/    Willkommen, Start, Spiel, Spielzimmer, Ergebnis, Ich, Eltern
```

### Die Spiele-Engine für 1–4 Spieler

Arta kennt zwei Seiten (`p1`/`p2`). Joyboy verallgemeinert das auf Plätze 0–3:

```ts
interface GameDef<S, A> {
  init(ctx: { players: number; starter: number; level: Level; rnd: Rnd }): S;
  turn(s: S): number | 'all' | null;            // wer ist dran – oder alle gleichzeitig
  apply(s: S, a: A, by: number, rnd: Rnd): S | null;
  outcome(s: S): { ranking: number[] } | null;  // Platzierung statt nur Sieger
  robo?(s: S, seat: number, level: Level, rnd: Rnd): A | null;
  viewer?(s: S): number | null;                 // Sichtschutz an einem Gerät
  tutorial: TutorialStep<S, A>[];
}
```

Ein Hook `useGame(def, …)` macht daraus – wie `useTurnGame` in Arta – automatisch alle Modi: allein, gegen Robo, an einem Gerät, online.

---

## 9. Umsetzungsplan

| Phase | Inhalt | Ergebnis |
| --- | --- | --- |
| **0 – Konzept** | Dieses Dokument + Designvorschläge | Deine Freigabe |
| **1 – Fundament** ✅ | PWA-Gerüst, Veröffentlichung über GitHub Pages, Design-System „Papierwelt“, Willkommen (Name, Avatar, Alter), „Wer spielt?“, Start, Spiel-Seite, Ich-Seite, Tutorial-Engine, Vorlesen, Elternbereich mit Spielzeit-Limit | App lässt sich auf iPhone und Android installieren |
| **2 – Spiele offline** ✅ | Engine für 1–4 Spieler, Robo, Aufgaben-Engine. Rechen-Rallye, Buchstaben-Jagd, Uhr-Profi, Paare finden, Vier gewinnt, Tic-Tac-Toe, Ludo, Mau-Mau, Würfelglück, Schiffe versenken, Stadt-Land-Fluss und 15 Arcade-Spiele – jeweils mit Tutorial | Spielbar allein, gegen Robo und an einem Gerät |
| **3 – Online** ✅ | Firebase-Anbindung, Spielzimmer mit Tier-Code, Klingel, Live-Sync für 4 Plätze, Herzschlag, Robo-Einspringen, Gastgeber-Wechsel, Fortsetzen, Cloud-Profile, Spielerpass, Rangliste mit Spielfreunden | 4 Kinder spielen live zusammen |
| **4 – Ausbau** | ✅ Welt-Quiz, Wort-Baumeister, English Words. Offen: Mühle und Dame, später Schach (dazu Wer ist es?, Farbwechsel, Bewegungs-Würfel), Wettkampf-Modus für die Arcade-Spiele | Voller Katalog |

Jede Phase endet mit Tests und einer veröffentlichten Version, die du auf dem Handy ausprobieren kannst.

---

## 10. Umsetzungsnotizen Phase 3

- **Firebase-Projekt** `joyboy-916f0` (Realtime Database in Belgien, anonyme Anmeldung). Die Regeln aus `database.rules.json` sind mit Testkonten gegen die echte Datenbank geprüft (Profile schützen, Zimmer anlegen, Klingel, Gastgeber-Wechsel, fremdes Überschreiben verhindert). Die strengeren Regeln vom 31.10.2026 (nur Mitglieder sehen ein Zimmer, Namensprüfung in der Datenbank) sind noch nicht gegen die echte Datenbank geprüft.
- **Online-Spiele:** alle Regel-Spiele für mehrere (11 Spiele). Lernspiele und Stadt-Land-Fluss laufen online gleichzeitig, sonst reihum. Arcade-Spiele bleiben vorerst an einem Gerät (Wettkampf-Modus ist Phase 4).
- **Zimmer-Code** aus 6 von 16 Tieren (16,7 Millionen Codes, bis Okt. 2026 waren es 4 Tiere); ein Zimmer kann nur neu vergeben werden, wenn es 2 Stunden unbenutzt war.
- **Abwesenheit:** Herzschlag alle 5 s; nach 20 s ohne Herzschlag springt Robo ein bzw. übernimmt das nächste Kind den Gastgeber.
- **Cloud-Spielstände:** jedes Profil bekommt ein anonymes Konto, sobald die Eltern Online erlaubt haben; abgeglichen wird nach Zeitstempel (neuer gewinnt).
