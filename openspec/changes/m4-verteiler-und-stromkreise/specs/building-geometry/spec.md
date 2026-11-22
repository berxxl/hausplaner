# Spec Delta

## ADDED Requirements

### Requirement: Gedachte Raumgrenze
Das System SHALL im Grundriss gedachte Raumgrenzen als Linien ohne Dicke zeichnen lassen, die Räume ohne trennende Wand voneinander abgrenzen (z. B. Flur und Wohnraum, Bereiche unter einem Unterzug). Eine Raumgrenze MUST nur für die Raumerkennung zählen: Sie erscheint nicht in 3D und hat keine Wandansichten, Öffnungen oder Geräte. Trassen auf Decke und Boden MUST über eine Raumgrenze hinweg zusammenhängen.

#### Scenario: Flur abgrenzen
- **WHEN** der Benutzer zwischen zwei Wänden eine Raumgrenze zeichnet und auf beiden Seiten einen Raum anlegt
- **THEN** gibt es zwei Räume, die an der Linie aneinandergrenzen, ohne Wandansicht entlang der Linie

#### Scenario: Trasse über die Raumgrenze
- **WHEN** eine Deckentrasse im Flur an der Raumgrenze endet
- **THEN** erscheint ihr Knoten auch im Deckenspiegel des Nachbarraums und die Trasse lässt sich dort fortsetzen

#### Scenario: Raumgrenze löschen
- **WHEN** der Benutzer die Raumgrenze löscht
- **THEN** werden die beiden Räume als verschmolzen gemeldet, und Rückgängig stellt die Grenze und beide Konturen her

### Requirement: Wandende rastet auf die Achse
Das System SHALL beim Zeichnen von Wänden ein Ende, das im Wandkörper einer vorhandenen Wand liegt, auf deren Achse legen, damit die Wände verbunden sind.

#### Scenario: Wand bis an die Oberfläche gezeichnet
- **WHEN** der Benutzer eine Innenwand bis an die Innenseite einer 240 mm dicken Außenwand zeichnet
- **THEN** endet die neue Wand auf der Achse der Außenwand und ist mit ihr verbunden
