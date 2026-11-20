# Proposal

## Why

Auf der Baustelle werden Lage von Leitungen und Dosen mit dem Stift auf dem Tablet in der Baustellen-PDF notiert. Diese Notizen von Hand in den Plan zu übertragen kostet Zeit und erzeugt Messfehler. Weil die Baustellen-PDF ihre Seitenzuordnung kennt, können die Stiftstriche maßstabsgerecht auf die richtige Fläche zurückgelegt werden.

## What Changes

- Annotierte Baustellen-PDF einlesen und Stiftstriche sowie Textnotizen den Flächen zuordnen
- Notizebene je Fläche in den Flächenansichten, maßstabsgerecht über Geräten und Trassen
- Notizen als erledigt markieren, ausblenden und löschen
- Notizen werden im Projekt gespeichert und über Git ausgetauscht

## Capabilities

### New Capabilities

- `site-notes`: Rückimport annotierter Baustellen-PDFs als Notizebene auf den Flächen

### Modified Capabilities

## Impact

Neue Projektdatei `notizen.yaml` mit Strichen als Polylinien in Flächenkoordinaten (ganze mm); pdf.js-Annotationen werden gelesen. Setzt die Baustellen-PDF mit Seitenzuordnung aus `m5-plan-export` voraus. Optional; wird nach `m6-kaeltemittel-und-licht` umgesetzt.
