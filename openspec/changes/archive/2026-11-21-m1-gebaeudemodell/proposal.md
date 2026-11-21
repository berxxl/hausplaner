# Proposal

## Why

Alle weiteren Planungsschritte (Geräte, Trassen, Verteiler, Export) brauchen ein maßlich korrektes Gebäudemodell. Grundlage sind die Architektenpläne als PDF, deren Maße beim Nachzeichnen korrigiert werden.

## What Changes

- Architekten-PDF je Geschoss als kalibrierter Hintergrund im Grundriss
- Geschosse, Wände, Räume, Öffnungen (Fenster, Türen, Rollladenkästen) und Dachschrägen
- Höhenbezug: Rohfußboden, Fußbodenaufbau, Putzstärke, Abhängung; Anzeige bezogen auf OKFF
- Abgeleitete Flächen (Wandseiten, Decken, Böden, Schrägen) und Ansichten je Raum
- Einfache 3D-Ansicht des Gebäudes
- Arbeitsoberfläche: Strukturbaum, Editorbereich, Eigenschaften, gemeinsame Auswahl, Undo/Redo
- Speichern und Laden des Projekts als diff-freundliche Textdateien

## Capabilities

### New Capabilities

- `plan-underlay`: PDF-Plan als Hintergrund eines Geschosses laden, kalibrieren und ausrichten
- `building-geometry`: Geschosse, Wände, Räume, Öffnungen, Decken und Schrägen mit Höhenbezug erfassen
- `surface-views`: abgeleitete Flächen (Wandseiten, Decke, Boden, Schräge) als maßstäbliche 2D-Ansichten
- `model-3d-view`: 3D-Ansicht des Modells mit Navigation
- `workspace`: Aufbau der Oberfläche, Strukturbaum, Auswahl, Undo/Redo, Maßeinheiten
- `project-storage`: Projekt speichern und laden, diff-freundlich für den Austausch über Git

### Modified Capabilities

## Impact

Neues Repository. Legt Projektgerüst, Datenmodell (siehe `docs/architektur.md`), Geometriekern und Store an, auf denen alle weiteren Changes aufbauen.
