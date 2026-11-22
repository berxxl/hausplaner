# Proposal

## Why

Der Elektriker und andere Gewerke arbeiten mit ausgedruckten bzw. als PDF verschickten Plänen und Listen. Nach der Sanierung dient der Export als Bestandsdokumentation.

## What Changes

- Listen in der App: Geräte mit ihrem Anschluss im Verteiler (Wunsch des Benutzers bei M4 7.2), Stromkreise, KNX-Kanäle, Leitungen mit Längen, Durchbrüche, Material
- PDF-Export: Grundrisse je Geschoss, Wandansichten mit Maßketten, Deckenspiegel, Bodenansichten, Verteilerbelegung, Listen
- Maßstab, Papierformat und Plankopf
- Filter nach Gewerk und Status, Bestandsplan aus verlegten Elementen
- Baustellen-PDF: eine Wand pro A4-Seite in 1:20 mit Raster und Bemaßung zum Annotieren mit dem Stift auf dem Tablet, mit eingebetteter Seitenzuordnung für den späteren Rückimport

## Capabilities

### New Capabilities

- `reports`: tabellarische Listen und Mengenermittlung
- `plan-export`: maßstäblicher PDF-Export von Plänen und Listen

### Modified Capabilities

## Impact

Neues Modul `export/`; Listenansicht; keine Änderung am Datenmodell. Setzt `m4-verteiler-und-stromkreise` voraus.
