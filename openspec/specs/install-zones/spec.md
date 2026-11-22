# install-zones Specification

## Purpose

Macht die Installationszonen nach DIN 18015-3 in Wandansichten sichtbar, damit Geräte und später Trassen danach ausgerichtet werden können.

## Requirements

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
Das System SHALL zu jedem Wandgerät, das in keiner waagerechten Zone liegt, auf Wunsch die senkrechte Linie zu der waagerechten Zone anzeigen, aus der es zuzuführen ist: zur unteren Zone, wenn das Gerät unterhalb von ihr liegt, sonst zur oberen. Verläuft die Linie nicht vollständig in einer senkrechten Zone, MUST sie hervorgehoben werden.

#### Scenario: Schalter neben Tür
- **WHEN** ein Schalter 150 mm neben der Türlaibung in 1050 mm Höhe sitzt und Zuführungen eingeblendet sind
- **THEN** zeigt das System die senkrechte Zuführung von der oberen Zone zum Schalter, nicht hervorgehoben, weil sie in der senkrechten Zone neben der Laibung liegt

#### Scenario: Schalter mitten auf der Wand
- **WHEN** ein Schalter 1000 mm von jeder Ecke und Laibung entfernt in 1050 mm Höhe sitzt und Zuführungen eingeblendet sind
- **THEN** zeigt das System die Zuführung von der oberen Zone hervorgehoben als außerhalb der Zonen

#### Scenario: Steckdose in der unteren Zone
- **WHEN** eine Steckdose in 300 mm Höhe sitzt
- **THEN** zeigt das System keine Zuführung, weil sie in der unteren waagerechten Zone liegt
