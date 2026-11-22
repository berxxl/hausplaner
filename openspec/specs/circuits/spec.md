# circuits Specification

## Purpose

Ordnet Geräte und Leitungen Stromkreisen zu, damit Verteilerbelegung, Beschriftung und Stromkreisliste aus dem Plan entstehen.

## Requirements

### Requirement: Stromkreis anlegen
Das System SHALL Stromkreise mit Bezeichnung, Verteiler, optionalem Schutzgerät im Verteiler und Standard-Leitungstyp anlegen.

#### Scenario: Küchenkreis
- **WHEN** der Benutzer „F12 Küche Steckdosen“ in der UV EG mit LS B16 und NYM-J 3×2,5 anlegt
- **THEN** existiert der Stromkreis mit Verweis auf das Schutzgerät

### Requirement: Geräte zuordnen
Das System SHALL Verbraucher einem Stromkreis zuordnen; Leitungen, deren Endpunkte zum Stromkreis gehören, MUST ihm ebenfalls zugeordnet werden.

#### Scenario: Mehrfachzuordnung
- **WHEN** der Benutzer fünf Steckdosen auswählt und „F12“ zuweist
- **THEN** gehören alle fünf zu F12 und ihre Zuleitungen ebenfalls

#### Scenario: Verteiler passt nicht
- **WHEN** ein Gerät einem Stromkreis zugewiesen wird, dessen Leitung zu einem anderen Verteiler führt
- **THEN** erzeugt das System eine Warnung

### Requirement: Stromkreise anzeigen
Das System SHALL den Stromkreis eines Geräts als Beschriftung in Ansichten anzeigen und auf Wunsch alle Geräte eines Stromkreises hervorheben.

#### Scenario: Stromkreis hervorheben
- **WHEN** der Benutzer F12 auswählt
- **THEN** sind alle Geräte und Leitungen von F12 in allen Ansichten markiert

### Requirement: Nicht zugeordnete Verbraucher
Das System SHALL eine Warnung für jeden Verbraucher des Gewerks Strom ohne Stromkreis erzeugen.

#### Scenario: Vergessene Dose
- **WHEN** eine Steckdose keinem Stromkreis zugeordnet ist
- **THEN** erscheint sie in der Warnungsübersicht
