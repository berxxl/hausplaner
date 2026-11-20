# Proposal

## Why

Mit KNX steigt der Platzbedarf in den Unterverteilungen deutlich: Für jeden geschalteten Verbraucher wird ein Aktorkanal gebraucht. Wie groß Zählerschrank, Unterverteilung pro Geschoss und Medienverteiler werden müssen, soll vor der Bestellung feststehen.

## What Changes

- Verteiler als Objekte im Raum: Zählerschrank, Unterverteilung je Geschoss, Medienverteiler
- Innerer Aufbau aus Feldern und Reihen mit Teilungseinheiten, grafische Belegung, Reserveprüfung
- Verteilerhierarchie mit Zuleitungen
- Stromkreise mit Schutzgerät und zugeordneten Geräten
- KNX: Aktorkanäle Verbrauchern zuordnen, Aktorbedarf aus dem Plan ableiten

## Capabilities

### New Capabilities

- `distribution-boards`: Verteiler, Felder, TE-Belegung, Reserve, Hierarchie
- `circuits`: Stromkreise mit Schutzgerät und Geräten
- `knx-planning`: Aktorkanalzuordnung und Aktorbedarf je Verteiler

### Modified Capabilities

## Impact

Neue Modellteile `boards`, `circuits`, `knxAssignments`; neue Ansicht „Verteiler-Belegung“; Reiheneinbaugeräte nutzen die Platzierungsart `board`. Setzt `m3-trassen-und-leitungen` voraus.
