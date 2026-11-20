# Hausplaner

Lokale Web-App zur Planung der Haustechnik (Elektro, KNX, Daten, Kältemittel) bei einer Kernsanierung.

## Vor jeder Arbeit lesen

1. `docs/architektur.md`: Datenmodell, Dateiformat, Modulschnitt, Technik. Nicht davon abweichen, ohne es dort zu ändern.
2. Den aktiven OpenSpec-Change unter `openspec/changes/` (Proposal, Specs, Design, Tasks).

## Arbeitsweise

- Umsetzung über OpenSpec: `/opsx:apply <change>`. Ein Change nach dem anderen (m1 → m7, m7 optional); der nächste beginnt erst, wenn der vorige archiviert ist.
- Vor der Umsetzung eines Changes: `/openspec-review <change>`.
- Bezeichner, Dateinamen im Code und YAML-Felder auf Englisch; Oberfläche, Specs und Doku auf Deutsch.
- `src/geometry/`, `src/rules/` und die Serialisierung in `src/io/` bleiben frei von React und werden mit Unit-Tests abgedeckt.
- Alle Modelländerungen laufen über Store-Befehle (Undo/Redo).
- Abgeleitete Werte (Flächen, Längen, Warnungen, Belegung) nie speichern.
- Das Dateiformat ist ein Austauschformat über Git: jede Änderung am Writer muss den Golden-File-Test bestehen; Formatänderungen brauchen eine Schema-Migration.

## Befehle

- `npm start -- <projektordner>`: App mit Projekt starten
- `npm run dev -- <projektordner>`: Entwicklung mit Hot Reload
- `npm test`, `npm run lint`, `npm run typecheck`
