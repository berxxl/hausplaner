# Review m3-trassen-und-leitungen

- Modus: vor der Umsetzung (Konsistenz, Lücken, Umsetzbarkeit)
- Datum: 2026-11-22
- Stand: design.md und tasks.md (Entwurf), Specs mit der Entscheidung vom 2026-11-22 (Verteiler erst in m4)
- Hinweis: Der Skill `/openspec-review` war nicht verfügbar. Den Review hat Claude von Hand nach dem Schema der m1/m2-Reviews erstellt, ohne getrennte Prüfer-Agenten.
- `openspec validate m3-trassen-und-leitungen --strict`: gültig nach den Korrekturen.

## Stage 1: Konsistenz mit den archivierten Specs
Verdict: PASS nach Korrekturen

### Findings
- [R1] [MAJOR] workspace:„Gemeinsame Auswahl“ zählt die auswählbaren Objekte abschließend auf; Trassenknoten, Segmente und Leitungen fehlen, ebenso die Mehrfachauswahl von Segmenten. Behoben: MODIFIED-Delta in `specs/workspace/spec.md` mit Scenario „Mehrere Segmente verlegt“; Task 3.4.
- [R2] [MAJOR] workspace:„Gewerkfilter“ kennt nur Gewerke und Möbel. Trassen haben kein Gewerk. Behoben: Kategorie „Trassen“, Leitungen folgen dem Gewerk ihres Typs; Scenario „Nur KNX“ zeigt Trassen weiter; neues Scenario „Trassen ausblenden“; Task 4.3.
- [R3] [INFO] device-catalog:„Katalog bearbeiten“ verbietet bereits das Löschen verwendeter Typen; mit M3 gilt das auch für Leitungstypen (design.md „Warnungen“, Task 5.2). Kein Delta nötig.
- [R4] [INFO] project-storage:„Aufteilung auf Dateien“ sieht weitere Dateien späterer Meilensteine vor; `leitungen.yaml` braucht kein Delta.

## Stage 2: Konsistenz Design ↔ Specs ↔ Architektur
Verdict: PASS nach Korrekturen

### Findings
- [R5] [MAJOR] Specs ↔ Meilensteinplan: Die m3-Specs setzten Verteiler als Endpunkte voraus (UV EG, „Leitung zu UV OG“, Verteilerzuschlag), Verteiler kommen aber erst mit m4. Vom Benutzer entschieden am 2026-11-22: Verteiler erst in m4. Behoben: m3-Specs auf Geräte als Endpunkte umgestellt (Längenbeispiel jetzt (8,4 + 0,3 + 0,3) × 1,1 = 9,9 m), Requirement „Mehrere Leitungen gleichzeitig“ und die Verteiler-Fassungen als Deltas nach `m4-verteiler-und-stromkreise/specs/cables` und `…/cable-routes` verschoben; Proposals von m3 und m4 ergänzt.
- [R6] [MINOR] design.md:Ablage: „Segment in der Datei von Knoten `a`“ widersprach „Deckendurchbruch in der Datei des oberen Geschosses“. Behoben: `a` ist bei Deckendurchbrüchen der obere Knoten, bei Wanddurchbrüchen der auf der angeklickten Seite.
- [R7] [MINOR] design.md:Verweise ins Leere: Offen war, wann unbekannte Segment-IDs aus `path` verschwinden. Behoben: nicht beim Laden, sondern beim nächsten Befehl über die Pfadbereinigung in `normalizeAfterCommand`.
- [R8] [INFO] docs/architektur.md führt `RouteNode.boardId`, `Endpoint.boardId` und `conduit.diameterMm`. Die Anpassung (boardId ab M4, `conduit` mit `size` und `innerDiameterMm`, `cableAllowances`) ist Task 1.6.

## Stage 3: Umsetzbarkeit und Testbarkeit
Verdict: PASS

### Findings
- [R9] [INFO] Jedes Scenario der drei Capabilities ist in tasks.md genannt (cable-routes 11, cables 9, workspace-Delta 6).
- [R10] [INFO] Risiko Umfang: m3 ist größer als m2 (Zeichenwerkzeug mit Fang, Übergänge, Graph). Die Abschnitte sind so geschnitten, dass nach jedem ein lauffähiger Stand mit grüner CI entsteht.
