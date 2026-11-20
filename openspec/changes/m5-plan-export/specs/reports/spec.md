# Spec Delta

## Purpose

Fasst den Plan in Tabellen zusammen, die für Bestellung, Ausführung und Abstimmung mit Handwerkern gebraucht werden.

## ADDED Requirements

### Requirement: Stromkreisliste
Das System SHALL je Verteiler eine Liste aller Stromkreise mit Bezeichnung, Schutzgerät, Leitungstyp, Anzahl Geräte und Räumen zeigen.

#### Scenario: Liste UV EG
- **WHEN** der Benutzer die Stromkreisliste der UV EG öffnet
- **THEN** stehen dort alle Stromkreise der UV EG in Reihenfolge ihrer Bezeichnung

### Requirement: KNX-Kanalliste
Das System SHALL je Verteiler eine Liste aller Aktorkanäle mit Aktor, Kanal, Funktion, Verbraucher und Raum zeigen, freie Kanäle eingeschlossen.

#### Scenario: Freie Kanäle
- **WHEN** ein 16-fach-Aktor 11 belegte Kanäle hat
- **THEN** zeigt die Liste 11 Zuordnungen und 5 freie Kanäle

### Requirement: Leitungsliste
Das System SHALL alle Leitungen mit Bezeichnung, Typ, Endpunkten, Stromkreis, Länge und Status listen und Summen je Leitungstyp bilden.

#### Scenario: Summe NYM-J 3×1,5
- **WHEN** 40 Leitungen vom Typ NYM-J 3×1,5 geplant sind
- **THEN** zeigt die Liste deren Gesamtlänge in Metern

### Requirement: Durchbruchsliste
Das System SHALL alle Durchbrüche mit Ort (Geschoss, Raum, Bauteil), Lage, Art, Durchmesser und durchgeführten Leitungen listen.

#### Scenario: Liste für Kernbohrer
- **WHEN** der Benutzer nur Kernbohrungen filtert
- **THEN** zeigt die Liste alle Kernbohrungen mit Durchmesser und Lage

### Requirement: Materialliste
Das System SHALL Geräte je Typ, Unterputzdosen je Dosentiefe, Leitungen je Typ, Leerrohre je Nenngröße und Reiheneinbaugeräte je Typ zählen bzw. summieren.

#### Scenario: Dosen zählen
- **WHEN** 85 Unterputzgeräte geplant sind, davon 6 als Dreifachkombination
- **THEN** weist die Materialliste die Geräte je Typ und die benötigten Dosen aus

### Requirement: Filter und Sortierung
Das System SHALL jede Liste nach Geschoss, Raum, Gewerk und Status filtern und nach jeder Spalte sortieren lassen.

#### Scenario: Nur Verlegtes
- **WHEN** der Benutzer in der Leitungsliste Status „verlegt“ filtert
- **THEN** stehen nur verlegte Leitungen in der Liste
