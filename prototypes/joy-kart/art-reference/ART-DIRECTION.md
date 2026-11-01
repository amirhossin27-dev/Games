# Joy-Kart: verbindliche Grafikreferenz

Die Nutzeranforderung lautet: „ich will 1 zu 1 die Grafik wie in der Vorschau.“
Der Nutzer hat die Grafik des fahrbaren Prototyps nicht als Ersatz akzeptiert.
Geltungsbereich: Joy-Kart auf Handys. Andere Spiele und Tablets sind nicht Teil dieses Schritts.

Seit dem aktuellen Planungsauftrag ist das vorhandene Streckenlayout ausdrücklich **nur Teststrecke**. Erste geplante Produktionswelten: Sonnenküste und Neonstadt. Regeln, Hindernisse, Extras und bestätigte Entscheidungen stehen in [JOY-KART-PLANUNG.md](../../../docs/JOY-KART-PLANUNG.md). Wiederverwendbare Küstenassets werden weiter ausgearbeitet; der vorhandene Grundriss gilt dadurch nicht als Produktionsstrecke.

## Originale

Die WebP-Dateien in diesem Ordner wurden unverändert aus `docs/joy-kart-handy-v2.html` extrahiert. `manifest.json` enthält Herkunft, Dateigröße und SHA-256-Prüfsumme. Es handelt sich um Konzeptbilder, nicht um vorhandene 3D-Modelle oder gerenderte Bilder einer bereits verfügbaren Spielszene.

- `hero.webp`: Figur, rotes Kart, Materialwirkung, Landschaft und Licht; Ansicht von vorn.
- `coast.webp`: primäre Referenz für die tatsächliche Fahransicht; Fuchs und Kart von hinten, Sonnenküste.
- `forest.webp` und `night.webp`: Referenzen der weiteren angebotenen Strecken und Lichtstimmungen; kein Auftrag, diese vor der Sonnenküste fertigzustellen.
- `tracks.webp`: ursprüngliche Streckenauswahlbilder.

## Merkmale, die erhalten bleiben müssen

- Fuchs: orangefarbenes Fell mit sichtbarer Faserstruktur und warmem Gegenlicht, weiße Wangen und Schwanzspitze, kompakte Schnauze, spitze Ohren, expressive Augen, Fliegerbrille, roter Rennanzug und dunkle Handschuhe. Proportionen und Silhouette aus den Originalen übernehmen.
- Kart: tiefes, gerundetes rotes Chassis, weiße Mittelmarkierung, breite dunkle Reifen, metallische Felgen und sichtbare mechanische Bauteile. Von hinten sind Motor, Aufhängung, Rahmen und zwei Auspufföffnungen sichtbar. Die Kontur muss in Vorder- und Rückansicht zum Referenzkart passen.
- Sonnenküste: eine bergige Küstenwelt mit Burg auf einem Felsen, terrassenförmiger Stadt, hohen steinernen Bogenbrücken, Wasserfällen, Meer, Segelbooten, Zypressen, Blumen, Brüstungen und rot-weißen Kurvenrändern. Die Dichte und Tiefenstaffelung gehören zum Erscheinungsbild.
- Licht und Oberflächen: goldene tiefe Sonne, warme Kanten am Fell und Kart, kühle blaue Ferne, texturierter Asphalt, reflektierende Metallteile und lackierte Karosserie. Funken und Bewegungseffekte unterstützen echte Kurven- und Turbomanöver.
- Fahrkamera: tief hinter dem Kart, mit gut lesbarer Strecke und Blick auf die Küstenwelt. Die Vorlage ist keine Draufsicht.
- Bedienoberfläche: dunkles Blau, warme cremefarbene Schrift, goldene Akzente, schmale sportliche Überschriften und gut erreichbare Handybedienung.

## Erforderliche Grafikproduktion

1. Referenzgetreues Fuchs-und-Kart-Modell mit konsistenten Vorder-, Seiten- und Rückansichten, UVs, Materialtexturen, beweglichen Rädern, Lenkung und Figurenanimation.
2. Passender Panda samt Konkurrenzkart.
3. Küstenstreckenabschnitt mit den charakteristischen Bauwerken und Landschaftselementen; Hintergrund und befahrbare Geometrie müssen zusammenpassen.
4. Licht-, Schatten-, Material- und Effektabstimmung auf einer real gerenderten Fahrszene.
5. Optimierung und Messung auf dem vorgesehenen Handy, ohne eigenmächtige stilistische Vereinfachung. Technische Budgets erst anhand des Zielgeräts und der tatsächlichen Assets festlegen.

Die Assets liegen noch nicht in der geforderten Qualität und Übereinstimmung vor. Es sind noch keine passenden externen, spielbereiten 3D-Assets in den Prototyp integriert. Die bislang verwendeten Bildwerkzeuge liefern Rasterbilder, keine vollständige spielbereite 3D-Szene. Die exakte Übereinstimmung ist nicht erreicht oder zugesagt.

Der anschließende Arbeitsauftrag „mach weiter“ wurde für eine erste tatsächliche Grafikproduktion genutzt: `production-karts.js` und `production-coast.js` ergänzen neue Geometrie, Fellfasern, Fahrzeuge und Bauwerke; `../assets/` enthält zwei anhand der Originale erzeugte Bildassets. Materialatlas und fernes Panorama werden im laufenden Prototyp verwendet. Dieser Zwischenstand ersetzt den Qualitätsmaßstab nicht und gilt nicht automatisch als freigegeben.

`production-v4` führt diese Arbeit mit geformtem Kopf und Schnauze, kürzerem Fell, mandelförmigen Augen, breiterem Kart, aufliegenden Lackmarkierungen und acht Gruppen naher Küstenhäuser fort. Steinbalustraden, Stützmauern und gepflasterte Seitenflächen ersetzen die einfachen Streckenränder. Die Fahransicht wurde entlang einer tatsächlich gefahrenen Runde geprüft. Die Originale bleiben der Maßstab; eine erreichte 1-zu-1-Übereinstimmung wird damit weiterhin nicht behauptet.

`production-v5` bearbeitet Sonnenrichtung, Materialwirkung und den Übergang von Wasser zu Fernbild. Die vorhandene Panoramaquelle wird in ihrer ursprünglichen Auflösung direkt angezeigt, das Reflexionslicht separat gefiltert. Auch diese tatsächliche, im Browser geprüfte Änderung schließt die dokumentierte Qualitätslücke nicht vollständig.

`production-v6` ersetzt aufgesetzt wirkende Kopfbauteile durch jeweils zusammenhängende geformte Oberflächen, ergänzt Augenhöhlen, gekrümmte Ohren, Augenmaterialien, gerichtetes Fell und einen hinter dem Kopf verlaufenden Brillenriemen. Kopfgeometrie und tatsächliche Modell-/Fahransicht wurden geprüft. Das ist eine Teilverbesserung, weiterhin keine 1-zu-1-Übereinstimmung. Bestätigtes Zielgerät ist iPhone 15/Safari. Die zusätzliche Desktop-WebKit-Prüfung zeigt einen offenen Leistungsbefund; erst ein tatsächlicher Gerätetest kann die weitere Optimierung sinnvoll begründen. Das Grafikziel bleibt dabei verbindlich.

Erster Nutzertest mit dieser Fassung: 46 FPS Median, 31–52 FPS und leichtes Ruckeln. `production-v7` optimiert daraufhin die Datenhaltung der Geometrie: gemeinsame Punkte bleiben erhalten, Dreiecke und Attribute werden nicht vereinfacht. Referenzierte Geometriepuffer um 28,15 % kleiner, direkt aus WebGL gelesene Bildwerte dreier geprüfter Ansichten gegenüber `production-v6` identisch. Eine höhere iPhone-Bildrate ist erst nach erneutem Gerätetest belegt. Die bisherige Lücke zu den filmischen Originalen bleibt davon unberührt.

`production-v8` bearbeitet den bereits zuvor langsamen Seitenstart durch wiederverwendete Bauteile, parallele Bildvorbereitung und asynchrone Shader-Vorbereitung. Direkte 3D-Bildwerte der drei geprüften Ansichten bleiben erhalten. Dritter Nutzertest iPhone 15/Safari bestätigt subjektiv einen spürbar schnelleren Start; gemessen 2,087 s bis spielbereit und 52 FPS Median gegen Robo. Das sind Werte eines einzelnen Laufs, keine garantierte Kaltstart-/Dauerlastleistung. Die geforderte Angleichung von Figuren, Kart und Küstenwelt an die Originale bleibt der nächste grafische Schwerpunkt.

`production-v9` verändert den Grafikstand bewusst: Fuchsblick mit schmaleren Lidern/Iris und geformter Nase, Haubenkontur/Panelfugen, Putzstruktur und höhenabhängige Felsfarben sowie weniger flaches Fülllicht. Echte Modell-/Fahransichten und Funktion geprüft. Der Bildgleichheitsnachweis aus `production-v8` gilt dafür nicht; die Originalvorschau bleibt sichtbar detailreicher und räumlich stimmiger. Keine erreichte 1-zu-1-Übereinstimmung und keine neue iPhone-Leistungsmessung behaupten.

## Nachweis vor dem App-Einbau

Der neue getrennte [Küstenabschnitt `coast-section-v1`](../coast-section/README.md) verwendet dieselben Fuchs-/Kart- und Bildassets aus `production-v9`, ergänzt eigene befahrbare Geometrie, Höhen und Sprung-/Drift-/Itemregeln. Tatsächliche Fahransichten über Brücke, Rampe und unteren Auslauf wurden geprüft. Die entfernte Kulisse steht außerhalb der Fahrkorridore. Dies belegt den Spielabschnitt und seine Regeln, keine erreichte filmische Originalgrafik. Figuren-, Fahrzeug-, Material- und Umgebungsproduktion bleiben offen; der physische Abschnittstest auf iPhone 15/Safari steht noch aus.

Zuerst einen echten befahrbaren Abschnitt der Sonnenküste ausarbeiten. Seine Fahransicht und eine Vorderansicht des Karts direkt mit `coast.webp` beziehungsweise `hero.webp` vergleichen. Als Fortschritt nur tatsächlich gerenderte Spielgrafik zeigen. Ein verschobenes Konzeptbild, ein Video oder eine neue KI-Vorschau gilt nicht als Nachweis der Spielgrafik.

Der bisherige `detailed-v2`-Prototyp bleibt ausschließlich ein Funktionsnachweis für Rennen und Eingaben. Er erfüllt die Grafikvorgabe nicht. Der nächste Meilenstein ist die Produktion der passenden Grafikassets und der Referenzszene; die Anbindung an Joyboy folgt erst danach.
