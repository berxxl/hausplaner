# Spec Delta

## Purpose

Bildet die physischen Wege, auf denen Leitungen aller Gewerke durch das Gebäude laufen, als zusammenhängendes Netz über alle Flächen ab.

## ADDED Requirements

### Requirement: Trassen zeichnen
Das System SHALL in jeder Flächenansicht Trassen als Linienzüge aus Knoten und geraden Segmenten zeichnen lassen. Knoten MUST an Geräten und bestehenden Knoten einrasten (an Verteilern ab `m4-verteiler-und-stromkreise`).

#### Scenario: Trasse zur Steckdose
- **WHEN** der Benutzer in der Wandansicht von der oberen Zone senkrecht zur Steckdose zeichnet
- **THEN** endet die Trasse in einem Knoten am Gerät

#### Scenario: Abzweig
- **WHEN** der Benutzer auf ein bestehendes Segment klickt
- **THEN** wird das Segment dort geteilt und ein Abzweigknoten entsteht

### Requirement: Übergänge an Kanten
Das System SHALL einen Knoten auf der Kante zwischen zwei angrenzenden Flächen desselben Raums (Wand–Wand, Wand–Decke, Wand–Boden, Wand–Schräge) beiden Flächen zugleich zuordnen, sodass die Trasse in beiden Ansichten zusammenhängt.

#### Scenario: Über Eck
- **WHEN** der Benutzer eine Trasse bis an die rechte Wandkante zeichnet
- **THEN** beginnt sie in der rechten Nachbarwand am selben Punkt und lässt sich dort fortsetzen

#### Scenario: Zur Decke
- **WHEN** eine Trasse an der Oberkante der Wand endet
- **THEN** erscheint der Knoten im Deckenspiegel am entsprechenden Wandrand

### Requirement: Durchbrüche
Das System SHALL einen Durchbruch durch eine Wand, Decke oder einen Boden als eigenes Segment mit Art (Bohrung, Kernbohrung, Schlitz, Leerrohr) und Durchmesser anlegen, das Knoten auf beiden Seiten verbindet. Seine Länge MUST der Bauteildicke entsprechen.

#### Scenario: Durch die Innenwand
- **WHEN** der Benutzer an einem Punkt der Küchenwand „Durchbruch“ wählt und 40 mm Bohrung angibt
- **THEN** entsteht auf der Flurseite derselben Wand an gespiegelter Position ein verbundener Knoten

#### Scenario: Durch die Geschossdecke
- **WHEN** der Benutzer im Boden des OG einen Durchbruch setzt
- **THEN** entsteht der Gegenknoten in der Decke des darunterliegenden Raums im EG

#### Scenario: Kernbohrung nach außen
- **WHEN** der Benutzer eine Kernbohrung 65 mm durch eine Außenwand setzt
- **THEN** verbindet sie die Innenwandseite mit der Außenseite der Außenwand

### Requirement: Leerrohre
Das System SHALL einem Trassensegment optional ein Leerrohr mit Nenngröße (z. B. M25) und Innendurchmesser zuordnen.

#### Scenario: Leerrohr belegen
- **WHEN** ein Segment ein Leerrohr M25 hat
- **THEN** wird der verfügbare Querschnitt für die Belegungsprüfung verwendet

### Requirement: Zonenprüfung für Trassen
Das System SHALL für jedes Wandsegment, das weder in einer Installationszone liegt noch als senkrechter Stich aus einer waagerechten Zone zu einem Gerät führt, eine Warnung erzeugen.

#### Scenario: Diagonale Trasse
- **WHEN** ein Segment schräg über die Wand läuft
- **THEN** meldet das System „Trasse außerhalb Installationszone“

#### Scenario: Senkrechter Stich
- **WHEN** ein Segment senkrecht von der oberen Zone zu einem Schalter läuft
- **THEN** entsteht keine Warnung

### Requirement: Status von Segmenten
Das System SHALL jedem Segment den Status geplant, verlegt oder geprüft geben und die Lage eines Segments nach dem Verlegen auf gemessene Werte korrigieren lassen.

#### Scenario: Aufmaß übernehmen
- **WHEN** der Benutzer einen Knoten auf das gemessene Maß 1830 mm ab Raumecke verschiebt und das Segment auf „verlegt“ stellt
- **THEN** zeigen alle Ansichten die korrigierte Lage mit Status verlegt
