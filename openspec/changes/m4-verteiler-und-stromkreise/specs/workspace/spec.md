# Spec Delta

## MODIFIED Requirements

### Requirement: Aufbau der Oberfläche
Das System SHALL links einen Strukturbaum, in der Mitte den aktiven Editor und rechts die Eigenschaften der Auswahl zeigen. Im Editorbereich MUST zwischen Grundriss, Flächenansicht, 3D und der Belegungsansicht „Verteiler“ umgeschaltet werden können.

#### Scenario: Fläche über Baum öffnen
- **WHEN** der Benutzer im Baum „OG › Bad › Wand Nord“ anklickt
- **THEN** öffnet sich deren Wandansicht im Editorbereich

#### Scenario: Belegung öffnen
- **WHEN** der Benutzer die UV OG auswählt und „Belegung öffnen“ wählt
- **THEN** zeigt der Editorbereich im Tab „Verteiler“ die Felder und Reihen der UV OG

### Requirement: Strukturbaum
Das System SHALL im Strukturbaum die Geschosse nach Höhenlage, je Geschoss die Räume und darunter deren Wandansichten (im Uhrzeigersinn ab Nord), Decke, Boden und Schrägen zeigen. Wandseiten ohne angrenzenden Raum, darunter alle Außenseiten, MUST unter „Flächen ohne Raum“ des Geschosses stehen. Unter den Geschossen MUST ein Baum „Verteiler“ die Verteiler nach ihrer Hierarchie und je Verteiler seine Stromkreise zeigen.

#### Scenario: Außenseiten im Baum
- **WHEN** das EG vier Außenwände hat
- **THEN** stehen deren Außenseiten unter „EG › Flächen ohne Raum“, nach Richtung sortiert und benannt wie „Nord außen“, und lassen sich von dort öffnen

#### Scenario: Wand ohne Raum
- **WHEN** eine Innenwand gezeichnet ist, an die noch kein Raum grenzt
- **THEN** stehen ihre beiden Seiten unter „Flächen ohne Raum“

#### Scenario: Stromkreis im Baum
- **WHEN** die UV EG den Stromkreis „F12 Küche Steckdosen“ hat und der Benutzer ihn im Baum anklickt
- **THEN** ist F12 ausgewählt und seine Eigenschaften stehen rechts

### Requirement: Gemeinsame Auswahl
Das System SHALL Geschosse, Wände, Räume, Öffnungen, Schrägen, Geräte, Möbel, Trassenknoten, Trassensegmente, Leitungen, Verteiler und Stromkreise auswählbar machen und eine Auswahl in allen Ansichten gleichzeitig hervorheben. Bei Auswahl einer Wand MUST der Baum alle Wandansichten dieser Wand markieren. Geräte derselben Fläche und Trassensegmente MUST sich mit Shift-Klick gemeinsam auswählen lassen, im Grundriss auch Geräte verschiedener Flächen.

#### Scenario: Auswahl im Grundriss
- **WHEN** der Benutzer im Grundriss eine Wand zwischen Küche und Flur auswählt
- **THEN** sind im Baum „Küche › Wand …“ und „Flur › Wand …“ markiert und ihre Eigenschaften stehen rechts

#### Scenario: Gerät in 3D auswählen
- **WHEN** der Benutzer in der 3D-Ansicht auf einen Deckenauslass klickt
- **THEN** ist der Deckenauslass auch im Grundriss und im Deckenspiegel hervorgehoben und seine Eigenschaften stehen rechts

#### Scenario: Mehrere Segmente verlegt
- **WHEN** der Benutzer drei Segmente mit Shift-Klick auswählt und den Status „verlegt“ setzt
- **THEN** haben alle drei den Status verlegt, und Rückgängig nimmt das in einem Schritt zurück

#### Scenario: Geräte verschiedener Wände
- **WHEN** der Benutzer im Grundriss mit Shift-Klick zwei Rollladenmotoren an verschiedenen Wänden auswählt
- **THEN** sind beide ausgewählt und ihre gemeinsamen Eigenschaften stehen rechts

### Requirement: Projekteinstellungen
Das System SHALL Projektname, Nordrichtung, Leitungszuschläge, TE-Reserve, Aktorreserve und KNX-Linien in den Projekteinstellungen bearbeiten lassen. Die Änderung MUST rückgängig gemacht werden können, und die Namen der Wandansichten MUST der neuen Nordrichtung folgen.

#### Scenario: Nordrichtung ändern
- **WHEN** ein achsparalleler rechteckiger Raum die Wandansichten „Wand Nord“, „Wand Ost“, „Wand Süd“ und „Wand West“ hat und der Benutzer die Nordrichtung auf 90° stellt
- **THEN** heißt die bisherige „Wand Ost“ nun „Wand Nord“, und Baum und Ansichten zeigen die neuen Namen

#### Scenario: TE-Reserve ändern
- **WHEN** der Benutzer die TE-Reserve auf 30 % stellt
- **THEN** prüfen alle Verteiler gegen 30 %, und Rückgängig stellt 25 % wieder her

### Requirement: Gewerkfilter
Das System SHALL Elemente nach Gewerk (Strom, KNX, Daten, Leerrohr, Kältemittel, Kondensat, Sonstiges) und zusätzlich die Kategorien Möbel und Trassen ein- und ausblenden. Leitungen MUST dem Gewerk ihres Leitungstyps folgen. Der Filter MUST in Grundriss, Flächenansichten und 3D gleichzeitig gelten; das Gebäude und die Verteiler bleiben immer sichtbar.

#### Scenario: Nur KNX
- **WHEN** der Benutzer alle Gewerke außer KNX und die Möbel ausblendet
- **THEN** zeigen Grundriss, Flächenansichten und 3D nur Gebäude, Verteiler, Trassen und KNX-Geräte

#### Scenario: Möbel ausblenden
- **WHEN** der Benutzer die Kategorie Möbel ausblendet
- **THEN** verschwinden Möbel und ihre Silhouetten in allen Ansichten, Geräte bleiben sichtbar

#### Scenario: Trassen ausblenden
- **WHEN** der Benutzer die Kategorie Trassen ausblendet
- **THEN** verschwinden Segmente, Knoten und Durchbrüche in allen Ansichten, Geräte und Möbel bleiben sichtbar
