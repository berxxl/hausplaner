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
`npm start -- <ordner>` baut die App, wenn `dist/` fehlt oder älter ist als die neueste Datei in `src/` bzw. `package.json`, und startet dann den Server, der `dist/` ausliefert. `npm run dev -- <ordner>` startet zuerst den Server, wartet auf den gewählten Port und startet dann Vite mit Hot Reload; der Port wird an den Vite-Proxy für `/api` übergeben. Alternative: Server als Vite-Plugin. Verworfen, weil `npm start` dann Vite bräuchte und Bun-Kompatibilität schwerer wird.

### Server
- Bindet an `127.0.0.1`, Port 5180; ist er belegt, der nächste freie bis 5189, sonst Abbruch mit Meldung. Öffnet `http://127.0.0.1:<port>` im Standardbrowser.
- Der Server kennt das Modell nicht. Serialisierung und Schemaprüfung laufen im Browser (`src/io/`). Alternative: Server parst YAML. Verworfen, weil die Schreibregeln dann an zwei Stellen gepflegt werden müssten.
- **Pfadprüfung** für jeden Pfad: URL-dekodieren; ablehnen (400) bei absolutem Pfad, Laufwerksbuchstabe, Backslash, leerem Segment oder `..`. Danach wird der `realpath` des nächsten existierenden Vorfahren des Pfads (bei existierender Datei der Datei selbst) bestimmt; liegt er außerhalb des Projektordners, wird abgelehnt (403). So werden auch Symlinks nach außen in noch nicht existierenden Unterordnern erkannt.

| Endpunkt | Anfrage | Antwort |
|---|---|---|
| `GET /api/project` | – | 200 `{"status":"ok","folder":"<ordnername>","files":{"<pfad>":"<inhalt>"}}` mit allen `*.yaml` (rekursiv, ohne `.git/`); 200 `{"status":"empty","folder":…}` wenn keine `*.yaml`; 200 `{"status":"missing","folder":…}` wenn der Ordner fehlt. `folder` ist der Name des Projektordners (Vorschlag für den Projektnamen) |
| `PUT /api/files` | `{"files":{"<pfad>":"<inhalt>" \| null}}`, `null` = löschen | 200 `{"results":{"<pfad>":"ok" \| {"error":"<meldung>"}}}`; `null` auf eine nicht vorhandene Datei ergibt `"ok"`; 400 bzw. 403, wenn ein Pfad ungültig ist oder außerhalb liegt (dann wird nichts aus dem Stapel geschrieben); legt fehlende Ordner an |
| `GET /api/raw/<pfad>` | – | 200 Rohbytes mit Content-Type nach Endung; 404 |
| `PUT /api/raw/plaene/<name>` | Rohbytes | Liegt in `plaene/` eine Datei mit gleichem SHA-256: 200 `{"path":"plaene/<vorhandene>"}`, nichts wird geschrieben. Sonst Schreiben unter `plaene/<name>`, bei Namenskollision `-2`, `-3` … vor der Endung: 201 `{"path":"plaene/<neu>"}`. Nur direkt unter `plaene/` erlaubt, sonst 400 |
| `GET /api/events` | Server-Sent Events | Ereignis `changed` mit `{"paths":["<pfad>",…]}` für neue, geänderte und gelöschte `*.yaml`, 300 ms entprellt; Dateien unter `plaene/` werden nicht gemeldet |

Es gibt keinen Endpunkt zum Auflisten von Dateien. Fehlerantworten haben den Body `{"error":{"code":"<code>","message":"<text>"}}` mit 400 (ungültiger Pfad), 403 (außerhalb des Projektordners), 404, 500. Jede Datei wird über eine temporäre Datei im selben Ordner und `rename` geschrieben, also je Datei atomar. Schlägt eine Datei fehl, meldet die Antwort das für diese Datei; der Client zeigt den Speicherstand „Fehler“.

### Eigene Schreibvorgänge von externen Änderungen unterscheiden
Der Server merkt sich je Datei den SHA-256 des zuletzt selbst geschriebenen Inhalts. Meldet chokidar eine Änderung mit genau diesem Hash, wird sie nicht als extern gemeldet.

### Neues Projekt
„Leer“ heißt: keine `*.yaml` im Projektordner (`.git/`, README und andere Dateien zählen nicht). Der Client behandelt den Ordner außerdem als leer, wenn `projekt.yaml` fehlt und keine Geschossdatei vorhanden ist, auch wenn andere `*.yaml` (z. B. `katalog.yaml`) dort liegen. Das Anlegen lässt diese Dateien unberührt. Fehlt der Ordner, wird er erst angelegt, wenn der Benutzer im Browser zustimmt (über `PUT /api/files`). Nach der Zustimmung werden `projekt.yaml` und `geschosse/eg.yaml` sofort geschrieben. Standardwerte: Projektname = Ordnername, `northDeg` 0, erstes Geschoss „EG“ mit Höhenlage 0, Rohbauhöhe 2500 mm, Fußbodenaufbau 120 mm, Putz 15 mm, Abhängung 0 mm.

**Weiteres Geschoss:** übernimmt `rawHeightMm` und `defaults` des höchsten Geschosses (größte Höhenlage); Höhenlage = dessen `elevationMm` + `rawHeightMm` + 300 mm (Rohdecke). Alle Werte sind danach editierbar. Geschosse mit gleicher Höhenlage werden nach Name sortiert.

### Dateiformat M1
M1 schreibt nur `projekt.yaml` und `geschosse/<slug>.yaml`. Für jede Datei, die fehlt, gilt: fehlt = leer bzw. Standardwerte. Die Geschossreihenfolge ergibt sich aus `elevationMm`; `projekt.yaml` führt keine Geschossliste, damit neue Geschosse keine Konflikte in einer gemeinsamen Datei erzeugen. `storeyId` wird in Geschossdateien nicht geschrieben, sondern beim Laden gesetzt. Andere `*.yaml`-Dateien (z. B. `katalog.yaml` eines späteren Meilensteins) werden ignoriert und nie geschrieben oder gelöscht.

| Objekt | Felder in Schreibreihenfolge (`?` = nur wenn gesetzt) | Listen sortiert nach | Flow-Stil |
|---|---|---|---|
| Datei `projekt.yaml` | `schemaVersion`, `name`, `settings` | – | – |
| `settings` | `northDeg` | – | – |
| Geschossdatei | `storey`, `walls`, `rooms`, `openings` | je Liste nach `id` | – |
| `storey` | `id`, `name`, `slug`, `elevationMm`, `rawHeightMm`, `defaults`, `underlay?` | – | `defaults` |
| `defaults` | `floorBuildupMm`, `plasterMm`, `suspendedMm` | – | ja |
| `underlay` | `file`, `page`, `calibration?`, `offset`, `rotationDeg`, `opacity`, `visible` | – | `calibration`, `offset` |
| `calibration` | `p1`, `p2`, `distanceMm` | – | ja |
| Punkt (`start`, `end`, `seed`, `offset`, `p1`, `p2`, Polygonpunkt) | `x`, `y` | – | ja |
| `wall` | `id`, `kind`, `start`, `end`, `thicknessMm`, `rawHeightMm?`, `outsideSide?` | – | `start`, `end` |
| `room` | `id`, `name`, `floorBuildupMm?`, `plasterMm?`, `suspendedMm?`, `seed`, `polygon`, `slopes?` | `slopes` nach `id` | `seed`, jeder Punkt in `polygon` |
| `slope` | `id`, `baseLine`, `heightAtBaseMm`, `angleDeg` | – | `baseLine` |
| `opening` | `id`, `wallId`, `kind`, `offsetMm`, `widthMm`, `heightMm`, `sillMm`, `shutterBox?` | – | `shutterBox` |
| `shutterBox` | `position`, `heightMm` | – | ja |

Weitere Regeln:
- IDs 8 Zeichen aus `[0-9a-z]` (nanoid, eigenes Alphabet), projektweit eindeutig.
- `polygon` als Blockliste mit einem Punkt je Zeile; alle anderen Listen als Blocklisten, Sequenzen um 2 eingerückt (`- ` unter dem Schlüssel eingerückt).
- Längen und Koordinaten ganze mm, Winkel 0,1°, PDF-Koordinaten 0,1 Punkt, `opacity` zwei Nachkommastellen.
- Zahlen: Ganzzahlen ohne `.0`, sonst kürzeste Dezimaldarstellung (`102.4`, nicht `102.40`); `-0` wird als `0` geschrieben.
- Texte in doppelten Anführungszeichen, Zahlen und Booleans ohne.
- Leere optionale Felder und leere Listen werden weggelassen.
- `schemaVersion` ist 1.
- Optionen des `yaml`-Pakets: `lineWidth: 0` (kein Umbruch), `flowCollectionPadding: false` (`{x: 0, y: 0}`), `indent: 2`, `indentSeq: true`; LF, UTF-8, abschließender Zeilenumbruch.

**Werte werden beim Setzen gerundet**, nicht erst beim Schreiben: Jeder Befehl rundet seine Ergebnisse, auch berechnete Polygone, auf die Speichergenauigkeit. Damit ist der Zustand nach Speichern und Neuladen identisch.

**Verbindliches Beispiel** `projekt.yaml`:

```yaml
schemaVersion: 1
name: "Beispielhaus"
settings:
  northDeg: 0
```

**Verbindliches Beispiel** `geschosse/dg.yaml` (vier Außenwände 300 mm, ein Raum mit Schräge an der Südwand, ein Fenster mit Aufsatzkasten in der Nordwand). Der Golden-File-Test nutzt genau diese Datei:

```yaml
storey:
  id: "k3f9a2qd"
  name: "DG"
  slug: "dg"
  elevationMm: 5600
  rawHeightMm: 2450
  defaults: {floorBuildupMm: 100, plasterMm: 15, suspendedMm: 0}
  underlay:
    file: "plaene/dg.pdf"
    page: 1
    calibration: {p1: {x: 102.4, y: 88.1}, p2: {x: 512, y: 88.1}, distanceMm: 4260}
    offset: {x: 0, y: 0}
    rotationDeg: 0
    opacity: 0.5
    visible: true
walls:
  - id: "1c8e0v5r"
    kind: "exterior"
    start: {x: 0, y: 0}
    end: {x: 4000, y: 0}
    thicknessMm: 300
  - id: "4kq9m2xa"
    kind: "exterior"
    start: {x: 4000, y: 0}
    end: {x: 4000, y: 3000}
    thicknessMm: 300
  - id: "a81kd0x2"
    kind: "exterior"
    start: {x: 4000, y: 3000}
    end: {x: 0, y: 3000}
    thicknessMm: 300
  - id: "t2p7w3nb"
    kind: "exterior"
    start: {x: 0, y: 3000}
    end: {x: 0, y: 0}
    thicknessMm: 300
rooms:
  - id: "m3x8c2pd"
    name: "Schlafen"
    plasterMm: 10
    seed: {x: 2000, y: 1500}
    polygon:
      - {x: 150, y: 150}
      - {x: 3850, y: 150}
      - {x: 3850, y: 2850}
      - {x: 150, y: 2850}
    slopes:
      - id: "s7m2k4qa"
        baseLine: [{x: 150, y: 150}, {x: 3850, y: 150}]
        heightAtBaseMm: 1000
        angleDeg: 45
openings:
  - id: "w5n1b8tz"
    wallId: "a81kd0x2"
    kind: "window"
    offsetMm: 1495
    widthMm: 1010
    heightMm: 1385
    sillMm: 800
    shutterBox: {position: "top", heightMm: 250}
```

### Dateiname der Geschossdatei
Der Slug wird beim Anlegen des Geschosses einmal gebildet und gespeichert: Kleinbuchstaben, ä→ae, ö→oe, ü→ue, ß→ss, jedes andere Zeichen außerhalb `[a-z0-9]` → `-`, mehrere `-` zusammengefasst, Rand-`-` entfernt, leer → `geschoss`; bei Kollision `-2`, `-3` … Beim Umbenennen bleibt der Slug gleich, damit Git keine Lösch- und Neu-Paare sieht.

### Ladefehler
Folgende Fehler zeigen eine Fehlerseite mit Datei, Zeile und Ursache; das Projekt wird nicht geöffnet und nichts geschrieben:
- YAML-Syntaxfehler
- Konfliktmarker (`<<<<<<<`, `=======`, `>>>>>>>` am Zeilenanfang)
- Schemaverstöße, darunter unbekannte Felder und eine fehlende `schemaVersion`
- `schemaVersion` größer als die der App: „Projekt wurde mit neuerer App-Version erstellt“
- `storey.slug` weicht vom Dateinamen der Geschossdatei ab
- doppelte IDs (projektweit über alle Dateien) oder doppelte Slugs
- Geschossdateien vorhanden, aber `projekt.yaml` fehlt

Ändern sich danach Dateien, lädt die App automatisch erneut. Verweise ins Leere (in M1: Öffnung mit unbekannter `wallId`) öffnen das Projekt; die Öffnung wird nicht dargestellt und erscheint als Warnung mit Aktion „Löschen“.

### Speichern
Der Client merkt sich je Datei den zuletzt gelesenen oder geschriebenen Inhalt. Beim Speichern wird das Projekt vollständig serialisiert; eine Datei wird geschrieben, wenn ihre Serialisierung von diesem Inhalt abweicht. Die Datei eines gelöschten Geschosses wird mit `null` gelöscht.
- **Autospeichern** 2 s nach dem letzten Befehl. Nur Befehle lösen es aus, nicht Laden, Neuladen oder Migration.
- **Cmd/Strg+S** schreibt sofort alle abweichenden Dateien, auch wenn die Abweichung nur aus einer Migration stammt.
- **Nicht kanonische Dateien** (z. B. von Hand mit anderer Einrückung oder Reihenfolge bearbeitet) werden beim nächsten Speichern kanonisch umgeschrieben.
- **Fehler:** Der Speicherstand zeigt „Fehler“; der Client versucht es beim nächsten Befehl und alle 10 s erneut, bis das Speichern gelingt.

### Externe Änderungen
Sobald der Server externe Änderungen meldet (auch neue oder gelöschte Dateien), pausiert das Autospeichern und ein Hinweis erscheint mit „Neu laden“ und „Später“. „Neu laden“ verwirft ungespeicherte Änderungen nach Rückfrage, lädt das Projekt neu und leert die Undo-Historie. „Später“ lässt den Hinweis stehen; das Autospeichern bleibt pausiert. Cmd/Strg+S fragt dann „Externe Änderungen überschreiben?“ und schreibt nach Bestätigung alle abweichenden Dateien; danach verschwindet der Hinweis und das Autospeichern läuft wieder. Dateien unter `plaene/` lösen keinen Hinweis aus.

### Schema mit zod
Das Modell wird mit zod beschrieben; daraus folgen TypeScript-Typen und die Prüfung beim Laden. Alle Objektschemata sind `.strict()`, unbekannte Felder sind also Schemaverstöße. Zeilennummern liefert das `yaml`-Paket über die Positionen im Dokumentbaum. Migrationen sind Funktionen `vN → vN+1`. Als Test der Migrationskette dient eine Dummy-Migration „Version 0 → 1“, die nur im Test registriert wird; echte Dateien ohne `schemaVersion` sind ein Ladefehler. Nach einer Migration zeigt die App den Hinweis „Projekt auf Version N aktualisiert, wird beim nächsten Speichern geschrieben“.

### Serialisierung über explizite Feldlisten
Die Tabelle oben ist im Code genau einmal hinterlegt (Feldliste, Sortierschlüssel, Flow-Markierung je Typ). Golden-File-Tests sichern: Laden → Speichern ergibt byteweise denselben Inhalt (mit dem verbindlichen Beispiel), und eine Änderung eines Werts ändert genau eine Zeile.

### Store mit Befehlen und Patches
Alle Änderungen laufen über benannte Befehle, die mit `immer` Patches und Gegenpatches erzeugen, auch Änderungen am Planhintergrund. Jeder Befehl hat ein deutsches Label für das Undo-Menü (z. B. „Wand verschieben“). Ein Ziehvorgang ist ein Befehl, abgeschlossen beim Loslassen. Kürzel: Cmd/Strg+Z, Cmd/Strg+Shift+Z. Historie 200 Schritte. Alternative: Snapshots. Verworfen wegen Speicherbedarf.

Abhängige Änderungen gehören zum selben Befehl und damit zum selben Patch: Die Neuberechnung der Raumkonturen läuft im Befehl der Wandänderung. Löschen ist für alle Objekte ein Befehl:
- Wand: mit ihren Öffnungen
- Geschoss: mit allen Wänden, Räumen und Öffnungen; die Geschossdatei wird beim Speichern gelöscht und nach Rückgängig wieder geschrieben
- Raum: mit seinen Schrägen; die Wände bleiben
- Öffnung, Schräge: nur das Objekt

### Wände
Die Achse ist die Mittellinie. Zeichenmodi: Achse, linke Kante, rechte Kante (bezogen auf die Zeichenrichtung); bei Kantenmodus wird die geklickte Linie um die halbe Dicke zur Achse versetzt. Eine neue Wand ist eine Innenwand mit der zuletzt verwendeten Dicke (beim Start 240 mm). Beim Zeichnen wird auf die orthogonale Richtung gefangen, wenn sie höchstens 5° abweicht.

Anschlüsse werden vor jeder Änderung aus der Geometrie bestimmt, nicht gespeichert: Eckanschluss = Endpunkte ≤ 20 mm auseinander, T-Anschluss = Endpunkt ≤ 20 mm von einer fremden Achse. **Kollinear** sind zwei Wände mit gemeinsamem Endpunkt (Eckanschluss), die höchstens 0,5° voneinander abweichen und deren Achsen höchstens 20 mm voneinander entfernt liegen; die Beziehung ist transitiv (eine Kette kollinearer Wände).
- **Endpunkt verschieben** (auch Längenänderung, die den Endpunkt `end` bewegt): Wände mit Eckanschluss an diesem Endpunkt erhalten denselben neuen Endpunkt, ihr anderes Ende bleibt. Wände mit T-Anschluss an die bewegte Wand behalten ihre Richtung; ihr angeschlossener Endpunkt wird auf den Schnitt ihrer Achse mit der neuen Achse gesetzt. Liegt dieser Schnitt außerhalb der neuen Achse (Toleranz ± 20 mm), wird der Anschluss gelöst, die angeschlossene Wand bleibt unverändert und eine Meldung „T-Anschluss gelöst“ wird angezeigt (keine gespeicherte Warnung). Ein T-Anschluss des bewegten Endpunkts selbst an eine fremde Achse darf sich lösen.
- **Parallel verschieben** um einen Betrag senkrecht zur Achse (positiv nach links bezogen auf `start → end`): Kollineare Nachbarn werden mitverschoben. Wände mit Eck- oder T-Anschluss an die verschobenen Wände behalten ihre Richtung; ihr angeschlossener Endpunkt wird auf den Schnitt ihrer Achse mit der neuen Achse gesetzt. Liegt dieser Schnitt außerhalb der neuen Achse (Toleranz ± 20 mm), wird der Anschluss wie beim Endpunktverschieben gelöst: Die angeschlossene Wand bleibt unverändert, und die Meldung „T-Anschluss gelöst“ erscheint.
- Die Eigenschaften zeigen Länge, Dicke, Anfangs- und Endpunkt (editierbar) und „parallel verschieben um … mm“.

Wandkörper mit Gehrungen an Eckanschlüssen berechnet `geometry/`.

### Räume
- **Erkennung:** Vereinigung aller Wandkörper des Geschosses, morphologisch geschlossen (Puffer +10 mm, dann −10 mm), schließt Lücken bis 20 mm. Die freie Region, die den Saatpunkt enthält, ist der Raum; ihre Außenkontur ist das Polygon. Erreicht die Region den Rand einer um 10 m vergrößerten Hülle aller Wände, ist sie offen; markiert werden dann die Wandendpunkte ohne Anschluss, deren Wandkörper an die offene Region grenzt. Die Markierung verschwindet beim nächsten Klick oder Befehl.
- **Kanonisches Polygon:** Polygonoperationen mit Clipper (npm `clipper-lib`), Puffer mit Miter-Join. Das Ergebnis wird auf ganze mm gerundet; doppelte Punkte und kollineare Punkte (Richtungsänderung ≤ 0,5°) werden entfernt. Umlauf gegen den Uhrzeigersinn (y nach oben), Startpunkt ist der Punkt mit kleinstem y, bei Gleichstand kleinstem x. So ändert eine Wandänderung nur die Polygone der Räume, deren Kontur sich tatsächlich ändert.
- **Klick in einen bestehenden Raum** wählt diesen Raum aus, statt einen neuen anzulegen.
- **Neuberechnung** nach jeder Wandänderung vom gespeicherten Saatpunkt aus, im selben Befehl. Ist die Region offen oder liegt der Saatpunkt in einem Wandkörper, bleibt das gespeicherte Polygon und die Warnung `room-open` entsteht. Enthält eine geschlossene Region den Saatpunkt eines anderen Raums (z. B. nach Löschen der Trennwand), behalten beide Räume ihr gespeichertes Polygon und erhalten je die Warnung `room-merged`. Ist die Region offen, hat `room-open` Vorrang: Es entsteht nur `room-open`, auch wenn die Region fremde Saatpunkte enthält. Mit „Raum neu erkennen“ setzt der Benutzer einen neuen Saatpunkt; der Raum behält ID, Name und Werte und erhält die Kontur der neuen Region.
- **Teilung:** Teilt eine neue Wand einen Raum, behält der Raum den Teil mit seinem Saatpunkt; der andere Teil hat keinen Raum, bis er angeklickt wird.
- **Fläche** eines Raums ist die fertige Fläche: das Rohbaupolygon um die Putzstärke des Raums nach innen versetzt.
- Die Status „offen“ und „verschmolzen“ werden berechnet, nie gespeichert.
- **Frei stehende Wände** (Mittelpunkt der Achse im Raumpolygon, ohne Anschluss an die Kontur) gehören zu diesem Raum; beide Seiten sind Ansichten dieses Raums.

### Öffnungen
Öffnungen werden auch dann angenommen, wenn sie ungültig sind: über das Wandende hinaus (`offsetMm` < 0 oder `offsetMm` + `widthMm` > Wandlänge), mit einer anderen Öffnung derselben Wand überlappend oder höher als die Wand (`sillMm` + `heightMm` > Wandhöhe). Sie erzeugen die Warnung `opening-invalid` mit einem der Gründe „über Wandende“, „überlappt <andere Öffnung>“ oder „höher als die Wand“ (bei mehreren Gründen eine Warnung je Öffnung mit dem ersten Grund in dieser Reihenfolge). In Grundriss, Wandansichten und 3D wird eine ungültige Öffnung an der Wandkontur abgeschnitten und rot umrandet; in 3D wird nur der Teil innerhalb des Wandkörpers ausgeschnitten.

### Warnungen
Warnungen werden berechnet, nie gespeichert. Schlüssel, Text und Klickziel in M1:

| Schlüssel | Text | Klick in der Warnungsleiste |
|---|---|---|
| `room-open:<roomId>` | „Raum nicht geschlossen: <Raum>“ | wählt den Raum im Grundriss, markiert offene Endpunkte |
| `room-merged:<roomId>` | „Raum mit <Name des anderen Raums> verschmolzen“ | wählt den Raum im Grundriss |
| `slope-invalid:<slopeId>` | „Schräge ungültig: <Raum>“ | wählt den Raum im Grundriss |
| `opening-without-wall:<openingId>` | „Öffnung ohne Wand (<wallId>)“ | nur Eintrag in der Liste mit Aktion „Löschen“ |
| `opening-invalid:<openingId>` | „Öffnung ungültig: <Grund>“ (Gründe siehe „Öffnungen“) | wählt die Öffnung und öffnet die Wandansicht des Raums an Seite L, in dessen Abschnitt die Mitte der Öffnung liegt; grenzt dort kein Raum, die ganze Wandseite L |

### Angrenzung, Außenseite und Benennung
- Eine Wandseite **grenzt an einen Raum**, wenn ein Segment des Raumpolygons höchstens 0,5° von der Wandrichtung abweicht, höchstens 20 mm von der Seitenfläche (Achse ± Dicke/2) entfernt liegt und sich entlang der Wand mindestens 1 mm mit ihr überlappt; der überlappende Bereich ist der u-Abschnitt dieses Raums.
- **Außenseite** einer Außenwand ist die Seite ohne angrenzenden Raum. Grenzen beide oder keine Seite an einen Raum, gilt `outsideSide` (Standard `L`, in den Eigenschaften umschaltbar).
- **Flächen ohne Raum** sind alle Wandseiten ohne angrenzenden Raum, darunter alle Außenseiten.
- **Himmelsrichtung** in 8 Sektoren (Nord, Nordost, Ost, …) zu je 45°, halboffen: Nord = [−22,5°, 22,5°), Nordost = [22,5°, 67,5°) usw., Winkel im Uhrzeigersinn ab der Nordrichtung `settings.northDeg` (Winkel der Nordrichtung im Grundriss, 0 = +y, im Uhrzeigersinn).
- **Benennung** einer Wandansicht im Raum: Richtung der Normalen vom Raum zur Wand (Blickrichtung des Betrachters im Raum), Name „Wand <Richtung>“. Frei stehende Wände: beide Seiten mit der Normalen in Blickrichtung auf die jeweilige Seite.
- **Benennung ohne Raum:** Richtung der Normalen von der Wandseite weg. Außenseiten von Außenwänden heißen „<Richtung> außen“, alle anderen Wandseiten ohne Raum „Wandseite <Richtung>“.
- **Nummerierung:** Haben mehrere Ansichten desselben Raums dieselbe Richtung, heißen sie „Wand Nord 1“, „Wand Nord 2“ …, nummeriert nach dem Winkel ihres Mittelpunkts um den Raumschwerpunkt, im Uhrzeigersinn ab 0° (Nord). Unter „Flächen ohne Raum“ gilt dieselbe Nummerierung je Name, gezählt nach Wand-ID.
- **Baumreihenfolge** der Wandansichten eines Raums: nach Himmelsrichtung im Uhrzeigersinn ab Nord, bei gleicher Richtung nach der Nummer. Danach folgen Decke, Boden und Schrägen. „Flächen ohne Raum“ sind nach Richtung im Uhrzeigersinn ab Nord, dann nach Wand-ID sortiert.

### Flächen und Ansichten
`deriveSurfaces(project)` liefert alle Flächen mit SurfaceRef, Kontur in (u, v), Öffnungen und Transformation (u, v) → Welt. Eine Wandseite (`wall:<id>:L|R`) umfasst die ganze Wandlänge, damit Geräte und Trassen ab M2 nicht von der Raumerkennung abhängen. `deriveRoomViews(project)` liefert je Raum die Ausschnitte der angrenzenden Wandseiten mit Name, Nachbarn links und rechts und Rand in fertigen Maßen. Ansichten frei stehender Wände haben keine Nachbarn.

**Flächenkoordinaten:**
- **Wandseite:** u = 0 ist die Projektion des Achsendpunkts, der für einen Betrachter vor dieser Seite links liegt, auf die Seitenfläche; u läuft entlang der Achse, die Länge ist die Achslänge. Die Kontur der Fläche wird an Gehrungen auf den tatsächlichen Wandkörper beschnitten.
- **Schräge:** u = 0 am linken Ende der Grundlinie aus Sicht vom Raum auf die Schräge, u entlang der Grundlinie; v = 0 auf der Grundlinie (d = 0), v entlang der Schräge aufwärts in wahrer Länge.
- **Decke:** (u, v) = (−x, y) (Deckenspiegel, Sicht von unten).
- **Boden:** (u, v) = (x, y).

**v-Bezug:** v zählt ab OKFF des Raums, in dessen u-Abschnitt der Punkt liegt, ohne Raum ab Oberkante Rohfußboden. Auf einer Wandseite, die an zwei Räume mit unterschiedlichem Fußbodenaufbau grenzt, ist v daher abschnittsweise bezogen. Das ist gewollt: Geräte (ab M2) sollen bei geändertem Estrich ihre Höhe über OKFF behalten, und an der Raumgrenze steht eine Trennwand, über die keine Trasse ohne Durchbruch läuft. Ändert sich die Raumzuordnung eines Abschnitts, bleibt v gespeichert und bezieht sich fortan auf den neuen Raum.

**Fertige Maße einer Öffnung** in der Ansicht: Breite − 2 · Putz, Brüstung über OKFF = `sillMm` − Fußbodenaufbau (mindestens 0), Sturz über OKFF = `sillMm` + `heightMm` − Fußbodenaufbau − Putz.

### Schrägen und Deckenhöhe
Für einen Punkt p im Grundriss: d(p) = Abstand zur Geraden der Grundlinie, positiv auf der Seite, auf der der Schwerpunkt des Raumpolygons liegt (liegt er auf der Geraden, ist die Schräge ungültig und erzeugt die Warnung `slope-invalid`). h_s(p) = `heightAtBaseMm` + d(p) · tan(`angleDeg`), auch für d < 0. Rohdecke H(p) = min(Rohbauhöhe − `suspendedMm`, alle h_s(p)). Fertige Decke = H(p) − Putz. `suspendedMm` gilt aus dem Raum, sonst aus `storey.defaults`. In der Regel liegt die Grundlinie auf der rohen Innenseite der Traufwand.

In 3D ist die Oberkante eines Wandkörpers an jeder Stelle das Minimum aus Wandhöhe und den Ebenen aller Schrägen der an die Wand angrenzenden Räume, über die ganze Wanddicke fortgesetzt. Schrägen haben eine stabile `id`; ihre SurfaceRef ist `slope:<roomId>:<slopeId>`.

### PDF-Hintergrund
pdf.js rendert die gewählte Seite (`page` ab 1) in ein Canvas mit Auflösung passend zum Zoom. PDF-Koordinaten sind Punkte im Viewport `page.getViewport({scale: 1})`, also einschließlich der Seitenrotation der PDF, mit Ursprung oben links und y nach unten. Transformation in Weltkoordinaten (mm, y nach oben):

`welt = offset + R(rotationDeg) · s · F · (pdf − p1)` mit `s = distanceMm / |p2 − p1|`, `F = diag(1, −1)` und R als Drehung gegen den Uhrzeigersinn (positive `rotationDeg` drehen gegen den Uhrzeigersinn).

- Unkalibriert (nach dem Wählen einer PDF fehlt `calibration`): Anzeige im Maßstab 1:100 mit p1 = (0, 0) und s = 25,4 / 72 · 100 mm je Punkt, `offset` und `rotationDeg` wie gespeichert. Eine neu gewählte PDF setzt `page = 1`, `offset = (0, 0)`, `rotationDeg = 0`, `opacity = 0.5`, `visible = true` und entfernt eine vorhandene Kalibrierung.
- Erste Kalibrierung eines Geschosses (bisher keine `calibration`): `offset = (0, 0)`, `rotationDeg = 0`; p1 wird damit Weltursprung.
- Verschieben ändert `offset`.
- Drehen um einen gewählten Punkt q um Δ (numerisch eingegeben, 0,1°): `rotationDeg += Δ`, `offset = q + R(Δ) · (offset − q)`.
- Neu kalibrieren: Die Weltposition des neuen p1 unter der alten Transformation wird zum neuen `offset`; `rotationDeg` bleibt.

Eine gewählte PDF wird immer über `PUT /api/raw/plaene/<dateiname>` hochgeladen, auch wenn sie schon im Projektordner liegt (der Browser kennt den Pfad nicht). Der Server erkennt gleiche Inhalte über SHA-256 und liefert dann den vorhandenen Pfad, sonst den neuen Pfad mit Kollisionssuffix; gespeichert wird der gelieferte relative Pfad. Undo entfernt eine hochgeladene Datei nicht.

### Oberfläche
- Auswählbar in M1: Geschoss (im Baum), Wand, Raum, Öffnung, Schräge. Ein Klick auf Decke oder Boden in 3D wählt den Raum.
- Warnungsleiste am unteren Rand: Anzahl der Warnungen, aufklappbare Liste, Klick nach der Tabelle „Warnungen“.
- **Projekteinstellungen:** Projektname und Nordrichtung (`northDeg`), undo-fähig; eine Änderung der Nordrichtung benennt die Wandansichten neu.
- **Grundriss:** Raster mit Linien alle 1 m und feiner alle 100 mm, nur zur Orientierung, kein Rasterfang.
- **Zahlenformat:** Eingaben in mm; Dezimaleingaben werden auf ganze mm gerundet, eine Eingabe mit „m“ (z. B. „4,26 m“) wird in mm umgerechnet. Winkel mit Komma oder Punkt als Dezimaltrenner, gerundet auf 0,1°. Anzeige mm ohne Tausendertrenner; m und m² mit zwei Nachkommastellen und Dezimalkomma; Winkel mit einer Nachkommastelle.
- Doppelklick im Grundriss neben einer Wandseite außerhalb aller Räume öffnet die ganze Wandseite.

### 3D aus denselben Daten
Die 3D-Ansicht extrudiert Wandkörper, kappt sie wie oben beschrieben und schneidet Öffnungen aus; Decken, Böden und Schrägen werden aus Polygonen und Deckenhöhenfunktion trianguliert. Geschosse werden nach `elevationMm` gestapelt. Keine eigene 3D-Datenhaltung.

### Tests und Fixtures
Testdaten liegen unter `tests/fixtures/`: zwei Projektordner (klein: ein Geschoss mit vier Räumen; DG mit Kniestock und Giebel) und zwei eingecheckte PDFs:
- **Vektorplan:** A3, zwei Seiten, Maßstab 1:100, mit einer bemaßten Referenzstrecke von 4260 mm
- **Scan:** Rasterbild von Seite 1 des Vektorplans, 150 dpi, um 1,5° gedreht

Herkunft und Erzeugung beider PDFs beschreibt `tests/fixtures/README.md`. CI läuft auf ubuntu, macos und windows mit Node 22; Playwright mit Chromium auf allen drei, Firefox und WebKit auf ubuntu.

## Risks / Trade-offs

- [Raumerkennung scheitert an kleinen Lücken im Altbau-Grundriss] → morphologisches Schließen bis 20 mm, offene Endpunkte werden markiert
- [Schräge Wände und Schrägen erzeugen komplizierte Wandkonturen] → Geometrie in `geometry/` mit Unit-Tests für Kniestock, Giebel und schräge Wand
- [Sortierung nach ID ist für Menschen zufällig] → Namen stehen direkt nach der ID; die Reihenfolge ist stabil, und das zählt für den Diff
- [Endpunkt verschieben dreht angeschlossene Wände] → gewollt wie in üblichen CAD-Werkzeugen; für rechtwinklige Änderungen dient „parallel verschieben“
- [Rundungen der Polygonbibliothek verschieben Punkte um 1 mm] → kanonische Form (Rundung, Bereinigung, Startpunkt) und Test, dass unbeteiligte Räume unverändert bleiben
- [Bun-Abweichungen im Server] → nur Node 22 in CI; Bun ist Best Effort

## Open Questions

- Ob Gauben einen eigenen Bauteiltyp brauchen, zeigt sich beim Nachzeichnen des DG. Die Annäherung über Wände und Schrägen ändert die Specs nicht.
- Nach M2 verschoben: Bekommt eine Wandseite ohne Raum später einen Raum, wechselt der v-Bezug von Rohfußboden auf OKFF, und schon platzierte Geräte springen um den Fußbodenaufbau. Wird beim Vervollständigen von `m2-geraete-und-moebel/design.md` als offener Punkt übernommen.
