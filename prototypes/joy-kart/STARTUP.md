# Startzeit – Messung und production-v8

Nutzerfeedback vom 01.11.2026: Nach der Geometrieoptimierung subjektiv weniger Ruckeln, aber langsamer Seitenstart. Der Nutzer hat klargestellt, dass der Start **schon beim ersten Lauf** verzögert war. Diese Wartezeit ist daher kein neu belegter Fehler von `production-v7`.

## Befund

`startup-qa.cjs` misst Download/Modulstart, Bilddecodierung, Szenen-/Figurenaufbau und erste Grafikdarstellung. Die ersten Messungen wurden auf dem Prüf-PC mit vierfach gedrosselter Chromium-CPU ausgeführt. Sie simulieren keinen bestimmten iPhone-Prozessor.

| PC-Stichprobe | production-v7 | production-v8 |
|---|---:|---:|
| Erster Durchlauf, bis spielbereit | 19,078 s | 11,152 s |
| Wiederholung, bis spielbereit | 19,834 s | 17,513 s |
| Küstenaufbau, erster Durchlauf | 5,365 s | 2,521 s |
| Küstenaufbau, Wiederholung | 6,249 s | 5,874 s |
| Shader-Vorbereitung plus erster Renderaufruf, erster Durchlauf | 4,366 s | 1,300 s |
| Shader-Vorbereitung plus erster Renderaufruf, Wiederholung | 4,714 s | 1,852 s |

Die Werte schwanken. Auch Browser-/Treiber-Caches und CPU-Drosselung beeinflussen den Vergleich. Keine feste prozentuale Beschleunigung, Zielgerätezeit oder garantierte Erststartzeit daraus ableiten. In diesen PC-Läufen dominieren Geometrieaufbau und Grafikvorbereitung; der reine Bibliotheksabruf liegt wesentlich darunter. Die physischen Erst-/Zweitberichte enthalten noch keine Startzeitmessung.

Inzwischen liegt der dritte Nutzertest auf iPhone 15/Safari vor: **2.087 ms bis Spielbereitschaft**, Nutzerfeedback **spürbar schneller**. [Bericht und genaue Phasen](qa/history/production-v8/physical-iphone15/THIRD_RUN.md). Bibliothek/Bilder bereit bei 414 ms, Figuren bei 964 ms, Küste bei 1.356 ms, Shader bei 1.984 ms, erstes Bild bei 2.085 ms. Dies ist der gemessene Lauf einschließlich der jeweiligen Browser-/Netzwerkbedingungen; kein garantierter Kaltstartwert. Für die älteren Handyfassungen fehlt eine gemessene Startzeit, daher keinen prozentualen Vorher-/Nachher-Wert angeben.

Belege: `qa/latest/startup-before/`, `startup-before-repeat/`, `startup-after/` und `startup-after-repeat/`. Jeder Bericht enthält Build-Prüfsumme, Phasen und Ressourcenzeiten. Unveränderter alter Build unter `qa/history/production-v7/build/`.

## Änderungen

- Gleiche Rundformen, Rohre und Zylinder werden innerhalb eines Seitenstarts wiederverwendet. Schlüssel enthalten ihre tatsächlichen Geometrieparameter; keine Rundung oder Detailverringerung. Erste neue Stichprobe: 2.124 Wiederverwendungen, 279 erstmals erzeugte Varianten im Geometriehelfer. Wiederkehrende steinerne Bögen werden ebenfalls wiederverwendet.
- Bibliotheksimport und Decodierung der vorhandenen Bilder beginnen parallel.
- Vorbereitung zeigt tatsächliche Arbeitsphasen statt eines erfundenen Prozentbalkens. Zwischen Figuren und Küstenabschnitten bekommt der Browser Zeit zum Anzeigen. Vorbereitungsbuttons bleiben bis zur fertigen ersten Szene deaktiviert; `aria-busy` meldet den Zustand.
- Shader werden mit `renderer.compileAsync()` vorbereitet, nachdem Licht und Umgebung feststehen. [Three.js-Dokumentation](https://threejs.org/docs/pages/WebGLRenderer.html#compileAsync). Das soll unnötiges synchrones Warten beim ersten Rendern verringern; Treiber und verfügbare Erweiterungen beeinflussen die Wirkung.
- `__joyKart` wird erst nach fertig gerenderter Startszene bereitgestellt. Prüfskripte müssen auf diesen Zustand warten. Die eingebettete Prüfung wartet außerdem auf den noch leeren Inhalt des Vorschaufensters, statt dort bereits vorhandene Elemente vorauszusetzen.
- `snapshot().startup` liefert Phasen, `readyAt` und Cache-Zähler. Zeiten stammen von `performance.now()` relativ zur Navigation des Dokuments. Der bestehende, vom Nutzer gespeicherte Telefonbericht enthält sie unter `data.latest.startup`; keine automatische Speicherung.

Der Cache besteht nur für den aktuellen Seitenstart. Neuladen beginnt erneut; ein dauerhaft gespeichertes, vorab gebautes Modellpaket ist damit noch nicht umgesetzt. Geometriepuffer und sichtbare Qualität werden separat geprüft, nicht aus Startzeitwerten abgeleitet.

## Erneut messen

```powershell
node prototypes/joy-kart/startup-qa.cjs --cpu=4 --file=prototypes/joy-kart/qa/history/production-v7/build/index.html --output=prototypes/joy-kart/qa/latest/startup-before-repeat
node prototypes/joy-kart/startup-qa.cjs --cpu=4 --output=prototypes/joy-kart/qa/latest/startup-after-repeat
```

Ohne `--cpu` läuft der Browser ungedrosselt. `--engine=webkit` nutzt den lokalen WebKit-Prüfbrowser ohne Chromium-Drosselung. Diese Diagnose verändert nur die lokale Prüfseite, nicht das erzeugte Spiel.

Nächster Schritt: bestätigten Startstand als Vergleichsbasis für die weitere Grafikproduktion erhalten. Bei weiteren Fahrbildratenvergleichen denselben Modus, dieselbe Qualität und Lenkhilfe verwenden; erster Lauf Zeitfahren, zweiter/dritter gegen Robo. Falls andere Kaltstartbedingungen wieder lange Wartezeiten zeigen, anhand der nun erfassten Phasen vorab gebaute/cachebare Grafikassets prüfen. Das 1-zu-1-Grafikziel bleibt offen.
