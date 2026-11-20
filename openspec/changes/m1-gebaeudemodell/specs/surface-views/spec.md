# Spec Delta

## Purpose

Leitet aus dem Gebäudemodell alle Flächen ab, auf denen später Geräte und Trassen liegen, und stellt sie als maßstäbliche 2D-Ansichten dar.

## ADDED Requirements

### Requirement: Flächen ableiten
Das System SHALL automatisch Flächen ableiten: je Wand ihre zwei Seiten als je eine Fläche über die ganze Wandlänge, je Raum Decke, Boden und jede Dachschräge. Die Identität einer Wandseite MUST nur von Wand und Seite abhängen, nicht von Räumen.

#### Scenario: Innenwand zwischen zwei Räumen
- **WHEN** eine Innenwand Küche und Flur trennt
- **THEN** gibt es zwei Wandseiten-Flächen, eine zur Küche und eine zum Flur

#### Scenario: Raum geteilt
- **WHEN** ein Raum durch eine neue Wand in zwei Räume geteilt wird
- **THEN** bleiben die Wandseiten-Flächen der bestehenden Wände dieselben

### Requirement: Angrenzung und Außenseite
Das System SHALL eine Wandseite einem Raum zuordnen, wenn eine Kante der Raumkontur parallel (höchstens 0,5° Abweichung), höchstens 20 mm entfernt und auf mindestens 1 mm Länge an ihr anliegt. Außenseite einer Außenwand MUST die Seite ohne angrenzenden Raum sein; ist das nicht eindeutig, MUST der Benutzer die Außenseite in den Eigenschaften festlegen können.

#### Scenario: Außenwand eines Raums
- **WHEN** eine Außenwand innen an das Wohnzimmer grenzt
- **THEN** ist die Seite zum Wohnzimmer eine Wandansicht des Wohnzimmers und die andere Seite die Außenseite

#### Scenario: Außenwand ohne Raum
- **WHEN** an einer Außenwand noch kein Raum angelegt ist
- **THEN** gilt die linke Seite als Außenseite, bis der Benutzer sie umschaltet

### Requirement: Höhenbezug auf der Wandseite
Das System SHALL Höhen auf einer Wandseite über OKFF des Raums angeben, in dessen Abschnitt der Punkt liegt, und ohne Raum über Oberkante Rohfußboden.

#### Scenario: Unterschiedlicher Fußbodenaufbau
- **WHEN** eine Wandseite an Bad (Aufbau 140 mm) und Flur (Aufbau 100 mm) grenzt und ein Punkt 1000 mm über OKFF im Bad-Abschnitt liegt
- **THEN** liegt der Punkt 1140 mm über Rohfußboden; derselbe Wert im Flur-Abschnitt läge 1100 mm über Rohfußboden

### Requirement: Benennung der Wandansichten
Das System SHALL jede Wandansicht nach der Himmelsrichtung benennen, in der die Wand vom Raum aus liegt (8 Richtungen, Nordrichtung in den Projekteinstellungen). Mehrere Ansichten gleicher Richtung in einem Raum MUST durchnummeriert werden, im Uhrzeigersinn um den Raumschwerpunkt ab Nord. Wandseiten ohne Raum MUST nach der Richtung benannt werden, in die sie zeigen: Außenseiten von Außenwänden als „<Richtung> außen“, alle anderen als „Wandseite <Richtung>“.

#### Scenario: Rechteckiger Raum
- **WHEN** ein rechteckiger Raum achsparallel liegt und Norden +y ist
- **THEN** heißen seine Wandansichten „Wand Nord“, „Wand Ost“, „Wand Süd“, „Wand West“

#### Scenario: L-förmiger Raum
- **WHEN** ein L-förmiger Raum zwei Wandabschnitte im Norden hat
- **THEN** heißen sie „Wand Nord 1“ und „Wand Nord 2“, wobei „Wand Nord 1“ der Abschnitt ist, der vom Raumschwerpunkt aus gesehen im Uhrzeigersinn ab Nord zuerst kommt

#### Scenario: Außenseite und Innenwand ohne Raum
- **WHEN** Norden +y ist, die Südwand eine Außenwand ist und eine Innenwand in Nord-Süd-Richtung noch an keinen Raum grenzt
- **THEN** heißt die Außenseite der Südwand „Süd außen“ und die Seiten der Innenwand heißen „Wandseite Ost“ und „Wandseite West“

### Requirement: Wandansicht je Raum
Das System SHALL für jeden Raum den Abschnitt jeder angrenzenden Wandseite als eigene Ansicht zeigen, so wie ein Betrachter im Raum sie sieht: links und rechts wie im Raum, unten OKFF, oben gekappt durch die fertige Decke und die Schrägen.

#### Scenario: Wand an zwei Räumen
- **WHEN** eine Wandseite an Küche und Essbereich grenzt
- **THEN** gibt es eine Ansicht im Raum Küche und eine im Raum Essbereich, beide Ausschnitte derselben Fläche

#### Scenario: Ansicht öffnen
- **WHEN** der Benutzer im Grundriss eine Wandseite innerhalb eines Raums doppelt anklickt
- **THEN** öffnet sich die Wandansicht dieses Raums mit Fenstern, Türen und Rollladenkästen

### Requirement: Fertige Oberflächen in der Wandansicht
Das System SHALL Raumecken und Laibungen in der Wandansicht an der fertigen Oberfläche zeigen, also um die Putzstärke versetzt, und Öffnungen mit fertigen Maßen bemaßen. Das Rohbaumaß MUST beim Auswählen der Öffnung abrufbar sein.

#### Scenario: Fenster mit Putz
- **WHEN** ein Fenster roh 1010 mm breit ist und die Putzstärke 15 mm beträgt
- **THEN** zeigt die Ansicht eine Breite von 980 mm und auf Abruf das Rohbaumaß 1010 mm

#### Scenario: Brüstung und Sturz
- **WHEN** das Fenster roh eine Brüstung von 900 mm und eine Höhe von 1385 mm hat, der Fußbodenaufbau 120 mm und die Putzstärke 15 mm beträgt
- **THEN** zeigt die Ansicht die Brüstung bei 780 mm und den Sturz bei 2150 mm über OKFF

### Requirement: Ansicht der Außenseite
Das System SHALL die Außenseite einer Außenwand von Oberkante Rohfußboden bis zur Oberkante der Wand zeigen, mit Öffnungen und außen liegenden Rollladenkästen.

#### Scenario: Außenansicht
- **WHEN** der Benutzer die Außenseite der Südwand im EG öffnet
- **THEN** zeigt sie die ganze Wandlänge mit allen Fenstern dieser Wand

#### Scenario: Außenansicht im Grundriss öffnen
- **WHEN** der Benutzer im Grundriss außerhalb aller Räume neben einer Wand doppelt klickt
- **THEN** öffnet sich die Ansicht dieser Wandseite über die ganze Wandlänge

### Requirement: Decken-, Boden- und Schrägenansicht
Das System SHALL die Decke als Deckenspiegel (Sicht von unten), den Boden in Draufsicht und jede Schräge in Sicht senkrecht auf die Schräge zeigen, jeweils mit beschrifteten Wandkanten.

#### Scenario: Deckenspiegel
- **WHEN** der Benutzer die Decke der Küche öffnet
- **THEN** sieht er die Raumkontur gespiegelt wie von unten, mit Beschriftung der angrenzenden Wände

#### Scenario: Schräge
- **WHEN** der Benutzer eine Dachschräge im DG öffnet
- **THEN** sieht er die Schräge in wahrer Größe, unten die Traufkante, oben die Kante zur Decke

### Requirement: Bemaßung und Messen
Das System SHALL in jeder Flächenansicht Gesamtmaße und Maße der Öffnungen anzeigen und Abstände zwischen zwei angeklickten Punkten bezogen auf die fertige Oberfläche messen lassen.

#### Scenario: Messen
- **WHEN** der Benutzer in einer Wandansicht von der Raumecke zur Fensterlaibung misst
- **THEN** zeigt das System den Abstand in Millimetern zwischen den fertigen Oberflächen

### Requirement: Navigation zwischen Flächen
Das System SHALL aus einer Wandansicht zur links und rechts anschließenden Wandansicht desselben Raums sowie zu Decke und Boden wechseln lassen. Aus Decken-, Boden- und Schrägenansicht MUST ein Klick auf eine beschriftete Wandkante deren Wandansicht öffnen.

#### Scenario: Um den Raum laufen
- **WHEN** der Benutzer in der Wandansicht „nächste Wand rechts“ wählt
- **THEN** öffnet sich die im Raum rechts anschließende Wandansicht

#### Scenario: Von der Decke zur Wand
- **WHEN** der Benutzer im Deckenspiegel auf die Kante „Wand Nord“ klickt
- **THEN** öffnet sich die Wandansicht Nord dieses Raums
