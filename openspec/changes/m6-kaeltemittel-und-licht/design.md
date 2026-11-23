# Design

## Context

M1 bis M5 sind archiviert (`openspec/changes/archive/2026-11-21-m1-gebaeudemodell/` bis `…/2026-11-23-m5-plan-export/`). Das Modell kennt bereits die Gewerke `refrigerant` und `condensate`, die Leitungstypen „Kältemittelleitungspaar 1/4" + 3/8"“ und „Kondensatleitung“, die Gerätetypen „Klima-Innengerät“ und „Klima-Außengerät“ (beide mit `refrigerant: { minLengthM, maxLengthM, prechargedLengthM }`) und Lichtangaben `light: { kind, lumen, beamAngleDeg?, colorTempK }` an Spot, Decken- und Wandauslass. Leitungen haben Länge mit Zuschlägen (`cableLength`), Trassensegmente liegen über `segmentWorldEnds` im Raum. Die 3D-Ansicht (`ui/three/ModelView.tsx`, react-three-fiber, `frameloop="demand"`) beleuchtet gleichmäßig mit Umgebungs- und zwei Richtungslichtern.

Was fehlt: Kältemittel- und Kondensatleitungen werden wie jede Leitung behandelt, ohne Prüfung. Leuchten sind in 3D nur Zylinder. Bilder und gespeicherte Kamerapositionen gibt es nicht. Dieses Dokument legt fest, was M6 dafür braucht, damit beim Umsetzen keine eigenen Designentscheidungen nötig sind.

## Goals / Non-Goals

**Goals:**
- Klimaverbindung als abgeleitete Sicht: Innengerät ↔ Außengerät über Kältemittelleitung, Innengerät → Ablauf über Kondensatleitung; Multisplit
- Prüfung der Kältemittellänge (Mindest-, Höchstlänge, Mehrlänge über vorgefüllt) und des Kondensatgefälles je Segment
- Leuchten als Lichtquellen in 3D (Spot, Punkt, Fläche; Lichtstrom und Lichtfarbe), Umschalten gleichmäßig/Leuchten, einzelne Leuchten und Stromkreise schalten
- 3D-Bild als PNG in wählbarer Auflösung, benannte Kamerapositionen

**Non-Goals:**
- Lichtberechnung nach Norm (Beleuchtungsstärke in lx, DIALux); die Darstellung ist eine grobe Einschätzung
- Nachfüllmenge in Gramm (braucht Kältemittel und g/m je Gerät); M6 weist nur die Mehrlänge in m aus
- Gesamtlängen- und Höhenunterschiedsgrenzen bei Multisplit, Höhenunterschied Innen-/Außengerät
- Dämmschicht an Außenwänden (siehe „Entscheidungen bei der Ausarbeitung“ 9)
- 3D-Bilder im PDF-Export

## Decisions

### Schemaversion 5 und Migration
M6 erhöht `schemaVersion` auf 5. Grund wie bisher: Eine M5-App würde `settings.condensateMinSlopePercent`, `refrigerant.unit` und `ansichten.yaml`-Inhalte nicht kennen bzw. als unbekannte Felder ablehnen.

Die Migration `4 → 5`:
- setzt `settings.condensateMinSlopePercent` = 1;
- ergänzt die neuen Standardtypen aus „Katalog“, deren ID im Projektkatalog fehlt (wie in M4; ohne `katalog.yaml` nichts). Vorhandene Typen bleiben unverändert (device-catalog „Katalog im Projekt“); ihr fehlendes `refrigerant.unit` wird abgeleitet (siehe „Katalog“).

Wie bisher schreibt sie nichts von selbst; Hinweis „Projekt auf Version 5 aktualisiert, wird beim nächsten Speichern geschrieben“. Neue Projekte starten in Version 5.

### Dateiformat M5 (Schemaversion 5)
Neu oder geändert gegenüber M4 (übrige Zeilen gelten unverändert):

| Objekt | Felder in Schreibreihenfolge (`?` = nur wenn gesetzt) | Listen sortiert nach | Flow-Stil |
|---|---|---|---|
| `settings` | `northDeg`, `installZones`, `lengthAllowance`, `teReservePercent`, `actuatorReservePercent`, `condensateMinSlopePercent` | – | – |
| `deviceType.refrigerant` | `unit?`, `minLengthM`, `maxLengthM`, `prechargedLengthM` | – | ja |
| Datei `ansichten.yaml` | `cameraViews` | nach `id` | – |
| `cameraView` | `id`, `name`, `position`, `target`, `upToStoreyId?` | – | `position`, `target` |
| `position`, `target` | `x`, `y`, `z` (ganze mm, z über Geländenull wie `globalZ`) | – | ja |

- `refrigerant.unit` ist `"indoor"` oder `"outdoor"` und optional. Fehlt es (Typen aus Projekten vor Version 5), gilt: Innengerät, wenn der Typ `condensate` in `connects` hat, sonst Außengerät (`refrigerantUnit(type)`). Die Längenwerte bleiben Pflicht wie bisher; bei Innengeräten haben sie keine Wirkung (maßgebend ist das Außengerät).
- `condensateMinSlopePercent`: Zahl ≥ 0 und ≤ 10 (eine Nachkommastelle in der Oberfläche).
- `ansichten.yaml` wird nur geschrieben, wenn `cameraViews` nicht leer ist, sonst gelöscht (wie `leitungen.yaml`). `upToStoreyId` mit unbekanntem Geschoss gilt als nicht gesetzt und wird vom nächsten Befehl in `normalizeAfterCommand` entfernt.
- `docs/architektur.md`: Dateiliste um `ansichten.yaml`, `Project.cameraViews`, `interface CameraView`, `Settings.condensateMinSlopePercent`, `DeviceType.refrigerant.unit?`.

### Katalog
- Neuer Standardtyp `condensate-drain` „Kondensatablauf“ (Gewerk `condensate`, Montage `wall`, `floor`, `free`, `connects: ["condensate"]`, Symbol Kreis mit „KA“, `shape3d` Zylinder 50 × 50 × 40, `defaultHeightMm` 300). Er steht für Fallrohranschluss, Siphon oder Hebeanlage und ist der Ablaufpunkt einer Kondensatleitung.
- Neuer Standardtyp `ac-outdoor-multi-3` „Klima-Außengerät Multisplit 3“ (wie `ac-outdoor`, Box 900 × 700 × 320, `refrigerant: { unit: outdoor, minLengthM: 3, maxLengthM: 25, prechargedLengthM: 7 }` je Kältemittelverbindung). Die Grenzen gelten je Verbindung (siehe Non-Goals).
- Im Standardkatalog neuer Projekte: `ac-indoor` mit `unit: indoor`, `ac-outdoor` mit `unit: outdoor` (Werte wie bisher 3 / 25 / 7 m). In bestehenden Projekten bleiben diese Typen unverändert und werden über die Ableitung erkannt.
- Katalogdialog: Abschnitt „Kältemittel“ mit Auswahl „Innengerät“/„Außengerät“ (setzt `unit`); Längenfelder nur beim Außengerät sichtbar, ihre Werte bleiben erhalten. Licht bleibt wie in M2 (Art, Lichtstrom, Abstrahlwinkel nur bei Spot, Lichtfarbe).

### Klimaverbindung (abgeleitet, `geometry/refrigerant.ts`)
Nichts davon wird gespeichert. Grundlage sind Leitungen, deren Leitungstyp das Gewerk `refrigerant` bzw. `condensate` hat.
- **Innengerät:** Gerät, dessen Typ `refrigerant.unit = "indoor"` hat. **Außengerät:** `unit = "outdoor"`. **Ablauf:** jedes Gerät oder jeder Verteiler am anderen Ende einer Kondensatleitung eines Innengeräts (normalerweise `condensate-drain`).
- `refrigerantLinks(project)`: je Kältemittelleitung mit einem Innen- und einem Außengerät als Endpunkten ein `RefrigerantLink { cableId, indoorId, outdoorId, lengthMm | null, limits | null, extraLengthMm | null }`. `lengthMm` = `cableLength` (die angezeigte Länge mit Zuschlägen und Verschnitt; siehe „Entscheidungen“ 3). `limits` aus dem Typ des Außengeräts. `extraLengthMm` = max(0, Länge − vorgefüllte Länge), null ohne Weg.
- `acConnection(project, deviceId)`: für ein Innengerät `{ links: RefrigerantLink[], condensate: { cableId, drain: Endpoint, lengthMm }[] }`; für ein Außengerät `{ links }` (eine je angeschlossenem Innengerät, Multisplit ergibt mehrere).
- **Eigenschaften des Innengeräts:** Abschnitt „Klimaverbindung“: „Außengerät: <Bezeichnung>“ (Link wählt es aus), „Kältemittelleitung: <Bezeichnung> · <Länge>“, „Mehrlänge: <x,x> m (vorgefüllt <y> m)“ bzw. „keine Mehrlänge“, „Kondensatleitung: <Bezeichnung> → <Ablauf> · <Länge>“; fehlt etwas: „kein Außengerät“, „keine Kondensatleitung“. **Außengerät:** „Kältemittelverbindungen: <n>“ und je Verbindung Innengerät, Leitung, Länge, Mehrlänge. **Leitung** (Kältemittel): Zeile „Mehrlänge …“ unter der Länge; Kondensat: „Gefälle min. <p> %“ (kleinstes Segmentgefälle) bzw. „ohne Gefälle in <k> Segmenten“.
- Leitungen anlegen: bestehendes Werkzeug „Leitung“; die Leitungstypauswahl (`compatibleLineTypes`) bietet zwischen Innen- und Außengerät schon das Kältemittelpaar und zum Ablauf die Kondensatleitung an. Keine neue Bedienung.

### Kondensatgefälle (`geometry/refrigerant.ts`, `rules/refrigerant.ts`)
- **Fließrichtung:** vom Innengerät weg. Ist `to` das Innengerät, wird der Weg umgekehrt; ist keins der Enden ein Innengerät, gilt `from → to`. Ohne zusammenhängenden Weg wird nicht geprüft (dafür gibt es `cable-without-path`).
- **Je Segment** in Fließrichtung: Weltpunkte der beiden Knoten (`segmentWorldEnds`, z über Geländenull), waagerechter Abstand h = Abstand in (x, y), Fall d = z_ein − z_aus. Gefälle p = d / h · 100 %.
  - h < 1 mm: senkrecht. d > 0 (nach unten) ist in Ordnung (Spec „Senkrecht nach unten“), d < 0 (nach oben) ist ein Fehler, d = 0 wird übersprungen.
  - sonst Fehler, wenn d < min · h / 100 − 0,5 mm (Rundung ganzer mm der Anker).
  - Durchbruchsegmente zählen mit: Eine waagerechte Bohrung durch die Außenwand braucht ebenfalls Gefälle.
- Ein Segment, das mehrere Kondensatleitungen tragen, wird je Leitung geprüft; die Warnung entsteht einmal je Segment.

### Warnungen
Neu in M6 (alle übergehbar):

| Schlüssel | Text | Klick in der Warnungsliste |
|---|---|---|
| `refrigerant-too-long:<cableId>` | „Kältemittelleitung zu lang: <Bezeichnung> <l> m (höchstens <max> m)“ | wählt die Leitung |
| `refrigerant-too-short:<cableId>` | „Kältemittelleitung zu kurz: <Bezeichnung> <l> m (mindestens <min> m)“ | wählt die Leitung |
| `refrigerant-ends:<cableId>` | „Kältemittelleitung verbindet nicht Innen- und Außengerät: <Bezeichnung>“ | wählt die Leitung |
| `condensate-slope:<segmentId>` | „Kondensat ohne Gefälle: <Bezeichnung der Leitung> (<p> %, mindestens <min> %)“; bei Anstieg „steigt an“ statt „<p> %“ | wählt das Segment |
| `ac-without-condensate:<deviceId>` | „Klima-Innengerät ohne Kondensatleitung: <Bezeichnung>“ | wählt das Gerät |

- Leitungen ohne Weg (Länge unbekannt) erzeugen keine Längenwarnung.
- Markierung: Segmente und Leitungen mit Warnung erscheinen wie bisher in Warnfarbe (`warnedIds`), in Grundriss, Flächenansicht und 3D (Spec „Steigung“: „das Segment wird markiert“).
- Längen in Texten mit einer Nachkommastelle und Komma.

### Einstellungen
- Projekteinstellungen, Abschnitt „Kondensat“: „Mindestgefälle (%)“, Befehl „Mindestgefälle ändern“, Prüfung 0–10, Schritt 0,1.

### Licht in 3D (`geometry/lighting.ts`, `ui/three/`)
- **Modus** (Ansichtszustand im View-Store, nicht gespeichert): „Gleichmäßig“ (bisherige Beleuchtung, Standard) oder „Leuchten“. Im Modus „Leuchten“ gibt es nur ein schwaches Umgebungslicht (Hemisphäre, Intensität 0,15) und die eingeschalteten Leuchten; die Richtungslichter sind aus.
- **Leuchten** sind sichtbare Geräte (Gewerkfilter, „Anzeigen bis“) mit `light` im Typ und Flächenplatzierung. `sceneLights(project, opts)` (rein) liefert je Leuchte `{ deviceId, kind, position, direction, color, intensity, angle?, width?, height? }` in Welt-mm:
  - Lage: Mitte der Gerätevorderseite (Oberfläche + `shape3d.depthMm` entlang der Normalen) + 5 mm; Richtung: Normale der Fläche (Deckenspot strahlt nach unten, Wandauslass in den Raum).
  - **Spot** → `SpotLight`, Öffnungswinkel `angle` = `beamAngleDeg` / 2 (Standard 36°, wenn nicht gesetzt), `penumbra` 0,3, `decay` 2, Lichtstärke I = Φ / (2π (1 − cos(θ/2))) cd.
  - **Punkt** → `PointLight`, `decay` 2, I = Φ / (4π) cd.
  - **Fläche** → `RectAreaLight` mit `shape3d` Breite × Höhe, Leuchtdichte L = Φ / (π · A) (A in m²), Richtung Normale.
  - Die physikalischen Werte werden mit dem festen Belichtungsfaktor `LIGHT_EXPOSURE` multipliziert (per Bild eingestellt auf 0,05, damit die 450-lm-Spotreihe der Fixture auf 2,5 m einen deutlich hellen, nicht ausgebrannten Kegel ergibt; der Wert steht im Code mit Begründung). Umgebungslicht im Modus „Leuchten“: Hemisphäre 0,15.
  - **Lichtfarbe:** `kelvinToRgb(K)` (Näherung nach Tanner Helland, 1000–40000 K, Ergebnis 0…1 je Kanal, in three als sRGB-Farbe). 2700 K hat ein größeres Verhältnis Rot/Blau als 4000 K (Spec „Warmweiß“).
  - Eingeschaltete Leuchten leuchten selbst: Material mit `emissive` in Lichtfarbe.
- **Grenze:** Höchstens 32 Lichtquellen gleichzeitig (Shader-Grenzen und Leistung). Sind mehr eingeschaltet, werden die des obersten angezeigten Geschosses zuerst genommen, dann nach Geräte-ID; Hinweis in der Lichtleiste „<n> von <m> Leuchten dargestellt (höchstens 32)“.
- **Schatten:** Kontrollkästchen „Schatten“ (Standard aus). Ein: Leuchten werfen Schatten (Schattenkarte 512 px), Wände, Decken, Böden, Möbel empfangen und werfen sie. Ohne Schatten fällt Licht auch in Nachbarräume; das ist bei Kegeln aus der Decke gering.
- **Ein- und ausschalten:** Leiste „Licht“ in der 3D-Ansicht (aufklappbar rechts): Modus, „Schatten“, „Alle an“, „Alle aus“ und eine Liste je Stromkreis (Bezeichnung des Kreises mit Verteiler, danach „ohne Stromkreis“), darunter die Leuchten mit Bezeichnung. Kontrollkästchen am Kreis schaltet alle seine Leuchten (gemischt = unbestimmt), Kontrollkästchen an der Leuchte nur sie. Zustand im View-Store als Menge ausgeschalteter Leuchten-IDs; Standard alle an. Neue Leuchten sind an. Nicht gespeichert.
- Test-Hilfe: `data-lights` am Szenenelement: sortierte Liste `<deviceId>:<kind>:<Farbe hex>` der dargestellten Lichtquellen, `data-light-mode`.

### 3D-Bild speichern
- Knopf „Bild speichern …“ in der 3D-Werkzeugleiste öffnet ein kleines Menü: Auflösung 1280 × 720, 1920 × 1080 (Standard), 2560 × 1440, 3840 × 2160, „wie Fenster“ (Größe der Zeichenfläche × Pixeldichte), Knopf „Speichern“.
- Ablauf in einer Komponente innerhalb des Canvas (`useThree`): Größe, Pixeldichte und Seitenverhältnis merken, `setPixelRatio(1)`, `setSize(w, h, false)`, Kamera-Seitenverhältnis w/h, einmal rendern, `toDataURL("image/png")`, alles zurücksetzen und neu rendern. Der Bildausschnitt folgt der Kamera; bei anderem Seitenverhältnis als das Fenster ändert sich der waagerechte Ausschnitt (der senkrechte Öffnungswinkel bleibt 45°).
- Download `<Projektname> 3D <Datum>.png` (gleiche Bereinigung wie beim PDF-Namen aus M5). Kein Schreiben in den Projektordner. Lässt der Browser die Größe nicht zu (größer als `MAX_RENDERBUFFER_SIZE`), Meldung „Auflösung zu groß für diesen Browser (höchstens <n> px)“.

### Kamerapositionen
- Gespeichert im Projekt (`ansichten.yaml`), damit sie über Git bei allen ankommen (Spec „Ansicht Küche“). Inhalt: Name, Kameraposition, Blickziel (Ziel der Orbit-Steuerung) in Welt-mm, z über Geländenull, ganze mm; dazu „Anzeigen bis“ (`upToStoreyId`, fehlt = alle Geschosse).
- 3D-Werkzeugleiste: Auswahl „Ansicht“ mit den gespeicherten Namen (alphabetisch); Wahl setzt Kamera, Ziel und „Anzeigen bis“. Knopf „Ansicht speichern …“ fragt den Namen (Vorschlag „Ansicht <n>“); gibt es den Namen schon, wird diese Ansicht nach Rückfrage überschrieben. Knopf „Ansicht löschen“ für die gewählte Ansicht.
- Befehle: „Ansicht speichern“, „Ansicht ändern“ (Überschreiben), „Ansicht löschen“. Ansichten sind keine Auswahlobjekte und erscheinen nicht im Baum.
- Umsetzung (2026-11-23): Die Auswahl heißt sichtbar „Ansicht“, für Screenreader „Gespeicherte Ansicht“ (die Tab-Leiste der Editoren heißt schon „Ansicht“). Beim Aufrufen wird die Restbewegung der gedämpften Orbit-Steuerung verworfen. Das Blickziel wird nur beim ersten Einpassen auf die Gebäudemitte gesetzt und bleibt danach bei Modelländerungen und beim Wechsel von „Anzeigen bis“ stehen (vorher sprang es bei jeder Änderung zurück, auch nach „Ansicht speichern“).

### Module
- Neu, rein: `geometry/refrigerant.ts` (Rollen, Verbindungen, Mehrlänge, Gefälle je Segment), `geometry/lighting.ts` (`kelvinToRgb`, Lichtstärken, `sceneLights`, Begrenzung), `rules/refrigerant.ts`, `store/views3d.ts` (Befehle für Ansichten). 
- UI: `ui/three/ModelView.tsx` (Lichtmodus, Lichtquellen, Schatten), `ui/three/LightPanel.tsx`, `ui/three/capture.ts` bzw. Komponente für das PNG, `ui/three/CameraViews.tsx`; Erweiterungen in `ui/DeviceProperties.tsx` (Klimaverbindung), `ui/CableProperties.tsx`, `ui/ProjectSettings.tsx`, `ui/catalog/CatalogDialog.tsx`.
- `io/`: `ansichten.yaml` in `project-files.ts`, Writer und Golden File.

### Tests und Fixtures
- Neue Fixture `tests/fixtures/m6/`: die M4-Fixture in Version 5, ergänzt um ein Klima-Innengerät im Raum Schlafen (Wand, 2100 mm), ein Außengerät auf der Außenseite einer Außenwand (Flächen ohne Raum), einen Kondensatablauf, Trassen mit Durchbruch nach außen, eine Kältemittelleitung und eine Kondensatleitung mit Gefälle, vier Spots in Wohnen (die Fixture hat keinen Flur; Spec „Spotreihe“ nennt den Flur, geprüft wird dasselbe Verhalten) auf einem Stromkreis „F3 Licht“ und einen Deckenauslass mit 4000 K (eigener Typ), sowie eine gespeicherte Ansicht. Erzeugt über Store-Befehle und den Writer (Generator `tests/unit/io/fixture-m6.gen.test.ts`), dazu Golden-File-Test.
- Migrations-Test mit der M4-Fixture: Version 5, erster Befehl schreibt `projekt.yaml` (`condensateMinSlopePercent`) und `katalog.yaml` (nur die neuen Typen angehängt), sonst nichts; `ac-indoor`/`ac-outdoor` der Fixture werden über die Ableitung als Innen- bzw. Außengerät erkannt.
- Unit-Tests: Verbindung, Multisplit, Mehrlänge, Längenwarnungen, Enden, Gefälle (Anstieg, senkrecht nach unten, waagerecht, zu flach, Richtung bei vertauschten Enden, Durchbruch), `kelvinToRgb`, Lichtstärken, `sceneLights` (Spotreihe, Schalten je Kreis, Grenze 32), Ansichtsbefehle mit Undo.
- Komponententests: Eigenschaften Innen-/Außengerät, Mindestgefälle in den Projekteinstellungen, Lichtleiste (Kreis schalten), Ansicht speichern/aufrufen (über eine Kamera-Attrappe).
- Playwright (alle drei Browser): Fixture m6 öffnen, 3D im Modus „Leuchten“ mit vier Spotlichtern (`data-lights`), nur Kreis „F3 Licht“ einschalten, Helligkeit unter einem Spot größer als daneben (Pixel aus dem gespeicherten PNG), Bild 1920 × 1080 speichern (PNG-Kopf lesen), Ansicht speichern, Kamera bewegen, Ansicht aufrufen (Projektion eines bekannten Punkts gleich), Kondensatknoten anheben → Warnung „Kondensat ohne Gefälle“ und Segment in Warnfarbe.

## Risks / Trade-offs

- [Viele Lichtquellen machen three.js langsam oder sprengen Shader-Grenzen] → höchstens 32 Lichter, Schatten standardmäßig aus; jedes Ein-/Ausschalten ändert die Lichtanzahl und kompiliert die Shader neu (kurzes Stocken).
- [Headless-WebGL in Playwright (Software-Rendering) kann bei Pixelvergleichen abweichen] → nur grobe Vergleiche (heller als daneben, Faktor), keine Bildvergleiche gegen Referenzbilder.
- [Safari des Benutzers ist älter als Playwright-WebKit] → keine neuen APIs; `RectAreaLight` braucht `RectAreaLightUniformsLib.init()` aus three/examples (seit Jahren vorhanden); Prüfung in Safari durch den Benutzer.
- [Leitungslänge mit Verschnitt ist länger als das verlegte Rohr] → die Prüfung warnt eher zu früh als zu spät; siehe „Entscheidungen“ 3.
- [Frei platzierte Außengeräte (`placement: free`) haben keinen Trassenknoten] → ihre Kältemittelleitung bleibt ohne Weg und ohne Längenprüfung; Außengeräte gehören auf eine Außenwandfläche (oder einen Boden). Hinweis in den Eigenschaften: „Länge unbekannt (Leitung ohne Weg)“.

## Entscheidungen bei der Ausarbeitung (2026-11-23, zur Prüfung durch den Benutzer)

Die Specs ließen diese Punkte offen. Claude hat sie ohne Rückfrage festgelegt, weil der Benutzer weiterarbeiten lassen wollte. Sie lassen sich vor dem Ende der Umsetzung noch ändern:
1. Klimaverbindung wird nicht gespeichert, sondern aus Kältemittel- und Kondensatleitungen abgeleitet (Innengerät, Außengerät, Ablauf über die Endpunkte).
2. Innen- und Außengerät unterscheidet ein neues, optionales Katalogfeld `refrigerant.unit` (ohne Feld: Innengerät, wenn es Kondensat anschließt); Längengrenzen nur am Außengerät und je Verbindung (auch bei Multisplit). Schemaversion 5 mit Migration, die vorhandene Typen nicht ändert.
3. Geprüft wird die angezeigte Leitungslänge (Trasse + Zuschläge + Verschnitt), nicht die reine Trassenlänge.
4. Ablaufpunkt ist ein neuer Gerätetyp „Kondensatablauf“; die Kondensatleitung endet dort (oder an jedem anderen Gerät, das Kondensat anschließt).
5. Gefälle je Segment in Fließrichtung vom Innengerät weg; senkrechte Segmente nach unten sind in Ordnung; Durchbrüche zählen mit; Toleranz 0,5 mm. Zusätzlich Warnungen „Kältemittelleitung verbindet nicht Innen- und Außengerät“ und „Klima-Innengerät ohne Kondensatleitung“.
6. Lichtmodus, geschaltete Leuchten und Schatten sind Ansichtszustand, nicht gespeichert; höchstens 32 Lichtquellen; Schatten optional.
7. PNG als Download, nicht im Projektordner; Auflösungen 720p bis 4K und „wie Fenster“.
8. Kamerapositionen werden im Projekt gespeichert (`ansichten.yaml`, über Git geteilt), mit „Anzeigen bis“.
9. Die Dämmschicht an Außenwänden (offener Punkt im Proposal, aus m1 9.4.1) kommt nicht in M6. Sie ändert Wandgeometrie, Außenflächen, Durchbruchslängen, Grundriss, Export und 3D und ist eine eigene Formatänderung; die Specs von M6 verlangen sie nicht. Sie bleibt ein offener Punkt für einen eigenen Change nach M6 (oder als Folge-Task, wenn der Benutzer sie für Kältemitteldurchführungen jetzt braucht).

## Open Questions

- Keine.
