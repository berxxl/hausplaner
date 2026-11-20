# Spec Delta

## Purpose

Prüft Kältemittel- und Kondensatleitungen von Klimageräten gegen die Grenzen, deren Verletzung nach dem Verputzen teuer wird.

## ADDED Requirements

### Requirement: Klimaverbindung
Das System SHALL ein Klima-Innengerät mit einem Außengerät über eine Kältemittelleitung verbinden und dem Innengerät eine Kondensatleitung zu einem Ablaufpunkt zuordnen.

#### Scenario: Split-Gerät Schlafzimmer
- **WHEN** der Benutzer Innengerät Schlafzimmer, Außengerät Terrasse, Kältemittelleitung und Kondensatleitung zum Fallrohr anlegt
- **THEN** zeigt das Innengerät seine Verbindung mit beiden Leitungen

#### Scenario: Multisplit
- **WHEN** drei Innengeräte an ein Außengerät angeschlossen werden
- **THEN** führt das Außengerät drei Kältemittelverbindungen

### Requirement: Kältemittel-Leitungslänge
Das System SHALL die Länge jeder Kältemittelleitung gegen Mindest- und Höchstlänge des Außengeräts aus dem Katalog prüfen und die Mehrlänge über die vorgefüllte Länge ausweisen.

#### Scenario: Nachfüllen nötig
- **WHEN** die Leitung 9,5 m lang und das Gerät mit 7 m vorgefüllt ist
- **THEN** weist das System 2,5 m Mehrlänge aus

#### Scenario: Zu lang
- **WHEN** die Leitung die Höchstlänge überschreitet
- **THEN** erzeugt das System eine Warnung

### Requirement: Kondensatgefälle
Das System SHALL für jedes Segment einer Kondensatleitung das Gefälle in Fließrichtung berechnen und eine Warnung erzeugen, wenn es unter dem eingestellten Mindestgefälle (Standard 1 %) liegt oder ansteigt.

#### Scenario: Steigung
- **WHEN** ein Kondensatsegment zum Ablauf hin ansteigt
- **THEN** wird das Segment markiert und eine Warnung „Kondensat ohne Gefälle“ erzeugt

#### Scenario: Senkrecht nach unten
- **WHEN** ein Segment senkrecht nach unten verläuft
- **THEN** entsteht keine Warnung
