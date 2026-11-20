# Spec Delta

## Purpose

Erfasst das Gebäude maßlich: Geschosse, Wände, Räume, Öffnungen, Decken und Dachschrägen, inklusive des Unterschieds zwischen Rohbau und fertigem Zustand.

## ADDED Requirements

### Requirement: Geschosse
Das System SHALL beliebig viele Geschosse mit Name, Höhenlage des Rohfußbodens und Rohbau-Geschosshöhe (Oberkante Rohfußboden bis Unterkante Rohdecke) verwalten. Ein neues Geschoss MUST Rohbauhöhe und Standardaufbauten des höchsten Geschosses übernehmen und 300 mm über dessen Rohdecke vorgeschlagen werden. Geschosse MUST mit allen ihren Bauteilen gelöscht werden können.

#### Scenario: Geschoss anlegen
- **WHEN** der Benutzer „DG“ mit Höhenlage 5600 mm und Rohbauhöhe 2450 mm anlegt
- **THEN** erscheint „DG“ im Strukturbaum und in 3D über den anderen Geschossen

#### Scenario: Reihenfolge nach Höhenlage
- **WHEN** der Benutzer zuerst „OG“ (2800 mm), dann „KG“ (−2600 mm) anlegt
- **THEN** zeigen Baum und 3D die Reihenfolge KG, EG, OG

#### Scenario: Vorschlag für das nächste Geschoss
- **WHEN** das höchste Geschoss „EG“ die Höhenlage 0 und die Rohbauhöhe 2500 mm hat und der Benutzer ein Geschoss hinzufügt
- **THEN** schlägt das System die Höhenlage 2800 mm, die Rohbauhöhe 2500 mm und die Standardaufbauten des EG vor

#### Scenario: Geschoss löschen
- **WHEN** der Benutzer das Geschoss „DG“ löscht und speichert
- **THEN** sind seine Wände, Räume und Öffnungen entfernt und `geschosse/dg.yaml` ist gelöscht; nach Rückgängig und Speichern ist die Datei wieder da

### Requirement: Wände zeichnen
Das System SHALL lotrechte, gerade Wände über Anfangs- und Endpunkt der Achse, Dicke und Art (Außen- oder Innenwand) erfassen. Im Grundriss MUST jeder Winkel möglich sein. Die Wandhöhe MUST der Rohbauhöhe des Geschosses entsprechen, sofern für die Wand keine abweichende Höhe angegeben ist. Eine neue Wand MUST eine Innenwand mit der zuletzt verwendeten Dicke sein, beim ersten Mal 240 mm.

#### Scenario: Wand nachzeichnen
- **WHEN** der Benutzer auf dem Hintergrund von Ecke zu Ecke klickt und Dicke 240 mm wählt
- **THEN** entsteht eine Wand mit dieser Achse und Dicke

#### Scenario: Fang
- **WHEN** der Benutzer weniger als 20 mm neben einem bestehenden Wandende oder einer Wandachse klickt
- **THEN** rastet der Punkt dort ein; weicht die Richtung höchstens 5° von waagerecht oder senkrecht ab, wird sie auf diese Richtung gesetzt

#### Scenario: Zeichnen über die Kante
- **WHEN** der Benutzer im Modus „linke Kante“ eine 240 mm dicke Wand entlang der im Plan sichtbaren Wandkante von (0, 0) nach (4000, 0) zeichnet
- **THEN** ist die gezeichnete Linie die linke Kante der Wand und die Achse liegt von (0, −120) nach (4000, −120)

#### Scenario: Niedrige Wand
- **WHEN** der Benutzer für eine Brüstungswand die Höhe 1100 mm einträgt
- **THEN** endet diese Wand in Wandansicht und 3D bei 1100 mm über Rohfußboden

### Requirement: Maße korrigieren
Das System SHALL Länge, Dicke, Anfangs- und Endpunkt einer Wand numerisch editierbar machen und eine Wand parallel um einen eingegebenen Betrag verschieben. Eine Längenänderung MUST den Endpunkt entlang der Achse verschieben und den Anfangspunkt festhalten. Angeschlossene Wände MUST verbunden bleiben, solange der Anschlusspunkt auf der geänderten Wand liegt; sonst MUST der Anschluss mit einer Meldung gelöst werden.

#### Scenario: Wandlänge korrigieren
- **WHEN** der Benutzer die Länge einer Wand von 4180 auf 4260 mm ändert
- **THEN** wandert der Endpunkt um 80 mm entlang der Achse; eine dort über Eck anschließende Wand erhält denselben Endpunkt, ihr anderes Ende bleibt

#### Scenario: Wand parallel verschieben
- **WHEN** in einem Raum mit den Wandachsen Süd (0, 0)–(4000, 0), Ost (4000, 0)–(4000, 3000), Nord (4000, 3000)–(0, 3000) und West (0, 3000)–(0, 0) die Ostwand um 200 mm nach außen verschoben wird
- **THEN** liegt die Ostwand bei x = 4200, die Südwand endet bei (4200, 0), die Nordwand beginnt bei (4200, 3000) und beide behalten ihre Richtung

#### Scenario: T-Anschluss
- **WHEN** eine Innenwand mit ihrem Endpunkt auf der Achse einer Außenwand endet und die Außenwand um 50 mm parallel verschoben wird
- **THEN** verlängert oder verkürzt sich die Innenwand so, dass ihr Endpunkt weiter auf der Achse der Außenwand liegt

#### Scenario: T-Anschluss beim Endpunkt verschieben
- **WHEN** die Innenwand (2000, 3000)–(2000, 0) mit ihrem Endpunkt auf der Achse der Südwand (0, 0)–(4000, 0) endet und der Endpunkt der Südwand nach (4000, 500) verschoben wird
- **THEN** endet die Innenwand bei (2000, 250) und bleibt senkrecht

#### Scenario: T-Anschluss gelöst
- **WHEN** in derselben Lage die Südwand auf 1500 mm Länge gekürzt wird
- **THEN** bleibt die Innenwand unverändert und das System meldet „T-Anschluss gelöst“

#### Scenario: T-Anschluss beim Parallelverschieben gelöst
- **WHEN** eine unter 45° schräge Innenwand mit ihrem Endpunkt 50 mm vor dem Ende der Achse einer Außenwand anschließt und die Außenwand um 100 mm parallel verschoben wird, sodass der Schnitt mit der verlängerten Innenwand mehr als 20 mm hinter dem Wandende läge
- **THEN** bleibt die Innenwand unverändert und das System meldet „T-Anschluss gelöst“

### Requirement: Räume erkennen
Das System SHALL einen Raum durch Klick in eine von Wänden umschlossene Fläche anlegen und seine Rohbau-Innenkontur aus den Wänden ableiten. Lücken bis 20 mm MUST als geschlossen gelten.

#### Scenario: Raum anlegen
- **WHEN** der Benutzer in die von vier Wänden umschlossene Fläche klickt und „Küche“ eingibt
- **THEN** entsteht der Raum „Küche“ mit der Kontur der Wandinnenseiten im Rohbau

#### Scenario: Nicht geschlossen
- **WHEN** die angeklickte Fläche eine Lücke von mehr als 20 mm hat
- **THEN** markiert das System die offenen Wandenden an der Lücke und legt keinen Raum an

#### Scenario: Klick in bestehenden Raum
- **WHEN** der Benutzer in eine Fläche klickt, die bereits zum Raum „Küche“ gehört
- **THEN** wählt das System die Küche aus und legt keinen neuen Raum an

#### Scenario: Frei stehende Wand im Raum
- **WHEN** im Wohnzimmer eine frei stehende Brüstungswand ohne Anschluss an die Raumkontur steht
- **THEN** gehört sie zum Wohnzimmer und beide Seiten sind Wandansichten des Wohnzimmers

### Requirement: Raumkontur folgt den Wänden
Das System SHALL die Kontur eines Raums nach jeder Wandänderung neu ableiten. Ist der Raum danach nicht mehr geschlossen oder fließt er mit einem anderen Raum zusammen, MUST die bisherige Kontur erhalten bleiben und eine Warnung entstehen.

#### Scenario: Wand verschoben
- **WHEN** eine Wand der Küche um 100 mm verschoben wird
- **THEN** passt sich die Kontur der Küche an

#### Scenario: Wand gelöscht
- **WHEN** eine Außenwand der Küche gelöscht wird
- **THEN** behält die Küche ihre bisherige Kontur und das System meldet „Raum nicht geschlossen: Küche“

#### Scenario: Räume verschmolzen
- **WHEN** die Trennwand zwischen Küche und Essen gelöscht wird
- **THEN** behalten beide Räume ihre bisherige Kontur und das System meldet bei der Küche „Raum mit Essen verschmolzen“ und beim Essen „Raum mit Küche verschmolzen“

#### Scenario: Offen hat Vorrang
- **WHEN** die Trennwand zwischen Küche und Essen und zugleich eine Außenwand der Küche gelöscht werden
- **THEN** meldet das System für beide Räume nur „Raum nicht geschlossen“

#### Scenario: Raum geteilt
- **WHEN** eine neue Wand den Raum „Wohnen“ in zwei Teile teilt
- **THEN** behält „Wohnen“ den Teil, in dem sein ursprünglicher Klickpunkt liegt; der andere Teil ist ohne Raum, bis er angeklickt wird

#### Scenario: Raum neu erkennen
- **WHEN** der Benutzer für die als offen gemeldete Küche „Raum neu erkennen“ wählt und in eine geschlossene Fläche klickt
- **THEN** behält die Küche Name, Fußbodenaufbau, Putz, Abhängung und Schrägen und erhält die Kontur der angeklickten Fläche

### Requirement: Öffnungen
Das System SHALL Fenster, Türen und Durchgänge in einer Wand mit Abstand vom Wandanfang, Breite, Höhe und Brüstungshöhe ab Rohfußboden in Rohbaumaßen erfassen. Öffnungen, die über das Wandende hinausragen, sich überlappen oder höher als die Wand reichen, MUST das System annehmen und mit einer Warnung melden.

#### Scenario: Fenster setzen
- **WHEN** der Benutzer ein Fenster 1010 × 1385 mm mit Brüstung 900 mm in eine Wand setzt
- **THEN** erscheint es im Grundriss, in den Ansichten beider Wandseiten und in 3D

#### Scenario: Fenster über das Wandende
- **WHEN** der Benutzer ein 1010 mm breites Fenster mit Abstand 3500 mm in eine 4000 mm lange Wand setzt
- **THEN** wird das Fenster angelegt, am Wandende abgeschnitten und rot umrandet dargestellt, und die Warnungsleiste meldet „Öffnung ungültig: über Wandende“

### Requirement: Rollladenkasten
Das System SHALL einem Fenster optional einen Rollladenkasten mit Lage (innen, außen, Aufsatz) und Höhe zuordnen. Der Kasten MUST unmittelbar über der Rohbauöffnung in deren Breite liegen. Innen liegende Kästen und Aufsatzkästen MUST in der Innenansicht, außen liegende in der Außenansicht erscheinen.

#### Scenario: Aufsatzkasten
- **WHEN** der Benutzer einem Fenster einen Aufsatzkasten mit 250 mm Höhe gibt
- **THEN** zeigt die Innenansicht den Kasten als 250 mm hohes Feld direkt über dem Fenster

#### Scenario: Vorbaukasten außen
- **WHEN** der Kasten die Lage „außen“ hat
- **THEN** erscheint er nur in der Ansicht der Außenseite

### Requirement: Rohbaumaße und Anzeige über OKFF
Das System SHALL Wände, Öffnungen und Schrägen in Rohbaumaßen speichern und je Geschoss Standardwerte sowie je Raum abweichende Werte für Fußbodenaufbau, Putzstärke und Deckenabhängung führen. Höhen in den Ansichten MUST über OKFF angezeigt werden, das Rohbaumaß MUST zusätzlich abrufbar sein.

#### Scenario: Estrich wird dicker
- **WHEN** im Bad der Fußbodenaufbau von 80 auf 120 mm erhöht wird und ein Fenster dort eine Rohbau-Brüstung von 900 mm hat
- **THEN** bleibt die Rohbau-Brüstung 900 mm und die angezeigte Brüstung über OKFF sinkt von 820 auf 780 mm

### Requirement: Dachschrägen
Das System SHALL je Raum Dachschrägen über eine Grundlinie im Grundriss, die Höhe an der Grundlinie und den Neigungswinkel erfassen. Die Höhe MUST ab Oberkante Rohfußboden bis zur Unterseite der Rohschräge gelten, die Schräge MUST von der Grundlinie zur Seite des Raumschwerpunkts hin ansteigen. Die fertige Schräge liegt um die Putzstärke des Raums tiefer.

#### Scenario: Kniestock
- **WHEN** im DG eine Schräge mit 1000 mm an der Traufwand und 45° definiert ist, der Fußbodenaufbau 100 mm und die Putzstärke 0 mm beträgt
- **THEN** endet die Ansicht der Traufwand 900 mm über OKFF, die Giebelwand zeigt den schrägen Anschnitt und die Schräge ist eine eigene Fläche

### Requirement: Deckenhöhe
Das System SHALL die Höhe der Rohdecke an jedem Punkt eines Raums als Minimum aus der Rohbauhöhe abzüglich Abhängung und allen Schrägen bestimmen.

#### Scenario: Zwei Schrägen
- **WHEN** ein Raum zwei gegenüberliegende Schrägen und eine Rohbauhöhe von 2450 mm hat
- **THEN** ist die Decke in der Mitte flach bei 2450 mm und fällt zu beiden Seiten entlang der Schrägen ab
