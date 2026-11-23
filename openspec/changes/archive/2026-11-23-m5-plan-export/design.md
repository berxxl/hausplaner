# Design

## Context

M1 bis M4 sind archiviert (`openspec/changes/archive/2026-11-21-m1-gebaeudemodell/` bis `…/2026-11-22-m4-verteiler-und-stromkreise/`). Das Modell enthält Gebäude, Geräte, Möbel, Trassen mit Durchbrüchen und Leerrohren, Leitungen mit Längen, Verteiler mit Belegung, Stromkreise und KNX-Zuordnungen. Alles ist in Grundriss, Flächenansichten, 3D und Belegungsansicht sichtbar, aber nicht als Tabelle und nicht als Papierplan. `docs/architektur.md` sieht für den PDF-Export jsPDF mit svg2pdf.js vor und im Modulschnitt `views/lists/` und `export/`. Dieses Dokument legt fest, was M5 dafür braucht, damit beim Umsetzen keine eigenen Designentscheidungen nötig sind.

Ein Probelauf vor dem Design (2026-11-22) ergab: svg2pdf.js braucht `getBBox` und läuft deshalb nicht unter jsdom. jsPDF schreibt Text mit den Standardschriften durchsuchbar und mit Umlauten (WinAnsi). pdf.js (Legacy-Build) liest in Node Seitengröße, Text und XMP-Metadaten einer jsPDF-Datei.

## Goals / Non-Goals

**Goals:**
- Listen in der App: Geräte mit Anschluss im Verteiler, Stromkreise, KNX-Kanäle, Leitungen mit Summen, Durchbrüche, Material; Filter und Sortierung
- PDF-Export: Grundrisse, Wandansichten mit Maßketten, Deckenspiegel, Bodenansichten, Schrägen, Verteilerbelegungen, Listen; Maßstab, Format, Plankopf, Legende, Gewerk- und Statusfilter, Bestandsplan
- Baustellen-PDF je Raum mit Raster, Bemaßung, Notizbereich und eingebetteter Seitenzuordnung für M7

**Non-Goals:**
- Einlesen von Notizen aus annotierten PDFs (M7); M5 liefert nur die Seitenzuordnung und das Lesen der eigenen Zuordnung
- 3D-Bilder im PDF (M6), DXF/DWG, Druck direkt aus der App
- Bearbeiten in den Listen (sie sind Sichten; Änderungen laufen über die Eigenschaften)
- Frei gestaltbare Plankopfe, Firmenlogos, eigene Schriften; Zeichen außerhalb von WinAnsi werden ersetzt
- Aufteilen eines zu großen Plans auf mehrere Blätter

## Decisions

### Datenmodell und Einstellungen
- **Keine Änderung am Datenmodell, Schemaversion bleibt 4.** Exporteinstellungen sind Ansichtszustand wie der zugeklappte Baum: `localStorage` `hausplaner.export` mit `{ scale, format, planStatus, trades, statuses }`. Sie stehen nicht in den Projektdateien. `docs/architektur.md` nennt bisher `settings.defaultPlotScale`; das Feld wird dort gestrichen (es gab es nie im Schema).
- Listenfilter und -sortierung sind Komponentenzustand und überleben das Neuladen nicht.

### Module
- `src/reports/` (rein, ohne React): `rows.ts` mit einer Funktion je Liste, `filter.ts` (gemeinsamer Filter und Sortierung), `material.ts`, `connection.ts` (Anschluss im Verteiler).
- `src/export/` (rein bis auf `pdf.ts`): `sheet.ts` (Blattmodell, Formate, Plankopf, Legende, Maßstabsleiste, Passprüfung, Text für WinAnsi), `plan.ts` (Grundriss), `surface.ts` (Wandansicht, Decke, Boden, Schräge mit Maßketten), `board.ts` (Belegung), `table.ts` (Listen als Tabellenblätter), `site.ts` (Baustellen-PDF), `mapping.ts` (Seitenzuordnung schreiben und lesen), `svg.ts` (Blatt → SVG-Text), `selection.ts` (Auswahl → Blattliste). `pdf.ts` erzeugt im Browser aus den SVG-Texten mit svg2pdf.js die PDF und ist das einzige Modul mit jsPDF und svg2pdf.js.
- UI: `ui/lists/ListsView.tsx` (Editor „Listen“), `ui/export/ExportDialog.tsx`, `ui/export/SiteExportDialog.tsx`.
- `docs/architektur.md`: Modulschnitt um `reports/` ergänzen; `views/…` heißen im Code `ui/…` (so seit M1), das wird dort angeglichen.

### Listen in der App
- **Editor „Listen“:** fünfter Tab neben Grundriss, Fläche, 3D, Verteiler (`EditorKind` `"lists"`). Oben eine Auswahl der Liste (Geräte, Stromkreise, KNX-Kanäle, Leitungen, Durchbrüche, Material), darunter die Filterleiste, darunter die Tabelle. Die Tabelle ist eine HTML-`table` mit `aria-label` = Name der Liste; Spaltenköpfe sind Knöpfe zum Sortieren.
- **Filter (alle Listen):** Geschoss (alle oder eins), Raum (alle oder einer des gewählten Geschosses), Gewerk (Mehrfachauswahl, Standard alle), Status (Mehrfachauswahl geplant, verlegt, geprüft; Standard alle). Hat eine Liste ein Merkmal gar nicht (Stromkreise: Status, Gewerk, Raum; KNX-Kanäle: Gewerk), wirkt der Filter dort nicht. Fehlt das Merkmal nur einer Zeile (Gerät außerhalb jedes Raums), wird sie bei gesetztem Filter ausgeschlossen. Listenspezifisch: Stromkreise und KNX-Kanäle „Verteiler“ (alle oder einer), Durchbrüche „Art“, Geräte „nur nicht angeschlossene“.
- **Sortierung:** Klick auf einen Spaltenkopf sortiert aufsteigend, ein zweiter absteigend; stabil, Texte mit `localeCompare("de", { numeric: true })` (F2 vor F10), Zahlen numerisch, leere Werte am Ende. Ohne Klick gilt die Standardsortierung der Liste.
- **Zeilenklick** wählt das Objekt aus (Gerät, Stromkreis, Leitung, Durchbruchsegment; Materialzeilen nicht). Der Editor bleibt „Listen“; die Auswahl ist in den Eigenschaften und, nach Wechsel, in allen Ansichten markiert.
- **Zeilenmodell:** jede Liste liefert `Row { id, select?, storeyId?, roomId?, trade?, status?, cells: Record<Spalte, Cell> }` mit `Cell { text, sort: string | number | null }`. Dieselben Zeilen nutzt der PDF-Export.

### Die Listen im Einzelnen
- **Geräte:** alle Geräte außer Reiheneinbaugeräten. Spalten: Bezeichnung, Typ, Gewerk, Geschoss, Raum, Fläche (Name der Raumansicht wie im Baum, „Decke“, „Boden“, Name der Schräge, „frei“), Höhe (über OKFF bei Wandgeräten, sonst leer), Status, Anschluss im Verteiler. Standardsortierung Geschoss (nach Höhenlage), Raum, Bezeichnung.
- **Anschluss im Verteiler** (`connection.ts`), Einträge mit „; “ verbunden, in dieser Reihenfolge:
  1. Stromkreis: „<Verteiler> · <Stromkreis>“, mit Schutzgerät „<Verteiler> · <Stromkreis> (<Bezeichnung des Schutzgeräts>)“. Ohne Stromkreis, aber über Stromleitungen mit einem Verteiler verbunden (`feedingBoards`): „<Verteiler> · ohne Stromkreis“.
  2. KNX-Kanal: „<Verteiler des Aktors> · <Kanal>“ mit `channelLabel` (z. B. „UV OG · JA2.C“).
  3. Leitungen, deren anderer Endpunkt ein Verteiler ist und die nicht schon unter 1. zählen (Gewerk nicht Strom): „<Verteiler> · <Leitungstyp>“, z. B. „Medienverteiler · Cat 7“.
  Gibt es keinen Eintrag, steht „nicht angeschlossen“. Der Filter „nur nicht angeschlossene“ zeigt genau diese Zeilen.
- **Stromkreise:** Spalten Verteiler, Bezeichnung, Schutzgerät (Bezeichnung), Leitungstyp, Geräte (Anzahl), Räume (Namen der Räume der Geräte, alphabetisch, mit „, “). Standardsortierung Verteiler, Bezeichnung (numerisch). Kein Status-, Gewerk- und Raumfilter (der Raumfilter wirkt nicht, weil ein Kreis mehrere Räume hat; der Geschossfilter zeigt Kreise mit mindestens einem Gerät im Geschoss oder mit Verteiler im Geschoss).
- **KNX-Kanäle:** je Aktor (Reiheneinbaugerät mit `knx.provides`) je Kanal 1…n eine Zeile: Verteiler, Aktor, Kanal (`channelLabel`), Funktion (`KNX_FUNCTION_LABELS`), Verbraucher, Raum des Verbrauchers. Freie Kanäle haben Verbraucher „frei“. Standardsortierung Verteiler, Aktor (numerisch), Kanal. Unter der Tabelle: „<n> Zuordnungen, <m> freie Kanäle“.
- **Leitungen:** Spalten Bezeichnung, Typ, Von, Nach (`endpointLabel`), Stromkreis (`cableCircuit`), Länge in m mit einer Nachkommastelle (`cableLength`, ohne Weg „–“), Status. Standardsortierung Typ, Bezeichnung. Geschoss und Raum einer Leitung sind die ihrer Endpunkte: eine Leitung passt zum Filter, wenn einer ihrer Endpunkte passt (Verteiler: Geschoss der Wand, Raum des Abschnitts). Unter der Tabelle je Leitungstyp der gefilterten Zeilen: Anzahl, Gesamtlänge in m (eine Nachkommastelle) und „<k> ohne Weg“, wenn Leitungen ohne Länge dabei sind.
- **Durchbrüche:** alle Segmente `kind: penetration`. Spalten Geschoss, Raum, Bauteil, Lage, Art (Bohrung, Kernbohrung, Schlitz, Leerrohr), Durchmesser, Leitungen (Bezeichnungen der Leitungen, deren Weg das Segment enthält). Bauteil und Lage aus dem Knoten `a` des Segments: Wand → „Wand <Name der Raumansicht> (<Dicke> mm)“, Lage „<Abstand zur linken Raumecke> / <Höhe über OKFF>“ in mm; Decke/Boden → „Decke“ bzw. „Boden“, Lage „x <x> / y <y>“. Raum ist der des Abschnitts bzw. der Decke/des Bodens. Standardsortierung Geschoss, Raum, Art. Filter „Art“: alle oder eine Art.
- **Material** (`material.ts`), Abschnitte mit Zwischenüberschrift, jeweils über die gefilterten Objekte:
  1. Geräte je Typ: Typ, Gewerk, Anzahl (ohne Reiheneinbaugeräte).
  2. Unterputzdosen je Dosentiefe: jedes Gerät eines Typs mit `flush.boxDepthMm` auf einer Wand-, Decken- oder Schrägenfläche braucht eine Dose. Zeilen „Gerätedose <Tiefe> mm“ mit Anzahl. Dazu Kombinationen: Geräte mit Dose auf derselben Fläche, deren Mitten waagerecht (gleiches v ± 2 mm) oder senkrecht (gleiches u ± 2 mm) 71 mm ± 2 mm auseinanderliegen, bilden Ketten; eine Kette aus n ≥ 2 Geräten ist eine n-fach-Kombination. Zeilen „Kombination <n>-fach“ mit Anzahl. Die Dosenzahl bleibt eine Dose je Gerät.
  3. Leitungen je Typ: Typ, Anzahl, Gesamtlänge in m (mit Zuschlägen, wie in der Leitungsliste), ohne Weg gezählt wie dort.
  4. Leerrohre je Nenngröße: Segmente mit `conduit` je `size`, Summe der Segmentlängen in m (eine Nachkommastelle, ohne Zuschlag). Leitungen eines Leerrohr-Leitungstyps stehen unter 3.
  5. Reiheneinbaugeräte je Typ: Typ, Anzahl, TE gesamt.
  Gewerkfilter wirkt auf 1–4 über den Typ, Statusfilter auf Geräte, Leitungen und Segmente; Geschoss/Raum wie in den Einzellisten, bei Segmenten über ihre Fläche.

### Blattmodell
- Ein Blatt ist `Sheet { widthMm, heightMm, title: TitleBlock, items: Item[] }` in Papiermillimetern, Ursprung oben links, y nach unten (wie SVG). `Item` ist `line`, `polyline` (offen/geschlossen, Füllung, Strichstärke, Strichmuster), `circle`, `text` (x, y, Größe, Ausrichtung start/middle/end, Drehung, fett, Farbe) oder `symbol` (SVG-Fragment im Raster 100 × 100, Mitte, Kantenlänge, Drehung). Jedes Element darf ein `data`-Kennzeichen tragen (z. B. `dim-u:<id>`), damit Tests es finden.
- `svg.ts` macht daraus ein vollständiges SVG mit `width="<w>mm" height="<h>mm" viewBox="0 0 w h"`; Texte mit `font-family="Helvetica"`. `pdf.ts` fügt je Blatt eine Seite im Blattformat hinzu und zeichnet das SVG mit svg2pdf.js an (0, 0) in voller Größe.
- **Formate:** A4 (210 × 297) und A3 (297 × 420), hoch oder quer. Standard A3 quer, Maßstäbe 1:20, 1:25, 1:50, 1:100, Standard 1:50.
- **Rand und Plankopf:** Rand 10 mm (A4 links 20 mm Heftrand). Plankopf unten rechts, 180 × 36 mm (A4 hoch: volle Breite innerhalb des Rands × 36 mm). Zeilen: Projekt (Projektname), Planinhalt, Geschoss, Maßstab („1:50“, bei Belegung und Listen „ohne“), Datum (Exporttag, „22.11.2026“), Planstand (Freitext aus dem Dialog, Standard „Entwurf“), Planart („Bestandsplan“ oder „Planung“), Filter („alle Gewerke“ oder die gewählten). Die Zeichenfläche ist das Blatt ohne Rand und ohne einen Streifen von 40 mm über die volle Breite unten (Plankopf und Legende).
- **Legende:** links neben dem Plankopf im unteren Streifen, Einträge „Symbol 5 mm + Name des Typs“ in Spalten von 45 mm, genau die Gerätetypen, die auf dem Blatt gezeichnet sind, nach Name sortiert; dazu „Verteiler“ (Rechteck), wenn einer gezeichnet ist. Passen die Einträge nicht in den Streifen, wird die Legende nach dem letzten passenden Eintrag mit „… und <n> weitere“ abgeschlossen.
- **Maßstabsleiste** auf maßstäblichen Blättern über dem Plankopf: 0–1–2–5 m in Papiermaß.
- **Text:** Standard 2,5 mm, Raumname 3,5 mm, Kleinbeschriftung 1,8 mm, Plankopf-Titel 5 mm. `pdfText()` ersetzt Zeichen außerhalb von WinAnsi: „→“ → „->“, „≤“ → „<=“, „≥“ → „>=“, „′“ → „'“, „″“ → „"“, „…“ bleibt (WinAnsi), sonst „?“. Jeder Text eines Blatts läuft durch `pdfText()`.
- **Linien:** geschnittene Wände gefüllt dunkelgrau (#404040) mit 0,35 mm Kontur; Ansichtskanten 0,25 mm; Öffnungen 0,18 mm; Trassen 0,35 mm (Decke gestrichelt 2/1 mm wie in der App); Maßlinien 0,13 mm; Raster 0,1 mm (#c0c0c0) bzw. 0,25 mm (#909090).
- **Passprüfung:** Jedes maßstäbliche Blatt hat eine Inhaltsgröße (Ausdehnung der Zeichnung in mm × Maßstab plus Maßketten). Passt sie nicht in die Zeichenfläche, steht das Blatt in der Meldungsliste des Dialogs: „<Planinhalt> passt in 1:<m> nicht auf <Format> (braucht 1:<k>)“, wobei k der kleinste Maßstab aus 20, 25, 50, 100, 200 ist, der passt. Exportieren ist dann gesperrt, bis Maßstab oder Format geändert oder das Blatt abgewählt ist. Der Inhalt wird in der Zeichenfläche zentriert.

### Planinhalte
- **Filter:** Gewerke und Status aus dem Dialog gelten für Geräte, Trassensegmente (über ihren Status; Gewerk über die Leitungen darauf: ein Segment ohne Leitung ist gewerkfrei und folgt nur dem Status) und Leitungen (in Listen). Gebäude, Räume und Verteiler sind immer da. Möbel und Silhouetten werden nicht exportiert. **Bestandsplan:** genau „verlegt“ und „geprüft“ gewählt → Planart „Bestandsplan“, sonst „Planung“.
- **Grundriss je Geschoss:** Wände wie in der App (Wandkörper als gefüllte Polygone mit Gehrungen, `wallGeoms`), Öffnungen wie im Grundriss der App (weißes Rechteck über die Wanddicke, Fenster mit Mittellinie, Türen mit Diagonale), Raumgrenzen gestrichelt, Raumname mit fertiger Fläche („Bad 6,42 m²“) im Schwerpunkt, Verteiler als Rechteck (`boardPlanRect`) mit Bezeichnung, Geräte als Symbol mit 250 mm Weltkantenlänge an `planSymbol` (wie in der App), Stromkreis-Kurzname darunter, Boden- und Deckentrassen des Geschosses (Decke gestrichelt) und Durchbrüche als Kreis. Nordpfeil oben rechts in der Zeichenfläche. Planinhalt „Grundriss <Geschoss>“.
- **Wandansicht (Raumansicht):** fertige Kontur der Raumansicht, Öffnungen mit fertigen Laibungen, Geräte mit Frontrechteck und Symbol (maßstäblich wie in der App), Verteiler als Rechteck mit Bezeichnung, Trassen und Knoten der Fläche, OKFF-Linie mit „±0 OKFF“. **Maßketten (Bezugsbemaßung):** unter der Ansicht eine Maßlinie ab der linken fertigen Raumecke mit einem Strich je eindeutigem u aller Geräte, Verteiler und Trassenknoten der Ansicht; an jedem Strich senkrecht der Abstand in mm (`dim-u:<id>`). Links eine senkrechte Maßlinie ab OKFF mit einem Strich je eindeutigem v (Gerätemitte, Verteilermitte, Knoten) und der Höhe in mm (`dim-v:<id>`). Werte mit gleichem Maß (±1 mm) teilen einen Strich. Planinhalt „<Raum> › <Ansicht>“, z. B. „Bad › Wand Nord“. Wandseiten ohne Raum („Flächen ohne Raum“) wie in der App über die ganze Wandseite, bemaßt ab u = Konturanfang und Rohfußboden.
- **Decke, Boden, Schräge** je Raum: Kontur der Fläche in ihren (u, v), Geräte, Trassen, Durchbrüche; Maßketten wie bei Wänden ab der kleinsten u bzw. v der Kontur der Fläche (wie in der App: Decke und Boden im Rohbaupolygon). Planinhalt „<Raum> › Decke“ usw.
- **Verteilerbelegung** je Verteiler: Felder nebeneinander, Reihen, Geräte mit Bezeichnung und Typ wie in der Belegungsansicht (gleiche Kürzung nach M4 R.7), Zusammenfassung „TE gesamt/belegt/frei“, darunter die Stromkreise und KNX-Kanäle dieses Verteilers als Tabelle. Nicht maßstäblich: Breite einer TE = min(9 mm, Zeichenbreite / Summe der TE-Breiten aller Felder samt Abständen), Reihenhöhe 2,5 × TE-Breite; passt die Höhe nicht, wird beides gleichmäßig verkleinert. Planinhalt „Belegung <Verteiler>“.
- **Listen als Tabellenblätter:** dieselben Zeilen und Spalten wie in der App mit den Filtern des Dialogs (Gewerk, Status; alle Geschosse), Standardsortierung. Spaltenbreiten proportional zur längsten Zelle (geschätzt 0,5 × Schriftgröße je Zeichen), mindestens die Kopfbreite; zu lange Zellen werden mit „…“ gekürzt. Kopfzeile auf jeder Seite wiederholt, Summen (Leitungen, KNX) am Ende. Planinhalt „Liste <Name>“, Seitenzahl „Seite i/n“ im Plankopf.

### Exportdialog
- Knopf „Exportieren …“ in der Kopfzeile (neben den Projekteinstellungen) öffnet den Dialog „PDF exportieren“ mit:
  - **Inhalt:** Baum mit Kontrollkästchen: je Geschoss „Grundriss“ und je Raum „Wandansichten“, „Decke“, „Boden“ (und „Schrägen“, wenn vorhanden), dazu je Geschoss „Flächen ohne Raum“; je Verteiler „Belegung“; „Listen“ mit je einem Kästchen pro Liste. Ein Kästchen auf Geschossebene setzt alle darunter. Standard: Grundriss des aktiven Geschosses.
  - **Maßstab** (1:20, 1:25, 1:50, 1:100), **Format** (A4/A3, hoch/quer), **Planstand** (Text), **Gewerke** (Standard: der aktuelle Gewerkfilter der App), **Status** (Standard alle). Hinweis „Bestandsplan“, wenn nur verlegt und geprüft gewählt sind.
  - Meldungsliste der Passprüfung, Anzahl der Blätter, Knopf „Exportieren“.
- **Ergebnis:** eine PDF-Datei als Download (`<Projektname> <Datum>.pdf`, bei einem Blatt `<Projektname> <Planinhalt> <Datum>.pdf`; Zeichen außer Buchstaben, Ziffern, Leerzeichen, „-“, „_“ entfernt). Kein Schreiben in den Projektordner. Während des Erzeugens „Seite i von n …“; Fehler von svg2pdf.js erscheinen im Dialog.
- Blattreihenfolge: Grundrisse nach Geschoss (Höhenlage), dann je Geschoss die Räume (Name), je Raum Wandansichten (im Uhrzeigersinn ab Nord wie im Baum), Decke, Boden, Schrägen; dann Flächen ohne Raum; dann Belegungen (Verteilerbaum-Reihenfolge); dann Listen (Reihenfolge wie oben).

### Baustellen-PDF
- Knopf „Baustellen-PDF …“ neben „Exportieren …“ öffnet einen Dialog mit Raumauswahl (Baum Geschoss › Raum, Mehrfachauswahl) und Gewerk-/Statusfilter. Format immer A4.
- Je Raum je Raumansicht (Wandseite), Decke, Boden und Schräge eine Seite, Reihenfolge wie im Baum. Je Seite wird der größte Maßstab aus 1:20, 1:25, 1:50 gewählt, bei dem die Fläche samt Maßketten auf A4 hoch oder quer passt (hoch bevorzugt bei Gleichstand); die Seite bekommt die passende Ausrichtung. Passt auch 1:50 nicht, steht die Fläche in der Meldungsliste und der Export ist gesperrt. Der Maßstab steht im Plankopf, bei 1:25 und 1:50 zusätzlich groß neben der Zeichnung: „Maßstab 1:25 (nicht 1:20)“.
- **Raster:** über der Zeichenfläche der Fläche (fertige Kontur, ab linker Raumecke und OKFF) ein Raster in Flächenmaß: 100-mm-Linien fein, 1-m-Linien kräftig, an den Rändern mit „0,5 m“, „1 m“ … beschriftet. (Die Spec nennt „Millimeterraster“; ein Raster je Papiermillimeter wäre bei 1:20 zu dicht zum Schreiben. Entscheidung unten.)
- Inhalt wie die Wandansicht des Exports (Geräte, Trassen, Maßketten), Plankopf kleiner (A4: 36 mm hoch, volle Breite), ohne Legende. **Notizbereich:** der Rest der Zeichenfläche neben oder unter der Zeichnung, mindestens 40 mm, umrandet, Titel „Notizen“.
- **Seitenzuordnung:** jsPDF `addMetadata(json, "https://hausplaner.app/ns/site-pdf/1")` schreibt ein JSON in die XMP-Metadaten (jsPDF verpackt es als `<jspdf:metadata>`, entity-kodiert). Inhalt: `{ "format": "hausplaner-site-pdf", "version": 1, "project": <Name>, "exportedAt": <ISO-Zeit>, "pages": [{ "page": 1, "surface": <SurfaceRef>, "roomId": <id|null>, "view": <Planinhalt>, "scale": 20, "originMm": [x0, y0], "uRange": [u0, u1] }] }`. Umrechnung: Seitenpunkt (x, y) in mm ab oben links → `u = u0 + (x − x0) · scale`, `v = (y0 − y) · scale` (v ab OKFF bzw. Rohfußboden wie in der Fläche; bei Decke/Boden/Schräge v in ihren Flächenkoordinaten). `mapping.ts` hat `siteMapping(...)`, `pageToSurface(mapping, page, x, y)` und `parseSiteMapping(xmpRaw)` (findet `jspdf:metadata` mit diesem Namensraum, entschlüsselt die Entities, prüft `format` und `version` mit zod). Gelesen wird in der App mit pdf.js `getMetadata().metadata.getRaw()`.

### Tests und Fixtures
- Fixture: `tests/fixtures/m4` reicht für Listen und Pläne (EG mit Küche, Wohnen, Bad, Schlafen; OG mit Kind; Verteiler, Stromkreise, KNX, Durchbrüche 40 mm und Kernbohrung 65 mm). Szenarien mit größeren Zahlen (40 Leitungen, 16-fach-Aktor mit 11 belegten Kanälen, 85 Unterputzgeräte) bauen die Tests über Store-Befehle auf der Fixture auf.
- Unit-Tests (rein): jede Liste, Filter, Sortierung, Anschluss im Verteiler, Material mit Kombinationen; Blätter: Maßstab (5 m Wand → 100 mm bei 1:50), Passprüfung, Legende, Maßketten, Bestandsplan, Auswahl → Blattliste, Baustellenmaßstab, Seitenzuordnung (Rundreise über XMP-Text, wie jsPDF ihn schreibt), `pdfText`.
- Komponententests: Listen-Editor (Filter, Sortieren, Zeilenklick), Exportdialog (Auswahl, Passmeldung sperrt, Bestandsplan-Hinweis).
- Playwright (alle drei Browser): Export Grundriss EG 1:50 A3 quer → Download, in Node mit pdf.js gelesen: Seitengröße 1190,55 × 841,89 pt, Text durchsuchbar (Raumnamen, Plankopf), keine Bild-Objekte; Baustellen-PDF für Bad → Seitenzahl, Seitenzuordnung mit `parseSiteMapping` aus den Metadaten; Listen-Editor mit Filter.

## Risks / Trade-offs

- [svg2pdf.js ist nur im Browser prüfbar] → Blätter sind rein und unit-getestet; der PDF-Schritt ist dünn und wird in Playwright in Chromium, Firefox und WebKit geprüft. Safari des Benutzers ist älter als Playwright-WebKit: beide Bibliotheken wurden auf sehr neue APIs durchsucht (keine Treffer); nach der Umsetzung prüft der Benutzer in Safari.
- [Standardschriften nur WinAnsi] → `pdfText` ersetzt bekannte Zeichen; Umlaute, „ß“, „×“, „·“, „–“, „„ “ sind enthalten. Eigene Schriften wären mehrere 100 kB groß.
- [Maßketten können sich bei dichten Geräten überdecken] → senkrecht gesetzte Werte mit 1,8 mm Schrift; 71-mm-Kombinationen liegen bei 1:20 3,55 mm auseinander und bleiben lesbar, bei 1:50 (1,42 mm) nicht. Baustellen-PDF bevorzugt 1:20.
- [1:20 auf A4 ist eng] → mit Maßketten (22 mm), Überschrift und Notizbereich (40 mm) passt eine Fläche in 1:20 hoch bis etwa 3,1 × 3,2 m, quer bis etwa 4,0 × 2,4 m; größere Flächen kommen in 1:25 bzw. 1:50 mit Hinweis auf der Seite. Prüfung durch den Benutzer in 8.2.
- [Große PDFs] → ein Haus mit 40 Räumen ergibt rund 200 Seiten; svg2pdf.js braucht dafür einige Sekunden. Fortschrittsanzeige, kein Abbruch nötig.

## Entscheidungen bei der Ausarbeitung (2026-11-22, zur Prüfung durch den Benutzer)

Die Specs ließen diese Punkte offen. Claude hat sie ohne Rückfrage festgelegt, weil der Benutzer weiterarbeiten lassen wollte. Sie lassen sich vor dem Ende der Umsetzung noch ändern:
1. Exporteinstellungen (Maßstab, Format, Planstand, Filter) im Browser, nicht in den Projektdateien; keine Schemaänderung.
2. PDF als Download, nicht im Projektordner.
3. Raster der Baustellen-PDF in Flächenmaß (100 mm fein, 1 m kräftig) statt Papiermillimetern.
4. Passt ein Plan nicht, sperrt der Dialog den Export und nennt den nötigen Maßstab; kein automatisches Verkleinern (außer in der Baustellen-PDF, wo die Spec es vorgibt).
5. Material: eine Dose je Unterputzgerät; Kombinationen (71-mm-Ketten) werden zusätzlich gezählt. Leerrohre je Nenngröße aus den Trassensegmenten.
6. Anschluss im Verteiler zeigt Stromkreis, KNX-Kanal und direkte Leitungen zu Verteilern; durchgeschleifte Stromgeräte ohne Kreis als „<Verteiler> · ohne Stromkreis“.
7. Listen-Editor als fünfter Tab; Listen im PDF mit den Filtern des Dialogs.
8. Wandseiten ohne Raum nur über „Flächen ohne Raum“ je Geschoss exportierbar, nicht in der Baustellen-PDF.

## Open Questions

- Keine.
