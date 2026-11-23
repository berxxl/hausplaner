# Spec Delta

## MODIFIED Requirements

### Requirement: Katalog im Projekt
Das System SHALL Gerätetypen, Leitungstypen und Möbeltypen als Teil des Projekts speichern. Ein neues Projekt MUST mit einem Standardkatalog beginnen. Die Migration auf eine neue Schemaversion MUST neue Standardtypen ergänzen, deren ID im Projektkatalog fehlt, und MUST NOT vorhandene Typen ändern.

#### Scenario: Projekt aus M1
- **WHEN** der Benutzer ein Projekt ohne Katalog öffnet, das mit M1 angelegt wurde
- **THEN** erhält es den Standardkatalog, der beim nächsten Speichern als eigene Datei geschrieben wird, und die Geschossdateien bleiben unverändert

#### Scenario: Standardkatalog
- **WHEN** der Benutzer ein neues Projekt anlegt
- **THEN** enthält der Katalog mindestens Steckdose, Doppelsteckdose, Schalter, KNX-Taster, Präsenzmelder, Deckenauslass, Wandauslass, Spot, Rollladenmotor, Netzwerkdose, WLAN-Accesspoint, Router, LS, FI/LS, RCD, SPD, KNX-Netzteil, Schalt- (8- und 16-fach), Dimm-, Jalousie- und Heizungsaktor, Patchfeld, Switch, Netzteil, Klima-Innengerät, Klima-Außengerät, Klima-Außengerät Multisplit 3, Kondensatablauf sowie NYM-J 3×1,5, NYM-J 5×1,5, NYM-J 3×2,5, NYM-J 5×2,5, NYM-J 5×10, KNX-Busleitung, Cat 7, Leerrohr M20/M25, Kältemittelleitungspaar und Kondensatleitung

#### Scenario: Projekt aus M3
- **WHEN** der Benutzer ein Projekt aus M3 öffnet, dessen Katalog einen geänderten Schaltaktor enthält
- **THEN** ergänzt das System Schaltaktor 16-fach, Patchfeld, Switch, Netzteil und NYM-J 5×10, lässt den geänderten Schaltaktor unverändert und schreibt den Katalog erst beim nächsten Speichern

#### Scenario: Projekt aus M5
- **WHEN** der Benutzer ein Projekt aus M5 öffnet, dessen Katalog Klima-Innen- und Außengerät ohne Angabe der Geräterolle enthält
- **THEN** ergänzt das System Kondensatablauf und Klima-Außengerät Multisplit 3, lässt die vorhandenen Klimageräte unverändert und erkennt das Gerät mit Kondensatanschluss als Innengerät
