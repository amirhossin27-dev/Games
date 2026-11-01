# Joy-Kart auf dem iPhone 15 testen

Zielgerät laut Nutzer: **iPhone 15, Safari**. Der fahrbare Prototyp ist noch keine fertige 1-zu-1-Umsetzung der freigegebenen Grafik.

**Diese Anleitung gilt für die ältere Testschleife.** Für den neuen Küstenabschnitt mit manuellem Drift und fünf Extras die [eigene Abschnitts-Testanleitung](coast-section/PHONE_TEST.md) und dessen Serverzustand verwenden. Beide Messungen sind getrennt; den alten Link nicht für den Abschnitt ausgeben.

Zuletzt auf dem iPhone geprüft ist `production-v8`: Nutzer meldet **spürbar schnelleren Start**, dort ca. **2,1 s** und 52 FPS Median gegen Robo, 36–57 FPS. [Dritter Bericht](qa/history/production-v8/physical-iphone15/THIRD_RUN.md). **Aktuelle Grafikfassung `production-v9` ist noch ohne physischen Gerätetest.** Erste [Vergleichsbasis](qa/history/production-v6/physical-iphone15/ANALYSIS.md) und [zweiter Lauf](qa/history/production-v7/physical-iphone15/SECOND_RUN.md) sind erhalten. Für weitere Vergleiche denselben Modus verwenden. Der ursprüngliche WLAN-Link ist seit **14:21:55 CET abgelaufen**; vor neuem Gerätetest den Server neu starten und dessen neue Ausgabe prüfen.

## Direkt testen

1. iPhone und PC mit demselben WLAN verbinden. Der PC muss während des Tests eingeschaltet bleiben.
2. Den aktuellen `phoneTestUrl` aus [qa/phone-server.json](qa/phone-server.json) in Safari öffnen. Der Status muss `running` sein und `expiresAt` darf noch nicht verstrichen sein. Der Link vom 01.11.2026 lautet `http://192.168.178.27:51933/test` und endet automatisch um **14:21:55 Uhr CET**.
3. Zuerst die Modellansicht öffnen: Fuchs/Panda wechseln und mit dem Finger drehen. Danach ein Rennen starten. Die Lenkhilfe ist anfangs eingeschaltet.
4. Mindestens 15–30 Sekunden fahren: Lenken halten, mit einem zweiten Finger Turbo auslösen, beide Finger wieder loslassen. Auf Ruckeln, klebende Lenkung und verdeckte Steuerflächen achten. Safari-Leisten ein-/ausblenden und einmal quer drehen.
5. Auf **Testdaten** in der unteren Mitte tippen. Das Rennen wird pausiert. **Messwerte auf PC speichern** schreibt die Daten auf diesen PC; eine Erfolgsmeldung erscheint im Dialog. Ohne dieses Antippen wird nichts gespeichert. Nach „Schließen“ im normalen Pausenmenü „Weiterfahren“ wählen.
6. Im Chat kurz beschreiben: flüssig oder ruckelig, Hoch-/Querformat und ob Lenken mit Turbo gleichzeitig funktioniert. Die iOS-Version ist für die Auswertung hilfreich.

Falls der Link nicht lädt: zuerst WLAN, PC und Ablaufzeit prüfen. Ein Gastnetz kann Geräte voneinander trennen; auch die Windows-Firewall kann den eingehenden Zugriff verhindern. Es wurden keine Firewallregeln geändert. Die genaue Safari-Fehlermeldung hilft beim nächsten Schritt.

`/game` öffnet dieselbe Spielversion ohne Testknopf. Die 3D-Bibliothek und Schrift werden von CDNs geladen; der erste Start braucht daher Internetzugang.

## Server erneut starten oder beenden

Vom Joyboy-Projektordner aus:

```powershell
node prototypes/joy-kart/phone-test-server.cjs
```

Der Server wählt eine private WLAN-Adresse und einen freien Port. Den **neu ausgegebenen** `phoneTestUrl` verwenden. Er beendet sich nach 60 Minuten und schreibt seinen Zustand in `qa/phone-server.json`. In einem sichtbaren Terminal beendet `Strg+C` den Server früher. Einen im Hintergrund gestarteten Prozess nur nach Abgleich von PID und Kommandozeile mit `phone-test-server.cjs` beenden; alte PIDs können später zu anderen Programmen gehören.

Optionale Umgebungsvariablen: `JOY_KART_PHONE_HOST` (private IPv4-Adresse), `JOY_KART_PHONE_PORT` (0 = freier Port), `JOY_KART_PHONE_MINUTES` (1–120). Es werden nur `/`, `/game` und `/test` ausgeliefert. Andere Projektdateien sind nicht erreichbar. Die Testseite hat volle Bildschirmgröße, keinen verkleinerten eingebetteten Rahmen. Keine öffentliche Veröffentlichung.

## Was die Messung aussagt

Ein vom Nutzer gespeicherter Bericht liegt unter `qa/latest/physical-iphone15/report.json`. Er enthält Build-Prüfsumme, Browserkennung, Bildschirmgröße und Rennstichproben mit unabhängig per `requestAnimationFrame` gezählter Bildrate, Renderauflösung, Zeichenaufrufen und Dreiecken. Messung beginnt nach den ersten drei Rennsekunden. Es bleiben höchstens 120 Stichproben erhalten. Pause oder minimierte Safari können den Vergleich beeinflussen; für die Messung Safari vorn lassen. Der Median beschreibt den typischen erfassten Wert, keine garantierte Mindestbildrate.

Das Gerät wird als **vom Nutzer angegeben** gekennzeichnet; aus Browserkennungen lässt sich das iPhone-Modell nicht unabhängig nachweisen. Der Server akzeptiert nur Anfragen von seiner eigenen Testseite mit zufälligem Token, maximal 32 KB und passender Build-Prüfsumme. Keine Joyboy-Profile, Firebase-Daten oder bestehenden Rekorde beteiligt.

## Schon geprüft und noch offen

- Edge auf dem Prüf-PC: vollständiger Drei-Runden-Ablauf, gleichzeitige Touch-Eingaben, Pause/Ergebnis, Modellansicht und mehrere Telefonformate bestanden. Aktuell erfasste Stellen im eingebetteten Zeitfahren ca. 59–60 FPS. Dies misst den PC.
- Playwright WebKit 26.5 im iPhone-15-Profil: Touch-Taps, gehaltene Lenkung per Maus-Pointer-Proxy, Turbo, Pause, vier Hoch-/Querformate und simulierte sichere Randabstände bestanden. Kein Nachweis physischer Mehrfingerbedienung.
- Desktop-WebKit bleibt auffällig: bei `production-v6` ca. 5 FPS Rennen/46 FPS Pause, bei `production-v7` in der neuen Stichprobe ca. 9/58 FPS. Automatische Renderauflösung sinkt dort auf 0,75. Daraus weder eine konkrete Ursache noch eine A16-/iPhone-Bildrate ableiten. Der erste vom Nutzer gespeicherte iPhone-Lauf liegt mit 46 FPS Median deutlich darüber. Gemeldete Zeichenketten wie „Apple GPU“ im Desktop-Test sind kein Hardwarebeweis.
- Die Playwright-[Geräteemulation](https://playwright.dev/docs/emulation) setzt Eigenschaften wie Viewport, Skalierung, Touch und Browserkennung. Der [WebKit-Prüfbrowser](https://playwright.dev/docs/browsers#webkit) ersetzt keinen Test auf dem physischen Zielgerät. Native Safari-Leisten, reale sichere Randabstände, Wärmeentwicklung und dauerhafte Bildrate müssen dort beurteilt werden.
- Der WLAN-Link selbst wurde mit einem Desktop-Browser geöffnet: Laden, Messdialog, Pause/Weiterfahren, fehlender Token → 403, unbekannter Pfad → 404. Dabei wurde **kein** Bericht eines physischen Handys erzeugt. Nachweis: `qa/latest/phone-link-report.json`.

Nächster Schritt: bei weiteren Grafikänderungen Startzeit und Bildrate wieder im gleichen Modus prüfen. Der schnellere Start ist für einen Nutzerlauf bestätigt, keine Garantie für jeden Kaltstart oder Dauerlast. Anschließend die weiterhin offene 1-zu-1-Grafikproduktion fortsetzen; diese technische Prüfung ist keine Grafikfreigabe.
