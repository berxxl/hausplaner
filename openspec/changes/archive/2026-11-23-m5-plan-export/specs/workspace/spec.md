# Spec Delta

## MODIFIED Requirements

### Requirement: Aufbau der Oberfläche
Das System SHALL links einen Strukturbaum, in der Mitte den aktiven Editor und rechts die Eigenschaften der Auswahl zeigen. Im Editorbereich MUST zwischen Grundriss, Flächenansicht, 3D, der Belegungsansicht „Verteiler“ und den „Listen“ umgeschaltet werden können.

#### Scenario: Fläche über Baum öffnen
- **WHEN** der Benutzer im Baum „OG › Bad › Wand Nord“ anklickt
- **THEN** öffnet sich deren Wandansicht im Editorbereich

#### Scenario: Belegung öffnen
- **WHEN** der Benutzer die UV OG auswählt und „Belegung öffnen“ wählt
- **THEN** zeigt der Editorbereich im Tab „Verteiler“ die Felder und Reihen der UV OG

#### Scenario: Gerät aus der Liste auswählen
- **WHEN** der Benutzer im Tab „Listen“ in der Geräteliste die Zeile „Rollladen Bad“ anklickt
- **THEN** ist der Rollladenmotor ausgewählt und seine Eigenschaften stehen rechts
