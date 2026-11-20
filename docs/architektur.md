# Architektur und Datenmodell

Gemeinsame Grundlage für alle Changes. Specs unter `openspec/` beschreiben das Verhalten, dieses Dokument das Modell, auf dem es aufsetzt. Jede KI-Sitzung liest es, bevor sie Code schreibt.

## Zweck

Hausplaner ist eine lokale Web-App für die Planung der Haustechnik einer Kernsanierung: Elektro, KNX, Daten, Leerrohre, Kältemittel und Kondensat. Möbel dienen zur Kontrolle der Gerätepositionen. Die Pläne sind Grundlage für die Abstimmung mit dem Elektriker und werden nach dem Verlegen zum Bestandsplan.

Nicht Ziel: fotorealistisches Rendering, Lichtberechnung (Lux), normative Berechnungen (Spannungsfall, Selektivität), KNX-Gruppenadressen, TAB-Prüfung.

## Technik

| Thema | Wahl |
|---|---|
| Sprache, Build | TypeScript (strict), React, Vite |
| 2D-Editoren | SVG |
| Polygonoperationen | `clipper-lib` (Vereinigung, Puffer mit Miter-Join, Raumerkennung) |
| 3D | three.js über react-three-fiber |
| PDF-Hintergrund | pdf.js |
| PDF-Export | jsPDF mit svg2pdf.js |
| Zustand | ein zentraler Store (z. B. Zustand) mit Undo/Redo über Snapshots oder Patches (immer) |
| Laufzeit | Node 22 LTS; Bun soll funktionieren, wird aber nicht eigens getestet |
| Lokaler Server | kleiner Node-Server (z. B. Hono oder Fastify), liefert die App aus und liest/schreibt den Projektordner; Dateibeobachtung mit chokidar |
| Dateiformat | YAML 1.2 über das Paket `yaml`, deterministisch geschrieben |
| Tests | Vitest für Modell, Geometrie und Serialisierung, Playwright für einzelne End-to-End-Abläufe |
| Plattformen | macOS, Windows, Linux; aktuelle Versionen von Chrome, Edge, Firefox, Safari |

Start: `git clone`, `npm install`, `npm start -- <pfad-zum-projektordner>`. Der Server lauscht nur auf `127.0.0.1` und öffnet den Browser. Kein Login, keine Cloud.

## Grundprinzipien

1. **Ein Modell, viele Sichten.** Grundriss, Wandansicht, Deckenspiegel, Bodenansicht, 3D und Listen sind Sichten auf dasselbe Projektmodell. Keine Sicht hält eigene Geometrie.
2. **Abgeleitetes wird nicht gespeichert.** Flächen, Leitungslängen, Warnungen, TE-Belegung und Aktorbedarf werden berechnet.
3. **Katalog statt Code.** Gerätetypen, Leitungstypen und Möbeltypen stehen im Katalog der Projektdatei. Ein neuer Gerätetyp braucht keine Code-Änderung.
4. **Warnen, nicht sperren.** Regelverstöße (Installationszone, Kollision, Reserve, Gefälle, Länge) erzeugen Warnungen; der Benutzer darf sie bewusst übergehen.
5. **Bezeichner Englisch, Oberfläche Deutsch.**

## Einheiten und Koordinaten

- Alle Längen in Millimetern als Ganzzahl oder Dezimalzahl, Winkel in Grad.
- **Grundriss:** x nach rechts, y nach oben (Planansicht von oben). Weltursprung ist p1 der ersten Kalibrierung eines Geschosses; die Pläne weiterer Geschosse werden daran ausgerichtet.
- **Höhe z:** je Geschoss relativ zur Oberkante Rohfußboden des Geschosses; global über `storey.elevationMm`.
- **Flächenkoordinaten (u, v):** jede Fläche hat ein eigenes 2D-System.
  - Wandseite: eine Fläche je Wand und Seite über die ganze Wandlänge, unabhängig von Räumen. u = 0 ist die Projektion des Achsendpunkts, der für einen Betrachter vor dieser Seite links liegt; u läuft entlang der Achse, die Länge ist die Achslänge, die Kontur ist an Gehrungen auf den Wandkörper beschnitten. v nach oben ab OKFF des Raums, in dessen Abschnitt der Punkt liegt (ohne Raum, z. B. Außenseite: ab Oberkante Rohfußboden). Die Ansichten je Raum sind Ausschnitte dieser Fläche.
  - Decke: Sicht von unten (Deckenspiegel), (u, v) = (−x, y).
  - Boden: Sicht von oben, (u, v) = (x, y).
  - Dachschräge: u = 0 am linken Ende der Grundlinie aus Sicht vom Raum auf die Schräge, u entlang der Grundlinie; v = 0 auf der Grundlinie, v die Schräge hinauf in wahrer Länge.
- **Roh oder fertig:** Gebäudeteile (Wände, Öffnungen, Schrägen, Raumkonturen) werden in Rohbaumaßen gespeichert. Geräte und Trassen (ab M2) beziehen sich auf die fertige Oberfläche (OKFF, Putzoberfläche). Ansichten zeigen Höhen über OKFF und fertige Laibungen; Rohbaumaße sind abrufbar.

## Projektordner und Austausch über Git

Die Planungsdaten liegen in einem eigenen, privaten Git-Repository, getrennt vom App-Repository. Die App hat keine Git-Funktionen; Pull, Commit und Push erfolgen außerhalb. Ziel ist ein gut lesbarer Diff und möglichst wenige Merge-Konflikte, wenn zwei Personen an verschiedenen Geschossen arbeiten.

```
haus-daten/
  projekt.yaml          schemaVersion, Name, Einstellungen (Geschosse werden über geschosse/*.yaml gefunden)
  katalog.yaml          deviceTypes, lineTypes, furnitureTypes
  geschosse/<slug>.yaml je Geschoss: storey, walls, rooms, openings, devices*, furniture, routeNodes, routeSegments
  verteiler.yaml        boards, Reiheneinbaugeräte (devices mit placement board), circuits, knxLines, knxAssignments
  leitungen.yaml        cables
  warnungen.yaml        suppressedWarnings
  notizen.yaml          importierte Baustellennotizen (ab m7)
  plaene/<datei>.pdf    Architektenpläne, von storey.underlay.file referenziert
```

\* Geräte stehen in der Datei des Geschosses ihrer Fläche; Geräte mit `placement: free` über `storeyId`.

Eine fehlende Datei gilt als leer. Jeder Meilenstein schreibt nur die Dateien, die er füllt; `*.yaml`-Dateien, die eine App-Version nicht kennt, ignoriert sie und schreibt oder löscht sie nie. Die vollständige Feldliste je Typ steht im Design des Meilensteins, der den Typ einführt (M1: `openspec/changes/m1-gebaeudemodell/design.md`, Abschnitt „Dateiformat M1“).

Regeln für deterministisches Schreiben:

- IDs: 8 Zeichen aus `[0-9a-z]`, zufällig, unveränderlich, projektweit eindeutig. Jedes Objekt mit Namen trägt ihn direkt nach der ID.
- Listen sortiert nach ID, nie nach Einfügereihenfolge. So ändert eine Wertänderung genau eine Zeile.
- Feste Feldreihenfolge je Objekttyp, definiert an einer Stelle im Code.
- Längen als ganze Millimeter, Winkel auf 0,1°, PDF-Koordinaten auf 0,1 Punkt, Anteile (z. B. Deckkraft) auf zwei Nachkommastellen; gerundet wird bereits beim Setzen eines Werts.
- Punkte und kurze Tupel einzeilig im Flow-Stil ohne Innenabstand: `{x: 120, y: 3400}`. Alles andere im Block-Stil, Einrückung 2, Listeneinträge eingerückt, keine Zeilenumbrüche in langen Zeilen (`yaml`-Optionen `lineWidth: 0`, `flowCollectionPadding: false`, `indent: 2`, `indentSeq: true`).
- Zahlen: Ganzzahlen ohne `.0`, sonst kürzeste Dezimaldarstellung; `-0` wird `0`.
- Leere optionale Felder werden weggelassen.
- Texte immer in Anführungszeichen; LF-Zeilenenden, UTF-8, abschließender Zeilenumbruch.
- Abgeleitete Werte werden nie gespeichert.
- Unverändertes Laden und Speichern erzeugt byteweise identische Dateien. Eine Datei wird nur geschrieben, wenn ihre Serialisierung vom zuletzt gelesenen oder geschriebenen Inhalt abweicht; von Hand nicht kanonisch bearbeitete Dateien werden dabei kanonisch umgeschrieben.

Beispiel `geschosse/eg.yaml` (Ausschnitt, `devices` ab M2; das verbindliche vollständige M1-Beispiel steht in `openspec/changes/m1-gebaeudemodell/design.md`):

```yaml
storey:
  id: "k3f9a2qd"
  name: "EG"
  slug: "eg"
  elevationMm: 0
  rawHeightMm: 2600
  defaults: {floorBuildupMm: 120, plasterMm: 15, suspendedMm: 0}
  underlay:
    file: "plaene/eg.pdf"
    page: 1
    calibration: {p1: {x: 102.4, y: 88.1}, p2: {x: 512, y: 88.1}, distanceMm: 8240}
    offset: {x: 0, y: 0}
    rotationDeg: 0
    opacity: 0.5
    visible: true
walls:
  - id: "a81kd0x2"
    kind: "exterior"
    start: {x: 0, y: 0}
    end: {x: 8240, y: 0}
    thicknessMm: 365
devices:
  - id: "p0qz7c1m"
    label: "Steckdose Küche Arbeitsplatte 1"
    typeId: "socket-double"
    status: "planned"
    placement: {kind: "surface", surface: "wall:a81kd0x2:L", u: 1830, v: 1100, rotationDeg: 0}
    circuitId: "f12xk9aa"
```

Beim Laden prüft die App alle Dateien gegen das Schema (unbekannte Felder sind Fehler), auf Merge-Konfliktmarker, doppelte IDs und eine zu neue `schemaVersion` und meldet Fehler mit Datei und Zeile. Ändern sich Dateien auf der Platte (z. B. nach `git pull`), bietet die App das Neuladen an.

## Datenmodell

Das Modell im Speicher ist ein einziges `Project`-Objekt; die Aufteilung auf Dateien geschieht nur beim Lesen und Schreiben.

```ts
type Id = string;                      // stabil, z. B. nanoid
type Status = "planned" | "installed" | "verified";
type Trade = "power" | "knx" | "data" | "conduit" | "refrigerant" | "condensate" | "other";

interface Project {
  schemaVersion: number;
  name: string;
  settings: Settings;
  catalog: Catalog;
  storeys: Storey[];
  walls: Wall[];
  rooms: Room[];
  openings: Opening[];
  devices: Device[];          // alle Geräte, auch Reiheneinbaugeräte und Verbraucher
  furniture: Furniture[];
  routeNodes: RouteNode[];
  routeSegments: RouteSegment[];
  cables: Cable[];
  boards: Board[];
  circuits: Circuit[];
  knxLines: { id: Id; label: string }[];      // z. B. "1.1"
  knxAssignments: KnxAssignment[];
  suppressedWarnings: string[];  // Warnungsschlüssel, die bewusst übergangen wurden
}

interface Settings {
  northDeg: number;            // Nordrichtung im Grundriss, 0 = +y, im Uhrzeigersinn (M1)
  lengthAllowance: { perDeviceMm: number; perBoardMm: number; wastePercent: number }; // 300 / 1500 / 10
  installZones: { horizontalTop: [number, number]; horizontalBottom: [number, number];
                  verticalFromEdge: [number, number] };   // [150,450], [150,450], [100,300]
  teReservePercent: number;    // 25
  actuatorReservePercent: number; // 20
  defaultPlotScale: number;    // 50
}

interface Storey {
  id: Id; name: string; slug: string;          // slug = Dateiname, einmal gebildet, ändert sich nie
  elevationMm: number; rawHeightMm: number;    // OK Rohfußboden bis UK Rohdecke
  underlay?: { file: string; page: number;      // Pfad relativ zum Projektordner
               calibration?: { p1: Pt; p2: Pt; distanceMm: number };  // p1/p2 in PDF-Punkten; fehlt = noch nicht kalibriert (1:100)
               offset: Pt; rotationDeg: number; opacity: number; visible: boolean };
  defaults: { floorBuildupMm: number; plasterMm: number; suspendedMm: number };   // suspendedMm Standard 0
}

interface Wall {
  id: Id; storeyId: Id; start: Pt; end: Pt;   // Achse
  thicknessMm: number; kind: "exterior" | "interior";
  rawHeightMm?: number;                       // Standard: storey.rawHeightMm
  outsideSide?: "L" | "R";                    // nur wenn die Außenseite nicht aus den Räumen folgt; Standard L
}

interface Room {
  id: Id; storeyId: Id; name: string;
  seed: Pt;                                   // Klickpunkt der Raumerkennung
  polygon: Pt[];                              // Rohbau-Innenkontur, aus Wänden erkannt, kanonisch (gegen Uhrzeigersinn, Start bei kleinstem y, dann x), bleibt bei offenem oder verschmolzenem Raum erhalten
  floorBuildupMm?: number; plasterMm?: number;  // Standard: storey.defaults
  suspendedMm?: number;                       // Abhängung unter Rohdecke; Standard: storey.defaults
  slopes?: Slope[];                           // Dachschrägen
}
// Rohdecke an einem Punkt = min(Rohbauhöhe - Abhängung, alle Schrägenebenen); fertige Decke = Rohdecke - plasterMm
interface Slope { id: Id; baseLine: [Pt, Pt]; heightAtBaseMm: number; angleDeg: number; }
// heightAtBaseMm: OK Rohfußboden bis Unterseite Rohschräge an der Grundlinie; steigt zur Seite des Raumschwerpunkts

interface Opening {
  id: Id; storeyId: Id; wallId: Id; kind: "window" | "door" | "opening";   // storeyId beim Laden aus der Datei gesetzt, nicht geschrieben
  offsetMm: number;                           // Abstand Wandanfang bis Rohbauöffnung
  widthMm: number; heightMm: number; sillMm: number;   // Rohbaumaße, Brüstung ab Rohfußboden
  shutterBox?: { position: "inside" | "outside" | "top"; heightMm: number };
}

type SurfaceRef = string;  // "wall:<wallId>:L" | "wall:<wallId>:R" (Seite bezogen auf Richtung start→end) | "ceiling:<roomId>" | "floor:<roomId>" | "slope:<roomId>:<slopeId>"

interface Device {
  id: Id; typeId: Id; label: string; status: Status;
  placement:
    | { kind: "surface"; surface: SurfaceRef; u: number; v: number; rotationDeg: number }
    | { kind: "board"; boardId: Id; fieldId: Id; row: number; slot: number }   // Reiheneinbau
    | { kind: "free"; storeyId: Id; x: number; y: number; z: number };        // z. B. Klima-Außengerät
  circuitId?: Id;
  knxLineId?: Id;                              // nur Busteilnehmer
  props: Record<string, unknown>;              // typabhängig, z. B. Leistung
}

interface Furniture {
  id: Id; typeId: Id; storeyId: Id; x: number; y: number; rotationDeg: number;
  widthMm: number; depthMm: number; heightMm: number; elevationMm: number;  // ab OKFF
}

interface RouteNode {
  id: Id;
  anchors: { surface: SurfaceRef; u: number; v: number }[];  // >1 Anker = Knoten auf einer Kante (Übergang)
  deviceId?: Id;                                             // Knoten an einem Gerät
  boardId?: Id;                                              // Knoten am Verteiler
}

interface RouteSegment {
  id: Id; a: Id; b: Id;                        // RouteNode-Ids
  kind: "surface" | "penetration";
  surface?: SurfaceRef;                        // bei kind=surface
  penetration?: { method: "drill" | "core-drill" | "slot" | "conduit"; diameterMm: number };
  conduit?: { diameterMm: number };            // Leerrohr auf dem Segment
  status: Status;
}

interface Cable {
  id: Id; lineTypeId: Id; label: string; status: Status;
  from: Endpoint; to: Endpoint;
  path: Id[];                                  // geordnete RouteSegment-Ids
  circuitId?: Id;
}
type Endpoint = { deviceId: Id } | { boardId: Id };

interface Board {
  id: Id; kind: "meter-cabinet" | "sub-distribution" | "media";
  label: string; storeyId: Id;
  placement: { surface: SurfaceRef; u: number; v: number };
  mounting: "flush" | "surface"; widthMm: number; heightMm: number; depthMm: number;
  fields: { id: Id; kind: "meter" | "apz" | "upper-connection" | "lower-connection"
                       | "distribution" | "multimedia"; rows: number; tePerRow: number }[];
  parentBoardId?: Id;                          // Hierarchie
}

interface Circuit {
  id: Id; boardId: Id; label: string;          // z. B. "F12 Küche Steckdosen"
  protectionDeviceId?: Id;                     // Reiheneinbaugerät
  lineTypeId?: Id;
}

interface KnxAssignment {
  actuatorDeviceId: Id; channel: number; consumerDeviceId: Id;
}
```

### Katalog

```ts
interface Catalog { deviceTypes: DeviceType[]; lineTypes: LineType[]; furnitureTypes: FurnitureType[]; }

interface LineType {
  id: Id; name: string; trade: Trade;          // "NYM-J 3x1,5", "KNX J-Y(St)Y 2x2x0,8", "Cat 7", "Kältemittel 1/4+3/8"
  outerDiameterMm: number; color: string;
}

interface DeviceType {
  id: Id; name: string; trade: Trade;
  symbol: string;                              // SVG-Fragment, 0..1 normiert, DIN-EN-60617-nah
  shape3d: { kind: "box" | "cylinder"; widthMm: number; heightMm: number; depthMm: number };
  mounting: ("wall" | "ceiling" | "floor" | "din-rail" | "free")[];
  defaultHeightMm?: number;                    // ab OKFF
  flush?: { boxDepthMm: number };              // Unterputz
  teWidth?: number;                            // Reiheneinbau
  connects: Trade[];                           // anschließbare Gewerke
  knx?: { consumes?: KnxFunction;              // Verbraucher braucht einen Kanal dieser Funktion
          provides?: { function: KnxFunction; channels: number } };   // Aktor
  light?: { kind: "spot" | "point" | "area"; lumen: number; beamAngleDeg?: number; colorTempK: number };
  refrigerant?: { minLengthM: number; maxLengthM: number; prechargedLengthM: number };
}
type KnxFunction = "switch" | "dim" | "blind" | "heating" | "binary-input";

interface FurnitureType { id: Id; name: string; widthMm: number; depthMm: number; heightMm: number; elevationMm: number; }
```

Ein neues Projekt startet mit einem Standardkatalog (Steckdosen, Schalter, Präsenzmelder, Taster, Auslässe, Leuchten, Rollladenmotor, Router, Netzwerkdose, KNX-Geräte, LS/FI/RCD/SPD, Aktoren, Klima-Innen- und Außengerät, gängige Leitungstypen, Grundmöbel).

## Abgeleitete Größen

| Größe | Berechnung |
|---|---|
| Flächen | aus Wänden, Räumen, Decken, Schrägen; Wandseite gekappt durch Deckenhöhe/Schrägen |
| Raumfläche | fertige Fläche: Rohbaupolygon um die Putzstärke nach innen versetzt |
| Rohbauhöhe einer Dose | `v + floorBuildupMm` |
| Leitungslänge | Summe Segmentlängen + Zuschläge je Endpunkt (Gerät/Verteiler) + Verschnitt % |
| TE-Belegung | Summe `teWidth` je Feld/Reihe gegen `tePerRow` |
| Aktorbedarf | Zählung `knx.consumes` je Verteiler (über Stromkreis bzw. Leitung zum Verteiler) |
| Warnungen | Regelprüfungen, jede mit stabilem Schlüssel `<regel>:<objektId>` |

## Modulschnitt (Vorschlag)

```
src/
  model/        Typen, Schema-Version, Migration, Standardkatalog
  geometry/     Flächen, Projektionen, Schnitte, Längen (rein, gut testbar)
  rules/        Warnungsregeln (rein)
  store/        Zustand, Undo/Redo, Befehle
  views/plan/   Grundriss-Editor
  views/surface/Wandansicht, Deckenspiegel, Bodenansicht
  views/board/  Verteiler-Belegung
  views/3d/     3D-Ansicht
  views/lists/  Listen
  export/       PDF
  io/           Serialisierung YAML <-> Project, Schemaprüfung, Client-API zum Server
server/         lokaler Node-Server: statische App, Dateizugriff im Projektordner, Dateibeobachtung
```

`geometry/`, `rules/` und die Serialisierung in `io/` hängen nicht von React ab. Der Server darf nur innerhalb des beim Start angegebenen Projektordners lesen und schreiben.

## Meilensteine

| Change | Inhalt |
|---|---|
| `m1-gebaeudemodell` | PDF-Hintergrund, Kalibrierung, Wände, Räume, Öffnungen, Höhen, Grundriss, Flächenansichten, einfache 3D, Speichern |
| `m2-geraete-und-moebel` | Katalog, Geräte platzieren, Installationszonen, Möbel, Kollisionswarnung, Gewerkfilter |
| `m3-trassen-und-leitungen` | Trassennetz, Übergänge, Durchbrüche, Leitungen, Längen, Status |
| `m4-verteiler-und-stromkreise` | Zählerschrank, UV, Medienverteiler, TE-Belegung, Stromkreise, KNX-Kanäle, Aktorbedarf |
| `m5-plan-export` | Listen, PDF-Pläne, Bestandsplan |
| `m6-kaeltemittel-und-licht` | Kältemittel- und Kondensatregeln, Licht in 3D, 3D-Bilder |
| `m7-baustellen-notizen` | optional: Stiftnotizen aus annotierten Baustellen-PDFs als Notizebene zurückholen |

Jeder Meilenstein ist für sich nutzbar. Ein Change wird erst begonnen, wenn der vorherige archiviert ist.
