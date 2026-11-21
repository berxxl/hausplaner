# Proposal

## Why

Die Positionen von Dosen, Schaltern, Meldern, Leuchten und Motoren sind die erste Entscheidung, die mit dem Elektriker abgestimmt wird. Sie müssen zu den Installationszonen und zu den Möbeln passen.

## What Changes

- Editierbarer Gerätekatalog im Projekt mit Standardkatalog für neue Projekte
- Geräte auf Wand, Decke, Boden oder Schräge platzieren, Höhe über OKFF und Rohbau
- Installationszonen nach DIN 18015-3 als Overlay
- Möbel als einfache Körper mit Kollisionswarnung gegen Geräte
- Zentrale Warnungen, die bewusst übergangen werden können
- Gewerkfilter für alle Ansichten
- Statusfeld geplant / verlegt / geprüft für Geräte
- Rohbauhöhe je Raum für Gebäude mit unterschiedlich hohen Teilen (z. B. Anbau)

## Capabilities

### New Capabilities

- `device-catalog`: Gerätetypen, Leitungstypen und Möbeltypen als editierbarer Katalog
- `device-placement`: Geräte auf Flächen platzieren, bemaßen, mit Status versehen
- `install-zones`: Installationszonen anzeigen und Zuführung zu Geräten außerhalb andeuten
- `furniture`: Möbel platzieren und Kollisionen mit Geräten erkennen
- `warnings`: Regelverstöße berechnen, anzeigen und bewusst übergehen

### Modified Capabilities

- `workspace`: Gewerkfilter für alle Ansichten
- `building-geometry`: Rohbauhöhe je Raum (Befund aus dem Nachzeichnen in m1)

## Impact

Erweitert Datenmodell um Katalog, Geräte und Möbel; neue Regeln in `rules/`; Darstellung in Grundriss, Flächenansichten und 3D. Setzt `m1-gebaeudemodell` voraus.
