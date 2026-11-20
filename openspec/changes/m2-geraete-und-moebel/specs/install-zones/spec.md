# Spec Delta

## Purpose

Macht die Installationszonen nach DIN 18015-3 in Wandansichten sichtbar, damit Geräte und später Trassen danach ausgerichtet werden können.

## ADDED Requirements

### Requirement: Zonen anzeigen
Das System SHALL in Wandansichten die Installationszonen als einblendbares Overlay zeigen: waagerecht 150–450 mm unter der fertigen Decke und über OKFF, senkrecht 100–300 mm neben Raumecken, Tür- und Fensterlaibungen.

#### Scenario: Wand mit Fenster
- **WHEN** der Benutzer eine Wandansicht mit Fenster öffnet und Zonen einblendet
- **THEN** sieht er die waagerechten Zonen und senkrechte Zonen an beiden Ecken und beiden Fensterlaibungen

#### Scenario: Unter Dachschräge
- **WHEN** die Wand von einer Schräge angeschnitten wird
- **THEN** folgt die obere waagerechte Zone der fertigen Deckenkontur

### Requirement: Zonen konfigurierbar
Das System SHALL die Grenzwerte der Zonen in den Projekteinstellungen änderbar machen.

#### Scenario: Obere Zone geändert
- **WHEN** der Benutzer die obere waagerechte Zone auf 200–500 mm unter der Decke setzt
- **THEN** zeigen alle Wandansichten die geänderte Zone

### Requirement: Senkrechte Zuführung andeuten
Das System SHALL zu einem Wandgerät außerhalb jeder Zone auf Wunsch die senkrechte Linie zur nächsten waagerechten Zone anzeigen, über die es zuzuführen ist.

#### Scenario: Schalter neben Tür
- **WHEN** ein Schalter 150 mm neben der Türlaibung in 1050 mm Höhe sitzt
- **THEN** zeigt das System die senkrechte Zuführung von der oberen Zone zum Schalter
