# Joy-Kart – fahrbare Handy-Teststrecke

Isolierter Prototyp, Stand 1. November 2026. Die bestehende Joyboy-App wird von diesem Ordner aus weder verändert noch veröffentlicht.

**Grafikstatus:** Der Nutzer verlangt die Grafik der ursprünglichen Vorschau 1 zu 1. Die aktuelle fahrbare Grafik erfüllt diese Vorgabe nicht und wurde nicht als Ersatz freigegeben. Originalbilder, Merkmale und fehlende Grafikassets stehen in [art-reference/ART-DIRECTION.md](art-reference/ART-DIRECTION.md).

## Ausprobieren

Die Chat-Vorschau unter `docs/joy-kart-fahrtest.html` ist tatsächlich fahrbar. Zusätzlich erzeugt der Build `prototypes/joy-kart/dist/index.html` als eigenständige Browserseite.

**Aktuell `production-v9`, reine Teststrecke** (`coast-lab`). Fuchsblick/Nase, Kartform, Küstenoberflächen und Licht überarbeitet; Grafikziel weiter offen. **Zuletzt auf dem Zielgerät iPhone 15/Safari gemessen: `production-v8`**, dort ca. 2,1 s Start und 52 FPS Median gegen Robo. [Dritter Bericht](qa/history/production-v8/physical-iphone15/THIRD_RUN.md). Diese Werte sind kein Nachweis der neuen Grafikfassung. Testablauf: [PHONE_TEST.md](PHONE_TEST.md), Startzeitbefund: [STARTUP.md](STARTUP.md).

**Neue Spielplanung:** [JOY-KART-PLANUNG.md](../../docs/JOY-KART-PLANUNG.md). Bestätigt sind Sonnenküste/Neonstadt, anspruchsvolles Fahren, Auto-Gas mit manuellem Driften, 2–3 Minuten Rennen und langsamer Auslauf nach Fehlern. Layouts, Hindernisse und Tempo-/Sprung-/Schutzextras sind Entwürfe; noch keine neuen Strecken oder Items implementiert. Die derzeitige Runde ist keine fertige Sonnenküsten-Produktionsstrecke.

- **Lenken:** Links-/Rechtsflächen gedrückt halten, alternativ Pfeiltasten oder A/D.
- **Turbo:** Blitz antippen oder die Leertaste drücken. Ein Start-Turbo ist vorhanden; die goldenen Sammelobjekte auf der Strecke laden einen weiteren auf.
- **Drift:** Eine Kurve länger halten und wieder loslassen. Ein geladener Drift bringt einen Mini-Turbo.
- **Lenkhilfe:** Folgt der Strecke; die Lenktasten verschieben die gewünschte Spur. Ohne Hilfe lenkt man das Fahrzeug frei.
- **Pause:** Hält Bewegung, Countdown und Rennuhr an. „Auf die Fahrbahn zurück“ hilft nach einem Ausflug ins Gras, ohne Rundenfortschritt zu vergeben.
- **Ziel:** Drei gefahrene Runden. Es gibt keinen vorgegebenen Ergebnis-Timer.
- **Robo:** Ein Computergegner mit echter Position, Tempo, Kollisionen und eigenem Rennfortschritt. Im Zeitfahren wird er ausgeblendet.
- **Modelle ansehen:** „Die neuen Karts ansehen“ öffnet eine drehbare Nahansicht. Fuchs und Panda lassen sich unabhängig vom Rennmodus betrachten. Das Drehen verändert keinen Spielstand.

## Lokal bauen und prüfen

Vom Joyboy-Projektordner aus:

```powershell
node prototypes/joy-kart/build-preview.cjs
node --test prototypes/joy-kart/race-engine.test.cjs
node --test prototypes/joy-kart/character-sculpt.test.cjs
node --test prototypes/joy-kart/indexed-batching.test.cjs
npx tsc --noEmit --strict --target ES2022 --module commonjs --moduleResolution node --lib ES2022,DOM --skipLibCheck prototypes/joy-kart/physics.ts prototypes/joy-kart/race-engine.ts
node prototypes/joy-kart/browser-qa.cjs
node prototypes/joy-kart/browser-qa.cjs --standalone --smoke
node prototypes/joy-kart/phone-qa.cjs --benchmark
node prototypes/joy-kart/batching-browser-qa.cjs
node prototypes/joy-kart/startup-qa.cjs --cpu=4
node prototypes/joy-kart/phone-test-server.cjs
```

Die vorhandene TypeScript-Installation wird nur zum Übersetzen des Prototyps verwendet. Die Haupt-App bekommt keine zusätzliche Abhängigkeit.

Der Browsercheck nutzt vorhandenes Playwright oder die gebündelte Codex-Runtime und installiertes Edge. Die eingebettete Variante braucht zusätzlich Python und den Visualize-Renderer; `--standalone` kommt ohne diese beiden Helfer aus. Mit `--smoke` werden Modellansicht, Eingaben und Layout geprüft, der vollständige Zieleinlauf entfällt. Konfiguration und aktuelle Übergabe stehen in [PROJECT_STATUS.md](../../PROJECT_STATUS.md). Berichte mit Build-Prüfsumme und Bilder liegen unter `qa/latest/inline/` und `qa/latest/standalone/`.

Zum Öffnen als lokale Browserseite:

```powershell
python -m http.server 5178 --bind 127.0.0.1 --directory prototypes/joy-kart/dist
```

Dann `http://127.0.0.1:5178` öffnen. Der Server zeigt ausschließlich den erzeugten Prototyp-Ordner. `127.0.0.1` ist nur auf demselben Rechner erreichbar. Eine Prüfung auf einem separaten Handy benötigt einen dafür erreichbaren Link oder einen gesondert gestarteten lokalen Netzwerkserver.

## Aufbau und Grenzen

- `physics.ts`: Fahrregeln aus [Arta/kart.ts](https://github.com/amirhossin27-dev/Arta/blob/main/src/games/kart.ts), abgerufen am 1. November 2026. Lediglich der Typimport für die beiden Plätze wurde lokal ersetzt.
- `race-engine.ts`: Eigenständiger Rennablauf mit festen Simulationsschritten von 1/120 Sekunde, Pause, Wiederaufnahme, Rücksetzen auf die Fahrbahn und Ergebnis.
- `drive-view.html`: Neue 3D-Ansicht, prozedurale Modelle, Materialien, Schatten, Kamera, Touch-Eingaben, Ton und Qualitätswahl.
- `kart-models.js`: Ausgearbeitete Fuchs- und Pandafiguren, Reifenprofile, Felgen, Aufhängung, Motor, Auspuff, Rennsitze, Startnummern und bewegte Details. Statische Bauteile werden nach Material zusammengefasst.
- `indexed-batching.js`: Aktuelle Bündelung aus `production-v7`; gemeinsame Punkte bleiben indiziert, statt sie für jedes Dreieck zu kopieren. Positionen, Normalen, UVs, Farben und Dreiecksreihenfolge bleiben erhalten. `indexed-batching.test.cjs` prüft Attribute, gemischte Teile und große Indizes; `batching-browser-qa.cjs` prüft die wirklichen Bauteile und direkte WebGL-Bildwerte gegenüber dem gesicherten `production-v6`-Build.
- `kart-scenery.js`: Küstendorf mit 11 Häusern, 19 Palmen, bewegtes Wasser, Bepflanzung und ein ausgearbeitetes Starttor mit Fahnen.
- `production-karts.js`: Aktive Karts/Körper auf Basis der Fahrzeuggeometrie aus `production-v4` und der Geometriehilfen aus `kart-models.js`; in `production-v6` mit neuen Köpfen verbunden. Breitere, glatt interpolierte Karosserie mit aufliegenden Lackmarkierungen, tatsächlich sichtbaren Kühlerstreben und geformtem Heck; freiliegender Motor, Aufhängung, Rennreifen und Felgen. Die Modelle bleiben frei drehbare Geometrie.
- `character-sculpt.js`: Aktive Köpfe in `production-v6`; zusammenhängende, geformte Oberflächen statt aufgesetzter Schnauzen-/Wangenbauteile. Augenhöhlen, gekrümmte Ohrmuscheln, detaillierte Augen, gerichtetes Fell und hinter dem Kopf geführte Brillenriemen. `production-karts.js` bindet sie an die bisherigen Körper/Karts an. Der reine Fuchskopf umfasst 21.314 Punkte/42.624 Dreiecke, der Pandakopf 18.842/37.680; zusätzliche Ohren, Augen und Fell kommen hinzu.
- `production-coast.js`: Zusätzliche 98 entfernte Häuser und 24 Häuser in acht Gruppen direkt neben der Strecke, drei steinerne Bogenbrücken, Küstenfelsen, Burg, Zypressen, Laternen, Blumen, Boote und vier bewegte Wasserfälle. Die Nahfassaden haben Bögen, Fensterläden, Balkone, Markisen, Dachziegel und Kletterpflanzen. Balustraden, Stützmauern und gepflasterte Seitenbereiche folgen der Strecke. Dekor liegt außerhalb der Fahrbahn.
- `production-lighting.js`: Aktuelle Lichtfassung `production-v5`. Direkte Darstellung des Panoramas aus der ursprünglichen Auflösung, eigene kleinere Reflexionskarte, zum dargestellten Sonnenstand passende Hauptbeleuchtung, kühles Fülllicht und ein weicher Übergang des fernen Wassers in den Bildhintergrund.
- `browser-qa.cjs`: Im Projekt gespeicherte, erneut ausführbare Browserprüfung; Berichte enthalten Ziel, Prüfumfang und SHA-256 des geprüften HTML-Builds.
- `phone-qa.cjs`: Zusätzliche Funktions-/Bildzeitprüfung in lokalem WebKit mit iPhone-15-Geräteprofil; Bericht unter `qa/latest/iphone15-webkit/`. Vorhandene Playwright-WebKit-Installation nötig, standardmäßig Version 26.5/v2336 in dieser Prüfumgebung. Mit `--engine=chromium` ist ein anderer lokaler Prüfbrowser wählbar.
- `phone-test-server.cjs`: Privater, zeitlich begrenzter WLAN-Zugang zum erzeugten Spiel, optional mit vom Nutzer bedienter Messfunktion. Zustand in `qa/phone-server.json`; nur ein tatsächlich vom Nutzer auf dem Handy gespeicherter Bericht gehört unter `qa/latest/physical-iphone15/`.
- `startup-qa.cjs`: Zerlegt den Seitenstart in Aufbau-/Renderphasen; optional gedrosselte PC-CPU. `snapshot().startup` erfasst dieselben nativen Startmarken im aktuellen Spiel und damit erstmals im gespeicherten Telefonbericht. Technik und Grenzen in [STARTUP.md](STARTUP.md).
- `assets/`: Mit dem eingebauten Bildgenerator anhand der Originalreferenzen erzeugter Materialatlas und Küstenpanorama, jeweils als Original-PNG und kleinerer WebP-Laufzeitexport. Prompts und Verwendung stehen in [assets/GENERATION.md](assets/GENERATION.md).
- `build-preview.cjs`: Erzeugt Chat-Vorschau und eigenständige Browserseite aus denselben Quellen.
- `race-engine.test.cjs`: Acht Tests für echte Bewegung, Turbo, Gras, Pause, Bildratenunabhängigkeit, Rücksetzen, Robo und den Zieleinlauf.
- `character-sculpt.test.cjs`: Zwei Tests auf endliche Werte, Einheitsnormalen, geschlossene Kanten, Zusammenhang und Topologie beider Köpfe.

Die Grafik verwendet [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), fest auf Version 0.180.0 gesetzt, und benötigt WebGL 2. Wiederholte Landschaftsobjekte werden mit [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) gezeichnet. Die 3D-Bibliothek und Schriftdateien werden von CDNs geladen; Fahrzeug-, Strecken- und Landschaftsgeometrie entsteht lokal im Browser. Es werden keine App-Profile, Firebase-Daten oder bestehenden Rekorde verwendet.

Dies ist eine Fahr- und Leistungserprobung mit eigens modellierten, stilisierten 3D-Fahrzeugen und Figuren. Die zuvor gezeigten filmischen Zielbilder dienen weiterhin als grafische Richtung. Die Modelle entstehen aus Geometrie und prozeduralen Materialien; ein vollständiger Produktionsumfang mit handgemalten Texturen, ausgearbeiteter Fellgrafik und komplexen Figurenanimationen ist damit noch nicht erreicht.

`production-v3` setzt zusätzlich erzeugte Fell-, Asphalt- und Steintexturen ein. Das Küstenpanorama ist eine statische ferne Umgebung und liefert Reflexionslicht; seine fernen Berge und Gebäude sind keine begehbare Geometrie. Die näheren Küstenbauwerke, Fahrzeuge und Fahrbahn werden dreidimensional gerendert. Die neue Fassung ist ein weiterer Produktionsstand, keine erreichte oder vom Nutzer freigegebene 1-zu-1-Umsetzung der Originalbilder.

## Nächster Schritt

Die beiden Produktionslayouts mit Kurvenlinien, Sprüngen, Auffangwegen, Hindernissen und Extras konkretisieren; parallel Figuren-/Fahrzeugqualität und Küstenassets weiter an die Originale angleichen. Das bisherige Layout bleibt Test. Geplantes manuelles Driften erfordert eine eigene Umsetzung und ist nicht mit dem bisherigen Drift-Ablauf gleichzusetzen. Startzeit/Fahrverhalten auf dem Zielgerät nach weiteren Änderungen mitprüfen. Grafikziel weiter offen, danach erst Joyboy-Anbindung; andere Spiele später.

## Bisherige Prüfung

- Acht Regeltests bestanden; separater strenger TypeScript-Check ohne Fehler.
- Browserprüfung bei 320, 390, 430 und 736 Pixeln Fensterbreite; keine horizontale Überbreite, Lenktasten 64 × 64 Pixel, Turbo 70–74 Pixel.
- Zwei gleichzeitige Berührungen geprüft: Lenken halten, Turbo drücken und loslassen, weiter lenken, schließlich Lenkung loslassen.
- Countdown-Pause, angehaltene Rennuhr, Wiederaufnahme, Tastatur, Tonanzeige, Qualitätswahl und Rücksetzen geprüft.
- Ein vollständiges Zeitfahren im Browser nach rund 45,67 Sekunden und drei gefahrenen Runden beendet; Ergebnis und Rückkehr zur Vorbereitung ohne Skript- oder Grafikfehler.
- Basisfassung: Im Prüf-Browser bei Geräteskalierung 2 ungefähr 60 FPS, 60–110 Zeichenaufrufe und rund 66.000–70.000 Dreiecke pro Bild. Dies ist keine Messung auf einem physischen Handy.
- Eigenständige Browserseite ohne Chat-Hilfsfunktionen bei 390 × 844 und 844 × 390 Pixeln geprüft: bildschirmfüllend, alle Bedienelemente erreichbar, keine Skriptfehler.

## Prüfung der Modellüberarbeitung

- Acht Fahrregeltests weiterhin bestanden. Die Fahrphysik wurde für die Grafiküberarbeitung nicht geändert.
- Nahansicht öffnen, per Berührung drehen, Panda/Fuchs wechseln und zur Vorbereitung zurückkehren geprüft; Rennen und Fortschritt bleiben dabei angehalten.
- Vollständiges Drei-Runden-Zeitfahren mit Ergebnis und Rückkehr zur Vorbereitung bestanden, ohne Skript- oder Grafikfehler.
- Erneute Prüfung von 320, 390, 430 und 736 Pixeln Fensterbreite: keine horizontale Überbreite, alle Lenktasten und Turbo vollständig im Bild.
- Neue Modellansicht auch auf der eigenständigen Browserseite bei 320, 390 und 430 Pixeln geprüft: Drehen, Figurenwechsel und Rückkehr ohne Fortschrittsänderung. Fahransicht bei 390 × 844 und 844 × 390 Pixeln weiterhin bildschirmfüllend und ohne Skriptfehler.
- Im Prüf-Browser weiterhin rund 60 FPS: im Zeitfahren an den gemessenen Stellen 75–95 Zeichenaufrufe und etwa 128.000–141.000 Dreiecke; im Robo-Lauf rund 98 Zeichenaufrufe und 152.000 Dreiecke. Geräteskalierung 2, automatische Auflösung bis 1,25. Diese Werte beschreiben den Prüf-Rechner.

## Prüfung der ersten Produktionsassets (`production-v3`)

- Acht Fahrregeltests bestanden; die Fahrphysik blieb unverändert.
- Beide erzeugten Bildassets im Projekt gespeichert und in der laufenden 3D-Szene verwendet. Der Vorschau-Build umfasst 868.234 Bytes und bleibt unter der Größenbegrenzung.
- Modellansicht mit Fuchs/Panda, Drehung per Touch und Rückkehr bestanden, ohne Rennfortschritt zu verändern.
- Eingebettete Vorschau bei 320, 390, 430 und 736 Pixeln Fensterbreite geprüft: keine horizontale Überbreite, alle Lenktasten und Turbo im Bild.
- Modus, Ton, Countdown-Pause, Tastatur, gleichzeitiges Lenken und Turbo, unabhängiges Loslassen, Pause mit angehaltener Uhr, Qualitätswahl und Rücksetzen bestanden.
- Vollständiges Drei-Runden-Rennen nach rund 45,68 Sekunden beendet; Ergebnis und Rückkehr zur Vorbereitung geprüft. Keine Skript- oder Grafikfehler.
- Eigenständige Fahransicht im Hoch- und Querformat gerendert. An den gemessenen Stellen rund 53–60 FPS, 110–144 Zeichenaufrufe und etwa 667.000–746.000 Dreiecke pro Bild; Geräteskalierung 2, automatische Auflösung 1,25. Keine Messung auf einem physischen Handy.
- Sichtprüfung gegenüber den Originalen: Der Abstand in Figurenform, Ausarbeitung und naher Umgebung bleibt deutlich. Die Tests belegen Funktion, keine erreichte grafische Übereinstimmung.

## Prüfung der Modell- und Küstenüberarbeitung (`production-v4`)

- Bestehende Materialbilder weiterverwendet; keine neuen Konzeptbilder als Spielgrafik ausgegeben. Die Laufzeit leitet eine neutrale Fellkarte ab und kombiniert sie mit den Farben der geformten Figur. Beim Zusammenfassen von Bauteilen bleiben diese Geometriefarben jetzt erhalten.
- Die Ausrichtung der Fell-Dreiecke und ihrer Beleuchtungsnormalen korrigiert; winzige Schrauben, Glanzpunkte und dünne Reifenringe verwenden eine angemessene Geometrieauflösung. Die entfernte Stadt wird aus dem lokalen Schattenpass herausgehalten.
- 133 Häuser insgesamt, davon 24 neue nahe Fassaden, sowie 730 wiederverwendete Baluster. Geometrische Böschungen fallen außerhalb der äußeren Stützmauer zum Meer ab. Terrain und bestehende Gebäude verwenden dieselbe Höhenfunktion; die Fahrphysik wurde nicht verändert.
- Modellansicht mit Fuchs/Panda, Touch-Drehung, Modus, Ton, Countdown-Pause, Tastatur, gleichzeitiges Lenken und Turbo, unabhängiges Loslassen, Pause, Qualität und Rücksetzen im Browser bestanden.
- Erneute Layoutprüfung bei 320, 390, 430 und 736 Pixeln Fensterbreite: keine horizontale Überbreite; Steuerflächen vollständig erreichbar. Zusätzliche Sichtprüfungen an fünf Stellen der gefahrenen Runde.
- Vollständiges Drei-Runden-Zeitfahren nach rund 45,67 Sekunden beendet; Ergebnis und Rückkehr zur Vorbereitung ohne Skript- oder Grafikfehler.
- Gemessene Stellen des Zeitfahrens: rund 53–60 FPS, 117–146 Zeichenaufrufe und etwa 954.000–997.000 gerenderte Dreiecke pro Bild einschließlich Schattenpässen. Geräteskalierung 2, automatische Auflösung 1,25. Dies beschreibt den Prüf-Rechner, kein physisches Handy.
- Vorschau-Build: 878.933 Bytes. Die 1-zu-1-Grafikvorgabe bleibt offen; insbesondere Figur, Beleuchtung, Materialabstimmung und Schärfe der entfernten Umgebung erreichen das Original noch nicht.

## Prüfung von Licht, Materialien und Hintergrund (`production-v5`)

- Originales Panorama als neuer Laufzeitexport `coast-panorama-v2.webp` in 1774 × 887 Pixeln statt 1536 × 768 verwendet. Direkte Hintergrunddarstellung mit separater 512 × 256 Reflexionskarte; keine zusätzlichen Bilddetails erfunden.
- Sonnenrichtung an der sichtbaren Sonnenposition ausgerichtet, Himmels-/Fülllicht und Belichtung abgestimmt. Lackschicht, Gummistruktur, Sitzoberfläche und Gewebe mit eigener Materialwirkung ergänzt. Das ferne Wasser blendet weich in den Hintergrund über.
- Eingebettete Vollprüfung mit dem gespeicherten Skript bestanden: Modellansicht, Touch-Drehung, Eingaben, Pause, Ton, Qualität, vier Breiten, fünf zusätzliche Streckenstellen und ein Drei-Runden-Rennen mit Ergebnis/Rückkehr nach ca. 45,675 Sekunden; keine Skript-/Grafikfehler.
- Eigenständige Smoke-Prüfung bei 320 × 740, 390 × 844, 430 × 932 und 844 × 390 Pixeln bestanden; keine Überbreite, alle Fahrbedienelemente im Bild, keine Skript-/Grafikfehler.
- Die damaligen Berichte samt Nahansichten sind inzwischen unter `qa/history/production-v5/inline/` und `standalone/` archiviert; `qa/latest/` gehört zur aktuellen Fassung.
- Beobachtet: im eingebetteten Zeitfahren an den erfassten Stellen ca. 60 FPS, eigenständige Smoke-Messung ca. 52 FPS; Robo-Sichtprüfung ca. 51–60 FPS. Geräteskalierung 2, automatische Auflösung 1,25, Prüf-Rechner; physisches Handy weiterhin offen.
- Fragment: 972.276 Bytes. Sichtvergleich: Wasserübergang und Beleuchtung wurden verbessert; die Ferne bleibt durch die Winkelauflösung der vorhandenen Bildquelle begrenzt. Die geforderte 1-zu-1-Grafikqualität ist weiterhin nicht erreicht.

## Figuren- und erster iPhone-Prüfstand (`production-v6`, Vergleichsbasis)

- Zwei neue Geometrietests bestanden. Beide Köpfe sind geschlossene, zusammenhängende Oberflächen mit gültigen Normalen. Sichtprüfung von Fuchs/Panda in tatsächlicher Modellansicht durchgeführt; trotzdem bleibt deutlicher Abstand zur filmischen Vorlage.
- Eingebettete Edge-Vollprüfung bestanden: Modellansicht und Drehung, Modus, Ton, Countdown-Pause, Tastatur, zwei gleichzeitige Touch-Punkte, unabhängiges Loslassen, Pause, Qualität, Rücksetzen, vier Breiten, fünf Streckenstellen und drei tatsächlich gefahrene Runden mit Ziel/Ergebnis/Rückkehr nach ca. 45,617 Sekunden. Keine Skript-/Grafikfehler.
- Eigenständige Smoke-Prüfung separat bestanden. Diese Reports sind inzwischen unter `qa/history/production-v6/` archiviert; `qa/latest/` beschreibt die neue Fassung. Die Physik wurde nicht geändert; die acht Regeltests wurden für diese reine Grafikänderung nicht erneut ausgeführt.
- Eingebettete Stichproben auf dem Prüf-PC ca. 59–60 FPS, 121–150 Zeichenaufrufe und ca. 997.000–1.040.000 Dreiecke einschließlich Schattenpässen; eigenständige Smoke-Stichprobe ca. 52 FPS. Kein Leistungsnachweis für das iPhone.
- Zusätzlicher WebKit-Funktionstest mit iPhone-15-Profil bestanden: echte Touch-Taps, gehaltene Lenkung per Maus-Pointer-Proxy, Turbo, Pause und vier Telefonansichten. Bei simulierten 59 px oberen/34 px unteren sicheren Rändern liegen HUD/Steuerung 69/46 px vom Rand. Native Safari-Bedienleisten und physisches Mehrfingerverhalten bleiben offen.
- Lokaler Desktop-WebKit-Befund: unabhängig per `requestAnimationFrame` ca. 5 FPS im Rennen, 46 FPS in Pause; automatische Renderauflösung 0,75. **Keine Leistungsfreigabe.** Ursache und tatsächliche iPhone-Bildrate offen. Gemeldetes „Apple GPU“ ist in dieser Umgebung kein Beweis echter Apple-Hardware.
- Chatfragment 982.579 Bytes (noch 17.421 bis zur 1-MB-Grenze), eigenständige Seite 983.849 Bytes. Keine weiteren großen eingebetteten Bildassets ohne Änderung der Vorschau-Verpackung.
- Privater WLAN-Testlink lokal geprüft: Testknopf ohne Steuerüberlappung, Messdialog/Pause/Weiterfahren, 404 für andere Pfade und 403 für eine unberechtigte Messanfrage. Kein physischer Messbericht während der Automation gespeichert. Der zeitlich begrenzte Server bleibt für den Nutzer aktiv; Zustand/Endzeit in `qa/phone-server.json`.
- Danach erster Nutzertest auf iPhone 15/Safari: 99 überlappende Rennstichproben von Sekunde 3,242 bis 42,892, Median 46 FPS, 31–52 FPS. Drei Runden im Zeitfahren mit Lenkhilfe beendet (43,267 s). Automatische Render-Pixelratio konstant 1,25. Rückmeldung: **leichtes Ruckeln**. Vollständige Auswertung und unveränderter Bericht unter `qa/history/production-v6/physical-iphone15/`.

## Geometrieoptimierung (`production-v7`, historisch)

- Geometrie-Bündelung erhält die Indizes der ursprünglichen Bauteile. Vier neue Tests sowie die beiden Kopfgeometrietests bestanden. Dreiecksanzahl und sichtbare Details wurden nicht reduziert.
- Alle eindeutigen, von der Szene referenzierten Geometrien einschließlich ausgeblendeter Modelle: 2.833.860 → 1.848.717 Punkte (−34,76 %); Attribut-/Indexpuffer 94.483.192 → 67.887.940 Bytes (−28,15 %). Diese Speicherzahl schließt Texturen, Renderziele und andere CPU-/GPU-Daten nicht ein.
- Browservergleich prüft 128 reale Materialbündel mit insgesamt 887.834 Dreiecken und 22.030.752 Attributwerten auf exakte Erhaltung. Kumulierte Prüfwerte, keine Dreiecke eines einzelnen Bildes.
- Direkte WebGL-Bildwerte von Fuchs-, Panda- und Startansicht bei 491 × 801 Renderpixeln gegenüber dem gesicherten Vorgänger jeweils exakt identisch. Zusammengesetzte Browser-Screenshots: Fuchs/Panda identisch; Startansicht 76 Pixel mit maximal 1/255 Rundungsabweichung. Bericht und Bilder: `qa/latest/indexed-batching/`.
- Vollständige eingebettete Edge-Regression einschließlich Drei-Runden-Ziel nach ca. 45,675 s, eigenständige Smoke-Prüfung und WebKit-Funktionsprüfung bestanden. Keine Skript-/Grafikfehler. Desktop-WebKit-Stichprobe 9 FPS Rennen/58 FPS Pause; weiterhin kein Ersatz für einen Gerätetest.
- Fragment 983.472 Bytes, eigenständige Seite 984.742 Bytes. Alle aktuellen Prüfberichte nennen den jeweiligen Build-Hash. Der unveränderte physische Erstbericht gehört ausdrücklich zu `production-v6`; erneute `production-v7`-Messung vom Nutzer angefragt.
- Nachgewiesen sind weniger Geometriepuffer und erhaltene Bildwerte in den geprüften Ansichten. **Verbesserte iPhone-Bildrate noch nicht nachgewiesen; 1-zu-1-Grafikziel weiter offen.**

## Seitenstart und dritter Nutzertest (`production-v8`, Vergleichsbasis)

- Wiederkehrende Rohre/Zylinder/Rundformen und Steinbögen werden pro Seitenstart wiederverwendet; Bilder und Bibliothek parallel vorbereitet. Sichtbare Arbeitsphasen, kurze Paint-Pausen und `compileAsync()` für die Shader; Vorbereitung bis zur fertigen Startszene gesperrt. Kein dauerhafter Modellcache über Neuladen hinweg.
- Vier Bündelungs- und zwei Kopfgeometrietests bestanden. Reale Bündel und direkte WebGL-Bildwerte dreier Ansichten erneut geprüft, identisch zum gesicherten `production-v6`-Build. Referenzierte Geometriepuffer 67.850.228 Bytes, 1.847.819 Punkte; −28,19 %/−34,79 % gegenüber `production-v6`, einschließlich ausgeblendeter Modelle. Keine entfernten Grafikdetails.
- Eingebettete Vollprüfung mit drei Runden und Ziel/Ergebnis/Rückkehr nach ca. 45,683 s, eigenständige Smoke-Prüfung und lokale WebKit-Funktionsprüfung bestanden. Keine Skript-/Grafikfehler. Startdiagnose und schwankende PC-Zeiten stehen in `STARTUP.md`; keine daraus abgeleitete Zielgerätezeit.
- Dritter vom Nutzer gespeicherter iPhone-15-/Safari-Lauf: **2.087 ms bis spielbereit**, Rückmeldung **spürbar schneller**. Gegen Robo, Lenkhilfe/automatische Darstellung, Render-Pixelratio 1,25, 89 Stichproben mit 52 FPS Median/36–57 FPS; drei Runden beendet. Zweiter Lauf war ebenfalls gegen Robo (37 FPS Median); beobachteter besserer Lauf, kein kontrollierter Prozent- oder Dauerlastnachweis. Erste beiden Handyberichte hatten keine Startzeitmarken.
- Alle drei physischen Läufe mit zugehörigen Builds getrennt unter `qa/history/production-v6/`, `production-v7/` und `production-v8/` gesichert. Das Gerät stammt aus der Nutzerangabe.
- Fragment 985.730 Bytes, eigenständige Seite 987.000 Bytes. Für die Chat-Vorschau nur noch 14.270 Bytes bis 1 MB. Die 1-zu-1-Grafik bleibt offen; stabile 60 FPS sind ebenfalls nicht nachgewiesen.

## Aktuelle Grafik und Planungsstand (`production-v9`)

- Fuchs: kleinere mandelförmige Augen-/Irisproportionen, geänderte Lider/Brauen und geformte dreieckige Nase; Fellfarben angepasst. Kart: vordere Haubenkontur, feine Panelfugen und Befestigungen. Küste: dezente Putzstruktur, Höhenfarben für Felsgeometrie und weniger flaches Fülllicht. Tatsächliche Modell- und Fahransichten geprüft; weiterhin deutliche Qualitätslücke zur Originalvorschau.
- Vorbereitung/Ergebnis und Diagnose kennzeichnen `coast-lab` ausdrücklich als Teststrecke. Produktionslayouts und zusätzliche Mechaniken bleiben die Planung aus `docs/JOY-KART-PLANUNG.md`.
- Sechs Geometrie-/Bündelungstests, eingebettete Edge-Vollprüfung inklusive drei echten Runden nach ca. 45,675 s, eigenständige Smoke- und WebKit-Funktionsprüfung bestanden. Modellansicht, vier Breiten und fünf Fahransichten ohne Skript-/Grafikfehler. Physik unverändert, daher keine erneuten Fahrregeltests.
- Aktuelle Berichte unter `qa/latest/inline/`, `standalone/`, `iphone15-webkit/`. Der alte exakte Bildgleichheitsbericht in `qa/latest/indexed-batching/` gehört zu `production-v8`, **nicht** zur absichtlich geänderten Grafik. Keine neue pixelgleiche oder physische Geräteprüfung behaupten.
- Fragment 987.710 Bytes, eigenständige Seite 988.980 Bytes. Noch 12.290 Bytes bis zur Chat-Grenze; keine neuen großen Base64-Bilder ohne andere Verpackung.
- Der ursprüngliche WLAN-Server ist um 14:21:55 CET ausgelaufen. Neue lokale Browserprüfungen schließen ihre eigenen Loopback-Server; kein erneuter WLAN-Server gestartet.
