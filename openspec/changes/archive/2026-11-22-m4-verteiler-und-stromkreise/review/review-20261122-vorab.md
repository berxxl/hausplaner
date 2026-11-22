# Review m4-verteiler-und-stromkreise

- Modus: vor der Umsetzung (Konsistenz, Lücken, Umsetzbarkeit)
- Datum: 2026-11-22
- Stand: design.md und tasks.md (Entwurf), Specs aus dem Proposal, Deltas `cables` und `cable-routes` aus m3, neue Deltas `workspace` und `device-catalog`
- Hinweis: Der Skill `/openspec-review` war nicht verfügbar. Den Review hat Claude von Hand nach dem Schema der m1–m3-Reviews erstellt, ohne getrennte Prüfer-Agenten.
- `openspec validate m4-verteiler-und-stromkreise --strict`: gültig nach den Korrekturen.

## Stage 1: Konsistenz mit den archivierten Specs
Verdict: PASS nach Korrekturen

### Findings
- [R1] [MAJOR] workspace:„Gemeinsame Auswahl“ zählt die auswählbaren Objekte abschließend auf. Verteiler und Stromkreise fehlten, ebenso die Mehrfachauswahl über Flächen, die „Alle Rollläden im OG“ braucht. Behoben: MODIFIED-Delta mit Scenario „Geräte verschiedener Wände“; Task 3.3.
- [R2] [MAJOR] workspace:„Aufbau der Oberfläche“ nennt nur Grundriss, Flächenansicht und 3D. Die Belegungsansicht ist ein vierter Editor. Behoben: MODIFIED-Delta mit Scenario „Belegung öffnen“; Task 2.4.
- [R3] [MAJOR] workspace:„Strukturbaum“ kennt keine Verteiler. Die Spec `distribution-boards` verlangt aber „im Strukturbaum unter ‚Verteiler‘“ und die Hierarchie im Baum. Behoben: MODIFIED-Delta mit Scenario „Stromkreis im Baum“; Tasks 2.3, 2.5, 4.4.
- [R4] [MINOR] workspace:„Gewerkfilter“, Scenario „Nur KNX“ zeigt „nur Gebäude, Trassen und KNX-Geräte“. Verteiler haben kein Gewerk. Behoben: Verteiler bleiben wie das Gebäude sichtbar, Scenario angepasst; Task 6.3.
- [R5] [MINOR] workspace:„Projekteinstellungen“ nennt nur Name und Nordrichtung. Zuschläge (M3) und jetzt Reserven und KNX-Linien fehlten. Behoben: MODIFIED-Delta mit Scenario „TE-Reserve ändern“; Tasks 5.6, 6.2.
- [R6] [MINOR] device-catalog:„Katalog im Projekt“: Die Specs setzen einen 16-fach-Schaltaktor, Patchfeld, Switch, Netzteile und NYM-J 5×10 voraus, die der Standardkatalog nicht hat. Bestehende Projekte bekämen sie nie. Behoben: neue Standardtypen, Migration ergänzt fehlende IDs, Scenario „Projekt aus M3“; Task 1.5.

## Stage 2: Konsistenz Design ↔ Specs ↔ Architektur
Verdict: PASS nach Korrekturen

### Findings
- [R7] [MAJOR] circuits:„Geräte zuordnen“ verlangt, dass Leitungen mit Endpunkten im Stromkreis ihm „ebenfalls zugeordnet werden“. docs/architektur.md speichert `Cable.circuitId`, das widerspricht „Abgeleitetes wird nicht gespeichert“ und erlaubt Widersprüche zwischen Gerät und Leitung. Entschieden in design.md: Die Zugehörigkeit wird abgeleitet; `Cable.circuitId` entfällt (Task 1.6). Steht unter „Entscheidungen bei der Ausarbeitung“ zur Prüfung durch den Benutzer.
- [R8] [MAJOR] Fixture vs. Specs: „Küchenkreis“ und „Busleitung zum Präsenzmelder“ nennen die UV EG, der Fixture-Entwurf hatte im EG nur Zählerschrank und Medienverteiler. Behoben: Die Fixture enthält eine UV EG.
- [R9] [MINOR] distribution-boards:„Felder und Reihen“ vs. Grundsatz „Listen sortiert nach ID“: Die Felder haben eine räumliche Reihenfolge. Behoben: Ausnahme in design.md „Dateiformat M4“ (Benutzerreihenfolge, links nach rechts).
- [R10] [MINOR] distribution-boards:„Reserve prüfen“ lässt offen, welche Felder zählen und was vorgemerkt wird. Festgelegt: nur Verteilerfelder; vorgemerkt sind 1 LS je Stromkreis ohne Schutzgerät plus der Aktorvorschlag. Steht ebenfalls unter „Entscheidungen bei der Ausarbeitung“.
- [R11] [MINOR] knx-planning:„Kanalbedarf zählen“ ordnet Verbraucher über die Leistungsleitung zu. Ohne Leitung wären frisch geplante Verbraucher keinem Verteiler zugeordnet. design.md ergänzt den Stromkreis als Ersatz; das widerspricht dem Scenario nicht.
- [R12] [MINOR] distribution-boards:„Verteilerhierarchie“: Wie die Zuleitung mit dem Verteiler verbunden ist, war offen. Festgelegt: `Board.feedCableId` (docs/architektur.md, Task 1.6), die Zuleitung ist eine gewöhnliche Leitung zwischen zwei Verteilern.
- [R13] [INFO] Die Deltas `cables` und `cable-routes` aus m3 passen zum archivierten Stand von m3 (MODIFIED auf „Trassen zeichnen“, „Leitung anlegen“, „Leitungslänge“; ADDED „Mehrere Leitungen gleichzeitig“).

## Stage 3: Umsetzbarkeit und Testbarkeit
Verdict: PASS

### Findings
- [R14] [INFO] Jedes Scenario der Deltas ist in tasks.md genannt. Ausnahme sind unveränderte Szenarien in MODIFIED-Requirements; sie sind durch die Tests von m1–m3 abgedeckt.
- [R15] [INFO] Risiko Umfang: m4 ist der größte Meilenstein (Belegungsansicht, Stromkreise, KNX). Die Abschnitte sind so geschnitten, dass nach jedem ein lauffähiger Stand entsteht und lokal vollständig geprüft wird (CI erst ab 2026-12-01).
- [R16] [INFO] Neue Warnungen (`device-without-circuit`, `knx-without-channel`) erzeugen in banatstrasse10 viele Einträge. Das ist gewollt und übergehbar; Task 7.2 prüft die Übersicht im echten Projekt.
