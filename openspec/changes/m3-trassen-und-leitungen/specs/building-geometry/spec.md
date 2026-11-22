# Spec Delta

## MODIFIED Requirements

### Requirement: Öffnung verschieben
Das System SHALL eine Öffnung mit dem Auswahlwerkzeug und mit dem Werkzeug „Öffnung“ entlang ihrer Wand verschieben lassen; das Verschieben MUST ein Befehl sein. Mit dem Werkzeug „Öffnung“ MUST ein Druck auf eine vorhandene Öffnung diese auswählen und verschieben, statt eine neue anzulegen.

#### Scenario: Fenster verschieben
- **WHEN** der Benutzer ein Fenster mit dem Auswahlwerkzeug 1000 mm entlang der Wand zieht
- **THEN** ist sein Abstand vom Wandanfang um 1000 mm größer, und ein Rückgängig stellt den alten Abstand her

#### Scenario: Verschieben mit dem Werkzeug „Öffnung“
- **WHEN** der Benutzer mit dem Werkzeug „Öffnung“ ein vorhandenes Fenster 500 mm entlang der Wand zieht
- **THEN** ist das Fenster ausgewählt und um 500 mm verschoben, und es entsteht keine neue Öffnung
