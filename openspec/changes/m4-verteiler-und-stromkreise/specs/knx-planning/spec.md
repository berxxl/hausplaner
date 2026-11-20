# Spec Delta

## Purpose

Leitet aus den geplanten Verbrauchern ab, welche KNX-Aktoren je Verteiler nötig sind, und dokumentiert, welcher Aktorkanal welchen Verbraucher steuert.

## ADDED Requirements

### Requirement: Kanalbedarf zählen
Das System SHALL je Verteiler die Verbraucher nach benötigter KNX-Funktion (Schalten, Dimmen, Jalousie, Heizung, Binäreingang) zählen. Ein Verbraucher MUST dem Verteiler zugerechnet werden, zu dem seine Leistungsleitung führt.

#### Scenario: Bedarf UV OG
- **WHEN** im OG 10 Leuchten (Schalten), 4 dimmbare Leuchten und 7 Rollladenmotoren mit Leitung zur UV OG geplant sind
- **THEN** zeigt die UV OG Bedarf 10 Schalten, 4 Dimmen, 7 Jalousie

### Requirement: Aktorvorschlag
Das System SHALL je Verteiler und Funktion aus den Aktortypen des Katalogs eine Kombination vorschlagen, die den Bedarf zuzüglich Reserve (Standard 20 %) mit möglichst wenig TE und bei Gleichstand mit möglichst wenig Geräten deckt, und deren TE-Summe ausweisen.

#### Scenario: Vorschlag mit Reserve
- **WHEN** 10 Schaltkanäle benötigt werden, der Katalog 8- und 16-fach-Schaltaktoren enthält und die Reserve 20 % beträgt
- **THEN** schlägt das System einen 16-fach-Schaltaktor vor und weist dessen TE aus

### Requirement: Vorschlag übernehmen
Das System SHALL einen Aktorvorschlag als Reiheneinbaugeräte in den Verteiler übernehmen; freie Plätze MUST dabei automatisch gesucht werden.

#### Scenario: Übernehmen
- **WHEN** der Benutzer „Vorschlag übernehmen“ wählt und genug Platz frei ist
- **THEN** stehen die Aktoren an freien Plätzen im Verteilerfeld

### Requirement: Kanäle zuordnen
Das System SHALL jedem Verbraucher einen Kanal eines Aktors passender Funktion im selben Verteiler zuordnen; ein Kanal MUST höchstens einem Verbraucher zugeordnet sein.

#### Scenario: Rollladen zuordnen
- **WHEN** der Benutzer „Rollladen Bad“ dem Jalousieaktor 2, Kanal C zuweist
- **THEN** zeigt die Kanalliste „JA2.C → Rollladen Bad“

#### Scenario: Automatisch zuordnen
- **WHEN** der Benutzer „Kanäle automatisch zuordnen“ wählt
- **THEN** erhalten alle nicht zugeordneten Verbraucher freie Kanäle passender Funktion, sortiert nach Raum

### Requirement: Fehlende Kanäle melden
Das System SHALL eine Warnung für jeden Verbraucher mit KNX-Funktion ohne Kanal erzeugen.

#### Scenario: Zu wenig Kanäle
- **WHEN** mehr Jalousie-Verbraucher als Jalousiekanäle in der UV existieren
- **THEN** meldet das System die überzähligen Verbraucher

### Requirement: KNX-Bus
Das System SHALL KNX-Busteilnehmer (Taster, Melder, Aktoren, Netzteil, IP-Router) über Busleitungen einer KNX-Linie zuordnen und je Linie die Anzahl der Teilnehmer anzeigen.

#### Scenario: Linie zählen
- **WHEN** an Linie 1.1 32 Busteilnehmer angeschlossen sind
- **THEN** zeigt das System 32 Teilnehmer für Linie 1.1
