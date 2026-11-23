# Review m6-kaeltemittel-und-licht

- Modus: vor der Umsetzung (Konsistenz, Lücken, Umsetzbarkeit)
- Datum: 2026-11-23
- Stand: design.md und tasks.md (Entwurf), Deltas `refrigerant-rules` und `lighting-3d` aus dem Proposal, neues Delta `device-catalog`
- Hinweis: Der Skill `/openspec-review` war nicht verfügbar. Den Review hat Claude von Hand nach dem Schema der m1–m5-Reviews erstellt, ohne getrennte Prüfer-Agenten.
- `openspec validate m6-kaeltemittel-und-licht --strict`: gültig nach den Korrekturen.

## Stage 1: Konsistenz mit den archivierten Specs
Verdict: PASS nach Korrekturen

### Findings
- [R1] [MAJOR] device-catalog:„Katalog im Projekt“ verbietet der Migration, vorhandene Typen zu ändern. Der erste Entwurf setzte `refrigerant.unit` an vorhandenen Klimageräten und strich die Längen am Innengerät. Behoben: `unit` ist optional und wird ohne Feld abgeleitet (Innengerät, wenn es Kondensat anschließt); die Migration hängt nur neue Typen an. MODIFIED-Delta `device-catalog` mit Scenario „Projekt aus M5“ und erweitertem „Standardkatalog“; Task 1.1.
- [R2] [MINOR] refrigerant-rules:„Klimaverbindung“ verlangt einen Ablaufpunkt; Leitungen enden nur an Geräten oder Verteilern (cables). Festgelegt: neuer Gerätetyp „Kondensatablauf“; keine Änderung an Endpunkten.
- [R3] [INFO] workspace:„Gewerkfilter“ gilt auch in 3D; ausgeblendete Leuchten leuchten nicht. Kein Widerspruch zu lighting-3d.
- [R4] [INFO] project-storage:„Aufteilung auf Dateien“ erlaubt spätere Dateien; `ansichten.yaml` folgt den Regeln von `leitungen.yaml` (nur mit Inhalt).

## Stage 2: Konsistenz Design ↔ Specs ↔ Architektur
Verdict: PASS nach Korrekturen

### Findings
- [R5] [MAJOR] Die Specs lassen offen, ob die Klimaverbindung ein eigenes Objekt ist. Ein gespeichertes Objekt würde Leitungsdaten doppeln (CLAUDE.md: abgeleitete Werte nie speichern). Festgelegt: abgeleitet aus Kältemittel- und Kondensatleitungen.
- [R6] [MAJOR] lighting-3d:„Kamerapositionen“ sagt nicht, wo sie liegen. Entschieden: im Projekt (`ansichten.yaml`), weil sie für Abstimmungen über Git geteilt werden; Schemaversion 5. docs/architektur.md wird in Task 1.2 ergänzt.
- [R7] [MINOR] refrigerant-rules:„Kältemittel-Leitungslänge“: welche Länge geprüft wird, war offen. Festgelegt: die angezeigte Länge mit Zuschlägen und Verschnitt (eher zu früh gewarnt).
- [R8] [MINOR] refrigerant-rules:„Kondensatgefälle“: Fließrichtung, Toleranz und Durchbrüche waren offen. Festgelegt in design.md „Kondensatgefälle“.
- [R9] [MINOR] Das Proposal nennt die Dämmschicht als offenen Punkt. Sie gehört zu keinem Requirement der Deltas und berührt Wandgeometrie, Flächen, Export und 3D. Entschieden: nicht in M6, „Entscheidungen bei der Ausarbeitung“ 9; Proposal angepasst.
- [R10] [INFO] Lichtangaben (`light`) und Kältemittelgrenzen (`refrigerant`) stehen seit M2 im Katalog und im Katalogdialog; die Spec „Gerätetyp-Eigenschaften“ deckt sie ab.

## Stage 3: Umsetzbarkeit und Testbarkeit
Verdict: PASS

### Findings
- [R11] [MAJOR] Viele Lichtquellen in three.js sprengen Shader-Grenzen und Bildrate. Behoben im Design: höchstens 32, Schatten optional, Hinweis bei Überschreitung; Unit-Test der Grenze.
- [R12] [MINOR] Lichtwirkung lässt sich unter jsdom nicht prüfen. `sceneLights` ist rein und unit-getestet (Kegel, Farbe, Schalten); in Playwright nur grobe Helligkeitsvergleiche aus dem gespeicherten PNG, keine Referenzbilder (Software-Rendering weicht ab).
- [R13] [INFO] „Spotreihe“ nennt den Flur; die Fixture hat keinen Flur. Geprüft wird dasselbe Verhalten mit vier Spots in Wohnen.
- [R14] [INFO] Jedes Scenario der Deltas ist in tasks.md genannt; „Projekt aus M1“ und „Projekt aus M3“ stehen nur im MODIFIED-Block und sind durch M2/M4 getestet.
- [R15] [INFO] Frei platzierte Außengeräte haben keinen Trassenknoten; ihre Leitung bleibt ohne Weg und ohne Längenprüfung. In design.md „Risks“ mit Hinweis in den Eigenschaften.
