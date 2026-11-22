# cables Specification

## Purpose

Beschreibt jede einzelne Leitung mit Typ, Endpunkten und Weg durch das Trassennetz und liefert daraus Längen und Belegung.

## Requirements

### Requirement: Leitung anlegen
Das System SHALL eine Leitung mit Leitungstyp, Bezeichnung und zwei Endpunkten (Gerät oder Verteiler) anlegen. Der Leitungstyp MUST zu einem Gewerk passen, das beide Endpunkte anschließen können.

#### Scenario: Busleitung zum Präsenzmelder
- **WHEN** der Benutzer eine KNX-Busleitung vom Präsenzmelder Küche zur UV EG anlegt
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
Das System SHALL die Länge jeder Leitung als Summe ihrer Segmentlängen plus Zuschlag je Geräteendpunkt (Standard 0,3 m) und je Verteilerendpunkt (Standard 1,5 m) plus Verschnitt (Standard 10 %) berechnen. Die Zuschläge MUST einstellbar sein.

#### Scenario: Längenberechnung
- **WHEN** eine Leitung über 8,4 m Trasse von einer Dose zu einem Verteiler läuft
- **THEN** beträgt ihre Länge (8,4 + 0,3 + 1,5) × 1,1 = 11,2 m

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

### Requirement: Mehrere Leitungen gleichzeitig
Das System SHALL mehrere Leitungen gleichen Typs von mehreren Geräten zu einem Verteiler in einem Schritt anlegen.

#### Scenario: Alle Rollläden im OG
- **WHEN** der Benutzer alle Rollladenmotoren im OG auswählt und „Leitung zu UV OG“ mit NYM-J 5×1,5 wählt
- **THEN** entsteht je Motor eine Leitung mit vorgeschlagenem Weg
