# Spec Delta

## MODIFIED Requirements

### Requirement: Leitung anlegen
Das System SHALL eine Leitung mit Leitungstyp, Bezeichnung und zwei Endpunkten (Gerät oder Verteiler) anlegen. Der Leitungstyp MUST zu einem Gewerk passen, das beide Endpunkte anschließen können.

#### Scenario: Busleitung zum Präsenzmelder
- **WHEN** der Benutzer eine KNX-Busleitung vom Präsenzmelder Küche zur UV EG anlegt
- **THEN** existiert die Leitung mit beiden Endpunkten

#### Scenario: Unpassender Typ
- **WHEN** der Benutzer eine Cat-7-Leitung an einen Rollladenmotor anschließen will
- **THEN** lehnt das System ab, weil der Motor kein Datengewerk anschließt

### Requirement: Leitungslänge
Das System SHALL die Länge jeder Leitung als Summe ihrer Segmentlängen plus Zuschlag je Geräteendpunkt (Standard 0,3 m) und je Verteilerendpunkt (Standard 1,5 m) plus Verschnitt (Standard 10 %) berechnen. Die Zuschläge MUST einstellbar sein.

#### Scenario: Längenberechnung
- **WHEN** eine Leitung über 8,4 m Trasse von einer Dose zu einem Verteiler läuft
- **THEN** beträgt ihre Länge (8,4 + 0,3 + 1,5) × 1,1 = 11,2 m

#### Scenario: Wand verschoben
- **WHEN** eine Wand verschoben wird und sich dadurch Segmente verlängern
- **THEN** aktualisieren sich die Längen aller betroffenen Leitungen

## ADDED Requirements

### Requirement: Mehrere Leitungen gleichzeitig
Das System SHALL mehrere Leitungen gleichen Typs von mehreren Geräten zu einem Verteiler in einem Schritt anlegen.

#### Scenario: Alle Rollläden im OG
- **WHEN** der Benutzer alle Rollladenmotoren im OG auswählt und „Leitung zu UV OG“ mit NYM-J 5×1,5 wählt
- **THEN** entsteht je Motor eine Leitung mit vorgeschlagenem Weg
