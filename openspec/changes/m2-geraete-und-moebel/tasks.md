# Tasks

## 1. Datenmodell, Katalog, Migration

- [x] 1.1 zod-Schema für Katalog (`deviceType`, `lineType`, `furnitureType` mit `knx`, `light`, `refrigerant`), `device` (Platzierung `surface` und `free`), `furniture`, `settings.installZones` und `suppressedWarnings` nach `design.md` „Dateiformat M2“, alle Objekte `.strict()`; `CURRENT_SCHEMA_VERSION` = 2; Unit-Test: M2-Fixture besteht die Prüfung, unbekanntes Feld in `device` ist ein Ladefehler
- [x] 1.2 Aufteilen und Zusammenführen um `katalog.yaml`, `devices`/`furniture` in Geschossdateien und `warnungen.yaml` erweitern (Gerät in der Datei des Geschosses seiner Fläche, `storeyId` beim Laden gesetzt, `warnungen.yaml` nur bei mindestens einem Eintrag, sonst `null`); Unit-Test Rundreise mit der M2-Fixture
- [x] 1.3 Writer-Tabelle um die neuen Objekte erweitern (eine Stelle im Code); Golden-File-Tests: (a) M2-Fixture Laden → Speichern byteweise identisch für alle vier Dateien, (b) Gerät verschieben ändert genau eine Zeile, (c) Typ ändern ändert nur `katalog.yaml`, (d) Warnung übergehen ändert nur `warnungen.yaml`
- [x] 1.4 Ladeprüfung erweitern: doppelte IDs über Katalog und Geschossdateien, lesbare Katalog-IDs aus `[a-z0-9-]` erlaubt; Verweise ins Leere (Gerät ohne Typ, Gerät ohne Fläche, Möbel ohne Typ) öffnen das Projekt; Unit-Test je Fall
- [x] 1.5 Standardkatalog in `src/model/default-catalog.ts` nach `design.md` „Standardkatalog“ (Geräte, Leitungen, Grundmöbel, Standardhöhen, Formen, Montagearten); Unit-Tests: alle in der Spec „Standardkatalog“ genannten Typen vorhanden, „Präsenzmelder KNX“ mit Gewerk KNX, Montage Decke, anschließbar KNX (Spec-Scenario), alle IDs eindeutig
- [x] 1.6 Migration `1 → 2` (Standardzonen, Standardkatalog nur wenn `katalog.yaml` fehlt), neues Projekt schreibt `katalog.yaml` mit; neues Projekt übernimmt eine vorhandene `katalog.yaml` unverändert (Spec-Scenario „Leerer Ordner mit vorhandenem Katalog“); Unit-Tests mit Fixture `klein`: Migration schreibt nichts, erster Befehl schreibt `projekt.yaml` mit `schemaVersion: 2` und `katalog.yaml`, Geschossdateien byteweise unverändert (Spec-Scenario „Projekt aus M1“); vorhandene `katalog.yaml` bleibt unverändert
- [x] 1.7 Symbole in `src/model/symbol.ts`: Parsen, Bereinigen nach Positivliste, Umrechnen der viewBox auf 0..100, Rendern als React-Elemente; Symbole für alle Typen des Standardkatalogs in Anlehnung an DIN EN 60617; Unit-Tests: `<script>`, `onload`, `href`, `style` werden entfernt (Spec-Scenario „Symbol mit Skript“), leeres Ergebnis wird abgelehnt, viewBox 0 0 24 24 wird auf 0..100 skaliert

## 2. Katalog bearbeiten

- [x] 2.1 Befehle „Typ anlegen“, „Typ kopieren“, „Typ ändern“, „Typ löschen“ für Geräte-, Leitungs- und Möbeltypen; Löschen abgelehnt mit „Typ wird von <n> Geräten verwendet“ bzw. „… Möbeln“; Unit-Tests: Kopie erhält neue zufällige ID und Namen „<Name> Kopie“, Löschen eines verwendeten Typs mit 12 Geräten nennt 12 (Spec-Scenario), Undo
- [x] 2.2 Katalogfenster (`ui/catalog/`): Listen nach Art, Gerätetypen nach Gewerk, Formular mit allen Feldern und Pflichtfeldprüfung, SVG-Import für Symbole mit Vorschau, Entfernen einer verwendeten Montageart abgelehnt; Komponententests: „Steckdose“ kopieren, „Steckdose USB-C“ mit 1050 mm speichern, steht danach in der Geräteauswahl (Spec-Scenario „Eigener Typ“); zugewiesenes SVG-Symbol wird bereinigt übernommen und im Katalog angezeigt (die Darstellung in Grundriss und Flächenansicht prüft Task 3.8)

## 3. Geräte

- [ ] 3.1 `geometry/devices.ts`: Flächenkoordinaten → Welt und Grundriss für alle Flächenarten, Grundriss-Platzierung (Wandseite bis 300 mm vor der fertigen Oberfläche, sonst Decke/Schräge, Boden, frei), Frontrechteck je Gerät; Unit-Tests: Klick auf der Flurseite ergibt die Flur-Wandseite (Spec-Scenario „Schalter im Grundriss“), Klick 350 mm vor der Wand bei Typ nur `wall` ergibt Meldung, Schräge mit tiefster Fläche über dem Punkt
- [ ] 3.2 Befehle „Gerät setzen“, „Gerät verschieben“, „Gerät ändern“, „Gerät löschen“; Mitlöschen mit Wand, Raum und Geschoss inkl. Anzahl in der Bestätigung; Unit-Tests: Steckdose in 300 mm (Spec-Scenario „Steckdose setzen“), Präsenzmelder in der Wandansicht abgelehnt mit Montagearten (Spec-Scenario), Wand mit zwei Steckdosen löschen und Rückgängig (Spec-Scenario „Wand gelöscht“), Raum löschen nimmt Deckengeräte mit
- [x] 3.3 `rebaseDeviceHeights` nach `design.md` „Höhenbezug bei geänderter Raumzuordnung“, aufgerufen in allen Befehlen, die Räume neu berechnen; Unit-Tests: Raum nachträglich angelegt 400 → 300 mm über OKFF (Spec-Scenario), Estrich 100 → 140 mm lässt 1050 mm über OKFF (Spec-Scenario), Raum gelöscht, Raum neu erkannt, Wand verschoben ändert Zuordnung, Undo stellt alles her
- [ ] 3.4 Werkzeug „Gerät“ in Grundriss und Flächenansicht mit Typauswahl (gruppiert, Suche, nur platzierbare Typen), Mehrfachsetzen bis Esc, Ziehen als ein Befehl; Playwright: Steckdose in der Wandansicht setzen, Schalter im Grundriss auf der Flurseite
- [ ] 3.5 Eigenschaften: Bezeichnung, Typ, Status, Abstand zur Bezugskante (linke/rechte Raumecke, Laibungen), Höhe über OKFF, Rohbauhöhe; Decke/Boden/Schräge mit Abständen zu den Wänden; frei mit x, y, z; Komponententest: Schalter 1050 mm bei 100 mm Aufbau zeigt Rohbauhöhe 1150 mm (Spec-Scenario „Höhe eingeben“), Bezugskante Laibung
- [ ] 3.6 Auswahl von Geräten und Möbeln im gemeinsamen Auswahlzustand, Mehrfachauswahl mit Shift nur auf einer Fläche; Playwright: Deckenauslass in 3D anklicken hebt ihn in Grundriss und Deckenspiegel hervor (Spec-Scenario „Gerät in 3D auswählen“)
- [ ] 3.7 Kombinieren waagerecht/senkrecht mit Abstandsdialog (Standard 71 mm), Mehrfachauswahl mit Shift; Unit-Tests: drei Geräte auf einer Höhe im Abstand 71 mm (Spec-Scenario „Dreifachkombination“), senkrecht, verschiedene Flächen abgelehnt
- [ ] 3.8 Darstellung in Grundriss, Flächenansicht und 3D nach `design.md` „Darstellung“ inkl. Statusfarben und rotem Rand bei offener Warnung; Unit-Test 3D-Position eines Deckenauslasses; Playwright: Deckenauslass in der Küche erscheint im Deckenspiegel, im Grundriss und in 3D (Spec-Scenario), Status „verlegt“ ändert die Darstellung (Spec-Scenario „Nach dem Verlegen“); eigenes SVG-Symbol erscheint in Grundriss und Flächenansicht (Spec-Scenario „Eigenes Symbol“)

## 4. Installationszonen

- [ ] 4.1 `geometry/zones.ts`: waagerechte Zonen (oben entlang der fertigen Deckenkontur, unten über OKFF), senkrechte Zonen an fertigen Raumecken und Laibungen von Türen und Fenstern; Unit-Tests: Wand mit Fenster ergibt zwei waagerechte Zonen und vier senkrechte Zonen (Spec-Scenario), Wand unter Schräge (Spec-Scenario), geänderte Einstellung 200–500 (Spec-Scenario)
- [ ] 4.2 Zuführung nach `design.md`: Ziel untere oder obere Zone, Hervorhebung außerhalb senkrechter Zonen; Unit-Tests: Schalter 150 mm neben Laibung (nicht hervorgehoben), Schalter mitten auf der Wand (hervorgehoben), Steckdose 300 mm (keine Zuführung) (alle Spec-Scenarios)
- [ ] 4.3 Overlay und Schalter „Zonen“ und „Zuführungen“ in der Flächenansicht, Zonen in den Projekteinstellungen editierbar (Befehl, Prüfung 0 ≤ a < b); Komponententest: Einblenden, geänderte Einstellung wirkt in allen Wandansichten

## 5. Möbel

- [ ] 5.1 `geometry/furniture.ts`: Grundfläche, Einrasten (≤ 200 mm, ≤ 15°, bündig an fertiger Oberfläche), Silhouette je Wandseite (≤ 100 mm, Überlappung in u); Unit-Tests: Küchenzeile 3000 × 600 × 900 an der Nordwand bündig an der Putzoberfläche (Spec-Scenario), Shift schaltet Einrasten ab, Bett vor der Wand ergibt Silhouette (Spec-Scenario), Möbel 150 mm vor der Wand ergibt keine
- [ ] 5.2 Befehle „Möbel setzen/verschieben/ändern/löschen“, Drehen um 90° mit R; Werkzeug „Möbel“ im Grundriss, Eigenschaften mit allen Maßen; Darstellung in Grundriss, Wandansicht (halbtransparent) und 3D; Playwright: Hängeschrank mit 1450 mm schwebt in Wandansicht und 3D (Spec-Scenario)
- [ ] 5.3 Regel `device-covered` in `rules/furniture.ts`; Unit-Tests: Steckdose hinter Kleiderschrank meldet „Gerät durch Möbel verdeckt“ (Spec-Scenario), Steckdose 150 mm über der Arbeitsplatte meldet nichts (Spec-Scenario), Verschieben neben den Schrank lässt die Warnung verschwinden (Spec-Scenario „Warnung verschwindet“)

## 6. Warnungen

- [ ] 6.1 Regeln `device-off-surface`, `device-without-surface`, `device-without-type`, `furniture-without-type` in `rules/devices.ts`; Unit-Tests: Wand gekürzt, Dose außerhalb (Spec-Scenario), Verweise ins Leere mit Aktion „Löschen“ und nicht übergehbar (Spec-Scenario „Nicht übergehbar“)
- [ ] 6.2 Übergehen und Wieder aktivieren als Befehle, `warnungen.yaml`, Bereinigen am Ende jedes Befehls im selben Patch; Unit-Tests: Übergehen zählt nicht mehr als offen (Spec-Scenario), Element gelöscht entfernt Markierung (Spec-Scenario), Erneut verletzt (Spec-Scenario), Undo stellt Markierung her, Laden bereinigt nicht
- [ ] 6.3 Warnungsübersicht mit Regel, Element, Ort, Abschnitt „übergangen“, Klickziele nach Tabelle; Komponententest: Klick öffnet die Ansicht und wählt das Element (Spec-Scenario „Zur Ursache springen“)

## 7. Gewerkfilter

- [ ] 7.1 Filter im View-Store, Schalter in der Kopfzeile, Wirkung in Grundriss, Flächenansicht und 3D, Auswahl ausgeblendeter Elemente aufheben; Playwright: nur KNX (Spec-Scenario), Möbel ausblenden (Spec-Scenario)

## 8. Rohbauhöhe je Raum

- [ ] 8.1 `room.rawHeightMm?` in Schema, Writer und Raumeigenschaften (leer = Geschosswert); Deckenhöhenfunktion, Zonen, Deckengeräte und 3D-Decke verwenden ihn; Unit-Tests: Raum mit 2460 mm im Geschoss mit 2405 mm hat fertige Decke 2445 mm bei 15 mm Putz (Spec-Scenario), obere Zone folgt, Wände unverändert, Feld leer → Geschosswert

## 9. Integration

- [ ] 9.1 Playwright-Ablauf: M1-Projekt öffnen (Migration), Katalogtyp kopieren, Geräte in Wandansicht und Grundriss setzen, Kombination, Möbel davor, Warnung übergehen, speichern, neu laden; serialisiertes Projekt vor und nach dem Neuladen identisch
- [ ] 9.2 Manuell: banatstrasse10 migrieren, Steckdosen und Schalter im EG setzen, Küchenzeile und Betten stellen; Befunde als Folge-Tasks

## Workflow follow-up

- Vor der Umsetzung: Review von design.md, Specs und Tasks (von Hand nach dem Schema der m1-Reviews, da `/openspec-review` nicht installiert ist)
- Nach Abschluss: Drift-Review, Change archivieren, danach `m3-trassen-und-leitungen` vervollständigen
