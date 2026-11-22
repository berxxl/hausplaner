# Spec Delta

## Purpose

Erzeugt maßstäbliche PDF-Pläne und Listen für die Abstimmung mit Handwerkern und als Bestandsdokumentation.

## ADDED Requirements

### Requirement: Planinhalt wählen
Das System SHALL für den Export Grundrisse je Geschoss, Wandansichten, Deckenspiegel, Bodenansichten, Verteilerbelegungen und Listen einzeln oder gesammelt auswählen lassen.

#### Scenario: Alle Wände eines Raums
- **WHEN** der Benutzer „Bad OG, alle Wandansichten“ exportiert
- **THEN** enthält die PDF je Wandseite des Bads eine Ansicht

### Requirement: Maßstab und Format
Das System SHALL Pläne im gewählten Maßstab (Standard 1:50) auf dem gewählten Format (Standard A3 quer) ausgeben. Passt ein Plan nicht auf ein Blatt, MUST das System dies vor dem Export melden.

#### Scenario: Maßhaltig drucken
- **WHEN** ein Grundriss in 1:50 exportiert und auf A3 mit 100 % gedruckt wird
- **THEN** misst eine 5 m lange Wand auf dem Papier 100 mm

### Requirement: Vektorausgabe
Das System SHALL Pläne als Vektorgrafik in die PDF schreiben; Text MUST durchsuchbar sein.

#### Scenario: Zoomen im PDF
- **WHEN** der Empfänger die PDF stark vergrößert
- **THEN** bleiben Linien und Texte scharf

### Requirement: Maßketten
Das System SHALL in exportierten Wandansichten Maßketten von der linken Raumecke zu jedem Gerät und Trassenknoten sowie Höhen über OKFF ausgeben.

#### Scenario: Dose bemaßt
- **WHEN** eine Wandansicht mit drei Steckdosen exportiert wird
- **THEN** ist jede Steckdose mit Abstand zur Ecke und Höhe über OKFF bemaßt

### Requirement: Plankopf und Legende
Das System SHALL jedes Blatt mit Plankopf (Projekt, Planinhalt, Geschoss, Maßstab, Datum, Planstand) und einer Legende der verwendeten Symbole ausgeben.

#### Scenario: Legende
- **WHEN** ein Grundriss mit Steckdosen, Schaltern und Präsenzmeldern exportiert wird
- **THEN** zeigt die Legende genau diese Symbole mit Namen

### Requirement: Baustellen-PDF
Das System SHALL eine Baustellen-PDF für ausgewählte Räume erzeugen: je Wandseite, Decke und Boden eine Seite A4 im Maßstab 1:20 (bei Bedarf kleiner, mit Angabe auf dem Blatt), mit einem Raster in Flächenmaß (100 mm fein, 1 m kräftig), Bemaßung ab linker Raumecke und OKFF, geplanten Geräten und Trassen sowie freiem Notizbereich.

#### Scenario: Bad für die Baustelle
- **WHEN** der Benutzer für „Bad OG“ eine Baustellen-PDF erzeugt
- **THEN** enthält sie je Wandseite, Decke und Boden des Bads eine Seite mit Raster und Bemaßung

#### Scenario: Wand zu groß für 1:20
- **WHEN** eine Wandseite in 1:20 nicht auf A4 passt
- **THEN** wählt das System den nächstkleineren Maßstab aus 1:25, 1:50 und gibt ihn auf der Seite an

### Requirement: Seitenzuordnung in der PDF
Das System SHALL in jede Baustellen-PDF maschinenlesbar einbetten, welche Seite welche Fläche zeigt und wie Seitenkoordinaten in Flächenkoordinaten (u, v) umzurechnen sind, zusammen mit Projekt und Exportzeitpunkt.

#### Scenario: Zuordnung lesbar
- **WHEN** die App eine von ihr erzeugte Baustellen-PDF wieder einliest
- **THEN** kennt sie für jede Seite die Fläche und die Umrechnung in Millimeter auf der Fläche

### Requirement: Gewerk- und Statusfilter
Das System SHALL den Export nach Gewerken und Status filtern; die Auswahl „nur verlegt und geprüft“ MUST als Bestandsplan beschriftet werden.

#### Scenario: Bestandsplan
- **WHEN** der Benutzer nur verlegte und geprüfte Elemente exportiert
- **THEN** trägt der Plankopf „Bestandsplan“ und geplante Elemente fehlen
