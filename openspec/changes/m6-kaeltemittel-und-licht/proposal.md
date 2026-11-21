# Proposal

## Why

Fehler bei Kältemittel- und Kondensatleitungen (zu lang, Kondensat ohne Gefälle) sind nach dem Verputzen teuer. Die Lichtwirkung von Spots und Leuchten lässt sich im Plan schwer einschätzen. Für Abstimmungen in der Familie sind 3D-Bilder hilfreich.

## What Changes

- Klimaverbindung aus Innengerät, Außengerät und zugehörigen Leitungen
- Prüfung der Kältemittel-Leitungslänge gegen Herstellergrenzen
- Prüfung des Kondensatgefälles
- Leuchten strahlen in der 3D-Ansicht Licht ab
- 3D-Bilder als PNG speichern

## Capabilities

### New Capabilities

- `refrigerant-rules`: Klimaverbindungen und Prüfregeln für Kältemittel und Kondensat
- `lighting-3d`: Lichtdarstellung von Leuchten in 3D und Bildexport

### Modified Capabilities

## Impact

Neue Regeln in `rules/`; erweiterte 3D-Ansicht. Kältemittel und Kondensat sind bereits als Leitungstypen vorhanden. Setzt `m5-plan-export` voraus.

## Offene Punkte

- Dämmschicht an Außenwänden (aus m1, Task 9.4.1): Wände haben bisher nur eine Rohbaudicke ohne Außendämmung. Für Kältemittel- und Kondensatdurchführungen nach außen wird die Gesamttiefe gebraucht; Außenansicht und 3D sollen die Dämmung zeigen. Vorher prüfen, ob schon m2 (Geräte an der Fassade) die Schicht braucht. Formatänderung mit Schema-Migration.
