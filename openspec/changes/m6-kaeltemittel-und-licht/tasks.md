# Tasks

## 1. Schema, Katalog, Dateiformat

- [x] 1.1 Schemaversion 5: `settings.condensateMinSlopePercent` (0–10), `refrigerant.unit?`, `cameraViews` im Modell; Migration `4 → 5` (Mindestgefälle 1 %, neue Standardtypen `condensate-drain`, `ac-outdoor-multi-3`, vorhandene Typen unverändert); `refrigerantUnit(type)` mit Ableitung; Standardkatalog neuer Projekte mit `unit`; Unit-Tests: Migration der M4-Fixture (Spec-Scenario „Projekt aus M5“), Standardkatalog (Spec-Scenario „Standardkatalog“), Ableitung der Rolle
- [x] 1.2 Datei `ansichten.yaml` (nur mit Inhalt), Feldreihenfolge, Flow-Stil, Bereinigung `upToStoreyId` in `normalizeAfterCommand`; `docs/architektur.md` (Dateiliste, `Project.cameraViews`, `CameraView`, `Settings`, `refrigerant.unit?`); Serialisierungstest
- [x] 1.3 Fixture `tests/fixtures/m6` über Generator `tests/unit/io/fixture-m6.gen.test.ts` (Klima Schlafen, Außengerät auf Außenwand, Kondensatablauf, Trassen mit Durchbruch, Kältemittel- und Kondensatleitung, vier Spots in Wohnen auf „F3 Licht“, Deckenauslass 4000 K, eine Ansicht); Golden-File-Test; Migrationstest „erster Befehl schreibt nur projekt.yaml und katalog.yaml“

## 2. Klimaverbindung und Kältemittellänge (rein)

- [x] 2.1 `geometry/refrigerant.ts`: `refrigerantLinks`, `acConnection`, Mehrlänge; Unit-Tests: Innengerät Schlafen mit Außengerät, Kältemittel- und Kondensatleitung zum Ablauf (Spec-Scenario „Split-Gerät Schlafzimmer“), drei Innengeräte an einem Multisplit-Außengerät (Spec-Scenario „Multisplit“), 9,5 m bei 7 m vorgefüllt ergibt 2,5 m (Spec-Scenario „Nachfüllen nötig“), ohne Weg keine Länge
- [x] 2.2 `rules/refrigerant.ts`: `refrigerant-too-long`, `refrigerant-too-short`, `refrigerant-ends`, `ac-without-condensate`; Unit-Tests: Länge über Höchstlänge (Spec-Scenario „Zu lang“), unter Mindestlänge, Innen-Innen, ohne Weg keine Längenwarnung

## 3. Kondensatgefälle

- [x] 3.1 Gefälle je Segment in Fließrichtung, Regel `condensate-slope`; Unit-Tests: Segment steigt zum Ablauf an → Warnung „Kondensat ohne Gefälle“ am Segment (Spec-Scenario „Steigung“), senkrecht nach unten keine Warnung (Spec-Scenario „Senkrecht nach unten“), 0,5 % bei 1 % meldet, 1 % nicht, vertauschte Enden, Durchbruch waagerecht meldet, geteiltes Segment einmal
- [x] 3.2 Projekteinstellungen „Kondensat“ mit „Mindestgefälle (%)“ (Befehl „Mindestgefälle ändern“); Komponententest: 2 % meldet ein 1,5-%-Segment, Undo stellt 1 % her

## 4. Klima in der Oberfläche

- [x] 4.1 Eigenschaften: Abschnitt „Klimaverbindung“ am Innen- und Außengerät, Mehrlänge und Gefälle an der Leitung; Katalogdialog „Innengerät“/„Außengerät“; Komponententests: Innengerät zeigt Außengerät, Kältemittel- und Kondensatleitung (Spec-Scenario „Split-Gerät Schlafzimmer“), Außengerät zeigt drei Verbindungen, Katalogdialog setzt `unit`

## 5. Licht in 3D

- [x] 5.1 `geometry/lighting.ts`: `kelvinToRgb`, Lichtstärken für Spot/Punkt/Fläche, `sceneLights` (Lage, Richtung, Schalten, Grenze 32); Unit-Tests: vier Spots 36° ergeben vier Spotlichter mit halbem Öffnungswinkel 18° nach unten (Spec-Scenario „Spotreihe“), 2700 K wärmer als 4000 K (Spec-Scenario „Warmweiß“), nur Kreis der Deckenspots an (Spec-Scenario „Nur Deckenspots“), mehr als 32 Leuchten
- [x] 5.2 3D: Lichtmodus im View-Store, Lichtquellen (Spot/Point/RectArea), Selbstleuchten, Schatten, Leiste „Licht“ mit Kreisen und Leuchten, `data-lights`; Belichtungsfaktor per Bild einstellen; Komponententest Lichtleiste (Kreis schalten, unbestimmter Zustand)

## 6. Bild und Kamerapositionen

- [x] 6.1 „Bild speichern …“ mit Auflösungen, Rendern in Zielgröße, Download, Fehlermeldung bei zu großer Auflösung; Playwright: 1920 × 1080 speichern, PNG-Kopf hat diese Größe (Spec-Scenario „Bild für die Familie“)
- [x] 6.2 Kamerapositionen: Befehle „Ansicht speichern/ändern/löschen“, Auswahl „Ansicht“, „Ansicht speichern …“ mit Überschreiben nach Rückfrage, „Anzeigen bis“; Unit-Tests der Befehle mit Undo; Playwright: „Küche vom Esstisch“ speichern, Kamera bewegen, aufrufen, Projektion eines bekannten Punkts wie vorher (Spec-Scenario „Ansicht Küche“)

## 7. Integration

- [x] 7.1 Playwright-Ablauf mit Fixture m6: Klimaverbindung in den Eigenschaften, Kondensatknoten anheben → Warnung und Segment in Warnfarbe, 3D „Leuchten“ mit vier Spots, nur „F3 Licht“, Helligkeit unter einem Spot größer als daneben (aus dem PNG), Ansicht speichern und aufrufen, speichern und neu laden; alle drei Browser
- [ ] 7.2 Manuell: banatstrasse10 migrieren, Klima-Innengerät mit Außengerät und Kondensatleitung planen, Spots im Flur in 3D ansehen, Bild speichern (in Safari); Befunde als Folge-Tasks

## Workflow follow-up

- Vor der Umsetzung: Review von design.md, Specs und Tasks (von Hand nach dem Schema der m1–m5-Reviews, da `/openspec-review` nicht installiert ist)
- Nach Abschluss: Drift-Review, Change archivieren, danach `m7-baustellen-notizen` (optional) vervollständigen
