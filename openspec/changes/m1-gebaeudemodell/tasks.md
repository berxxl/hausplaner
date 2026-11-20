# Tasks

## 1. Projektgerüst

- [ ] 1.1 Vite + React + TypeScript (strict) anlegen, ESLint und Prettier einrichten; `npm run dev` zeigt eine leere Seite
- [ ] 1.2 Vitest und Playwright einrichten; `npm test` und `npm run e2e` laufen je mit einem Beispieltest grün
- [ ] 1.3 GitHub Actions: Lint, Typecheck und Vitest auf Node 22 unter ubuntu, macos und windows; Playwright mit Chromium auf allen drei, Firefox und WebKit auf ubuntu; Workflow läuft grün
- [ ] 1.4 Fixtures unter `tests/fixtures/`: kleines Projekt (ein Geschoss, vier Räume), DG-Projekt (Kniestock, Giebel) mit dem verbindlichen Beispiel `geschosse/dg.yaml` aus `design.md`; eingecheckte PDFs: Vektorplan A3, zwei Seiten, 1:100, bemaßte Referenzstrecke 4260 mm, und Scan als Rasterbild von Seite 1 mit 150 dpi, um 1,5° gedreht; Herkunft und Erzeugung in `tests/fixtures/README.md`

## 2. Datenmodell und Serialisierung

- [ ] 2.1 zod-Schema für das M1-Modell (Project, Settings, Storey mit `defaults.suspendedMm`, Wall, Room, Slope, Opening) nach `design.md` „Dateiformat M1“ in `src/model/`, alle Objekte `.strict()`; Typen daraus abgeleitet; Unit-Test: Fixture-Projekte bestehen die Prüfung
- [ ] 2.2 Aufteilen und Zusammenführen Project ↔ Dateien (`projekt.yaml`, `geschosse/<slug>.yaml`; fehlende Dateien = leer; andere `*.yaml` ignoriert und nie geschrieben oder gelöscht; `storeyId` beim Laden gesetzt); Unit-Test Rundreise mit beiden Fixtures und mit einer fremden `katalog.yaml`
- [ ] 2.3 Deterministischer YAML-Writer nach der Tabelle „Dateiformat M1“ (eine Stelle im Code) mit den Formatregeln und `yaml`-Optionen aus `design.md`; Golden-File-Tests: (a) verbindliches Beispiel Laden → Speichern byteweise identisch, (b) Öffnung verschieben ändert genau eine Zeile, (c) zwei Wände in unterschiedlicher Reihenfolge angelegt ergeben dieselbe Datei, (d) Zahlen: `512` statt `512.0`, `102.4`, `-0` → `0`
- [ ] 2.4 Rundungsfunktionen (mm, 0,1°, 0,1 pt, 0,01) und Slug-Bildung nach `design.md`; Unit-Tests für Umlaute, Sonderzeichen, Kollision, leeren Namen
- [ ] 2.5 Laden mit Prüfung nach `design.md` „Ladefehler“: Syntaxfehler, Konfliktmarker, Schemaverstoß, unbekanntes Feld, fehlende `schemaVersion`, neuere `schemaVersion`, Slug ≠ Dateiname, doppelte ID über zwei Dateien, doppelter Slug, Geschossdatei ohne `projekt.yaml` → Ablehnung mit Datei und Zeile; Öffnung mit unbekannter `wallId` → Projekt öffnet, Warnung `opening-without-wall`; Unit-Test je Fall
- [ ] 2.6 Schemaversion 1 und Migrationskette; Dummy-Migration „Version 0 → 1“ nur im Test registriert; Unit-Tests: Migration läuft, es wird nichts geschrieben, Hinweistext wird geliefert; ohne registrierte Migration ist eine Datei ohne `schemaVersion` ein Ladefehler

## 3. Lokaler Server

- [ ] 3.1 `npm start -- <ordner>`: Build nur wenn `dist/` fehlt oder älter als `src/`/`package.json`; Bindung an 127.0.0.1, Port 5180 mit Ausweichen bis 5189; öffnet `http://127.0.0.1:<port>`; Integrationstest prüft Bindung und Portausweichen
- [ ] 3.2 Endpunkte `GET /api/project` (ok/empty/missing), `PUT /api/files` (inkl. `null` = löschen, `null` auf fehlende Datei = `"ok"`, Ordner anlegen, 400/403 bricht den ganzen Stapel ab), `GET /api/raw/*`, `PUT /api/raw/plaene/<name>` (200 mit vorhandenem Pfad bei gleichem SHA-256, sonst 201 mit Kollisionssuffix, 400 außerhalb von `plaene/`) nach Tabelle in `design.md`; atomares Schreiben über temp+rename; Integrationstests je Endpunkt und Statuscode
- [ ] 3.3 Pfadprüfung nach `design.md` mit `realpath` des nächsten existierenden Vorfahren; Tests für `..`, absolut, `C:\`, Backslash, `%2e%2e`, Symlink nach außen auf eine vorhandene Datei und Symlink-Ordner nach außen mit neuer Datei darin → 400/403, im Stapel wird nichts geschrieben
- [ ] 3.4 `GET /api/events` mit chokidar, nur `*.yaml`, 300 ms entprellt, eigene Schreibvorgänge per SHA-256 ausgefiltert; Integrationstest: externe Änderung, neue und gelöschte Datei werden gemeldet, eigene nicht, neue Datei in `plaene/` nicht
- [ ] 3.5 `npm run dev -- <ordner>`: Server zuerst starten, gewählten Port an den Vite-Proxy für `/api` übergeben; Test: bei belegtem Port 5180 erreicht der Proxy den Server auf 5181; README beschreibt beide Startarten

## 4. Store und Oberflächengerüst

- [ ] 4.1 Store mit Befehlen (deutsches Label je Befehl), `immer`-Patches, Undo/Redo, 200 Schritte, Kürzel Cmd/Strg+Z und Cmd/Strg+Shift+Z, Ziehen = ein Befehl; Unit-Tests für Undo/Redo über mehrere Befehle und Historiengrenze
- [ ] 4.2 Speichern nach `design.md` „Speichern“: Vergleich der Serialisierung mit dem zuletzt gelesenen/geschriebenen Inhalt je Datei; Autospeichern 2 s nach dem letzten Befehl, nur durch Befehle ausgelöst; Cmd/Strg+S schreibt alle abweichenden Dateien; Statusanzeige gespeichert/ungespeichert/Fehler; nach Fehler erneuter Versuch beim nächsten Befehl und alle 10 s; Tests mit gemocktem Server: Fehler einer einzelnen Datei und erfolgreicher Wiederholversuch, nicht kanonische Datei wird beim nächsten Speichern kanonisch geschrieben, nach Migration (Dummy v0) löst erst die erste Änderung das Schreiben von `projekt.yaml` mit `schemaVersion: 1` aus
- [ ] 4.3 Externe Änderungen: Hinweis mit „Neu laden“/„Später“, Autospeichern pausiert, Rückfrage bei ungespeicherten Änderungen, Undo-Historie nach Neuladen leer, Cmd/Strg+S mit Bestätigung „Externe Änderungen überschreiben?“, danach Hinweis weg und Autospeichern wieder aktiv; Komponententest mit gemocktem Server
- [ ] 4.4 Startzustände: Fehlerseite bei Ladefehler (inkl. „Projekt wurde mit neuerer App-Version erstellt“) mit automatischem Neuladen bei Dateiänderung; Dialog „Neues Projekt“ bei empty/missing und bei Ordner ohne `projekt.yaml` und Geschossdateien (z. B. nur `katalog.yaml`) mit Standardwerten aus `design.md`; Anlegen lässt `katalog.yaml` unberührt; Zustimmung schreibt sofort `projekt.yaml` und `geschosse/eg.yaml`; Ablehnen schreibt nichts; Komponententests
- [ ] 4.5 Layout-Gerüst: Baum (nur Geschossebene), Editorbereich mit Umschaltung Grundriss/Fläche/3D, Eigenschaftenbereich, Warnungsleiste (Anzahl, Liste, Klickziele und Aktion „Löschen“ nach Tabelle „Warnungen“ in `design.md`); deutsche Texte; Komponententest für Warnungsleiste
- [ ] 4.6 Zahlenformat: Eingabe in mm mit Rundung von Dezimaleingaben und Umrechnung von „m“, Winkel mit Komma oder Punkt; Anzeige mm ohne Tausendertrenner, m/m² mit zwei Nachkommastellen und Dezimalkomma, Winkel mit einer Nachkommastelle; Unit-Tests „4260 mm (4,26 m)“, „12,50 m²“, „4,26 m“ → 4260, „240,6“ → 241, „1.5“ und „1,5“ → 1,5°
- [ ] 4.7 Auswahlmodell für Geschoss, Wand, Raum, Öffnung, Schräge; Hervorhebung in allen Ansichten über einen gemeinsamen Zustand; Unit-Test für Auswahlzustand
- [ ] 4.8 Projekteinstellungen: Projektname und Nordrichtung bearbeiten, undo-fähig; Komponententest: nach Änderung der Nordrichtung auf 90° ändern sich die Namen der Wandansichten im Baum (Spec-Scenario „Nordrichtung ändern“), nach Rückgängig wieder die alten

## 5. Geschosse und Planhintergrund

- [ ] 5.1 Geschosse anlegen (Vorschlag aus dem höchsten Geschoss: Rohbauhöhe, Standardaufbauten inkl. Abhängung, Höhenlage + Rohbauhöhe + 300 mm), umbenennen (Slug bleibt), Höhen und Standardaufbauten bearbeiten; Reihenfolge nach Höhenlage, bei Gleichstand nach Name; Komponententests: KG/EG/OG-Reihenfolge, Vorschlag 2800 mm, Umbenennen ändert Dateinamen nicht
- [ ] 5.2 Geschoss löschen mit allen Wänden, Räumen und Öffnungen in einem Befehl; Speichern löscht die Geschossdatei; Unit-Test: Löschen, Speichern (`null` für die Datei), Rückgängig, Speichern (Datei wieder geschrieben)
- [ ] 5.3 PDF wählen: immer Upload über `PUT /api/raw/plaene/<name>`, gespeichert wird der gelieferte Pfad; Seite wählen (`page` ab 1); Rendern mit pdf.js unter den Bauteilen, Viewport `getViewport({scale: 1})` inkl. Seitenrotation; Playwright-Tests mit beiden Fixture-PDFs (Seite 2 des Vektorplans, gescannter Plan) und erneuter Wahl derselben PDF für ein zweites Geschoss (keine Kopie)
- [ ] 5.4 Transformation nach Formel in `design.md` in `geometry/`; Kalibrierung über zwei Punkte und Abstand, undo-fähig; Unit-Tests: bemaßte Strecke ergibt 4260 mm, Neu-Kalibrieren hält p1 fest, Wände unverändert, Kalibrierung rückgängig stellt die vorige Kalibrierung her (Spec-Scenario)
- [ ] 5.5 Hintergrund verschieben, um gewählten Punkt drehen (Δ numerisch auf 0,1°, positiv gegen den Uhrzeigersinn), Deckkraft, ein/aus, nur im Grundriss; alles undo-fähig; Unit-Tests: Drehpunkt bleibt fest, Verschieben ändert nur `offset`, Deckkraft wird auf 0,01 gerundet; Komponententest Ausblenden; Playwright: gescannter Plan um 1,5° gedreht ergibt achsparallele Planwände

## 6. Wände, Räume, Öffnungen

- [ ] 6.1 Grundriss-Editor: Zoom, Pan, Raster 1 m / 100 mm ohne Rasterfang, Messwerkzeug; Komponententest Messwerkzeug
- [ ] 6.2 Wände zeichnen: Modi Achse/linke Kante/rechte Kante, neue Wand als Innenwand mit zuletzt verwendeter Dicke (Start 240 mm), Fang 20 mm (Endpunkte, Achsen), orthogonale Richtung bis 5° Abweichung, optionale Wandhöhe; Wandkörper mit Gehrungen in `geometry/`; Unit-Tests für L-, T- und Kreuzanschluss, Kantenmodus (Spec-Scenario), Fang, orthogonaler Fang bei 4,9° und kein Fang bei 5,1°, niedrige Wand 1100 mm in Wandansicht und 3D (Spec-Scenario)
- [ ] 6.3 Wände bearbeiten nach `design.md` „Wände“: Endpunkt verschieben bzw. Länge (Eck-Nachbarn übernehmen Endpunkt, T-Nachbarn behalten Richtung und folgen der neuen Achse, Anschluss außerhalb ± 20 mm wird mit Meldung gelöst), parallel verschieben (kollineare Kette mitverschoben, Nachbarn behalten Richtung), Dicke; Unit-Tests: Längen-Scenario, Rechteck-Scenario Ost +200 mm, T-Anschluss parallel, T-Anschluss beim Endpunkt verschieben (2000, 250), T-Anschluss gelöst, T-Anschluss beim Parallelverschieben gelöst (Spec-Scenario), kollineare Kette aus drei Wänden, Abweichung 0,6° gilt nicht als kollinear
- [ ] 6.4 Raumerkennung nach `design.md` (morphologisches Schließen, Saatpunkt, kanonisches Polygon mit `clipper-lib`, offene Endpunkte markieren, deren Wandkörper an die offene Region grenzt; Markierung verschwindet beim nächsten Klick oder Befehl); Klick in bestehenden Raum wählt ihn; frei stehende Wände gehören zum Raum; Unit-Tests: geschlossen, Lücke 15 mm, Lücke 30 mm (genau die beiden Endpunkte an der Lücke markiert, entfernte freie Endpunkte nicht), Klick in bestehenden Raum, frei stehende Wand, kanonische Form (Umlauf, Startpunkt, keine kollinearen Punkte)
- [ ] 6.5 Raumkontur im selben Befehl wie die Wandänderung neu; bei offenem Raum alte Kontur und Warnung `room-open`; bei fremdem Saatpunkt in der Region alte Konturen und `room-merged` an beiden Räumen, bei offener Region nur `room-open`; Teilung behält Teil mit Saatpunkt; „Raum neu erkennen“ behält ID, Name und Werte; Unit-Tests: verschoben, Außenwand gelöscht, Trennwand gelöscht (verschmolzen), Trennwand und Außenwand gelöscht (nur offen), geteilt, neu erkennen, Wandänderung an Raum A lässt die Zeilen von Raum B in der Geschossdatei unverändert, Undo stellt Wand und Kontur in einem Schritt wieder her
- [ ] 6.6 Raumeigenschaften: Name, Fußbodenaufbau, Putz, Abhängung, fertige Fläche in m² (Polygon um Putz nach innen versetzt); Raum löschen mit seinen Schrägen in einem Befehl, Wände bleiben; Unit-Test Fläche: Rohbaupolygon 4000 × 3000 mm mit 15 mm Putz ergibt 11,79 m²; Unit-Test Löschen und Rückgängig
- [ ] 6.7 Öffnungen (Fenster, Tür, Durchgang) in Rohbaumaßen mit Rollladenkasten (über der Öffnung, Lage innen/außen/Aufsatz) setzen, bearbeiten und löschen (undo-fähig); ungültige Öffnungen erlaubt mit Warnung `opening-invalid` und Grund (über Wandende, überlappt <andere Öffnung>, höher als die Wand; erster Grund in dieser Reihenfolge), an der Wandkontur abgeschnitten und rot umrandet in Grundriss, Wandansichten und 3D; Klickziel nach Tabelle „Warnungen“; Darstellung im Grundriss; Warnung `opening-without-wall` mit Aktion „Löschen“; Tests: Fenster 1010 × 1385 erscheint im Grundriss, in beiden Wandseiten und in 3D (Spec-Scenario), je ungültiger Fall eine Warnung mit dem richtigen Grund, Öffnung mit zwei Gründen meldet den ersten, Abschneiden am Wandende, Klickziel bei Wand an zwei Räumen und an keinem Raum, Löschen und Rückgängig, Komponententest für die Löschaktion
- [ ] 6.8 Dachschrägen mit stabiler `id` erfassen und löschen (undo-fähig); Deckenhöhenfunktion nach Formel in `design.md` mit `suspendedMm` aus Raum oder Geschoss; ungültige Schräge (Schwerpunkt auf der Grundlinie) → Warnung `slope-invalid` „Schräge ungültig: <Raum>“; Unit-Tests: flach, Abhängung aus Raum und aus Geschoss, Kniestock (Spec-Scenario), zwei Schrägen, ungültige Schräge, Löschen und Rückgängig

## 7. Flächen und Flächenansichten

- [ ] 7.1 `deriveSurfaces` (Wandseiten über ganze Länge, Decken, Böden, Schrägen) mit Flächenkoordinaten nach `design.md` (u = 0 am linken Achsendpunkt, Kontur an Gehrungen beschnitten; Schräge u/v ab linkem Ende der Grundlinie; Decke (−x, y); Boden (x, y)) und Angrenzung (Mindestüberlappung 1 mm)/Außenseite, `outsideSide` umschaltbar; Unit-Tests: Innenwand zwischen zwei Räumen, Außenwand mit und ohne Raum, geteilter Raum behält Flächen-IDs, u-Richtung beider Seiten einer Wand, Überlappung 0,5 mm grenzt nicht an
- [ ] 7.2 `deriveRoomViews`: Ausschnitte je Raum, v-Bezug je Abschnitt, fertige Ränder, Nachbarn (frei stehende Wände ohne Nachbarn), Benennung, Nummerierung und Reihenfolge nach `design.md` (Sektoren halboffen, „<Richtung> außen“ nur für Außenseiten von Außenwänden, sonst „Wandseite <Richtung>“); Unit-Tests: Wandseite an zwei Räumen, unterschiedlicher Fußbodenaufbau (Spec-Scenario), Namen im Rechteck und im L-Raum, Sektorgrenze genau 22,5°, Außenseite und Innenwand ohne Raum (Spec-Scenario)
- [ ] 7.3 Wandansicht je Raum: fertige Laibungen, Rollladenkästen, Bemaßung fertig, Rohbaumaß beim Auswählen, Messwerkzeug; Unit-Tests der fertigen Öffnungsmaße (980 mm, Brüstung 780, Sturz 2150; Estrich-Scenario 820 → 780) und des Aufsatzkastens 250 mm direkt über dem Fenster in der Innenansicht (Spec-Scenario); Playwright: Messen Raumecke–Laibung
- [ ] 7.4 Ansicht einer ganzen Wandseite (Außenseite, Flächen ohne Raum) von Rohfußboden bis Wandoberkante mit außen liegenden Rollladenkästen; Komponententest: Außenansicht zeigt alle Fenster, Vorbaukasten nur außen
- [ ] 7.5 Deckenspiegel, Bodenansicht und Schrägenansicht in wahrer Größe mit beschrifteten Wandkanten und Messwerkzeug; Unit-Tests der Spiegelung und der wahren Größe der Schräge; Komponententest: Messen in Decken-, Boden- und Schrägenansicht ergibt fertige Maße
- [ ] 7.6 Strukturbaum vollständig: Räume, Wandansichten in Reihenfolge, Decke, Boden, Schrägen, „Flächen ohne Raum“ nach Richtung, dann Wand-ID; Wandauswahl markiert alle Wandansichten der Wand; Komponententests für Baumaufbau und Markierung
- [ ] 7.7 Navigation: Doppelklick im Raum, Doppelklick außerhalb aller Räume, Baum, Nachbarwand links/rechts, Decke/Boden, Klick auf Wandkante in Decken-, Boden- und Schrägenansicht; Playwright-Test für jeden Weg

## 8. 3D-Ansicht

- [ ] 8.1 react-three-fiber-Szene in Rohbaumaßen: Wandkörper mit Öffnungen, gekappt an den Schrägen aller angrenzenden Räume, Böden, Decken, Schrägen; Geschosse nach Höhenlage gestapelt; Unit-Tests der Kappungsgeometrie für Giebelwand und der Stapelung (KG, EG, OG, DG nach `elevationMm`, Spec-Scenario „Geschoss anlegen“); Playwright: Wand verschieben aktualisiert die Szene
- [ ] 8.2 Orbit-Navigation, „bis Geschoss“ blendet höhere Geschosse aus; Playwright-Test „bis EG“
- [ ] 8.3 Auswahl per Klick: Wand → Wand, Decke/Boden → Raum, synchron mit Grundriss und Baum; Playwright-Test

## 9. Integration

- [ ] 9.1 Playwright-Ablauf in CI: neues Projekt, PDF laden, kalibrieren, vier Wände, Raum, Fenster, Wandansicht öffnen, speichern, Seite neu laden; serialisiertes Projekt vor und nach dem Neuladen identisch
- [ ] 9.2 Playwright: Änderung im DG ändert nur `geschosse/dg.yaml`; Laden und Speichern ohne Änderung schreibt keine Datei
- [ ] 9.3 Manuell: `npm start` auf macOS, Windows und Linux; Projekt in Safari und Firefox öffnen
- [ ] 9.4 Mit einem echten Architektenplan ein Geschoss nachzeichnen; gefundene Probleme als Issues oder Folge-Tasks festhalten

## Workflow follow-up

- `/openspec-review m1-gebaeudemodell --quick` nach Einarbeitung von Runde 3, vor Beginn der Umsetzung
- Nach Abschluss: `/openspec-review m1-gebaeudemodell --drift`, Change archivieren, danach `m2-geraete-und-moebel` mit design.md und tasks.md vervollständigen; dabei den offenen Punkt „v-Bezug bei nachträglich angelegtem Raum“ aus `design.md` übernehmen
