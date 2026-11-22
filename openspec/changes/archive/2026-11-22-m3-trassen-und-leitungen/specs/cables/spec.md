# Spec Delta

## Purpose

Beschreibt jede einzelne Leitung mit Typ, Endpunkten und Weg durch das Trassennetz und liefert daraus Längen und Belegung.

## ADDED Requirements

### Requirement: Leitung anlegen
Das System SHALL eine Leitung mit Leitungstyp, Bezeichnung und zwei Geräten als Endpunkten anlegen (Verteiler als Endpunkt ab `m4-verteiler-und-stromkreise`). Der Leitungstyp MUST zu einem Gewerk passen, das beide Endpunkte anschließen können.

#### Scenario: Busleitung zum Präsenzmelder
- **WHEN** der Benutzer eine KNX-Busleitung vom Präsenzmelder Küche zum KNX-Taster Küche anlegt
- **THEN** existiert die Leitung mit beiden Endpunkten

#### Scenario: Unpassender Typ
- **WHEN** der Benutzer eine Cat-7-Leitung an einen Rollladenmotor anschließen will
- **THEN** lehnt das System ab, weil der Motor kein Datengewerk anschließt

### Requirement: Wegvorschlag
Das System SHALL für eine Leitung den kürzesten Weg durch das Trassennetz vorschlagen; der Benutzer MUST den Weg durch Wahl anderer Segmente ändern können.

#### Scenario: Automatischer Weg
- **WHEN** zwischen den Endpunkten ein zusammenhängender Trassenweg existiert
- **THEN** ordnet das System die Segmente des kürzesten Wegs zu und hebt ihn in allen Ansichten hervor

#### Scenario: Kein Weg
- **WHEN** die Endpunkte nicht über Trassen verbunden sind
- **THEN** wird die Leitung als „ohne Weg“ gekennzeichnet und erzeugt eine Warnung

### Requirement: Leitungslänge
Das System SHALL die Länge jeder Leitung als Summe ihrer Segmentlängen plus Zuschlag je Geräteendpunkt (Standard 0,3 m) plus Verschnitt (Standard 10 %) berechnen. Zuschlag und Verschnitt MUST einstellbar sein.

#### Scenario: Längenberechnung
- **WHEN** eine Leitung über 8,4 m Trasse von einer Dose zu einem Schalter läuft
- **THEN** beträgt ihre Länge (8,4 + 0,3 + 0,3) × 1,1 = 9,9 m

#### Scenario: Wand verschoben
- **WHEN** eine Wand verschoben wird und sich dadurch Segmente verlängern
- **THEN** aktualisieren sich die Längen aller betroffenen Leitungen

### Requirement: Belegung von Segmenten
Das System SHALL je Segment die Anzahl der Leitungen und die Summe ihrer Querschnitte anzeigen und bei Leerrohren eine Warnung erzeugen, wenn der Füllgrad 40 % der Innenquerschnittsfläche übersteigt.

#### Scenario: Volles Leerrohr
- **WHEN** fünf Leitungen über ein Segment mit Leerrohr M20 geführt werden
- **THEN** meldet das System „Leerrohr überfüllt“ für dieses Segment

### Requirement: Leitung hervorheben
Das System SHALL beim Auswählen einer Leitung ihren vollständigen Weg in allen Ansichten hervorheben, auch über mehrere Flächen und Geschosse.

#### Scenario: Leitung über zwei Geschosse
- **WHEN** der Benutzer eine Leitung von einem Taster im DG zu einem Gerät im EG auswählt
- **THEN** ist ihr Weg in allen beteiligten Flächenansichten und in 3D markiert

### Requirement: Status von Leitungen
Das System SHALL jeder Leitung den Status geplant, verlegt oder geprüft geben.

#### Scenario: Leitung geprüft
- **WHEN** der Benutzer eine Leitung auf „geprüft“ setzt
- **THEN** wird sie in Listen und Ansichten mit diesem Status geführt
