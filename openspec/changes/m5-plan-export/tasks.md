# Tasks

## 1. Grundlagen

- [x] 1.1 Abhängigkeiten jsPDF und svg2pdf.js (auf sehr neue JS-APIs geprüft, design.md „Risks“); Modulgerüst `src/reports/`, `src/export/`; `docs/architektur.md`: Modulschnitt (`reports/`, `ui/` statt `views/`), `settings.defaultPlotScale` streichen, PDF-Export-Abschnitt mit Verweis auf dieses Design
- [x] 1.2 Editor „Listen“ als fünfter Tab (`EditorKind` `"lists"`), leere Ansicht mit Listenauswahl; Exporteinstellungen im `localStorage` `hausplaner.export` mit Standardwerten (1:50, A3 quer, Planstand „Entwurf“)

## 2. Listen (rein)

- [x] 2.1 `reports/filter.ts`: Zeilenmodell, Filter (Geschoss, Raum, Gewerk, Status; fehlende Werte schließen nicht aus), Sortierung (numerisch, deutsch, leere am Ende, stabil); Unit-Tests: Status „verlegt“ lässt nur verlegte Leitungen (Spec-Scenario „Nur Verlegtes“), F2 vor F10, absteigend
- [x] 2.2 `reports/connection.ts` und Geräteliste; Unit-Tests: Steckdose „Bad EG Waschtisch“ an „F7 Bad EG“ mit LS „F7“ in der UV EG zeigt „UV EG · F7 Bad EG (F7)“ (Spec-Scenario „Steckdose im Bad“), Rollladen an JA2.C zeigt „UV OG · JA2.C“ und seinen Stromkreis (Spec-Scenario „Rollladen am Aktor“), Netzwerkdose ohne Leitung „nicht angeschlossen“ und Filter (Spec-Scenario „Nicht angeschlossen“), Netzwerkdose mit Cat 7 zum Medienverteiler, durchgeschleifte Dose ohne Kreis, Reiheneinbaugeräte fehlen
- [x] 2.3 Stromkreisliste und KNX-Kanalliste; Unit-Tests: alle Kreise der UV EG nach Bezeichnung (Spec-Scenario „Liste UV EG“), 16-fach-Aktor mit 11 Zuordnungen zeigt 11 Zuordnungen und 5 freie Kanäle (Spec-Scenario „Freie Kanäle“), Räume und Geräteanzahl
- [x] 2.4 Leitungsliste mit Summen je Typ und Durchbruchsliste; Unit-Tests: 40 Leitungen NYM-J 3×1,5 ergeben deren Gesamtlänge in m (Spec-Scenario „Summe NYM-J 3×1,5“), „ohne Weg“, Filter über Endpunkte; nur Kernbohrungen mit Durchmesser und Lage (Spec-Scenario „Liste für Kernbohrer“), Bauteil und Lage für Wand und Decke, Leitungen durch den Durchbruch
- [x] 2.5 `reports/material.ts`; Unit-Tests: 85 Unterputzgeräte, davon 6 in zwei Dreifachkombinationen, ergeben Geräte je Typ, 85 Dosen je Tiefe und „Kombination 3-fach: 2“ (Spec-Scenario „Dosen zählen“), Leitungen je Typ, Leerrohre je Nenngröße aus Segmenten, Reiheneinbaugeräte mit TE

## 3. Listen in der Oberfläche

- [x] 3.1 `ui/lists/ListsView.tsx`: Listenauswahl, Filterleiste mit listenspezifischen Filtern, Tabelle mit sortierbaren Spaltenköpfen, Summen, Zeilenklick wählt aus; Komponententests: Zeile „Rollladen Bad“ anklicken wählt das Gerät (Spec-Scenario „Gerät aus der Liste auswählen“), Spaltenkopf sortiert auf- und absteigend, Filter „nur nicht angeschlossene“, Statusfilter in der Leitungsliste, Materialliste ohne Zeilenauswahl

## 4. Blattaufbau

- [x] 4.1 `export/sheet.ts` und `export/svg.ts`: Blattmodell, Formate, Rand, Zeichenfläche, Plankopf (Projekt, Planinhalt, Geschoss, Maßstab, Datum, Planstand, Planart, Filter), Maßstabsleiste, Legende mit Überlauf, `pdfText`, Passprüfung mit nötigem Maßstab; Unit-Tests: Zeichenfläche A3 quer und A4 hoch, Plankopf-Texte, `pdfText` ersetzt „→“ und behält Umlaute, Passprüfung meldet „passt in 1:50 nicht auf A3 quer (braucht 1:100)“, SVG hat Breite/Höhe in mm und viewBox

## 5. Planinhalte

- [x] 5.1 `export/plan.ts` Grundriss: Wände, Öffnungen mit Türanschlag, Raumgrenzen, Raumname mit Fläche, Verteiler, Geräte mit Symbol und Kurzname, Trassen, Durchbrüche, Nordpfeil; Gewerk- und Statusfilter, Bestandsplan; Unit-Tests: 5 m Wand misst bei 1:50 100 mm (Spec-Scenario „Maßhaltig drucken“), Legende enthält genau Steckdose, Schalter, Präsenzmelder (Spec-Scenario „Legende“), nur verlegt und geprüft → Plankopf „Bestandsplan“, geplante Geräte fehlen (Spec-Scenario „Bestandsplan“), „Nur KNX“ blendet Strom aus, Verteiler bleiben
- [x] 5.2 `export/surface.ts` Raumansicht, Decke, Boden, Schräge, Flächen ohne Raum mit Maßketten (u ab linker Raumecke, v ab OKFF), gemeinsame Striche bei gleichem Maß; Unit-Tests: drei Steckdosen je mit Abstand zur Ecke und Höhe über OKFF (Spec-Scenario „Dose bemaßt“), Trassenknoten bemaßt, Decke ab kleinster u/v
- [x] 5.3 `export/board.ts` Belegung (Felder, Reihen, Geräte, Zusammenfassung, Stromkreise und KNX-Kanäle des Verteilers) und `export/table.ts` Listen als Tabellenblätter (Spaltenbreiten, Kürzen, Kopf je Seite, Summen, Seitenzahl); Unit-Tests: Belegung der UV EG passt aufs Blatt, Leitungsliste mit 120 Zeilen ergibt mehrere Seiten mit Kopf, Summenzeile auf der letzten
- [x] 5.4 `export/selection.ts`: Auswahl → Blattliste in der festgelegten Reihenfolge; Unit-Test: „Bad, alle Wandansichten“ ergibt je Wandseite des Bads ein Blatt (Spec-Scenario „Alle Wände eines Raums“), Geschosskästchen setzt alle Räume

## 6. PDF und Exportdialog

- [x] 6.1 `export/pdf.ts` (jsPDF, svg2pdf.js, eine Seite je Blatt, Download mit Dateiname); `ui/export/ExportDialog.tsx` mit Inhaltsbaum, Maßstab, Format, Planstand, Gewerken, Status, Bestandsplan-Hinweis, Passmeldungen, Fortschritt; Knopf „Exportieren …“ in der Kopfzeile; Komponententests: Passmeldung sperrt „Exportieren“, Bestandsplan-Hinweis, Standardauswahl Grundriss des aktiven Geschosses
- [x] 6.2 Playwright: Grundriss EG 1:50 A3 quer exportieren, PDF mit pdf.js lesen: Seitengröße A3 quer, Raumnamen und Plankopf als Text (Spec-Scenario „Zoomen im PDF“: Vektor und Text, keine Bilder), Lage einer bekannten Beschriftung in Papiermaß; Export mehrerer Inhalte ergibt die erwartete Seitenzahl

## 7. Baustellen-PDF

- [ ] 7.1 `export/site.ts`: Seiten je Raumansicht, Decke, Boden, Schräge; Maßstabswahl 1:20/1:25/1:50 mit Ausrichtung; Raster in Flächenmaß; Notizbereich; Maßstabshinweis; Unit-Tests: Bad ergibt je Wandseite, Decke und Boden eine Seite mit Raster und Bemaßung (Spec-Scenario „Bad für die Baustelle“), zu lange Wand ergibt 1:25 bzw. 1:50 mit Angabe (Spec-Scenario „Wand zu groß für 1:20“)
- [ ] 7.2 `export/mapping.ts`: Seitenzuordnung erzeugen, in XMP schreiben, `parseSiteMapping`, `pageToSurface`; Unit-Tests: Rundreise über den XMP-Text, wie jsPDF ihn schreibt, Umrechnung eines Seitenpunkts in (u, v) (Spec-Scenario „Zuordnung lesbar“); `ui/export/SiteExportDialog.tsx` und Knopf „Baustellen-PDF …“; Playwright: Baustellen-PDF für das Bad herunterladen, Seitenzahl, Zuordnung mit pdf.js aus den Metadaten gelesen

## 8. Integration

- [ ] 8.1 Playwright-Ablauf: Listen öffnen, filtern, Zeile auswählen; Export mit Wandansichten, Belegung und Leitungsliste; Baustellen-PDF; alle drei Browser
- [ ] 8.2 Manuell: banatstrasse10 Grundriss EG in 1:50 auf A3 drucken und eine Wand nachmessen, Wandansichten eines Raums und Baustellen-PDF prüfen, Listen durchsehen (in Safari); Befunde als Folge-Tasks

## Workflow follow-up

- Vor der Umsetzung: Review von design.md, Specs und Tasks (von Hand nach dem Schema der m1–m4-Reviews, da `/openspec-review` nicht installiert ist)
- Nach Abschluss: Drift-Review, Change archivieren, danach `m6-kaeltemittel-und-licht` vervollständigen
