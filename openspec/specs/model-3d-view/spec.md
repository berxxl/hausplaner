# model-3d-view Specification

## Purpose

Zeigt das gesamte Modell räumlich, um Geometrie, Gerätepositionen und Leitungswege visuell zu prüfen.

## Requirements

### Requirement: 3D-Darstellung des Gebäudes
Das System SHALL Wände mit Öffnungen, Böden, Decken und Schrägen aller Geschosse in Rohbaumaßen in 3D darstellen und bei jeder Modelländerung aktualisieren. Wände MUST über ihre ganze Dicke an den Rohschrägen aller angrenzenden Räume gekappt werden.

#### Scenario: Änderung sichtbar
- **WHEN** der Benutzer im Grundriss eine Wand verschiebt
- **THEN** zeigt die 3D-Ansicht die Wand ohne Neuladen an der neuen Position

#### Scenario: Giebelwand
- **WHEN** eine Giebelwand im DG unter zwei Schrägen steht
- **THEN** zeigt 3D die Wand mit schrägem Abschluss entlang der Schrägen

### Requirement: Navigation in 3D
Das System SHALL Drehen, Schwenken und Zoomen sowie das Ausblenden von Geschossen oberhalb eines gewählten Geschosses ermöglichen.

#### Scenario: Geschoss von oben
- **WHEN** der Benutzer „bis EG“ wählt
- **THEN** sind OG und DG ausgeblendet und das EG ist von oben einsehbar

### Requirement: Auswahl in 3D
Das System SHALL ein in 3D angeklicktes Element in allen Ansichten auswählen.

#### Scenario: Wand anklicken
- **WHEN** der Benutzer in 3D eine Wand anklickt
- **THEN** ist sie auch im Grundriss ausgewählt und im Baum sind ihre Wandansichten markiert

#### Scenario: Boden anklicken
- **WHEN** der Benutzer in 3D den Boden der Küche anklickt
- **THEN** ist der Raum Küche ausgewählt
