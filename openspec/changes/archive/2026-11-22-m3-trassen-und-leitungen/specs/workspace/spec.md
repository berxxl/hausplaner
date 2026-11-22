# Spec Delta

## MODIFIED Requirements

### Requirement: Gemeinsame Auswahl
Das System SHALL Geschosse, Wände, Räume, Öffnungen, Schrägen, Geräte, Möbel, Trassenknoten, Trassensegmente und Leitungen auswählbar machen und eine Auswahl in allen Ansichten gleichzeitig hervorheben. Bei Auswahl einer Wand MUST der Baum alle Wandansichten dieser Wand markieren. Geräte derselben Fläche und Trassensegmente MUST sich mit Shift-Klick gemeinsam auswählen lassen.

#### Scenario: Auswahl im Grundriss
- **WHEN** der Benutzer im Grundriss eine Wand zwischen Küche und Flur auswählt
- **THEN** sind im Baum „Küche › Wand …“ und „Flur › Wand …“ markiert und ihre Eigenschaften stehen rechts

#### Scenario: Gerät in 3D auswählen
- **WHEN** der Benutzer in der 3D-Ansicht auf einen Deckenauslass klickt
- **THEN** ist der Deckenauslass auch im Grundriss und im Deckenspiegel hervorgehoben und seine Eigenschaften stehen rechts

#### Scenario: Mehrere Segmente verlegt
- **WHEN** der Benutzer drei Segmente mit Shift-Klick auswählt und den Status „verlegt“ setzt
- **THEN** haben alle drei den Status verlegt, und Rückgängig nimmt das in einem Schritt zurück

### Requirement: Gewerkfilter
Das System SHALL Elemente nach Gewerk (Strom, KNX, Daten, Leerrohr, Kältemittel, Kondensat, Sonstiges) und zusätzlich die Kategorien Möbel und Trassen ein- und ausblenden. Leitungen MUST dem Gewerk ihres Leitungstyps folgen. Der Filter MUST in Grundriss, Flächenansichten und 3D gleichzeitig gelten; das Gebäude bleibt immer sichtbar.

#### Scenario: Nur KNX
- **WHEN** der Benutzer alle Gewerke außer KNX und die Möbel ausblendet
- **THEN** zeigen Grundriss, Flächenansichten und 3D nur Gebäude, Trassen und KNX-Geräte

#### Scenario: Möbel ausblenden
- **WHEN** der Benutzer die Kategorie Möbel ausblendet
- **THEN** verschwinden Möbel und ihre Silhouetten in allen Ansichten, Geräte bleiben sichtbar

#### Scenario: Trassen ausblenden
- **WHEN** der Benutzer die Kategorie Trassen ausblendet
- **THEN** verschwinden Segmente, Knoten und Durchbrüche in allen Ansichten, Geräte und Möbel bleiben sichtbar

## ADDED Requirements

### Requirement: Baum auf- und zuklappen
Das System SHALL Geschosse, Räume und „Flächen ohne Raum“ im Strukturbaum auf- und zuklappbar machen, per Klick auf das Pfeilsymbol und mit den Pfeiltasten rechts/links. Die App MUST sich den Zustand über das Neuladen hinaus merken. Ein zugeklappter Eintrag MUST markiert sein, wenn ein Eintrag darunter ausgewählt oder markiert ist.

#### Scenario: Geschoss zuklappen
- **WHEN** der Benutzer beim Keller auf das Pfeilsymbol klickt
- **THEN** verschwinden dessen Räume aus dem Baum, die Auswahl bleibt unverändert, und nach dem Neuladen ist der Keller weiter zugeklappt

#### Scenario: Markierung im zugeklappten Raum
- **WHEN** der Raum „Küche“ zugeklappt ist und der Benutzer im Grundriss eine Wand der Küche auswählt
- **THEN** ist der Eintrag „Küche“ markiert

### Requirement: Nordpfeil im Grundriss
Das System SHALL im Grundriss oben rechts einen Nordpfeil zeigen, der der Nordrichtung der Projekteinstellungen folgt. Der Plan selbst MUST dabei ungedreht bleiben.

#### Scenario: Nordrichtung 30°
- **WHEN** der Benutzer die Nordrichtung in den Projekteinstellungen auf 30° stellt
- **THEN** zeigt der Nordpfeil um 30° im Uhrzeigersinn gedreht nach Norden, und Wände und Plan bleiben unverändert ausgerichtet
