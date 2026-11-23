# reports Specification

## Purpose

Fasst den Plan in Tabellen zusammen, die für Bestellung, Ausführung und Abstimmung mit Handwerkern gebraucht werden.

## Requirements

### Requirement: Geräteliste
Das System SHALL alle Geräte außerhalb von Verteilern (Dosen, Schalter, Taster, Melder, Auslässe, Motoren usw.) mit Bezeichnung, Typ, Gewerk, Geschoss, Raum, Fläche und Status listen, dazu eine Spalte „Anschluss im Verteiler“: Stromkreis mit Schutzgerät und Verteiler, KNX-Aktorkanal, bei Datengeräten der Verteiler am anderen Ende ihrer Leitung; nicht angeschlossene Geräte sind erkennbar. Ein Klick auf eine Zeile wählt das Gerät aus.

#### Scenario: Steckdose im Bad
- **WHEN** die Steckdose „Bad EG Waschtisch“ dem Stromkreis „F7 Bad EG“ mit LS „F7“ in der UV EG zugeordnet ist
- **THEN** zeigt die Geräteliste in ihrer Zeile „UV EG · F7 Bad EG (F7)“

#### Scenario: Rollladen am Aktor
- **WHEN** der Rollladenmotor „Rollladen Bad“ dem Kanal C des Jalousieaktors JA2 in der UV OG zugeordnet ist
- **THEN** zeigt die Geräteliste „UV OG · JA2.C“ und seinen Stromkreis

#### Scenario: Nicht angeschlossen
- **WHEN** eine Netzwerkdose keine Leitung zu einem Verteiler hat
- **THEN** zeigt die Spalte „nicht angeschlossen“, und der Filter „nur nicht angeschlossene“ findet sie

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
