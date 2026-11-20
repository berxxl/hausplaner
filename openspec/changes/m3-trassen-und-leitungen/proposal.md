# Proposal

## Why

Leitungswege bestimmen Material, Schlitz- und Bohrarbeiten und sind nach dem Verputzen nur noch über den Plan auffindbar. Viele Leitungen verschiedener Gewerke laufen parallel; sie einzeln zu zeichnen ist fehleranfällig und liefert keine verlässlichen Längen.

## What Changes

- Trassennetz aus Knoten und Segmenten auf allen Flächen, mit automatischen Übergängen an Kanten
- Durchbrüche durch Wände, Decken und Böden mit Art und Durchmesser
- Leerrohre auf Trassensegmenten
- Leitungen als Verbindung zweier Endpunkte über eine Folge von Trassensegmenten, Wegvorschlag
- Leitungslängen mit Zuschlägen, Belegung je Segment und Leerrohr
- Prüfung der Trassen gegen die Installationszonen
- Status geplant / verlegt / geprüft für Segmente und Leitungen

## Capabilities

### New Capabilities

- `cable-routes`: Trassennetz, Übergänge, Durchbrüche, Leerrohre und Zonenprüfung
- `cables`: Leitungen über Trassen führen, Längen berechnen, Belegung und Status

### Modified Capabilities

## Impact

Neue Modellteile `routeNodes`, `routeSegments`, `cables`; Graphalgorithmen (kürzester Weg) in `geometry/`; neue Regeln. Setzt `m2-geraete-und-moebel` voraus.
