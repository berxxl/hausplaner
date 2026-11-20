# Design

## Context

Leeres Repository. Datenmodell, Dateiformat, Modulschnitt und Technik sind in `docs/architektur.md` festgelegt. Dieses Dokument legt fest, was M1 darüber hinaus braucht, damit beim Umsetzen keine eigenen Designentscheidungen nötig sind.

## Goals / Non-Goals

**Goals:**
- Tragfähiger Kern für alle weiteren Meilensteine: Modell, Store mit Undo/Redo, Geometrie der Flächen, Serialisierung, Server
- Jede Flächenansicht wird aus dem Modell berechnet, nicht gespeichert

**Non-Goals:**
- Geräte, Trassen, Möbel, Katalog und Gewerkfilter (ab M2), Verteiler im Baum (ab M4), Listen (ab M5)
- Übergehen von Warnungen (ab M2, Capability `warnings`)
- Gebogene Wände, Treppen als Bauteil, Gauben als eigener Bauteiltyp (Gauben werden über Wände und Schrägen angenähert)
- Mehrbenutzerbetrieb gleichzeitig in einer App-Instanz

## Decisions

### Ein Repository, zwei Startarten
`npm start -- <ordner>` baut die App, wenn `dist/` fehlt oder älter ist als die neueste Datei in `src/` bzw. `package.json`, und startet dann den Server, der `dist/` ausliefert. `npm run dev -- <ordner>` startet Vite mit Hot Reload und den Server als API dahinter (Vite-Proxy auf `/api`). Alternative: Server als Vite-Plugin. Verworfen, weil `npm start` dann Vite bräuchte und Bun-Kompatibilität schwerer wird.

### Server
- Bindet an `127.0.0.1`, Port 5180; ist er belegt, der nächste freie bis 5189, sonst Abbruch mit Meldung. Öffnet `http://127.0.0.1:<port>` im Standardbrowser.
- Der Server kennt das Modell nicht. Serialisierung und Schemaprüfung laufen im Browser (`src/io/`). Alternative: Server parst YAML. Verworfen, weil die Schreibregeln dann an zwei Stellen gepflegt werden müssten.
- **Pfadprüfung** für jeden Pfad: URL-dekodieren; ablehnen bei absolutem Pfad, Laufwerksbuchstabe, Backslash, leerem Segment oder `..`; danach `realpath` muss innerhalb des Projektordners liegen (Symlinks nach außen werden abgelehnt).

| Endpunkt | Anfrage | Antwort |
|---|---|---|
| `GET /api/project` | – | 200 `{"status":"ok","files":{"<pfad>":"<inhalt>"}}` mit allen `*.yaml` (rekursiv, ohne `.git/`); 200 `{"status":"empty"}` wenn keine `*.yaml`; 200 `{"status":"missing"}` wenn der Ordner fehlt |
| `PUT /api/files` | `{"files":{"<pfad>":"<inhalt>" \| null}}`, `null` = löschen | 200 `{"results":{"<pfad>":"ok" \| {"error":"<meldung>"}}}`; 400 wenn ein Pfad ungültig ist (dann wird nichts geschrieben); legt fehlende Ordner an |
| `GET /api/raw/<pfad>` | – | 200 Rohbytes mit Content-Type nach Endung; 404 |
| `PUT /api/raw/<pfad>` | Rohbytes | 201; 409 wenn die Datei existiert |
| `GET /api/events` | Server-Sent Events | Ereignis `changed` mit `{"paths":["<pfad>",…]}` für neue, geänderte und gelöschte `*.yaml` und `plaene/*`, 300 ms entprellt |

Fehlerantworten haben den Body `{"error":{"code":"<code>","message":"<text>"}}` mit 400 (ungültiger Pfad), 403 (außerhalb des Projektordners), 404, 409, 500. Jede Datei wird über eine temporäre Datei im selben Ordner und `rename` geschrieben, also je Datei atomar. Schlägt eine Datei fehl, meldet die Antwort das für diese Datei; der Client zeigt den Speicherstand „Fehler“.

### Eigene Schreibvorgänge von externen Änderungen unterscheiden
Der Server merkt sich je Datei den SHA-256 des zuletzt selbst geschriebenen Inhalts. Meldet chokidar eine Änderung mit genau diesem Hash, wird sie nicht als extern gemeldet.

### Neues Projekt
„Leer“ heißt: keine `*.yaml` im Projektordner (`.git/`, README und andere Dateien zählen nicht). Fehlt der Ordner, wird er erst angelegt, wenn der Benutzer im Browser zustimmt (über `PUT /api/files`). Standardwerte: Projektname = Ordnername, erstes Geschoss „EG“ mit Höhenlage 0, Rohbauhöhe 2500 mm, Fußbodenaufbau 120 mm, Putz 15 mm; `northDeg` 0.

### Dateiformat M1
M1 schreibt nur `projekt.yaml` und `geschosse/<slug>.yaml`. Für jede Datei, die fehlt, gilt: fehlt = leer bzw. Standardwerte. Die Geschossreihenfolge ergibt sich aus `elevationMm`; `projekt.yaml` führt keine Geschossliste, damit neue Geschosse keine Konflikte in einer gemeinsamen Datei erzeugen. `storeyId` wird in Geschossdateien nicht geschrieben, sondern beim Laden gesetzt.

| Objekt | Felder in Schreibreihenfolge (`?` = nur wenn gesetzt) | Listen sortiert nach | Flow-Stil |
|---|---|---|---|
| Datei `projekt.yaml` | `schemaVersion`, `name`, `settings` | – | – |
| `settings` | `northDeg` | – | – |
| Geschossdatei | `storey`, `walls`, `rooms`, `openings` | je Liste nach `id` | – |
| `storey` | `id`, `name`, `slug`, `elevationMm`, `rawHeightMm`, `defaults`, `underlay?` | – | `defaults` |
| `underlay` | `file`, `page`, `calibration`, `offset`, `rotationDeg`, `opacity`, `visible` | – | `calibration`, `offset` |
| `wall` | `id`, `kind`, `start`, `end`, `thicknessMm`, `rawHeightMm?`, `outsideSide?` | – | `start`, `end` |
| `room` | `id`, `name`, `floorBuildupMm?`, `plasterMm?`, `suspendedMm?`, `seed`, `polygon`, `slopes?` | `slopes` nach `id` | `seed`, jeder Punkt in `polygon` |
| `slope` | `id`, `baseLine`, `heightAtBaseMm`, `angleDeg` | – | `baseLine` |
| `opening` | `id`, `wallId`, `kind`, `offsetMm`, `widthMm`, `heightMm`, `sillMm`, `shutterBox?` | – | `shutterBox` |

Weitere Regeln: IDs 8 Zeichen aus `[0-9a-z]` (nanoid, eigenes Alphabet). `polygon` als Blockliste mit einem Punkt je Zeile. Längen und Koordinaten ganze mm, Winkel 0,1°, PDF-Koordinaten 0,1 Punkt, `opacity` zwei Nachkommastellen. Texte in doppelten Anführungszeichen, Zahlen und Booleans ohne. Leere optionale Felder und leere Listen werden weggelassen. `schemaVersion` ist 1.

**Werte werden beim Setzen gerundet**, nicht erst beim Schreiben: Jeder Befehl rundet seine Ergebnisse, auch berechnete Polygone, auf die Speichergenauigkeit. Damit ist der Zustand nach Speichern und Neuladen identisch.

### Dateiname der Geschossdatei
Der Slug wird beim Anlegen des Geschosses einmal gebildet und gespeichert: Kleinbuchstaben, ä→ae, ö→oe, ü→ue, ß→ss, jedes andere Zeichen außerhalb `[a-z0-9]` → `-`, mehrere `-` zusammengefasst, Rand-`-` entfernt, leer → `geschoss`; bei Kollision `-2`, `-3` … Beim Umbenennen bleibt der Slug gleich, damit Git keine Lösch- und Neu-Paare sieht.

### Ladefehler
Syntaxfehler, Konfliktmarker (`<<<<<<<`, `=======`, `>>>>>>>` am Zeilenanfang) und Schemaverstöße zeigen eine Fehlerseite mit Datei, Zeile und Ursache; das Projekt wird nicht geöffnet. Ändern sich danach Dateien, lädt die App automatisch erneut. Verweise ins Leere (in M1: Öffnung mit unbekannter `wallId`) öffnen das Projekt; die Öffnung wird nicht dargestellt und erscheint als Warnung mit Aktion „Löschen“.

### Externe Änderungen
Sobald der Server externe Änderungen meldet (auch neue oder gelöschte Dateien), pausiert das Autospeichern und ein Hinweis erscheint mit „Neu laden“ und „Später“. „Neu laden“ verwirft ungespeicherte Änderungen nach Rückfrage, lädt das Projekt neu und leert die Undo-Historie. „Später“ lässt den Hinweis stehen; das Autospeichern bleibt pausiert. Cmd/Strg+S fragt dann „Externe Änderungen überschreiben?“ und schreibt nach Bestätigung alle geänderten Dateien.

### Schema mit zod
Das Modell wird mit zod beschrieben; daraus folgen TypeScript-Typen und die Prüfung beim Laden. Zeilennummern liefert das `yaml`-Paket über die Positionen im Dokumentbaum. Migrationen sind Funktionen `vN → vN+1`; als Test dient eine Dummy-Migration „Version 0“ = Datei ohne `schemaVersion` → Version 1 setzt das Feld. Nach einer Migration zeigt die App den Hinweis „Projekt auf Version N aktualisiert, wird beim nächsten Speichern geschrieben“.

### Serialisierung über explizite Feldlisten
Die Tabelle oben ist im Code genau einmal hinterlegt (Feldliste, Sortierschlüssel, Flow-Markierung je Typ). Golden-File-Tests sichern: Laden → Speichern ergibt byteweise denselben Inhalt, und eine Änderung eines Werts ändert genau eine Zeile.

### Store mit Befehlen und Patches
Alle Änderungen laufen über benannte Befehle, die mit `immer` Patches und Gegenpatches erzeugen, auch Änderungen am Planhintergrund. Jeder Befehl hat ein deutsches Label für das Undo-Menü (z. B. „Wand verschieben“). Ein Ziehvorgang ist ein Befehl, abgeschlossen beim Loslassen. Kürzel: Cmd/Strg+Z, Cmd/Strg+Shift+Z. Historie 200 Schritte. Löschen einer Wand löscht ihre Öffnungen im selben Schritt. Alternative: Snapshots. Verworfen wegen Speicherbedarf.

### Wände
Die Achse ist die Mittellinie. Zeichenmodi: Achse, linke Kante, rechte Kante (bezogen auf die Zeichenrichtung); bei Kantenmodus wird die geklickte Linie um die halbe Dicke zur Achse versetzt. Anschlüsse werden vor jeder Änderung aus der Geometrie bestimmt, nicht gespeichert: Eckanschluss = Endpunkte ≤ 20 mm auseinander, T-Anschluss = Endpunkt ≤ 20 mm von einer fremden Achse.
- **Endpunkt verschieben** (auch Längenänderung, die den Endpunkt `end` bewegt): Wände mit Eckanschluss an diesem Endpunkt erhalten denselben neuen Endpunkt, ihr anderes Ende bleibt.
- **Parallel verschieben** um einen Betrag senkrecht zur Achse (positiv nach links bezogen auf `start → end`): Wände mit Eck- oder T-Anschluss behalten ihre Richtung; ihr angeschlossener Endpunkt wird auf den Schnitt ihrer Achse mit der neuen Achse gesetzt. Kollineare Nachbarn werden mitverschoben.
- Die Eigenschaften zeigen Länge, Dicke, Anfangs- und Endpunkt (editierbar) und „parallel verschieben um … mm“.

Wandkörper mit Gehrungen an Eckanschlüssen berechnet `geometry/`.

### Räume
- **Erkennung:** Vereinigung aller Wandkörper des Geschosses, morphologisch geschlossen (Puffer +10 mm, dann −10 mm), schließt Lücken bis 20 mm. Die freie Region, die den Saatpunkt enthält, ist der Raum; ihre Außenkontur ist das Polygon. Erreicht die Region den Rand einer um 10 m vergrößerten Hülle aller Wände, ist sie offen; markiert werden dann alle Wandendpunkte ohne Anschluss in der Nähe der Region.
- **Klick in einen bestehenden Raum** wählt diesen Raum aus, statt einen neuen anzulegen.
- **Neuberechnung** nach jeder Wandänderung vom gespeicherten Saatpunkt aus. Ist die Region offen oder liegt der Saatpunkt in einem Wandkörper, bleibt das gespeicherte Polygon; die Warnung „Raum nicht geschlossen“ entsteht. Mit „Raum neu erkennen“ setzt der Benutzer einen neuen Saatpunkt.
- **Teilung:** Teilt eine neue Wand einen Raum, behält der Raum den Teil mit seinem Saatpunkt; der andere Teil hat keinen Raum, bis er angeklickt wird.
- Der Status „offen“ wird berechnet, nie gespeichert. Warnungsschlüssel: `room-open:<roomId>`, `opening-without-wall:<openingId>`.
- **Frei stehende Wände** (Mittelpunkt der Achse im Raumpolygon, ohne Anschluss an die Kontur) gehören zu diesem Raum; beide Seiten sind Ansichten dieses Raums.

### Angrenzung, Außenseite und Benennung
- Eine Wandseite **grenzt an einen Raum**, wenn ein Segment des Raumpolygons höchstens 0,5° von der Wandrichtung abweicht, höchstens 20 mm von der Seitenfläche (Achse ± Dicke/2) entfernt liegt und sich entlang der Wand mit ihr überlappt; der überlappende Bereich ist der u-Abschnitt dieses Raums.
- **Außenseite** einer Außenwand ist die Seite ohne angrenzenden Raum. Grenzen beide oder keine Seite an einen Raum, gilt `outsideSide` (Standard `L`, in den Eigenschaften umschaltbar).
- **Flächen ohne Raum** sind alle Wandseiten ohne angrenzenden Raum, darunter alle Außenseiten.
- **Benennung** einer Wandansicht: Himmelsrichtung der Normalen vom Raum zur Wand in 8 Sektoren (Nord, Nordost, Ost, …), bezogen auf `settings.northDeg` (Winkel der Nordrichtung im Grundriss, 0 = +y, im Uhrzeigersinn). Der Name lautet „Wand <Richtung>“; mehrere Ansichten gleicher Richtung in einem Raum heißen „Wand Nord 1“, „Wand Nord 2“ … in Baumreihenfolge. Flächen ohne Raum heißen „<Richtung> außen“ bzw. „<Richtung> außen 1“ … mit derselben Regel über die nach außen zeigende Normale.
- **Baumreihenfolge** der Wandansichten eines Raums: nach Himmelsrichtung im Uhrzeigersinn ab Nord, bei gleicher Richtung nach Lage entlang des Polygons im Uhrzeigersinn. Danach folgen Decke, Boden und Schrägen.

### Flächen und Ansichten
`deriveSurfaces(project)` liefert alle Flächen mit SurfaceRef, Kontur in (u, v), Öffnungen und Transformation (u, v) → Welt. Eine Wandseite (`wall:<id>:L|R`) umfasst die ganze Wandlänge, damit Geräte und Trassen ab M2 nicht von der Raumerkennung abhängen. `deriveRoomViews(project)` liefert je Raum die Ausschnitte der angrenzenden Wandseiten mit Name, Nachbarn links und rechts und Rand in fertigen Maßen.

**v-Bezug:** v zählt ab OKFF des Raums, in dessen u-Abschnitt der Punkt liegt, ohne Raum ab Oberkante Rohfußboden. Auf einer Wandseite, die an zwei Räume mit unterschiedlichem Fußbodenaufbau grenzt, ist v daher abschnittsweise bezogen. Das ist gewollt: Geräte (ab M2) sollen bei geändertem Estrich ihre Höhe über OKFF behalten, und an der Raumgrenze steht eine Trennwand, über die keine Trasse ohne Durchbruch läuft. Ändert sich die Raumzuordnung eines Abschnitts, bleibt v gespeichert und bezieht sich fortan auf den neuen Raum.

**Fertige Maße einer Öffnung** in der Ansicht: Breite − 2 · Putz, Brüstung über OKFF = `sillMm` − Fußbodenaufbau (mindestens 0), Sturz über OKFF = `sillMm` + `heightMm` − Fußbodenaufbau − Putz.

### Schrägen und Deckenhöhe
Für einen Punkt p im Grundriss: d(p) = Abstand zur Geraden der Grundlinie, positiv auf der Seite, auf der der Schwerpunkt des Raumpolygons liegt (liegt er auf der Geraden, ist die Schräge ungültig und erzeugt eine Warnung). h_s(p) = `heightAtBaseMm` + d(p) · tan(`angleDeg`), auch für d < 0. Rohdecke H(p) = min(Rohbauhöhe − `suspendedMm`, alle h_s(p)). Fertige Decke = H(p) − Putz. In der Regel liegt die Grundlinie auf der rohen Innenseite der Traufwand.

In 3D ist die Oberkante eines Wandkörpers an jeder Stelle das Minimum aus Wandhöhe und den Ebenen aller Schrägen der an die Wand angrenzenden Räume, über die ganze Wanddicke fortgesetzt. Schrägen haben eine stabile `id`; ihre SurfaceRef ist `slope:<roomId>:<slopeId>`.

### PDF-Hintergrund
pdf.js rendert die gewählte Seite in ein Canvas mit Auflösung passend zum Zoom. PDF-Koordinaten sind Punkte der Seite bei Maßstab 1 mit Ursprung oben links und y nach unten (wie pdf.js-Viewport). Transformation in Weltkoordinaten (mm, y nach oben):

`welt = offset + R(rotationDeg) · s · F · (pdf − p1)` mit `s = distanceMm / |p2 − p1|` und `F = diag(1, −1)`.

- Erste Kalibrierung eines Geschosses: `offset = (0, 0)`, `rotationDeg = 0`; p1 wird damit Weltursprung.
- Verschieben ändert `offset`.
- Drehen um einen gewählten Punkt q um Δ: `rotationDeg += Δ`, `offset = q + R(Δ) · (offset − q)`.
- Neu kalibrieren: Die Weltposition des neuen p1 unter der alten Transformation wird zum neuen `offset`; `rotationDeg` bleibt.

Eine PDF außerhalb des Projektordners wird nach `plaene/<dateiname>` kopiert (bei Kollision `-2`, `-3` vor der Endung) über `PUT /api/raw`; eine PDF innerhalb wird nur referenziert. Undo entfernt eine kopierte Datei nicht.

### Oberfläche
- Auswählbar in M1: Geschoss (im Baum), Wand, Raum, Öffnung, Schräge. Ein Klick auf Decke oder Boden in 3D wählt den Raum.
- Warnungsleiste am unteren Rand: Anzahl der Warnungen, aufklappbare Liste, Klick wählt das Objekt und öffnet die passende Ansicht.
- Zahlenformat: Eingaben in ganzen mm; Anzeige mm ohne Tausendertrenner; m und m² mit zwei Nachkommastellen und Dezimalkomma; Winkel mit einer Nachkommastelle.
- Doppelklick im Grundriss neben einer Wandseite außerhalb aller Räume öffnet die ganze Wandseite.

### 3D aus denselben Daten
Die 3D-Ansicht extrudiert Wandkörper, kappt sie wie oben beschrieben und schneidet Öffnungen aus; Decken, Böden und Schrägen werden aus Polygonen und Deckenhöhenfunktion trianguliert. Geschosse werden nach `elevationMm` gestapelt. Keine eigene 3D-Datenhaltung.

### Tests und Fixtures
Testdaten liegen unter `tests/fixtures/`: zwei Projektordner (klein: ein Geschoss mit vier Räumen; DG mit Kniestock und Giebel) und zwei PDFs (zweiseitiger Vektorplan, gescannter Plan), erzeugt durch ein Skript `tests/fixtures/make-pdfs.ts`. CI läuft auf ubuntu, macos und windows mit Node 22; Playwright mit Chromium auf allen drei, Firefox und WebKit auf ubuntu.

## Risks / Trade-offs

- [Raumerkennung scheitert an kleinen Lücken im Altbau-Grundriss] → morphologisches Schließen bis 20 mm, offene Endpunkte werden markiert
- [Schräge Wände und Schrägen erzeugen komplizierte Wandkonturen] → Geometrie in `geometry/` mit Unit-Tests für Kniestock, Giebel und schräge Wand
- [Sortierung nach ID ist für Menschen zufällig] → Namen stehen direkt nach der ID; die Reihenfolge ist stabil, und das zählt für den Diff
- [Endpunkt verschieben dreht angeschlossene Wände] → gewollt wie in üblichen CAD-Werkzeugen; für rechtwinklige Änderungen dient „parallel verschieben“
- [Bun-Abweichungen im Server] → nur Node 22 in CI; Bun ist Best Effort

## Open Questions

- Ob Gauben einen eigenen Bauteiltyp brauchen, zeigt sich beim Nachzeichnen des DG. Die Annäherung über Wände und Schrägen ändert die Specs nicht.
