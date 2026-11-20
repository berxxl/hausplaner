# Tasks

## 1. Projektgerüst

- [ ] 1.1 Vite + React + TypeScript (strict) anlegen, ESLint und Prettier einrichten; `npm run dev` zeigt eine leere Seite
- [ ] 1.2 Vitest und Playwright einrichten; `npm test` und `npm run e2e` laufen je mit einem Beispieltest grün
- [ ] 1.3 GitHub Actions: Lint, Typecheck und Vitest auf Node 22 unter ubuntu, macos und windows; Playwright mit Chromium auf allen drei, Firefox und WebKit auf ubuntu; Workflow läuft grün
- [ ] 1.4 Fixtures unter `tests/fixtures/`: kleines Projekt (ein Geschoss, vier Räume), DG-Projekt (Kniestock, Giebel), Skript `make-pdfs.ts` erzeugt zweiseitigen Vektorplan und gescannten Plan; Skript läuft und erzeugt die Dateien

## 2. Datenmodell und Serialisierung

- [ ] 2.1 zod-Schema für das M1-Modell (Project, Settings, Storey, Wall, Room, Slope, Opening) nach `design.md` „Dateiformat M1“ in `src/model/`; Typen daraus abgeleitet; Unit-Test: Fixture-Projekte bestehen die Prüfung
- [ ] 2.2 Aufteilen und Zusammenführen Project ↔ Dateien (`projekt.yaml`, `geschosse/<slug>.yaml`; fehlende Dateien = leer; `storeyId` beim Laden gesetzt); Unit-Test Rundreise mit beiden Fixtures
- [ ] 2.3 Deterministischer YAML-Writer nach der Tabelle „Dateiformat M1“ (eine Stelle im Code); Golden-File-Tests: (a) Laden → Speichern byteweise identisch, (b) Öffnung verschieben ändert genau eine Zeile, (c) zwei Wände in unterschiedlicher Reihenfolge angelegt ergeben dieselbe Datei
- [ ] 2.4 Rundungsfunktionen (mm, 0,1°, 0,1 pt, 0,01) und Slug-Bildung nach `design.md`; Unit-Tests für Umlaute, Sonderzeichen, Kollision, leeren Namen
- [ ] 2.5 Laden mit Prüfung: Syntaxfehler, Konfliktmarker, Schemaverstoß → Ablehnung mit Datei und Zeile; Öffnung mit unbekannter `wallId` → Projekt öffnet, Warnung `opening-without-wall`; Unit-Tests für alle vier Fälle
- [ ] 2.6 Schemaversion 1 und Migrationskette; Dummy-Migration „Datei ohne `schemaVersion`“ → 1; Unit-Test: Migration läuft, es wird nichts geschrieben, Hinweistext wird geliefert

## 3. Lokaler Server

- [ ] 3.1 `npm start -- <ordner>`: Build nur wenn `dist/` fehlt oder älter als `src/`/`package.json`; Bindung an 127.0.0.1, Port 5180 mit Ausweichen bis 5189; öffnet `http://127.0.0.1:<port>`; Integrationstest prüft Bindung und Portausweichen
- [ ] 3.2 Endpunkte `GET /api/project` (ok/empty/missing), `PUT /api/files` (inkl. `null` = löschen, Ordner anlegen), `GET`/`PUT /api/raw/*` nach Tabelle in `design.md`; atomisches Schreiben über temp+rename; Integrationstests je Endpunkt und Statuscode
- [ ] 3.3 Pfadprüfung nach `design.md`; Tests für `..`, absolut, `C:\`, Backslash, `%2e%2e`, Symlink nach außen → 400/403
- [ ] 3.4 `GET /api/events` mit chokidar, 300 ms entprellt, eigene Schreibvorgänge per SHA-256 ausgefiltert; Integrationstest: externe Änderung, neue und gelöschte Datei werden gemeldet, eigene nicht
- [ ] 3.5 `npm run dev -- <ordner>` mit Vite-Proxy auf `/api`; README beschreibt beide Startarten; manuell geprüft

## 4. Store und Oberflächengerüst

- [ ] 4.1 Store mit Befehlen (deutsches Label je Befehl), `immer`-Patches, Undo/Redo, 200 Schritte, Kürzel Cmd/Strg+Z und Cmd/Strg+Shift+Z, Ziehen = ein Befehl; Unit-Tests für Undo/Redo über mehrere Befehle und Historiengrenze
- [ ] 4.2 Speichern: Cmd/Strg+S und automatisch 2 s nach der letzten Änderung, nur geänderte Dateien; Statusanzeige gespeichert/ungespeichert/Fehler; Test mit gemocktem Server inkl. Fehler einer einzelnen Datei
- [ ] 4.3 Externe Änderungen: Hinweis mit „Neu laden“/„Später“, Autospeichern pausiert, Rückfrage bei ungespeicherten Änderungen, Undo-Historie nach Neuladen leer, Cmd/Strg+S mit Bestätigung „Externe Änderungen überschreiben?“; Komponententest mit gemocktem Server
- [ ] 4.4 Startzustände: Fehlerseite bei Ladefehler mit automatischem Neuladen bei Dateiänderung; Dialog „Neues Projekt“ bei empty/missing mit Standardwerten aus `design.md`; Ablehnen schreibt nichts; Komponententests
- [ ] 4.5 Layout-Gerüst: Baum (nur Geschossebene), Editorbereich mit Umschaltung Grundriss/Fläche/3D, Eigenschaftenbereich, Warnungsleiste (Anzahl, Liste, Klick wählt Objekt); deutsche Texte; Komponententest für Warnungsleiste
- [ ] 4.6 Zahlenformat: Eingabe ganze mm, mm ohne Tausendertrenner, m/m² mit zwei Nachkommastellen und Dezimalkomma, Winkel mit einer Nachkommastelle; Unit-Tests „4260 mm (4,26 m)“ und „12,50 m²“
- [ ] 4.7 Auswahlmodell für Geschoss, Wand, Raum, Öffnung, Schräge; Hervorhebung in allen Ansichten über einen gemeinsamen Zustand; Unit-Test für Auswahlzustand

## 5. Geschosse und Planhintergrund

- [ ] 5.1 Geschosse anlegen, umbenennen (Slug bleibt), Höhen und Standardaufbauten bearbeiten; Reihenfolge nach Höhenlage; Komponententest: KG/EG/OG-Reihenfolge, Umbenennen ändert Dateinamen nicht
- [ ] 5.2 PDF wählen: außerhalb → Kopie nach `plaene/` mit Kollisionssuffix über `PUT /api/raw`, innerhalb → Referenz; Seite wählen; Rendern mit pdf.js unter den Bauteilen; Playwright-Test mit beiden Fixture-PDFs (Seite 2 des Vektorplans, gescannter Plan)
- [ ] 5.3 Transformation nach Formel in `design.md` in `geometry/`; Kalibrierung über zwei Punkte und Abstand, undo-fähig; Unit-Tests: bemaßte Strecke ergibt 4260 mm, Neu-Kalibrieren hält p1 fest, Wände unverändert
- [ ] 5.4 Hintergrund verschieben, um gewählten Punkt drehen, Deckkraft, ein/aus, nur im Grundriss; alles undo-fähig; Unit-Test Drehpunkt bleibt fest; Komponententest Ausblenden

## 6. Wände, Räume, Öffnungen

- [ ] 6.1 Grundriss-Editor: Zoom, Pan, Raster, Messwerkzeug; Komponententest Messwerkzeug
- [ ] 6.2 Wände zeichnen: Modi Achse/linke Kante/rechte Kante, Fang 20 mm (Endpunkte, Achsen, orthogonal), optionale Wandhöhe; Wandkörper mit Gehrungen in `geometry/`; Unit-Tests für L-, T- und Kreuzanschluss, Kantenmodus (Spec-Scenario), Fang
- [ ] 6.3 Wände bearbeiten: Endpunkt verschieben bzw. Länge (Eck-Nachbarn übernehmen Endpunkt), parallel verschieben (Nachbarn behalten Richtung), Dicke; Löschen mit Öffnungen in einem Schritt; Unit-Tests: Längen-Scenario, Rechteck-Scenario Ost +200 mm, T-Anschluss, Undo des Löschens
- [ ] 6.4 Raumerkennung nach `design.md` (morphologisches Schließen, Saatpunkt, offene Endpunkte markieren); Klick in bestehenden Raum wählt ihn; frei stehende Wände gehören zum Raum; Unit-Tests: geschlossen, Lücke 15 mm, Lücke 30 mm, Klick in bestehenden Raum, frei stehende Wand
- [ ] 6.5 Raumkontur nach Wandänderung neu, bei offenem Raum alte Kontur und Warnung `room-open`; Teilung behält Teil mit Saatpunkt; „Raum neu erkennen“; Unit-Tests: verschoben, gelöscht, geteilt
- [ ] 6.6 Raumeigenschaften: Name, Fußbodenaufbau, Putz, Abhängung, Fläche in m²; Komponententest
- [ ] 6.7 Öffnungen (Fenster, Tür, Durchgang) in Rohbaumaßen mit Rollladenkasten (über der Öffnung, Lage innen/außen/Aufsatz) setzen und bearbeiten; Darstellung im Grundriss; Warnung `opening-without-wall` mit Aktion „Löschen“; Komponententest für die Löschaktion
- [ ] 6.8 Dachschrägen mit stabiler `id` erfassen; Deckenhöhenfunktion nach Formel in `design.md`; ungültige Schräge (Schwerpunkt auf der Grundlinie) → Warnung; Unit-Tests: flach, Abhängung, Kniestock (Spec-Scenario), zwei Schrägen, ungültige Schräge

## 7. Flächen und Flächenansichten

- [ ] 7.1 `deriveSurfaces` (Wandseiten über ganze Länge, Decken, Böden, Schrägen) und Angrenzung/Außenseite nach `design.md`, `outsideSide` umschaltbar; Unit-Tests: Innenwand zwischen zwei Räumen, Außenwand mit und ohne Raum, geteilter Raum behält Flächen-IDs
- [ ] 7.2 `deriveRoomViews`: Ausschnitte je Raum, v-Bezug je Abschnitt, fertige Ränder, Nachbarn, Benennung und Reihenfolge nach `design.md`; Unit-Tests: Wandseite an zwei Räumen, unterschiedlicher Fußbodenaufbau (Spec-Scenario), Namen im Rechteck und im L-Raum
- [ ] 7.3 Wandansicht je Raum: fertige Laibungen, Rollladenkästen, Bemaßung fertig, Rohbaumaß beim Auswählen, Messwerkzeug; Unit-Tests der fertigen Öffnungsmaße (980 mm, Brüstung 780, Sturz 2150; Estrich-Scenario 820 → 780); Playwright: Messen Raumecke–Laibung
- [ ] 7.4 Ansicht einer ganzen Wandseite (Außenseite, Flächen ohne Raum) von Rohfußboden bis Wandoberkante mit außen liegenden Rollladenkästen; Komponententest: Außenansicht zeigt alle Fenster, Vorbaukasten nur außen
- [ ] 7.5 Deckenspiegel, Bodenansicht und Schrägenansicht in wahrer Größe mit beschrifteten Wandkanten; Unit-Test der Spiegelung und der wahren Größe der Schräge
- [ ] 7.6 Strukturbaum vollständig: Räume, Wandansichten in Reihenfolge, Decke, Boden, Schrägen, „Flächen ohne Raum“; Wandauswahl markiert alle Wandansichten der Wand; Komponententests für Baumaufbau und Markierung
- [ ] 7.7 Navigation: Doppelklick im Raum, Doppelklick außerhalb aller Räume, Baum, Nachbarwand links/rechts, Decke/Boden, Klick auf Wandkante in Decken-, Boden- und Schrägenansicht; Playwright-Test für jeden Weg

## 8. 3D-Ansicht

- [ ] 8.1 react-three-fiber-Szene in Rohbaumaßen: Wandkörper mit Öffnungen, gekappt an den Schrägen aller angrenzenden Räume, Böden, Decken, Schrägen; Geschosse nach Höhenlage gestapelt; Unit-Test der Kappungsgeometrie für Giebelwand; Playwright: Wand verschieben aktualisiert die Szene
- [ ] 8.2 Orbit-Navigation, „bis Geschoss“ blendet höhere Geschosse aus; Playwright-Test „bis EG“
- [ ] 8.3 Auswahl per Klick: Wand → Wand, Decke/Boden → Raum, synchron mit Grundriss und Baum; Playwright-Test

## 9. Integration

- [ ] 9.1 Playwright-Ablauf in CI: neues Projekt, PDF laden, kalibrieren, vier Wände, Raum, Fenster, Wandansicht öffnen, speichern, Seite neu laden; serialisiertes Projekt vor und nach dem Neuladen identisch
- [ ] 9.2 Playwright: Änderung im DG ändert nur `geschosse/dg.yaml`; Laden und Speichern ohne Änderung schreibt keine Datei
- [ ] 9.3 Manuell: `npm start` auf macOS, Windows und Linux; Projekt in Safari und Firefox öffnen
- [ ] 9.4 Mit einem echten Architektenplan ein Geschoss nachzeichnen; gefundene Probleme als Issues oder Folge-Tasks festhalten

## Workflow follow-up

- `/openspec-review m1-gebaeudemodell --after-fixes` vor Beginn der Umsetzung
- Nach Abschluss: `/openspec-review m1-gebaeudemodell --drift`, Change archivieren, danach `m2-geraete-und-moebel` mit design.md und tasks.md vervollständigen
