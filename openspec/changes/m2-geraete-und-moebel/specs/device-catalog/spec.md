# Spec Delta

## Purpose

Beschreibt alle planbaren Geräte, Leitungen und Möbel als Daten, damit neue Typen ohne Programmänderung ergänzt werden können.

## ADDED Requirements

### Requirement: Katalog im Projekt
Das System SHALL Gerätetypen, Leitungstypen und Möbeltypen als Teil des Projekts speichern. Ein neues Projekt MUST mit einem Standardkatalog beginnen.

#### Scenario: Standardkatalog
- **WHEN** der Benutzer ein neues Projekt anlegt
- **THEN** enthält der Katalog mindestens Steckdose, Doppelsteckdose, Schalter, KNX-Taster, Präsenzmelder, Deckenauslass, Wandauslass, Spot, Rollladenmotor, Netzwerkdose, WLAN-Accesspoint, Router, LS, FI/LS, RCD, SPD, KNX-Netzteil, Schalt-, Dimm-, Jalousie- und Heizungsaktor, Klima-Innen- und Außengerät sowie NYM-J 3×1,5, NYM-J 5×1,5, NYM-J 3×2,5, NYM-J 5×2,5, KNX-Busleitung, Cat 7, Leerrohr M20/M25, Kältemittelleitungspaar und Kondensatleitung

### Requirement: Gerätetyp-Eigenschaften
Ein Gerätetyp SHALL Name, Gewerk, 2D-Symbol, einfache 3D-Form, zulässige Montagearten, Standardhöhe über OKFF, Unterputz-Dosentiefe, TE-Breite, anschließbare Gewerke und optionale KNX-, Licht- und Kältemittelangaben haben.

#### Scenario: Präsenzmelder
- **WHEN** der Typ „Präsenzmelder KNX“ angesehen wird
- **THEN** hat er Gewerk KNX, Montage Decke und anschließbares Gewerk KNX

### Requirement: Katalog bearbeiten
Das System SHALL Katalogeinträge anlegen, kopieren, ändern und löschen lassen. Ein Typ, der noch verwendet wird, MUST NOT gelöscht werden.

#### Scenario: Eigener Typ
- **WHEN** der Benutzer „Steckdose“ kopiert, als „Steckdose USB-C“ speichert und die Höhe auf 1050 mm setzt
- **THEN** steht der neue Typ beim Platzieren zur Auswahl

#### Scenario: Verwendeter Typ
- **WHEN** der Benutzer einen Typ löschen will, von dem 12 Geräte existieren
- **THEN** lehnt das System ab und nennt die Anzahl der Verwendungen

### Requirement: Symbole
Das System SHALL für jeden Typ des Standardkatalogs ein 2D-Symbol in Anlehnung an DIN EN 60617 mitbringen und eigene Symbole als SVG zulassen.

#### Scenario: Eigenes Symbol
- **WHEN** der Benutzer einem Typ ein SVG-Symbol zuweist
- **THEN** wird es in allen 2D-Ansichten und im Export für diesen Typ verwendet
