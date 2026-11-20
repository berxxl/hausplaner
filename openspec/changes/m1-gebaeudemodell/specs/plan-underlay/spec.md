# Spec Delta

## Purpose

Macht vorhandene Architektenpläne im PDF-Format als maßstäblichen Hintergrund nutzbar, auf dem das Gebäude nachgezeichnet wird.

## ADDED Requirements

### Requirement: PDF-Seite als Geschosshintergrund
Das System SHALL je Geschoss genau eine Seite einer PDF-Datei als Hintergrund des Grundrisses anzeigen können. Vektor-PDFs und gescannte PDFs MUST beide unterstützt werden. Eine in der PDF gesetzte Seitendrehung MUST berücksichtigt werden, sodass die Seite so erscheint wie in einem PDF-Betrachter.

#### Scenario: Plan laden
- **WHEN** der Benutzer im Geschoss „EG“ eine PDF mit mehreren Seiten wählt und Seite 2 auswählt
- **THEN** zeigt der Grundriss des EG Seite 2 als Hintergrund unter allen Bauteilen

#### Scenario: Gescannter Plan
- **WHEN** die PDF nur ein Rasterbild enthält
- **THEN** wird sie genauso angezeigt und kalibriert wie eine Vektor-PDF

### Requirement: Maßstab kalibrieren
Das System SHALL den Maßstab des Hintergrunds aus zwei angeklickten Punkten und ihrem eingegebenen realen Abstand in Millimetern bestimmen.

#### Scenario: Kalibrierung über bemaßte Wand
- **WHEN** der Benutzer zwei Punkte auf einer im Plan mit 4,26 m bemaßten Wand anklickt und 4260 eingibt
- **THEN** misst die Strecke zwischen den Punkten im Grundriss danach 4260 mm

#### Scenario: Neu kalibrieren
- **WHEN** der Benutzer erneut kalibriert, nachdem bereits Wände gezeichnet wurden
- **THEN** ändert sich nur der Hintergrund; gezeichnete Wände behalten ihre Maße

### Requirement: Hintergrund ausrichten
Das System SHALL den Hintergrund verschieben und um einen vom Benutzer gewählten Punkt drehen können, damit die Pläne aller Geschosse übereinanderliegen. Der Drehwinkel MUST numerisch auf 0,1° genau eingegeben werden können; positive Werte drehen gegen den Uhrzeigersinn.

#### Scenario: Geschosse deckungsgleich
- **WHEN** der Benutzer den OG-Plan so verschiebt, dass eine Treppenhausecke über der des EG-Plans liegt, und dann die Wände des OG nachzeichnet
- **THEN** liegen die Treppenhauswände beider Geschosse in 3D übereinander

#### Scenario: Schräg gescannter Plan
- **WHEN** der Benutzer eine Ecke als Drehpunkt wählt und den Plan um 1,5° dreht
- **THEN** bleibt die Ecke an ihrer Stelle und die Planwände verlaufen achsparallel

### Requirement: Darstellung des Hintergrunds
Das System SHALL Deckkraft und Sichtbarkeit des Hintergrunds je Geschoss einstellbar machen. Der Hintergrund MUST nur im Grundriss erscheinen.

#### Scenario: Ausblenden
- **WHEN** der Benutzer den Hintergrund ausblendet
- **THEN** zeigt der Grundriss nur noch die modellierten Bauteile
