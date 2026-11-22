# Spec Delta

## ADDED Requirements

### Requirement: Gewerkfilter
Das System SHALL Elemente nach Gewerk (Strom, KNX, Daten, Leerrohr, Kältemittel, Kondensat, Sonstiges) und zusätzlich die Kategorie Möbel ein- und ausblenden. Der Filter MUST in Grundriss, Flächenansichten und 3D gleichzeitig gelten; das Gebäude bleibt immer sichtbar.

#### Scenario: Nur KNX
- **WHEN** der Benutzer alle Gewerke außer KNX und die Möbel ausblendet
- **THEN** zeigen Grundriss, Flächenansichten und 3D nur Gebäude und KNX-Geräte

#### Scenario: Möbel ausblenden
- **WHEN** der Benutzer die Kategorie Möbel ausblendet
- **THEN** verschwinden Möbel und ihre Silhouetten in allen Ansichten, Geräte bleiben sichtbar

## MODIFIED Requirements

### Requirement: Gemeinsame Auswahl
Das System SHALL Geschosse, Wände, Räume, Öffnungen, Schrägen, Geräte und Möbel auswählbar machen und eine Auswahl in allen Ansichten gleichzeitig hervorheben. Bei Auswahl einer Wand MUST der Baum alle Wandansichten dieser Wand markieren. Geräte derselben Fläche MUST sich mit Shift-Klick gemeinsam auswählen lassen.

#### Scenario: Auswahl im Grundriss
- **WHEN** der Benutzer im Grundriss eine Wand zwischen Küche und Flur auswählt
- **THEN** sind im Baum „Küche › Wand …“ und „Flur › Wand …“ markiert und ihre Eigenschaften stehen rechts

#### Scenario: Gerät in 3D auswählen
- **WHEN** der Benutzer in der 3D-Ansicht auf einen Deckenauslass klickt
- **THEN** ist der Deckenauslass auch im Grundriss und im Deckenspiegel hervorgehoben und seine Eigenschaften stehen rechts
