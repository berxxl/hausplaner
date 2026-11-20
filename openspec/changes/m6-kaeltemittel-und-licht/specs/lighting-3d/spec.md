# Spec Delta

## Purpose

Lässt die Wirkung geplanter Leuchten in der 3D-Ansicht grob einschätzen und erzeugt Bilder für Abstimmungen.

## ADDED Requirements

### Requirement: Leuchten strahlen Licht ab
Das System SHALL Leuchten mit Lichtangaben im Katalog in der 3D-Ansicht als Lichtquelle darstellen: Spots mit Abstrahlwinkel, Punkt- und Flächenleuchten entsprechend. Lichtstrom und Lichtfarbe MUST die Darstellung beeinflussen.

#### Scenario: Spotreihe
- **WHEN** im Flur vier Spots mit 36° Abstrahlwinkel gesetzt sind
- **THEN** zeigt die 3D-Ansicht vier Lichtkegel auf Boden und Wänden

#### Scenario: Warmweiß
- **WHEN** eine Leuchte 2700 K hat
- **THEN** erscheint ihr Licht wärmer als das einer Leuchte mit 4000 K

### Requirement: Licht ein- und ausschalten
Das System SHALL zwischen gleichmäßiger Ausleuchtung und Darstellung mit Leuchten umschalten und einzelne Leuchten oder Stromkreise ein- und ausschalten lassen.

#### Scenario: Nur Deckenspots
- **WHEN** der Benutzer nur den Stromkreis der Deckenspots einschaltet
- **THEN** leuchten in 3D nur diese Leuchten

### Requirement: 3D-Bild speichern
Das System SHALL die aktuelle 3D-Ansicht als PNG in wählbarer Auflösung speichern.

#### Scenario: Bild für die Familie
- **WHEN** der Benutzer „Bild speichern“ mit 1920 × 1080 wählt
- **THEN** entsteht eine PNG-Datei dieser Größe mit der aktuellen Ansicht

### Requirement: Kamerapositionen
Das System SHALL Kamerapositionen mit Namen speichern und wieder aufrufen.

#### Scenario: Ansicht Küche
- **WHEN** der Benutzer die Ansicht „Küche vom Esstisch“ speichert und später aufruft
- **THEN** steht die Kamera wieder an derselben Stelle
