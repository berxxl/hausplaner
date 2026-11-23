# Review m5-plan-export

- Modus: vor der Umsetzung (Konsistenz, Lücken, Umsetzbarkeit)
- Datum: 2026-11-22
- Stand: design.md und tasks.md (Entwurf), Deltas `reports` (mit „Geräteliste“ aus M4 7.2) und `plan-export` aus dem Proposal, neues Delta `workspace`
- Hinweis: Der Skill `/openspec-review` war nicht verfügbar. Den Review hat Claude von Hand nach dem Schema der m1–m4-Reviews erstellt, ohne getrennte Prüfer-Agenten.
- `openspec validate m5-plan-export --strict`: gültig nach den Korrekturen.

## Stage 1: Konsistenz mit den archivierten Specs
Verdict: PASS nach Korrekturen

### Findings
- [R1] [MAJOR] workspace:„Aufbau der Oberfläche“ zählt die Editoren abschließend auf (Grundriss, Flächenansicht, 3D, Belegung). Die Listen sind ein weiterer Editor, und die Geräteliste verlangt Auswahl per Zeilenklick. Behoben: MODIFIED-Delta mit Scenario „Gerät aus der Liste auswählen“; Tasks 1.2, 3.1.
- [R2] [MINOR] workspace:„Gewerkfilter“ gilt für Grundriss, Flächenansichten und 3D. Der Export hat einen eigenen Gewerk- und Statusfilter (plan-export:„Gewerk- und Statusfilter“), der mit dem App-Filter vorbelegt wird. Kein Widerspruch; in design.md „Exportdialog“ festgehalten.
- [R3] [INFO] Durchbrüche, Leerrohre und Längen (cable-routes, cables), Stromkreise und KNX-Kanäle (circuits, knx-planning) liefern alle Werte, die die Listen brauchen; keine Modelländerung nötig.

## Stage 2: Konsistenz Design ↔ Specs ↔ Architektur
Verdict: PASS nach Korrekturen

### Findings
- [R4] [MAJOR] docs/architektur.md nennt `settings.defaultPlotScale: 50`, das Proposal sagt „keine Änderung am Datenmodell“, das Schema kennt das Feld nicht. Entschieden: Exporteinstellungen sind Ansichtszustand (`localStorage`), das Feld wird in docs/architektur.md gestrichen (Task 1.1). Steht unter „Entscheidungen bei der Ausarbeitung“.
- [R5] [MAJOR] plan-export:„Baustellen-PDF“ verlangte ein „Millimeterraster“. Ein Raster je Papiermillimeter ist bei 1:20 zum Beschreiben zu dicht und hat keinen Bezug zum Wandmaß. Geändert im Delta: Raster in Flächenmaß (100 mm fein, 1 m kräftig); unter „Entscheidungen bei der Ausarbeitung“ zur Prüfung durch den Benutzer.
- [R6] [MINOR] reports:„Filter und Sortierung“ sagt „jede Liste nach Geschoss, Raum, Gewerk und Status“. Stromkreise haben keinen Status und meist mehrere Räume, KNX-Kanäle kein Gewerk. design.md legt fest: fehlende Werte schließen nicht aus, der Raumfilter wirkt bei Stromkreisen nicht. Das schwächt die Spec nicht, weil die Filter dort keinen Sinn hätten.
- [R7] [MINOR] reports:„Materialliste“: „Leerrohre je Nenngröße“ war doppeldeutig (Leitungen vom Typ Leerrohr oder Leerrohr auf Trassensegmenten). Festgelegt: Segmente mit `conduit` je Größe; Leerrohr-Leitungen stehen unter „Leitungen je Typ“. „Dreifachkombination“ ist im Modell nicht gespeichert; festgelegt: Ketten im 71-mm-Raster werden erkannt, Dosen zählen je Gerät.
- [R8] [MINOR] Modulschnitt: docs/architektur.md nennt `views/…`, der Code nutzt seit M1 `ui/…`. Wird mit `reports/` angeglichen (Task 1.1).
- [R9] [MINOR] Seitenzuordnung (plan-export): Wo und wie sie in der PDF steht, war offen. Festgelegt: JSON in den XMP-Metadaten über jsPDF `addMetadata`, gelesen mit pdf.js; Probelauf bestätigt, dass pdf.js es in Node und im Browser liest.
- [R10] [INFO] Die neue Requirement „Geräteliste“ (Wunsch aus M4 7.2) braucht `feedingBoards`, `cableCircuit`, `channelLabel` und `endpointLabel` aus M3/M4, alle vorhanden.

## Stage 3: Umsetzbarkeit und Testbarkeit
Verdict: PASS

### Findings
- [R11] [MAJOR] svg2pdf.js läuft nicht unter jsdom (`getBBox`). Ohne Gegenmaßnahme wären Blätter nur in Playwright testbar. Behoben im Design: Blätter sind ein reines Modell (`Sheet`/`Item`) mit eigenen Unit-Tests; nur `export/pdf.ts` nutzt jsPDF und svg2pdf.js, geprüft in Playwright in allen drei Browsern.
- [R12] [INFO] Jedes Scenario der Deltas ist in tasks.md genannt. „Bad OG“ (Spec) prüfen die Tests mit dem Bad der Fixture im EG; geprüft wird dasselbe Verhalten. „Fläche über Baum öffnen“ und „Belegung öffnen“ stehen nur im MODIFIED-Block und sind durch die Tests von M1/M4 abgedeckt.
- [R13] [INFO] Szenarien mit großen Mengen (40 Leitungen, 85 Unterputzgeräte, 16-fach-Aktor) bauen die Tests über Store-Befehle auf der Fixture `m4`; eine neue Fixture ist nicht nötig.
- [R14] [INFO] Maßhaltigkeit wird zweistufig geprüft: im Blattmodell (5 m → 100 mm bei 1:50) und in der heruntergeladenen PDF (Seitengröße, Lage einer Beschriftung in pt). Den Ausdruck prüft der Benutzer in 8.2.
