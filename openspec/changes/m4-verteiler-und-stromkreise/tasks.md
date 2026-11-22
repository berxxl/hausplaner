# Tasks

## 1. Datenmodell, Dateiformat, Migration

- [x] 1.1 zod-Schema für `board` (mit `fields`), `placement.kind: board`, `device.circuitId?`/`knxLineId?`, `routeNode.boardId?`, Endpunkt `deviceId` oder `boardId` (genau eins), `circuit`, `knxLine`, `knxAssignment`, `settings.teReservePercent`/`actuatorReservePercent`, `lengthAllowance.perBoardMm` nach `design.md` „Dateiformat M4“, alle Objekte `.strict()`; `CURRENT_SCHEMA_VERSION` = 4; Unit-Test: M4-Fixture besteht die Prüfung, Endpunkt mit beiden Feldern ist ein Ladefehler, unbekanntes Feld in `board` ist ein Ladefehler
- [x] 1.2 Aufteilen und Zusammenführen: `verteiler.yaml` (nur mit Inhalt, sonst `null`), Reiheneinbaugeräte nur dort, `board.storeyId` aus der Wand, Geschoss der Reiheneinbaugeräte aus dem Verteiler; Unit-Test Rundreise mit der M4-Fixture
- [x] 1.3 Writer-Tabelle erweitern (Felder in Benutzerreihenfolge, `knxAssignments` nach Aktor und Kanal); Golden-File-Tests: (a) M4-Fixture Laden → Speichern byteweise identisch für alle Dateien, (b) Verteiler verschieben ändert genau eine Zeile, (c) Gerät einem Stromkreis zuweisen ändert nur die Geschossdatei, (d) Reiheneinbaugerät umsetzen ändert nur `verteiler.yaml`
- [x] 1.4 Ladeprüfung: doppelte IDs über alle Dateien (auch `verteiler.yaml`); Verweise ins Leere nach design.md öffnen das Projekt; optionale Verweise ins Leere gelten als nicht gesetzt; Unit-Test je Fall
- [x] 1.5 Migration `3 → 4` (Reserven, `perBoardMm`, neue Standardtypen ergänzen), neue Standardtypen im Standardkatalog, neues Projekt in Version 4; Unit-Tests mit der M3-Fixture: Migration schreibt nichts, erster Befehl schreibt `projekt.yaml` und `katalog.yaml`, alle übrigen Dateien byteweise unverändert; geänderter Schaltaktor bleibt (Spec-Scenario „Projekt aus M3“); Standardkatalog enthält die neuen Typen (Spec-Scenario „Standardkatalog“)
- [x] 1.6 Fixture `tests/fixtures/m4/` nach `design.md` „Tests und Fixtures“ (über Store-Befehle und Writer erzeugt); `docs/architektur.md` anpassen

## 2. Verteiler und Belegung

- [x] 2.1 `geometry/boards.ts`: Weltlage und Grundrissrechteck (Unterputz/Aufputz), Gerätebreite (`teWidth`, sonst aus der Breite), erlaubte Typen je Feldart, Belegung je Reihe, Platzprüfung, Platzsuche, Reserve (gesamt, belegt, vorgemerkt, frei); Unit-Tests: 8-TE-Aktor in Reihe 3 ab Platz 1 belegt 1–8 (Spec-Scenario „Aktor einsetzen“), 4 TE frei lehnt ab (Spec-Scenario „Kein Platz“), 48 TE mit 42 belegt meldet (Spec-Scenario „Zu wenig Reserve“), Router passt ins Multimediafeld, nicht ins Verteilerfeld
- [x] 2.2 Befehle in `store/boards.ts`: „Verteiler anlegen“, „Verteiler verschieben“, „Verteiler ändern“, „Felder ändern“ (Feld mit Geräten nicht löschbar), „Verteiler löschen“ mit Kaskade, „Gerät einsetzen“, „Gerät umsetzen“; `normalizeAfterCommand`: Verteilerknoten nachführen, optionale Verweise bereinigen; Löschkaskaden für Wand, Raum, Geschoss; Unit-Tests inkl. Undo, Bestätigungstext mit Anzahlen
- [x] 2.3 Werkzeug „Verteiler“ in der Flächenansicht mit Dialog und Standardwerten je Art, Darstellung in Flächenansicht, Grundriss und 3D, Auswahl und Ziehen, `BoardProperties` mit Feldtabelle, Baum „Verteiler“ (auf- und zuklappbar); Playwright: Unterputz-UV 550 × 1100 × 120 im Flur OG erscheint in Wandansicht, Grundriss, 3D und im Baum unter „Verteiler“ (Spec-Scenario „UV im Flur“); Komponententest: Zählerschrank mit Zählerfeld, APZ-Feld und Verteilerfeld 5 × 12 zeigt drei Felder und 60 TE (Spec-Scenario „Zählerschrank aufbauen“)
- [x] 2.4 Belegungsansicht (Tab „Verteiler“): Felder, Reihen, Geräte, Zusammenfassung, Palette, Einsetzen und Umsetzen per Zeiger, Entf, Meldungen, Feld/Reihe/Platz in den Geräteeigenschaften; Komponententest: „Belegung öffnen“ zeigt die UV OG (Spec-Scenario „Belegung öffnen“), Aktor auf Platz ziehen setzt ihn ein, Ziehen auf belegten Platz zeigt „Kein Platz …“
- [x] 2.5 Verteilerhierarchie: Befehl „Verteiler zuordnen“ mit Zuleitung, Baum nach Hierarchie, Warnung `board-without-parent`; Unit-Test: UV OG am Zählerschrank mit NYM-J 5×10 (Spec-Scenario „UV am Zählerschrank“), Wechsel des übergeordneten Verteilers ändert dieselbe Leitung, Zuleitung löschen entfernt `feedCableId`; Komponententest: Baum zeigt die UV unter dem Zählerschrank
- [x] 2.6 Medienverteiler: Patchfeldports in den Eigenschaften; Unit-Test: drei Netzwerkdosen mit Leitung zum Medienverteiler ergeben 3 Ports (Spec-Scenario „Netzwerkdosen an Patchfeld“)

## 3. Verteiler als Endpunkt

- [x] 3.1 Verteilerknoten: Fang im Werkzeug „Trasse“, Wiederverwendung, Anker oben mittig, folgt dem Verteiler; Komponententest: Trasse bis an die UV endet in deren Knoten (Spec-Scenario „Trasse zum Verteiler“); Unit-Test: Verteiler verschieben zieht den Knoten mit, Verteiler löschen lässt ihn als gewöhnlichen Knoten stehen
- [x] 3.2 Endpunkt `boardId`: Werkzeug „Leitung“ in Grundriss und Flächenansicht, Typprüfung nach Verteilerart, Wegvorschlag zum Verteilerknoten, Länge mit `perBoardMm`, Einstellung in den Projekteinstellungen; Unit-Tests: KNX-Busleitung vom Präsenzmelder Küche zur UV EG (Spec-Scenario „Busleitung zum Präsenzmelder“), Cat 7 am Rollladenmotor weiter abgelehnt (Spec-Scenario „Unpassender Typ“), 8,4 m Trasse Dose → Verteiler ergibt 11,2 m (Spec-Scenario „Längenberechnung“), Wand verschoben (Spec-Scenario „Wand verschoben“), Cat 7 an die UV abgelehnt
- [x] 3.3 Mehrere Leitungen: Shift-Klick im Grundriss über Flächen, „Gleiche im Geschoss auswählen“, „Kombinieren“ nur auf einer Fläche, Dialog „Leitungen zu Verteiler …“, Befehl „Leitungen anlegen“ mit Überspringen; Unit-Test: alle Rollladenmotoren im OG mit NYM-J 5×1,5 zur UV OG ergeben je Motor eine Leitung mit Weg (Spec-Scenario „Alle Rollläden im OG“), erneuter Aufruf überspringt alle; Komponententest: zwei Motoren an verschiedenen Wänden per Shift-Klick (Spec-Scenario „Geräte verschiedener Wände“)

## 4. Stromkreise

- [x] 4.1 `geometry/circuits.ts`: Kurzname, speisender Verteiler (Breitensuche über Stromleitungen von Gerät zu Gerät), Leitungen eines Stromkreises; Unit-Tests: durchgeschleifte Dosen, zwei Verteiler, kein Verteiler
- [x] 4.2 Befehle „Stromkreis anlegen/ändern/löschen“, „Stromkreis zuweisen“ (auch mehrere Geräte); Unit-Tests: „F12 Küche Steckdosen“ in der UV EG mit LS B16 und NYM-J 3×2,5 (Spec-Scenario „Küchenkreis“), fünf Steckdosen F12 zuweisen, ihre Zuleitungen gehören zu F12 (Spec-Scenario „Mehrfachzuordnung“), Stromkreis löschen löst die Geräte, Undo
- [x] 4.3 Regeln `device-without-circuit` und `circuit-board-mismatch`; Unit-Tests: Steckdose ohne Stromkreis erscheint in der Übersicht (Spec-Scenario „Vergessene Dose“), Leitung zu anderem Verteiler meldet (Spec-Scenario „Verteiler passt nicht“), Reiheneinbaugeräte und Datengeräte melden nicht
- [x] 4.4 Oberfläche: Abschnitt „Stromkreise“ in den Verteilereigenschaften, `CircuitProperties`, Feld „Stromkreis“ in den Geräteeigenschaften (auch mehrfach), „Stromkreis“ in den Leitungseigenschaften, Kurzname an Geräten in Grundriss und Flächenansicht, Auswahlart `circuit` mit Hervorheben in allen Ansichten und in der Belegung, Stromkreise im Baum; Komponententests: Stromkreis im Baum anklicken (Spec-Scenario „Stromkreis im Baum“), F12 auswählen markiert Geräte und Leitungen (Spec-Scenario „Stromkreis hervorheben“)

## 5. KNX

- [x] 5.1 `geometry/knx.ts`: Verbraucher, Verteiler eines Verbrauchers, Kanalbedarf je Verteiler und Funktion; Unit-Test: 10 Leuchten, 4 dimmbare Leuchten, 7 Rollladenmotoren mit Leitung zur UV OG (Spec-Scenario „Bedarf UV OG“), Verbraucher ohne Leitung über den Stromkreis
- [x] 5.2 Aktorvorschlag (Rucksack über Kanäle, Gleichstände nach TE, Anzahl, Typ-IDs), vorhandene Aktoren abziehen, vorgemerkte TE in der Reserve; Unit-Tests: 10 Schaltkanäle mit 8- und 16-fach und 20 % ergeben einen 16-fach (Spec-Scenario „Vorschlag mit Reserve“), kein Aktortyp, Bedarf 16 TE ohne Aktor zählt als vorgemerkt (Spec-Scenario „Aktorbedarf vor Belegung“)
- [x] 5.3 Befehl „Aktorvorschlag übernehmen“ mit Platzsuche und Bezeichnungen; Unit-Tests: Aktoren stehen an freien Plätzen (Spec-Scenario „Übernehmen“), zu wenig Platz lehnt ganz ab, Nummerierung „JA2“ nach vorhandenem „JA1“
- [x] 5.4 Kanalzuordnung: Befehle „Kanal zuordnen“ und „Kanäle automatisch zuordnen“; Unit-Tests: „Rollladen Bad“ → Jalousieaktor 2, Kanal C ergibt „JA2.C → Rollladen Bad“ (Spec-Scenario „Rollladen zuordnen“), automatische Zuordnung nach Raum (Spec-Scenario „Automatisch zuordnen“), belegter Kanal nicht doppelt
- [x] 5.5 Regeln `knx-without-channel` und `knx-channel-mismatch`; Unit-Tests: mehr Jalousie-Verbraucher als Kanäle meldet die überzähligen (Spec-Scenario „Zu wenig Kanäle“), Aktor in anderem Verteiler meldet
- [x] 5.6 KNX-Linien: Befehle, Abschnitt in den Projekteinstellungen, Feld „KNX-Linie“ (auch mehrfach), „Teilnehmer über Busleitungen zuordnen“, Teilnehmerzahl; Unit-Test: 32 Teilnehmer an Linie 1.1 (Spec-Scenario „Linie zählen“), Zuordnung über Busleitungen erreicht Taster und Aktoren im Verteiler
- [x] 5.7 Oberfläche: Tabelle „KNX“ mit Vorschlag und „Vorschlag übernehmen“, „Kanäle automatisch zuordnen“, Kanalliste am Aktor, Feld „KNX-Kanal“ am Verbraucher; Komponententest: Vorschlag übernehmen und automatisch zuordnen über die Oberfläche

## 6. Warnungen, Einstellungen, Filter

- [x] 6.1 Regeln `board-reserve-low`, `board-device-outside`, `board-device-overlap` und die Verweise ins Leere mit ihren Aktionen; Klickziele (Belegung öffnen); Unit-Tests je Regel, nicht übergehbare Warnungen
- [x] 6.2 Projekteinstellungen: Verteilerzuschlag, TE-Reserve, Aktorreserve (Befehl „Reserven ändern“, 0–100); Komponententest: TE-Reserve 30 % ändert die Prüfung, Undo stellt 25 % her (Spec-Scenario „TE-Reserve ändern“)
- [x] 6.3 Gewerkfilter: Verteiler bleiben sichtbar; Playwright: „Nur KNX“ zeigt Gebäude, Verteiler, Trassen und KNX-Geräte (Spec-Scenario „Nur KNX“)

## 7. Integration

- [x] 7.1 Playwright-Ablauf: M3-Projekt öffnen (Migration), UV setzen, Belegung öffnen und Aktor einsetzen, Trasse zur UV, Leitung mit Verteilerzuschlag, Stromkreis anlegen und Geräte zuweisen, hervorheben, Aktorvorschlag übernehmen, Kanäle automatisch zuordnen, speichern, neu laden; serialisiertes Projekt vor und nach dem Neuladen identisch
- [ ] 7.2 Manuell: banatstrasse10 migrieren, UV EG und Zählerschrank setzen, einen Stromkreis mit Geräten anlegen, Aktorvorschlag prüfen; Befunde als Folge-Tasks

### Rückmeldungen des Benutzers während m4

- [x] R.1 Gedachte Raumgrenze nach design.md „Gedachte Raumgrenze“: Schema, Ablage, Golden File; Raumerkennung mit Grenzen; Befehle zeichnen/löschen mit Neuberechnung; Werkzeug, Darstellung, Auswahl, Eigenschaften im Grundriss; Trassenübergang Decke/Boden über die Grenze; Unit-Tests (Spec-Scenarios „Flur abgrenzen“, „Trasse über die Raumgrenze“, „Raumgrenze löschen“), Komponententest Werkzeug
- [x] R.2 Wandende im Wandkörper rastet auf die Achse; Unit-Test (Spec-Scenario „Wand bis an die Oberfläche gezeichnet“)
- [x] R.3 Keine Raumansichten mit fertiger Breite ≤ 1 mm; Unit-Test
- [x] R.4 banatstrasse10 OG: Wandenden auf die Achsen legen, `aoytki8w` (Flurabgrenzung mit gleich großer Öffnung) durch eine Raumgrenze ersetzen, Räume neu erkennen; Diff dem Benutzer zeigen (2026-11-22 über Store-Befehle geschrieben, nur `geschosse/og.yaml`; Stub `6e59j4hq` bleibt wie im EG frei, `r84ym8kl` offen – Rückfrage; Wandstärke `kmqewfc4` 230 mm vom Benutzer bestätigt)

- [x] R.5 Verteiler nach dem Platzieren per Maus verschieben: im Grundriss entlang der Wand ziehen (bisher nur auswählen), in der Flächenansicht prüfen (Ziehen ist dort umgesetzt; ergänzt: u auf die Seitenfläche begrenzt); ein Befehl „Verteiler verschieben“, Verteilerknoten folgt; Komponententest und Playwright (Spec-Scenario „Verteiler per Maus verschieben“)

## Workflow follow-up

- Vor der Umsetzung: Review von design.md, Specs und Tasks (von Hand nach dem Schema der m1–m3-Reviews, da `/openspec-review` nicht installiert ist)
- Nach Abschluss: Drift-Review, Change archivieren, danach `m5-plan-export` vervollständigen
