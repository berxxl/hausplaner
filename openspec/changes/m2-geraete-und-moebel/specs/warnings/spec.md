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
Das System SHALL eine Warnung als bewusst übergangen markieren lassen und die Markierungen im Projekt speichern. Übergangene Warnungen MUST NOT als offen zählen und MUST in der Übersicht abrufbar bleiben. Entfällt eine übergangene Warnung, weil das Element gelöscht oder der Verstoß behoben wurde, MUST die Markierung entfallen. Warnungen über Verweise ins Leere MUST NOT übergehbar sein.

#### Scenario: Übergehen
- **WHEN** der Benutzer eine Warnung als bewusst markiert
- **THEN** zählt sie nicht mehr als offen und erscheint unter „übergangen“

#### Scenario: Element gelöscht
- **WHEN** eine übergangene Warnung durch Löschen des Elements entfällt
- **THEN** wird auch die Markierung entfernt

#### Scenario: Erneut verletzt
- **WHEN** der Benutzer eine übergangene, verdeckte Steckdose neben den Schrank verschiebt und später ein anderes Möbel davor stellt
- **THEN** ist die Warnung wieder offen, weil die Markierung beim Beheben entfernt wurde

#### Scenario: Nicht übergehbar
- **WHEN** ein Gerät auf eine Fläche verweist, die es nicht gibt
- **THEN** bietet die Warnung nur „Löschen“ an und lässt sich nicht übergehen
