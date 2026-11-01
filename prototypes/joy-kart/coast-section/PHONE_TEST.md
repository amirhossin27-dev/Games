# Küstenabschnitt auf iPhone 15/Safari testen

## Neuer Tempovergleich (`coast-simple-v2`)

Nach dem Feedback „Speed zu langsam, Effekt kaum spürbar“: neue gepinnte Sitzung mit `artifact.version: coast-simple-v2` verwenden. Zwei kurze Fahrten reichen: einmal ohne Turbo, einmal nach kurzer Beschleunigung Turbo antippen, auch bei gehaltenem Lenken. Auf Grundtempo, wahrnehmbaren Schub, Dosierbarkeit und Ruckeln achten. Danach Ziel/Pause → Testdaten → bewerten → Messwerte speichern. Die letzte `coast-simple-v1`-Messung ist bereits eingegangen; `latest.json` zeigt erst nach einer neuen Speicherung auf v2.

Safari-Seite über den frischen Link neu öffnen: Ein schon geladenes Spiel wird durch einen PC-Build oder Serverwechsel nicht ausgetauscht. Der Server pinnt eine Fassung pro Sitzung. `expiresAt`, Prozess und Buildhash prüfen. Mit iOS „Bewegung reduzieren“ bleiben die zusätzlichen Kamerablick-/Randstreifeneffekte aus; der echte Geschwindigkeitsschub bleibt erhalten.

## Neue vereinfachte Probe

Nach dem abgelehnten ersten Test gilt `coast-simple-v1`: Auto-Gas, leichtes Lenken mit sichtbarer Lenkhilfe und nur Turbo. Kein Extra-Auswahlfeld, Driften oder Springen.

1. Nur eine frische Sitzung mit `artifact.version: coast-simple-v1` in `qa/phone-server.json` verwenden. `status: running` und noch zukünftiges `expiresAt` prüfen. Alte Links liefern keine automatisch aktualisierte Fassung.
2. iPhone und PC im selben WLAN, Safari quer. Zweimal kurz fahren: links den Daumen auflegen und sanft seitlich ziehen; rechts Turbo antippen. Beim zweiten Versuch auch Lenken halten und Turbo gleichzeitig nutzen.
3. Nach Ziel oder Pause **Testdaten** öffnen, Laufruhe/Bedienung bewerten, sichtbare Grafikfehler beschreiben und **Messwerte auf PC speichern**. Ein Bericht wird erst beim Speichern übertragen.
4. Den neuen Versions-/Hash-gebundenen Bericht unter `qa/physical-iphone15/latest.json` auswerten; nicht mit Desktop-Emulation verwechseln. Zwei Fahrten genügen für den ersten erneuten Eindruck.

Start einer neuen begrenzten privaten Sitzung: installierte, bereits für dieses WLAN zugelassene `C:\Program Files\nodejs\node.exe` mit `phone-test-server.cjs --simple`. Ohne `--simple` wird bewusst die alte komplexe Vergleichsfassung ausgeliefert. Server/PID/Port zuerst prüfen, Hintergrundstart mit `-WindowStyle Hidden`, Laufzeit standardmäßig 60 Minuten. Keine Firewalländerung erforderlich. Der Server archiviert Build, Messquellen und Runtime-Manifest selbst.

## Frühere Testanleitung (`coast-section-v1`)

Diese Anleitung gehört zu `coast-section-v1` mit Lenkpad, manuellem Drift, fünf Extras und Rampe/Auffangweg. Die ältere Anleitung `../PHONE_TEST.md` betrifft die alte Testschleife. Grafikziel und tatsächlicher Prüfstand: [PROJECT_STATUS.md](../../../PROJECT_STATUS.md).

## Aktuellen Link verwenden

Den `phoneTestUrl` aus [qa/phone-server.json](qa/phone-server.json) öffnen, wenn `status` noch `running` und `expiresAt` noch nicht verstrichen ist. PC und iPhone müssen im selben WLAN sein; der PC muss laufen. Die 3D-Bibliothek kommt vom CDN, daher braucht Safari beim Laden Internetzugang.

1. Safari öffnen und das iPhone quer halten. Beim ersten Öffnen darauf achten, wie lange die Seite bis zur fertigen Szene braucht.
2. Ein Start-Extra auswählen und **Abschnitt fahren**. Links analog lenken, rechts Drift halten; für das Item nach oben wischen. Die Itemanzeige lässt sich ebenfalls antippen.
3. Nach Möglichkeit fünf kurze Versuche fahren und jedes Extra einmal ausprobieren. Die Messung sammelt bis zu acht Fahrten getrennt. Einige Fahrten dürfen abgebrochen werden; ein vollständiger Abschnitt ist für Routen-/Landebefunde hilfreicher.
4. Die normale Brückenlinie und nach Möglichkeit die rechte Rampe versuchen. Ein Fehlversuch soll auf dem langsamen unteren Weg weitergehen. Auf klemmende Lenkung, unerwünschten Itemverbrauch, Sicht auf die Landung und Ruckeln achten.
5. Nach dem Ziel oder nach **Pause** erscheint oben mittig **Testdaten**. Während der Fahrt ist dieser zusätzliche Knopf ausgeblendet. Im Dialog Laufruhe/Steuerung bewerten, optional eine Bemerkung schreiben und **Messwerte auf PC speichern** tippen. Die Erfolgsmeldung abwarten.
6. Im Chat „Test abgeschlossen“ und einen kurzen Eindruck melden. Die iOS-Version ist hilfreich, falls Eingaben oder Safari-Leisten Probleme machen.

Die Messung wird erst durch den Speichern-Knopf auf den PC übertragen. Neuladen der Seite beginnt eine neue Sammlung; für einen erneuten Startvergleich daher zuerst vorhandene Fahrten speichern. Mehrmaliges Speichern erzeugt zusätzliche Berichte und überschreibt keine frühere Messung.

Wenn die Seite nicht lädt, WLAN, eingeschalteten PC und Ablaufzeit prüfen. Der alte Link mit Port 51933 ist abgelaufen. Gastnetze können Geräte trennen; eine tatsächliche Safari-Fehlermeldung hilft bei der Diagnose. Es werden keine Firewallregeln geändert.

## Server starten

Vom Projektordner aus:

```powershell
& 'C:\Program Files\nodejs\node.exe' prototypes/joy-kart/coast-section/phone-test-server.cjs
```

Der Server wählt eine private WLAN-Adresse und einen freien Port. Standardlaufzeit: 60 Minuten, danach automatisches Ende. Nur `/`, `/game`, `/test` und der geschützte Messdaten-Upload sind erreichbar. `/game` ist die unveränderte eigenständige Abschnittsseite; `/test` ergänzt die Messung und den Dialog. Keine öffentliche Veröffentlichung.

**Auf diesem PC die oben genannte installierte Node-Version verwenden.** Am 01.11. wurde die Codex-Cache-Laufzeit durch eine bestehende Public-Firewallregel blockiert; die installierte Node ist bereits freigegeben. Nach dem Wechsel bestätigte der Nutzer den iPhone-Zugriff. Netzwerkkategorie und Firewallregeln wurden nicht verändert. Serverprüfungen mit installierter Node v24.15.0 bestanden, Protokoll: [phone-server-installed-node-tests.txt](qa/phone-server-installed-node-tests.txt).

Optionale Variablen: `JOY_KART_SECTION_HOST` (private IPv4-Adresse), `JOY_KART_SECTION_PORT` (0 = freier Port), `JOY_KART_SECTION_MINUTES` (1–120). Vor einem erneuten Start prüfen, ob bereits ein gültiger Abschnittsserver läuft. In einem eigenen Terminal beendet `Strg+C` den Server. Einen Hintergrundprozess nur nach Abgleich von PID **und Kommandozeile** mit genau diesem Abschnittsskript beenden; alte PIDs können zu anderen Programmen gehören.

Beim Start wird die aktuelle eigenständige Seite im Speicher und unter `qa/phone-sessions/<Sitzung>/build.html` festgehalten. Auch wenn danach ein anderer Build erzeugt wird, liefert dieser Testlink weiterhin seine ursprüngliche Fassung. `qa/phone-server.json` nennt Sitzung, Hash, archivierte Datei und Ende. Erneute Testläufe mit geänderter Spielversion brauchen einen neuen Link.

## Messdaten und Grenzen

- Interne Spielvorbereitung: `navigation.gameStartup.readyMs` und Phasenmarken aus dem tatsächlichen Spiel.
- Gesamter Seitenaufruf: Navigationseintrag und `readyObservedMs` ab Navigationsbeginn. Die Bereitschaft wird etwa alle 200 ms erkannt; dieser Wert kann entsprechend später als die tatsächliche Bereitschaft liegen.
- Bildrate: unabhängig gezählte `requestAnimationFrame`-Intervalle in normalerweise etwa einer Sekunde langen, nicht überlappenden Fenstern. Unterbrechungen werden abgetrennt; ausreichend lange Restfenster werden separat erfasst. Dies misst den Browsertakt, keine garantierte GPU-Ausgabe oder Mindestbildrate.
- Je Fahrt: anfängliches Extra, Proben, Endzustand, Routenbeleg und Item-/Trefferstatistik. Die ersten Sekunden bleiben erhalten. Maximal 40 Fenster je Fahrt; bei längeren Versuchen bleiben die ersten drei und die jüngsten Fenster. Verlorene Fenster werden gezählt.
- Kontext: Browserkennung, Viewport/Orientierung, sichtbare Steuerflächen, Renderauflösung, Zeichenaufrufe, Dreiecke sowie beobachtete gehaltene Eingaben. Nicht beobachtete kombinierte Gesten beweisen keinen Fehler; kurze Gesten können zwischen Stichproben liegen.
- Eigener Eindruck: Laufruhe, Lenkung/Drift und optionale Bemerkung. Ein Build-Hash oder bestandener Funktionstest ist keine Grafikfreigabe.

Der Server berechnet die Zusammenfassung erneut aus den Frameintervallen. Der Gesamtmedian über Fenster gewichtet längere Fahrten stärker; für Item-/Routenvergleiche die einzelnen Fahrten betrachten. Unterschiedliche Wege, Treffer, Temperaturen, Browserzustände oder Lade-Caches sind kein kontrollierter Vorher-/Nachher-Vergleich. Die kleine Diagnoseergänzung hat selbst einen Messaufwand.

Gespeicherte Nutzerberichte: `qa/physical-iphone15/<Sitzung>/report-<Zeit>-<ID>.json`. `qa/physical-iphone15/latest.json` wird erst nach dem ersten echten Speichern angelegt und verweist auf den neuesten Bericht. Dort und im Serverzustand den Hash gegen die archivierte Fassung prüfen. Ein gespeicherter Bericht bezeichnet das Gerät als vom Nutzer angegeben; das iPhone-Modell lässt sich aus Browserkennungen nicht unabhängig nachweisen.

Automatische Tests schreiben ausschließlich in `qa/phone-server-qa/` und `qa/phone-browser-chromium/` bzw. `qa/phone-browser-webkit/`. Ihre Berichte sind ausdrücklich **nicht physisch**. Diese Daten niemals als Nutzerlauf übernehmen. Der vorhandene Spiel-Build und seine bisherigen 13 Regeltests bleiben unverändert.

## Reproduzierbare Prüfungen

```powershell
node --test prototypes/joy-kart/coast-section/phone-test-server.test.cjs
node prototypes/joy-kart/coast-section/phone-test-browser-qa.cjs
node prototypes/joy-kart/coast-section/phone-test-browser-qa.cjs --webkit
```

Fünf Serverprüfungen decken Versionsbindung, getrennte Archivierung, Fenster-/Zusammenfassungsprüfung und zulässige Anfragen ab. Die Browserprüfung erfasst alle fünf Start-Extras als getrennte Fahrten, erhält einen tatsächlichen Zielabschluss, prüft Dialoggrößen und speichert über den nativen Knopf einen ausdrücklich automatischen Bericht. Aktuellen `status` in `qa/phone-browser-*/report.json` und dessen Build-Hash prüfen.

Nächster Schritt nach dem echten Nutzerlauf: pro Fahrt Start, Bildtakt, beobachtete Steuerung und Eindruck zusammen auswerten. Erst danach Lenk-/Driftwerte, Balance oder Leistung verändern; die Originalgrafik bleibt unabhängig davon offen.
