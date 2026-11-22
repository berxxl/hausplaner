# furniture Specification

## Purpose

Zeigt die spätere Einrichtung als einfache Körper, damit Geräte nicht hinter Möbeln verschwinden und zur Möblierung passen.

## Requirements

### Requirement: Möbel platzieren
Das System SHALL Möbel eines Katalogtyps im Grundriss mit Position, Drehung, Breite, Tiefe, Höhe und Höhe über OKFF platzieren. Möbel MUST an Wandseiten einrasten können.

#### Scenario: Küchenzeile an der Wand
- **WHEN** der Benutzer eine Küchenzeile 3000 × 600 × 900 mm an die Nordwand zieht
- **THEN** liegt sie bündig an der fertigen Wandoberfläche

#### Scenario: Hängeschrank
- **WHEN** der Benutzer einen Hängeschrank mit Höhe über OKFF 1450 mm platziert
- **THEN** schwebt er in Wandansicht und 3D in dieser Höhe

### Requirement: Silhouette in Wandansicht
Das System SHALL Möbel, die an eine Wandseite grenzen, in deren Ansicht als halbtransparente Silhouette darstellen.

#### Scenario: Bett vor der Wand
- **WHEN** ein Bett an der Wand steht
- **THEN** zeigt die Wandansicht dessen Umriss vor der Wand

### Requirement: Kollisionswarnung
Das System SHALL eine Warnung erzeugen, wenn ein Wandgerät von einem Möbel verdeckt wird, das näher als 100 mm vor der Wand steht.

#### Scenario: Steckdose hinter Schrank
- **WHEN** eine Steckdose hinter einem Kleiderschrank liegt
- **THEN** meldet das System „Gerät durch Möbel verdeckt“

#### Scenario: Steckdose über Arbeitsplatte
- **WHEN** eine Steckdose 150 mm über der Arbeitsplatte sitzt
- **THEN** entsteht keine Warnung
