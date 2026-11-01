# Joy-Kart – spielbarer Küstenabschnitt

## Aktuell: Tempoabstimmung `coast-simple-v2`

**Am 01.11., 23:15 CET auf dem iPhone als passend bestätigt:** Nutzer „passt“ zu Tempo/Schub/Lenkbarkeit, gespeicherte Rückmeldung flüssig/gute Bedienung. Zwei gültige Fahrten; [Auswertung und genauer Abnahmeumfang](qa/physical-iphone15/2026-11-01T22-12-41-552Z-e36bde/TEMPO_ACCEPTANCE.md). Diese Abstimmung bleibt bestehen. Grafik und größere Strecken sind weiterhin offen; die folgenden Hinweise zum noch ausstehenden Test sind historischer Umsetzungsstand.

Nach dem echten Test der einfachen v1: sechs gültige Fahrten, aber Grundtempo/Turbo vom Nutzer als zu langsam/kaum spürbar beurteilt; zusätzlich leichtes Ruckeln und träge Bedienung gemeldet. Originaldaten und [Auswertung](qa/physical-iphone15/2026-11-01T21-45-21-143Z-b05a1b/SIMPLE_TEST_ANALYSIS.md) bleiben erhalten. Reproduzierbarer v1-Quell-/Ausgabe-/Browserstand unter `qa/history/coast-simple-v1/`.

- Grundtempo **24 statt 16 m/s** (86 statt 58 km/h). Turbo-Ziel **36 statt 22 m/s** (130 statt 79 km/h), **1,8 statt 1,2 Sekunden** Dauer, deutlich schnellerer Anstieg. Tatsächliche zurückgelegte Strecke ändert sich; keine bloße Tachokorrektur. Seitliche Lenkgeschwindigkeit, Lenkhilfe und sanfte Randbehandlung bleiben erhalten.
- Sanfter Kamera-Bildwinkel von 60 bis 68 Grad während Turbo und leichte Randstreifen. Keine neue 3D-Effektgeometrie, kein Kamerawackeln oder weiterer Bedienknopf. Mit `prefers-reduced-motion: reduce` entfallen Bildwinkelbewegung und Randstreifen; der echte Turbo und die vorhandene Anzeige bleiben wirksam.
- Gleiche Buildbefehle und Ausgabepfade; Versionskennung jetzt `coast-simple-v2`. Browser-QA schreibt **`qa/coast-simple-v2/inline`**, **`phone-edge`** und **`phone-webkit`**, damit v1-Berichte nicht überschrieben werden. Native Prüfung kontrolliert reale Geschwindigkeit, Kamera-/CSS-Effekt und reduzierte Bewegung zusätzlich zur Fahrt/Bedienung/Messspeicherung.
- Neue Handyabnahme, Laufruhe und 1-zu-1-Grafik weiter offen. Kein neues Streckenlayout, keine weiteren Extras oder App-Integration.

## Vorheriger vereinfachter Stand

## Aktuell: vereinfachte Küstenprobe `coast-simple-v1`

Der Nutzer hat `coast-section-v1` nach dem echten iPhone-Test abgelehnt: stark ruckelig, zu schwere Bedienung, schwebende/überlappende Landschaft. Neue bestätigte Richtung: **Auto-Gas, leichtes Lenken, Turbo; keine Sprünge oder Driftpflicht**. Die alte Ausgabe und der physische Originalbericht bleiben unverändert erhalten.

- Quellen: `simple-engine.js`, `simple-world.js`, `simple-view.html`; Build: `build-simple.cjs`.
- Ausgaben: `docs/joy-kart-einfach.html` (eingebettet), `dist/coast-simple.html` (eigenständig).
- 300-m-Teststraße, sichtbare Lenkhilfe; keine ganze Runde/keine Gegner. Die Straße bestimmt die Fahrtrichtung, der Spieler lenkt seitlich. Links halten/ziehen, rechts Turbo tippen, auch gleichzeitig. Tastatur: A/D oder Pfeile, E für Turbo, Escape für Pause.
- Relatives Pad mit neutralem Auflegen, schnellem Abklingen beim Loslassen und sanfter Randbegrenzung. Turbo ist ein echter verbrauchter Schub; drei Boxenreihen füllen einen freien Platz auf. Keine Drift-/Sprung-/Schutz-/Impulsmechanik in dieser Fassung.
- Durchgehender Unterbau bis unter Wasser, getrennte Kulisse; deren interne Stadtdrehung wird außen ausgeglichen. Expliziter QA-Aufruf `inspectGeometry()` prüft tatsächliche transformierte Dreiecke auf Eingriffe in den gesamten Fahrkorridor. Diese Prüfung läuft nicht im normalen Handy-Startpfad.
- Wasser-Distanz im Fragment berechnet; GPU-Pixelvergleich gegen den eingefrorenen alten Build unter `qa/water-regression/`. Kart und Blickziel werden von Anfang an aus derselben Rückansicht verfolgt; Turbo-Material wird vorgewärmt.
- Standalone nutzt die echte sichtbare Höhe inklusive 852 × 283 CSS-Pixel. Die bisherigen Fuchs-/Kart-/Atlasquellen sind wiederverwendet; das 1-zu-1-Grafikziel ist ausdrücklich weiter offen.

Reproduzierbare Befehle mit installierter Node-CLI:

```powershell
& 'C:\Program Files\nodejs\node.exe' prototypes/joy-kart/coast-section/build-simple.cjs
& 'C:\Program Files\nodejs\node.exe' --test prototypes/joy-kart/coast-section/simple-engine.test.cjs prototypes/joy-kart/coast-section/phone-test-server.test.cjs
& 'C:\Program Files\nodejs\node.exe' prototypes/joy-kart/coast-section/water-regression-qa.cjs
& 'C:\Program Files\nodejs\node.exe' prototypes/joy-kart/coast-section/browser-simple-qa.cjs
& 'C:\Program Files\nodejs\node.exe' prototypes/joy-kart/coast-section/browser-simple-qa.cjs --inline
& 'C:\Program Files\nodejs\node.exe' prototypes/joy-kart/coast-section/browser-simple-qa.cjs --webkit --phone
```

Browserberichte unter `qa/simple-*` sind Desktop-Prüfungen, keine iPhone-Abnahme. Die QA nutzt native Eingaben und tatsächlich gefahrene Strecke. Im eingebetteten Edge-Rahmen werden keine Zwischen-Screenshots vor weiteren Eingaben erstellt: Browser-Screenshot-Eingabeproblem reproduziert; die eigenständige Fassung liefert die Sichtbilder. Kein synthetischer DOM-Klick als Ersatz.

## Frühere komplexe Probe (Vergleichsstand)

Separater Entwicklungsabschnitt `coast-section-v1` für Handy/Querformat, Zielgerät iPhone 15/Safari. **Keine ganze Produktionsstrecke und kein Drei-Runden-Rennen.** Die bisherige Testschleife `coast-lab`/`production-v9` bleibt unverändert daneben bestehen. Verbindlicher Stand und Prüfstatus: [PROJECT_STATUS.md](../../../PROJECT_STATUS.md).

## Spielen

`../dist/coast-section.html` ist die eigenständige Handyseite. `docs/joy-kart-kuestenabschnitt.html` im Projekt ist die erzeugte eingebettete Vorschau. Beide benutzen dieselben Regeln und Grafikquellen. Die Three.js-Bibliothek wird versionsgebunden vom CDN geladen; Bilder sind eingebettet.

Vor dem Start eines der fünf Extras auswählen. Auto-Gas übernimmt das Beschleunigen. Links das analoge Pad ziehen, rechts Drift halten; zum Einsetzen eines Extras mit dem rechten Daumen nach oben wischen. Die Itemanzeige lässt sich auch einzeln antippen. Tastatur: Pfeile/A/D zum Lenken, Leertaste zum Driften bei fokussiertem Fahrbereich, E für das Item, Escape für Pause.

Die sichere Brückenlinie bleibt links der Abzweigung verfügbar. Für die optionale Rampe an der markierten Gabelung nach rechts fahren. Ein verpatzter Sprung führt auf die langsamere untere Zufahrt. Nach einer vollständigen Fahrt endet der Abschnitt; zum Vergleich ein anderes Start-Extra wählen und erneut fahren.

## Tatsächliche Regeln

- Eigene Joy-Kart-Simulation mit festem Schritt von 1/120 s. Dies ist eine Weiterentwicklung für den neuen Abschnitt, kein unveränderter Arta-Regelcode. Die alten Arta-Regeln werden nicht bearbeitet.
- Rund 260 m Parameterlänge: Terrassen-S, angekündigter bewegter Hafenkarren, Gabelung, Brücke oder Rampe, Landekorridor, nasse Zone und Zielausfahrt. Noch keine bestätigte Streckengeometrie der späteren Sonnenküste.
- Die Fahrbahn hat ein Höhenprofil. Der Rampenweg startet bei Abschnittskoordinate 100; Absprung bei 120, Landefläche ab 139. Zwischen Absprung und Landefläche fehlt die obere Fahrbahn tatsächlich. Die Flugbahn folgt vertikaler Geschwindigkeit/Schwerkraft; der Renderer liest diesen Zustand.
- Eine misslungene Landung führt zur unteren Bodenstrecke. Diese bleibt langsamer, schließt am Ende wieder an und benötigt ihren eigenen gültigen Bodennachweis. Oberes Deck, Auslauf und gemeinsame Kontrollpunkte bleiben getrennt. Eine saubere Sprungfeder-Landung kann ebenfalls einen gültigen Rampenweg nachweisen.
- Lenken ändert die tatsächliche Weltposition. Drift beginnt erst mit manuellem Halten, Lenkeinschlag, Bodenkontakt und mindestens 8 m/s. Nach mindestens 0,75 s Driftladung gibt korrektes Loslassen einen Schub. Pause und Eingabeabbruch lösen keinen solchen Bonus aus.
- Nasse Innenlinie verändert die Seitenbewegung. Eine griffigere Außenlinie bleibt verfügbar. Die Hafenkarren-Kollision benutzt eine vereinfachte Kontaktform und berücksichtigt Sprunghöhe. Hohe Geschwindigkeit wird mit überstrichenen Längsintervallen geprüft.
- Itemboxen stehen in drei Reihen mit je drei möglichen Sammelpositionen. Ein Itemplatz; kein Aufbewahren mehrerer Gegenstände. Das Start-Extra ist für gezielte Erprobung frei wählbar. Kein Zufallszwang zum Prüfen aller fünf.

| Extra | Vorläufig implementierte Wirkung |
|---|---|
| Turbo | bis 1,35 s Schub, erhöht das Geschwindigkeitsziel, keine Unverwundbarkeit |
| Sprungfeder | echter Sprung; Verbrauch nur mit Bodenkontakt und mindestens 4 m/s; in der Luft bleibt ein neuer Einsatz ungenutzt |
| Schutzblase | ein Kontakt oder maximal 6 s; verhindert die betreffende Trefferstrafe |
| Haftreifen | 3 s stärkerer Grip, auch in der nassen Zone; kein automatisches Lenken |
| Impulsring | bis 6 s auf eine gültige Driftfreigabe oder saubere Landung warten; ein Bonus, danach verbraucht |

Schub setzt eine begrenzte Restdauer; wiederholte Ereignisse addieren keine unbegrenzte Wirkung. Pause friert Effektzeiten ein. Neustart entfernt alte Wirkungen, Routennachweise und Boxenstatus. Der fahrbare Abschnitt verwendet vorläufige Werte; diese sind keine abgeschlossene Spielbalance.

## Dateien und Aufbau

- `section-engine.js`: reine Simulation, Streckenfunktionen und Kontrollpunktfolge.
- `section-engine.test.cjs`: 13 Tests, darunter alle drei Routen, tatsächliche Flugbahn, Sprungfeder auf der Rampe, oberes Deck vor tieferem Boden, fünf Extras, kein Impulsbonus nach misslungenem Sprung, Pause und gleiche Ergebnisse bei 30/60/120 Render-FPS.
- `section-view.html`: wörtliche Vorschauquelle, 3D-Fahrbahnen/Terrasse/Brücke, Eingaben und Oberfläche. Die bestehenden Fuchs-/Kart-/Küsten- und Lichtquellen werden wiederverwendet. Die entfernte Küstenwelt erhält eine leere Route, weil der Abschnitt eigene Fahrbahnen und Brüstungen besitzt.
- `build-section.cjs`: erzeugt ausschließlich die zwei neuen Abschnittsseiten; überschreibt die bisherige Testschleife nicht.
- `browser-section-qa.cjs`: eingebettete Browserprüfung mit echten Browser-Eingaben, allen Extras, zwei Touchpunkten, Pause, Breiten und drei gefahrenen Wegen. Für den Auffangweg wird die Anfahrt absichtlich an der Brüstung verlangsamt; der Test versetzt das Kart nicht. Die Kamera muss dem tieferen Kart folgen.
- `standalone-section-qa.cjs`: kurzlebiger Loopback-Server, native Touch-Taps und Eingaben auf der eigenständigen Seite. `--webkit` verwendet Desktop-WebKit mit iPhone-15-Querprofil.
- `phone-test-server.cjs` und `phone-test-client.html`: eigener begrenzter WLAN-Test mit festgehaltener Spielversion, Startmessung, getrennten Fahrten und Speicherung auf ausdrücklichen Knopfdruck. Anleitung: [PHONE_TEST.md](PHONE_TEST.md).

Diagnosezugang: `document.getElementById('joy-kart-coast-section').__joyKartSection.snapshot()`. `setTestInput()` setzt nur Lenken/Drift für die reproduzierbare Browserfahrt; es versetzt das Kart nicht und vergibt keinen Fortschritt. Es gibt keinen automatischen Rennpiloten in der Benutzeroberfläche.

```powershell
node prototypes/joy-kart/coast-section/build-section.cjs
node --test prototypes/joy-kart/coast-section/section-engine.test.cjs
node prototypes/joy-kart/coast-section/browser-section-qa.cjs
node prototypes/joy-kart/coast-section/standalone-section-qa.cjs
node prototypes/joy-kart/coast-section/standalone-section-qa.cjs --webkit
```

Im eingeschränkten Windows-Sandbox-Kontext ggf. die reguläre Werkzeug-Eskalation verwenden. Die Testskripte schließen Browser und Loopback-Server in `finally`. Kein dauerhaft gestarteter Handyserver und kein öffentlicher Upload.

## Prüfungen richtig einordnen

Nur `status: passed` für den Hash der aktuellen Datei zählt. `qa/report.json` gehört zum eingebetteten Fragment; `qa/standalone-chromium/report.json` und `qa/standalone-webkit/report.json` zur eigenständigen Seite. Ein älterer Bericht passt nach einem neuen Build möglicherweise nicht mehr. Browser-FPS und Startzeiten stammen vom Prüf-PC, nicht vom iPhone.

Bei der ersten Sichtprüfung wurden nach unten gerichtete Fahrbahn-Dreiecke gefunden und korrigiert. Der Testbrowser stellte nach einer Vollseiten-Bildaufnahme keine nativen Klicks mehr an den Vorschaurahmen zu. Zugeschnittene Aufnahmen des Spielbereichs erhalten die Eingaben; die Prüfung verwendet echte Klicks/Taps und zwei echte Browser-Touchpunkte, keine synthetischen DOM-Klicks als Ersatz.

Die grafischen Quellen stammen weiterhin aus `production-v9`. Dieser Abschnitt erreicht die filmische Originalvorschau nicht 1 zu 1. Neue Geometrie und bestandene Fahrregeln schließen die offene Grafikproduktion nicht ab. Nicht auf dem physischen iPhone geprüft; insbesondere Erreichbarkeit, manuelles Driften, Safari-Leisten, Start und Dauerlast sind dort offen.

Abschlussstand 1. November 2026: 13 Simulationstests und vollständige eingebettete Edge-Prüfung bestanden. Alle drei Wege bis zum gültigen Ziel gefahren: Hauptlinie ca. 13,892 s, saubere Rampenfahrt ca. 14,375 s, Auffangweg ca. 17,758 s. Dies sind automatisierte Prüffahrten mit zwei/drei Treffern, keine Bestzeiten und keine fertige Risikoweg-Balance. Auch eigenständige Edge- und Desktop-WebKit-Prüfung mit iPhone-15-Querprofil bestanden: native Start-/Item-Taps, gehaltener Maus-Pointer als Lenkproxy, Freigabe, Pause und drei Handyformate. Keine physische Mehrfinger- oder Leistungsabnahme.

Fragment: **935.834 Bytes**, SHA-256 `fad740d5fc651c651008c7f72c9b9a2497bb2f2f3bae439f3a337f20f4e0e9b3`. Eigenständige Seite: **936.248 Bytes**, SHA-256 `628eacfe25c956f684404783ee64779e5b79ad58643a05d45ee2e2d8f1264f14`. Die drei genannten Berichte müssen diese passenden Hashes enthalten.

Sichtprüfung: Start/Terrassen-S, Hauptbrücke, Rampenflug, unterer Auslauf, Itemeffekte und kleine Ansicht angesehen. Die entfernte Küstenkulisse wurde um 180 m hinter den Abschnitt versetzt, damit deren dekorative Felsen/Bauwerke nicht in die Fahrbahn ragen. Die Kamera folgt dem tatsächlichen Höhenzustand; der Auffangweg erhält keine Erfolgsmeldung oder Impulsbelohnung für eine saubere Sprunglandung. Offene UI-Feinarbeit: die allgemeine Schubmeldung unterscheidet Impuls-/Lande- und Drift-Schub noch nicht durchgehend präzise.

## Nächste Schritte

1. Auf iPhone 15/Safari im Querformat alle fünf Extras und beide Sprungausgänge fahren; Start, Mehrfingerbedienung und Leistung getrennt erfassen. Dafür den neuen Abschnittsserver aus [PHONE_TEST.md](PHONE_TEST.md) verwenden. Der bestehende `../phone-test-server.cjs` und sein Testdaten-Wrapper zielen auf die alte Testschleife/`__joyKart`; nicht als neuer Abschnittstest verwenden. Der alte WLAN-Link ist abgelaufen.
2. Lenkempfindlichkeit, Driftladung, Sichtweite des Karrens und Zeitkosten des Auslaufs nach echten Fahrversuchen abstimmen. Der Abschnitt besitzt noch keinen Robo und keine Konkurrenzkollisionen.
3. Fuchs, Kart und nahe Küstenwelt anhand echter Fahrbilder an die Originale angleichen. Danach bestätigte Linien in eine ganze Sonnenküstenstrecke mit drei Runden à 40–60 s überführen. Neonstadt und Joyboy-Integration folgen später.

## Sonnenküsten-Duell im WLAN

Im Projektordner mit `node prototypes/joy-kart/coast-section/duel-server.cjs` starten. Den ausgegebenen Link mit der WLAN-Adresse des PCs auf beiden Geräten öffnen. Der PC muss wach bleiben. Die Sitzung endet nach einer Stunde, Strg+C beendet sie früher. WebGL 2 wird benötigt. Die 3D-Bibliothek wird vom PC mitgeliefert.

Beide Spieler tippen zuerst auf **Beitreten**, anschließend auf **Bereit**. Links durch Ziehen lenken, rechts das gesammelte Item einsetzen. Am PC steuern A/D oder die Pfeiltasten, E setzt das Item ein. Am Ziel werden die Zeiten beider Fahrer verglichen. Beide können eine Revanche starten. Nach zehn Sekunden ohne Kontakt gibt der Server den Platz frei und führt den verbleibenden Fahrer in die Aufstellung zurück.

Nach Quellenänderungen mit `node prototypes/joy-kart/coast-section/build-simple.cjs --duel` bauen. Der lokale Zwei-Browser-Test läuft mit `node prototypes/joy-kart/coast-section/duel-qa.cjs`.

## Drei-Runden-Cup in Joyboy

Sonnenbucht (1.664 m je Runde) und Kap der Winde (1.728 m) sind geschlossene Kurse. Vor dem Robo-Rennen oder in der Spielauswahl des Zimmers lässt sich der Startkurs wählen. Die Joyboy-Revanche wechselt zum anderen Kurs. Das separate PC-Spiel bietet den Kurswechsel im Startmenü an. Der private WLAN-Testserver startet die Sonnenbucht.

Pro Runde gibt es zehn Boxenreihen. Die Farbe zeigt das Item. Ein freier Slot nimmt beim Durchfahren eine Box auf. Gold gibt 1,8 Sekunden Turbo, Blau zwölf Sekunden Schild für einen Treffer, Violett zwölf Sekunden Magnet für Boxen aus jeder Spur. Koralle löst eine Welle aus, die das andere Kart bis 85 Streckenmeter entfernt 2,2 Sekunden abbremst. Der Schild löst auch eine bestehende Verlangsamung. Die Rundenanzeige, Kurskarte und beide Fahrerpunkte gehören zur 3D- und App-Kompaktansicht.
