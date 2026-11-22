# Spec Delta

## ADDED Requirements

### Requirement: Rohbauhöhe je Raum
Das System SHALL für einen Raum eine eigene Rohbauhöhe (Oberkante Rohfußboden bis Unterkante Rohdecke) erfassen lassen, die für diesen Raum die Rohbauhöhe des Geschosses ersetzt. Ohne eigene Angabe MUST die Rohbauhöhe des Geschosses gelten. Wände MUST ihre eigene Höhe behalten.

#### Scenario: Anbau höher als Bestand
- **WHEN** das Geschoss 2405 mm Rohbauhöhe hat und der Benutzer für den Raum „Wohnen“ 2460 mm bei 15 mm Putz einträgt
- **THEN** liegt die fertige Decke in Wohnen 2445 mm über Rohfußboden, in den übrigen Räumen 2390 mm, und die Wandhöhen bleiben unverändert

#### Scenario: Angabe entfernt
- **WHEN** der Benutzer die eigene Rohbauhöhe des Raums leert
- **THEN** gilt wieder die Rohbauhöhe des Geschosses

### Requirement: Öffnung zeichnen
Das System SHALL eine Öffnung im Grundriss durch Aufziehen entlang einer Wand anlegen lassen; die Strecke MUST Abstand vom Wandanfang und Breite vorbelegen. Ein Klick ohne Aufziehen MUST ein Fenster in Standardbreite mittig auf den Klickpunkt vorbelegen. Ein Wechsel der Art im Dialog MUST den Abstand unverändert lassen.

#### Scenario: Fenster aufziehen
- **WHEN** der Benutzer mit dem Werkzeug „Öffnung“ auf einer Wand von 4000 mm bis 5200 mm ab Wandanfang zieht
- **THEN** zeigt der Dialog Abstand 4000 mm und Breite 1200 mm

#### Scenario: Art wechseln
- **WHEN** der Benutzer im Dialog die Art von Fenster auf Tür ändert
- **THEN** bleibt der Abstand vom Wandanfang unverändert, Höhe und Brüstung zeigen die Standardwerte der Tür, und eine aufgezogene Breite bleibt erhalten

### Requirement: Öffnung verschieben
Das System SHALL eine Öffnung mit dem Auswahlwerkzeug entlang ihrer Wand verschieben lassen; das Verschieben MUST ein Befehl sein.

#### Scenario: Fenster verschieben
- **WHEN** der Benutzer ein Fenster mit dem Auswahlwerkzeug 1000 mm entlang der Wand zieht
- **THEN** ist sein Abstand vom Wandanfang um 1000 mm größer, und ein Rückgängig stellt den alten Abstand her
