# Spec Delta

## Purpose

Legt fest, wie sich der Benutzer in der App bewegt: Aufbau der Oberfläche, Strukturbaum, gemeinsame Auswahl, Rückgängig und Darstellung von Maßen.

## ADDED Requirements

### Requirement: Aufbau der Oberfläche
Das System SHALL links einen Strukturbaum, in der Mitte den aktiven Editor und rechts die Eigenschaften der Auswahl zeigen. Im Editorbereich MUST zwischen Grundriss, Flächenansicht und 3D umgeschaltet werden können.

#### Scenario: Fläche über Baum öffnen
- **WHEN** der Benutzer im Baum „OG › Bad › Wand Nord“ anklickt
- **THEN** öffnet sich deren Wandansicht im Editorbereich

### Requirement: Strukturbaum
Das System SHALL im Strukturbaum die Geschosse nach Höhenlage, je Geschoss die Räume und darunter deren Wandansichten (im Uhrzeigersinn ab Nord), Decke, Boden und Schrägen zeigen. Wandseiten ohne angrenzenden Raum, darunter alle Außenseiten, MUST unter „Flächen ohne Raum“ des Geschosses stehen.

#### Scenario: Außenseiten im Baum
- **WHEN** das EG vier Außenwände hat
- **THEN** stehen deren Außenseiten unter „EG › Flächen ohne Raum“ und lassen sich von dort öffnen

#### Scenario: Wand ohne Raum
- **WHEN** eine Innenwand gezeichnet ist, an die noch kein Raum grenzt
- **THEN** stehen ihre beiden Seiten unter „Flächen ohne Raum“

### Requirement: Gemeinsame Auswahl
Das System SHALL Geschosse, Wände, Räume, Öffnungen und Schrägen auswählbar machen und eine Auswahl in allen Ansichten gleichzeitig hervorheben. Bei Auswahl einer Wand MUST der Baum alle Wandansichten dieser Wand markieren.

#### Scenario: Auswahl im Grundriss
- **WHEN** der Benutzer im Grundriss eine Wand zwischen Küche und Flur auswählt
- **THEN** sind im Baum „Küche › Wand …“ und „Flur › Wand …“ markiert und ihre Eigenschaften stehen rechts

### Requirement: Rückgängig und Wiederholen
Das System SHALL jede Modelländerung rückgängig machen und wiederholen können, einschließlich Änderungen an Planhintergrund und Kalibrierung.

#### Scenario: Löschen rückgängig
- **WHEN** der Benutzer eine Wand löscht und danach Rückgängig wählt
- **THEN** ist die Wand mit allen Eigenschaften und Öffnungen wieder da

#### Scenario: Kalibrierung rückgängig
- **WHEN** der Benutzer neu kalibriert und danach Rückgängig wählt
- **THEN** gilt wieder die vorige Kalibrierung

### Requirement: Warnungsleiste
Das System SHALL am unteren Rand die Anzahl der aktuellen Warnungen anzeigen und sie als Liste aufklappen lassen; ein Klick auf eine Warnung MUST das betroffene Objekt auswählen und die passende Ansicht öffnen.

#### Scenario: Offener Raum
- **WHEN** die Küche nach dem Löschen einer Wand nicht mehr geschlossen ist
- **THEN** zeigt die Leiste eine Warnung „Raum nicht geschlossen: Küche“, und ein Klick wählt die Küche im Grundriss aus

### Requirement: Deutsche Oberfläche und Maßeinheiten
Das System SHALL alle Bedienelemente und Meldungen auf Deutsch anzeigen. Eingaben und Bemaßungen MUST in ganzen Millimetern ohne Tausendertrenner erfolgen, zusammengefasste Längen und Flächen in Metern bzw. Quadratmetern mit zwei Nachkommastellen und Dezimalkomma.

#### Scenario: Wandlänge
- **WHEN** eine Wand 4260 mm lang ist
- **THEN** zeigt die Bemaßung „4260“ und die Eigenschaften zeigen „4260 mm (4,26 m)“

#### Scenario: Raumfläche
- **WHEN** ein Raum 12,5 m² Grundfläche hat
- **THEN** zeigen die Eigenschaften „12,50 m²“
