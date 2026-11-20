# Spec Delta

## Purpose

Sammelt alle Regelverstöße an einer Stelle. Warnungen sperren nichts, lassen sich aber bewusst übergehen und nachvollziehen.

## ADDED Requirements

### Requirement: Warnungen berechnen
Das System SHALL Warnungen aus den Regeln bei jeder Modelländerung neu berechnen und am betroffenen Element in allen Ansichten kennzeichnen.

#### Scenario: Warnung verschwindet
- **WHEN** der Benutzer eine verdeckte Steckdose neben den Schrank verschiebt
- **THEN** verschwindet die Warnung ohne weitere Aktion

### Requirement: Warnungsübersicht
Das System SHALL alle offenen Warnungen mit Regel, Element und Ort auflisten; ein Klick MUST zum Element in der passenden Ansicht führen.

#### Scenario: Zur Ursache springen
- **WHEN** der Benutzer in der Übersicht eine Warnung anklickt
- **THEN** öffnet sich die Ansicht mit dem Element und es ist ausgewählt

### Requirement: Warnung bewusst übergehen
Das System SHALL eine Warnung als bewusst übergangen markieren lassen. Übergangene Warnungen MUST NOT als offen zählen und MUST in der Übersicht abrufbar bleiben.

#### Scenario: Übergehen
- **WHEN** der Benutzer eine Warnung als bewusst markiert
- **THEN** zählt sie nicht mehr als offen und erscheint unter „übergangen“

#### Scenario: Erneut verletzt
- **WHEN** eine übergangene Warnung durch Löschen des Elements entfällt
- **THEN** wird auch die Markierung entfernt
