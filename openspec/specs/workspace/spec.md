# workspace Specification

## Purpose

Legt fest, wie sich der Benutzer in der App bewegt: Aufbau der Oberfläche, Strukturbaum, gemeinsame Auswahl, Rückgängig und Darstellung von Maßen.

## Requirements

### Requirement: Aufbau der Oberfläche
Das System SHALL links einen Strukturbaum, in der Mitte den aktiven Editor und rechts die Eigenschaften der Auswahl zeigen. Im Editorbereich MUST zwischen Grundriss, Flächenansicht und 3D umgeschaltet werden können.

#### Scenario: Fläche über Baum öffnen
- **WHEN** der Benutzer im Baum „OG › Bad › Wand Nord“ anklickt
- **THEN** öffnet sich deren Wandansicht im Editorbereich

### Requirement: Strukturbaum
Das System SHALL im Strukturbaum die Geschosse nach Höhenlage, je Geschoss die Räume und darunter deren Wandansichten (im Uhrzeigersinn ab Nord), Decke, Boden und Schrägen zeigen. Wandseiten ohne angrenzenden Raum, darunter alle Außenseiten, MUST unter „Flächen ohne Raum“ des Geschosses stehen.

#### Scenario: Außenseiten im Baum
- **WHEN** das EG vier Außenwände hat
- **THEN** stehen deren Außenseiten unter „EG › Flächen ohne Raum“, nach Richtung sortiert und benannt wie „Nord außen“, und lassen sich von dort öffnen

#### Scenario: Wand ohne Raum
- **WHEN** eine Innenwand gezeichnet ist, an die noch kein Raum grenzt
- **THEN** stehen ihre beiden Seiten unter „Flächen ohne Raum“

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

### Requirement: Rückgängig und Wiederholen
Das System SHALL jede Modelländerung rückgängig machen und wiederholen können, einschließlich Änderungen an Planhintergrund und Kalibrierung.

#### Scenario: Löschen rückgängig
- **WHEN** der Benutzer eine Wand löscht und danach Rückgängig wählt
- **THEN** ist die Wand mit allen Eigenschaften und Öffnungen wieder da

#### Scenario: Kalibrierung rückgängig
- **WHEN** der Benutzer neu kalibriert und danach Rückgängig wählt
- **THEN** gilt wieder die vorige Kalibrierung

### Requirement: Warnungsleiste
Das System SHALL am unteren Rand die Anzahl der aktuellen Warnungen anzeigen und sie als Liste aufklappen lassen; ein Klick auf eine Warnung MUST das betroffene Objekt auswählen und die passende Ansicht öffnen. Warnungen zu Objekten, die nicht dargestellt werden können, MUST in der Liste eine Aktion „Löschen“ anbieten.

#### Scenario: Offener Raum
- **WHEN** die Küche nach dem Löschen einer Wand nicht mehr geschlossen ist
- **THEN** zeigt die Leiste eine Warnung „Raum nicht geschlossen: Küche“, und ein Klick wählt die Küche im Grundriss aus

### Requirement: Deutsche Oberfläche und Maßeinheiten
Das System SHALL alle Bedienelemente und Meldungen auf Deutsch anzeigen. Eingaben und Bemaßungen MUST in ganzen Millimetern ohne Tausendertrenner erfolgen, zusammengefasste Längen und Flächen in Metern bzw. Quadratmetern mit zwei Nachkommastellen und Dezimalkomma. Die angezeigte Raumfläche MUST die fertige Fläche innerhalb des Putzes sein.

#### Scenario: Wandlänge
- **WHEN** eine Wand 4260 mm lang ist
- **THEN** zeigt die Bemaßung „4260“ und die Eigenschaften zeigen „4260 mm (4,26 m)“

#### Scenario: Raumfläche
- **WHEN** ein Raum fertig, also innerhalb des Putzes, 12,5 m² Grundfläche hat
- **THEN** zeigen die Eigenschaften „12,50 m²“

### Requirement: Eingabe von Werten
Das System SHALL Dezimaleingaben in Millimeterfeldern auf ganze Millimeter runden und Eingaben mit „m“ in Millimeter umrechnen. Winkel MUST mit Komma oder Punkt als Dezimaltrenner eingegeben werden können und auf 0,1° gerundet werden.

#### Scenario: Eingabe in Metern
- **WHEN** der Benutzer als Wandlänge „4,26 m“ eingibt
- **THEN** wird die Wand 4260 mm lang

#### Scenario: Dezimale Millimeter
- **WHEN** der Benutzer als Dicke „240,6“ eingibt
- **THEN** wird die Dicke 241 mm

#### Scenario: Winkel mit Punkt
- **WHEN** der Benutzer als Drehwinkel „1.5“ eingibt
- **THEN** wird der Hintergrund um 1,5° gedreht

### Requirement: Projekteinstellungen
Das System SHALL Projektname und Nordrichtung in den Projekteinstellungen bearbeiten lassen. Die Änderung MUST rückgängig gemacht werden können, und die Namen der Wandansichten MUST der neuen Nordrichtung folgen.

#### Scenario: Nordrichtung ändern
- **WHEN** ein achsparalleler rechteckiger Raum die Wandansichten „Wand Nord“, „Wand Ost“, „Wand Süd“ und „Wand West“ hat und der Benutzer die Nordrichtung auf 90° stellt
- **THEN** heißt die bisherige „Wand Ost“ nun „Wand Nord“, und Baum und Ansichten zeigen die neuen Namen

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
