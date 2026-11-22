# Tasks

## 1. Datenmodell, Dateiformat, Migration

- [x] 1.1 zod-Schema für `routeNode` (Anker, `deviceId?`), `routeSegment` (`surface` und `penetration`, `conduit?`, `status`), `cable` (`from`/`to` mit `deviceId`, `path`), `settings.lengthAllowance` nach `design.md` „Dateiformat M3“, alle Objekte `.strict()`; `CURRENT_SCHEMA_VERSION` = 3; Unit-Test: M3-Fixture besteht die Prüfung, unbekanntes Feld in `routeSegment` ist ein Ladefehler
- [ ] 1.2 Aufteilen und Zusammenführen: Knoten und Segmente in Geschossdateien nach den Ablageregeln (Knoten: Geschoss des ersten Ankers; Segment: Geschoss von Knoten `a`), `storeyId` beim Laden gesetzt; `leitungen.yaml` nur bei mindestens einer Leitung, sonst `null`; Unit-Test Rundreise mit der M3-Fixture
- [ ] 1.3 Writer-Tabelle erweitern; Golden-File-Tests: (a) M3-Fixture Laden → Speichern byteweise identisch für alle Dateien, (b) Knoten verschieben ändert genau eine Zeile, (c) Leitungsstatus ändern ändert nur `leitungen.yaml`, (d) Segment teilen ändert die Geschossdatei und die Pfade in `leitungen.yaml`
- [x] 1.4 Ladeprüfung: doppelte IDs über alle Dateien; Verweise ins Leere (Anker ohne Fläche, Knoten ohne Gerät, Segment ohne Knoten, Leitung ohne Typ oder Gerät, unbekannte IDs in `path`) öffnen das Projekt; Unit-Test je Fall
- [x] 1.5 Migration `2 → 3` (Standardzuschläge), neues Projekt in Version 3; Unit-Test mit der M2-Fixture: Migration schreibt nichts, erster Befehl schreibt `projekt.yaml` mit `schemaVersion: 3` und `lengthAllowance`, alle übrigen Dateien byteweise unverändert
- [ ] 1.6 Fixture `tests/fixtures/m3/` nach `design.md` „Tests und Fixtures“ (per Writer erzeugt); `docs/architektur.md` anpassen (`boardId` ab M4, `conduit`, `lengthAllowance`, Ablage)

## 2. Trassengeometrie

- [x] 2.1 `geometry/routes.ts`: `anchorWorld` für alle Flächenarten (gemeinsam mit `deviceWorld`), Segmentlänge in (u, v); Unit-Tests: Wand, Decke (gespiegelt), Boden, Schräge
- [x] 2.2 Übergänge an Kanten: Raumecke links/rechts, Wand–Decke (auch unter Schräge auf die Schräge), Wand–Boden; Ableitung weiterer Anker aus dem ersten; Unit-Tests: Knoten an der rechten Ecke liegt in der rechten Nachbaransicht bei deren linker fertiger Ecke (Spec-Scenario „Über Eck“), Knoten an der Oberkante erscheint im Deckenspiegel am Wandrand (Spec-Scenario „Zur Decke“), unterschiedliche Fußbodenaufbauten, Kante entfällt
- [x] 2.3 Gegenknoten von Durchbrüchen und Durchbruchlänge: Innenwand gespiegelt, Außenwand zur Außenseite, Boden → Decke darunter, Decke → Boden darüber, ohne Raum abgelehnt; Unit-Tests: 40-mm-Bohrung in der Küchenwand ergibt Knoten auf der Flurseite an gespiegelter Position (Spec-Scenario „Durch die Innenwand“), Boden OG → Decke EG (Spec-Scenario „Durch die Geschossdecke“), Kernbohrung 65 mm Außenwand (Spec-Scenario „Kernbohrung nach außen“), Längen
- [x] 2.4 Segment teilen an einem Punkt inkl. Pfadanpassung in Wegrichtung; Unit-Test: Leitung über das geteilte Segment hat danach beide Teile in richtiger Reihenfolge

## 3. Trassen zeichnen und bearbeiten

- [ ] 3.1 Befehle in `store/routes.ts`: „Trasse zeichnen“ (Segment mit neuen oder vorhandenen Knoten), „Segment teilen“, „Knoten verschieben“, „Segment ändern“ (Status, Leerrohr), „Trasse löschen“ (Knoten mit Segmenten, Segment allein); Unit-Tests inkl. Undo
- [ ] 3.2 `normalizeAfterCommand`: Gerätknoten auf Gerätelage, weitere Anker von Übergangsknoten, verwaiste Knoten entfernen, gelöschte Segmente aus Pfaden entfernen; Löschkaskaden für Gerät, Wand, Raum, Geschoss mit Anzahl mitgelöschter Leitungen in der Bestätigung; Unit-Tests: Gerät verschieben zieht den Knoten mit, Gerät löschen löscht seine Leitungen und lässt den Knoten stehen, Wand löschen nimmt Knoten und Segmente mit, Undo stellt alles her
- [ ] 3.3 Werkzeug „Trasse“ in der Flächenansicht mit Fang (Gerät, Knoten, Segment → Abzweig, Kante, Winkelfang, Shift), Zug bis Esc; Playwright: Trasse von der oberen Zone senkrecht zur Steckdose endet in einem Gerätknoten (Spec-Scenario „Trasse zur Steckdose“), Klick auf ein Segment teilt es (Spec-Scenario „Abzweig“), Trasse bis an die rechte Ecke und in der Nachbarwand fortsetzen
- [ ] 3.4 Auswahl, Ziehen und Eigenschaften von Knoten und Segmenten (u, v, Abstand zur Bezugskante, Status, Leerrohr, Belegung), Mehrfachauswahl mit Shift; Komponententest: drei Segmente gemeinsam auf „verlegt“, ein Undo-Schritt (Spec-Scenario „Mehrere Segmente verlegt“); Knoten auf 1830 mm ab Raumecke und Segment auf „verlegt“ (Spec-Scenario „Aufmaß übernehmen“)
- [ ] 3.5 Werkzeug „Durchbruch“ mit Dialog (Art, Durchmesser mit Standardwerten); Komponententest: Durchbruch in der Küchenwand erscheint in der Fluransicht

## 4. Darstellung

- [ ] 4.1 Flächenansicht: Segmente, Knoten, Übergangsknoten, Durchbrüche, Leerrohr, Statusfarben, roter Rand bei offener Warnung
- [ ] 4.2 Grundriss: Boden- und Deckensegmente, Wand- und Deckendurchbrüche; 3D: Segmente und Durchbrüche; Playwright: Durchbruch EG/OG erscheint in beiden Geschossen und in 3D
- [ ] 4.3 Gewerkfilter um „Trassen“ erweitern, Leitungen nach Gewerk; Unit-Test des Filters; Playwright: Trassen ausblenden (Spec-Scenario „Trassen ausblenden“), „nur KNX“ zeigt Trassen weiter (Spec-Scenario „Nur KNX“)

## 5. Leitungen

- [ ] 5.1 `geometry/cables.ts`: Graph aus Segmenten, Dijkstra mit deterministischem Gleichstand, Kette ordnen, zusammenhängend prüfen; Unit-Tests: kürzester Weg (Spec-Scenario „Automatischer Weg“), kein Weg (Spec-Scenario „Kein Weg“), gleich lange Wege, Weg über einen Deckendurchbruch
- [ ] 5.2 Befehle „Leitung anlegen“ (mit Typprüfung und Wegvorschlag), „Leitung ändern“, „Weg ändern“, „Weg vorschlagen“, „Leitung löschen“; Leitungstyp in Verwendung nicht löschbar; Unit-Tests: KNX-Busleitung vom Präsenzmelder zum KNX-Taster (Spec-Scenario „Busleitung zum Präsenzmelder“), Cat 7 an Rollladenmotor abgelehnt (Spec-Scenario „Unpassender Typ“), Typ löschen abgelehnt
- [ ] 5.3 Länge mit Zuschlägen, Einstellungen in den Projekteinstellungen (Befehl, Prüfung ≥ 0); Unit-Tests: 8,4 m Trasse Dose → Schalter ergibt 9,9 m (Spec-Scenario „Längenberechnung“), Wand verschoben verlängert Segmente und Länge (Spec-Scenario „Wand verschoben“), unterbrochener Weg ohne Länge
- [ ] 5.4 Werkzeug „Leitung“ (zwei Geräte, auch über Ansichten und Geschosse), Leitungseigenschaften (Typ, Bezeichnung, Status, Länge, Weg bearbeiten, Weg vorschlagen), Hervorheben in allen Ansichten, im Grundriss und in 3D, Baum markiert die Flächen; Playwright: Leitung über zwei Geschosse auswählen hebt den Weg in allen beteiligten Ansichten und in 3D hervor (Spec-Scenario „Leitung über zwei Geschosse“); Komponententest: Status „geprüft“ (Spec-Scenario „Leitung geprüft“)

## 6. Belegung und Regeln

- [ ] 6.1 Belegung je Segment (Anzahl, Querschnittssumme, Füllgrad, Leitungsliste), Regel `conduit-overfull`; Unit-Test: fünf Leitungen über M20 melden „Leerrohr überfüllt“ (Spec-Scenario „Volles Leerrohr“), M25 belegt (Spec-Scenario „Leerrohr belegen“)
- [ ] 6.2 Regel `route-outside-zone` mit den vier Bedingungen aus `design.md`; Unit-Tests: Diagonale meldet (Spec-Scenario „Diagonale Trasse“), senkrechter Stich zum Schalter meldet nichts (Spec-Scenario „Senkrechter Stich“), waagerecht in der oberen Zone, senkrecht in der senkrechten Zone, Stich über Abzweig, Wandseite ohne Raum nicht geprüft
- [ ] 6.3 Regeln `cable-without-path`, `route-node-off-edge` und die Verweise ins Leere mit ihren Aktionen; Klickziele in der Warnungsübersicht; Unit-Tests je Regel, nicht übergehbare Warnungen

## 7. Integration

- [ ] 7.1 Playwright-Ablauf: M2-Projekt öffnen (Migration), Trasse über Ecke und zur Decke zeichnen, Durchbruch, Leitung anlegen, Weg hervorgehoben, Zuschläge ändern, speichern, neu laden; serialisiertes Projekt vor und nach dem Neuladen identisch
- [ ] 7.2 Manuell: banatstrasse10 migrieren, im EG Trassen zu einigen Steckdosen und Schaltern zeichnen, eine Leitung anlegen; Befunde als Folge-Tasks

## Workflow follow-up

- Vor der Umsetzung: Review von design.md, Specs und Tasks (von Hand nach dem Schema der m1/m2-Reviews, da `/openspec-review` nicht installiert ist)
- Nach Abschluss: Drift-Review, Change archivieren, danach `m4-verteiler-und-stromkreise` vervollständigen
