# device-placement Specification

## Purpose

Legt fest, wie Geräte auf Flächen des Gebäudes gesetzt, positioniert und dokumentiert werden.

## Requirements

### Requirement: Gerät auf Fläche setzen
Das System SHALL ein Gerät eines Katalogtyps auf einer Fläche platzieren, deren Art der Typ als Montageart zulässt. Auf Wänden MUST die Standardhöhe des Typs vorbelegt werden.

#### Scenario: Steckdose setzen
- **WHEN** der Benutzer in der Wandansicht „Steckdose“ wählt und auf die Wand klickt
- **THEN** sitzt die Steckdose an der Klickposition in 300 mm über OKFF

#### Scenario: Unzulässige Fläche
- **WHEN** der Benutzer einen Präsenzmelder (nur Decke) in einer Wandansicht setzen will
- **THEN** lässt das System dies nicht zu und nennt die zulässigen Montagearten

### Requirement: Platzieren im Grundriss
Das System SHALL Wandgeräte auch im Grundriss setzen lassen; das Gerät MUST dabei der Wandseite zugeordnet werden, an der geklickt wurde.

#### Scenario: Schalter im Grundriss
- **WHEN** der Benutzer im Grundriss neben der Tür an die Flurseite der Wand klickt
- **THEN** sitzt ein Schalter auf der Flur-Wandseite in Standardhöhe

### Requirement: Exakte Position
Das System SHALL die Position eines Geräts als Abstand zur linken Raumecke bzw. zu einer gewählten Bezugskante und als Höhe über OKFF anzeigen und numerisch ändern lassen; die Rohbauhöhe MUST zusätzlich angezeigt werden.

#### Scenario: Höhe eingeben
- **WHEN** der Benutzer für einen Schalter 1050 mm eingibt und der Fußbodenaufbau 100 mm beträgt
- **THEN** zeigt das System Höhe über OKFF 1050 mm und Rohbauhöhe 1150 mm

### Requirement: Gerätekombinationen ausrichten
Das System SHALL mehrere Geräte waagerecht oder senkrecht in einem gewählten Achsabstand (Standard 71 mm) als Kombination anordnen.

#### Scenario: Dreifachkombination
- **WHEN** der Benutzer drei Geräte auswählt und „waagerecht kombinieren“ wählt
- **THEN** liegen sie auf einer Höhe im Abstand von 71 mm

### Requirement: Darstellung in allen Ansichten
Das System SHALL platzierte Geräte als Symbol in Grundriss und Flächenansicht und als 3D-Form in der 3D-Ansicht zeigen.

#### Scenario: Deckenauslass
- **WHEN** ein Deckenauslass in der Küche gesetzt ist
- **THEN** erscheint er im Deckenspiegel, als Symbol im Grundriss und in 3D an der Decke

### Requirement: Status
Das System SHALL jedem Gerät einen Status geplant, verlegt oder geprüft geben; neue Geräte MUST den Status geplant haben.

#### Scenario: Nach dem Verlegen
- **WHEN** der Benutzer eine Dose nach dem Setzen auf die gemessene Position korrigiert und auf „verlegt“ stellt
- **THEN** wird sie mit dem Status verlegt in Ansichten und Listen gekennzeichnet

### Requirement: Mitbewegen mit dem Gebäude
Das System SHALL Geräte relativ zu ihrer Fläche speichern, sodass sie beim Ändern der Wand mitwandern; liegt ein Gerät danach außerhalb der Fläche, MUST eine Warnung entstehen.

#### Scenario: Wand gekürzt
- **WHEN** eine Wand so gekürzt wird, dass eine Dose außerhalb liegt
- **THEN** meldet das System eine Warnung für diese Dose

#### Scenario: Wand gelöscht
- **WHEN** der Benutzer eine Wand mit zwei Steckdosen löscht
- **THEN** werden die Steckdosen im selben Schritt mitgelöscht, und Rückgängig stellt Wand und Steckdosen wieder her

### Requirement: Höhenbezug bei geänderter Raumzuordnung
Das System SHALL die Rohbauhöhe eines Wandgeräts erhalten, wenn sich der Raum ändert, zu dem sein Wandabschnitt gehört. Ändert sich nur der Fußbodenaufbau eines Raums, MUST die Höhe über OKFF erhalten bleiben.

#### Scenario: Raum nachträglich angelegt
- **WHEN** eine Dose auf einer Wandseite ohne Raum in 400 mm über Rohfußboden sitzt und der Benutzer dort einen Raum mit 100 mm Fußbodenaufbau anlegt
- **THEN** sitzt die Dose in 300 mm über OKFF und weiterhin in 400 mm Rohbauhöhe

#### Scenario: Estrich geändert
- **WHEN** der Benutzer den Fußbodenaufbau eines Raums von 100 auf 140 mm ändert, in dem ein Schalter in 1050 mm über OKFF sitzt
- **THEN** bleibt der Schalter in 1050 mm über OKFF, und seine Rohbauhöhe wird 1190 mm
