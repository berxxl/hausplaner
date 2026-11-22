# Review m4-verteiler-und-stromkreise

- Modus: --drift (Abgleich von Specs, design.md und docs/architektur.md mit der Umsetzung vor dem Archivieren)
- Datum: 2026-11-22
- Stand: `08b8fd4` (alle Tasks einschließlich 7.2 und der Rückmeldungen R.1–R.7 abgehakt) plus die Nachträge aus diesem Review
- Hinweis: Der Skill `/openspec-review` war nicht verfügbar. Den Review hat Claude von Hand erstellt, nach dem Schema der m1–m3-Drift-Reviews, ohne getrennte Prüfer-Agenten. Nach den Nachträgen wurde `openspec validate --strict` erneut ausgeführt.

## Vorgehen

1. Abdeckung: Alle 49 Szenarien der acht Spec-Deltas (`building-geometry`, `cable-routes`, `cables`, `circuits`, `device-catalog`, `distribution-boards`, `knx-planning`, `workspace`) wurden über ihren Namen in den Tests gesucht. 47 haben mindestens einen Test mit dem Szenarionamen.
2. Drift: Die Umsetzungs-Commits seit dem Review vor der Umsetzung (`0e7850b` bis `08b8fd4`) wurden gegen design.md, die Specs und docs/architektur.md geprüft. Stichproben im Code: alle zwölf Warnungstexte der Tabelle „Warnungen“ und die Umbenennung von `cable-without-device`, alle 22 Befehlslabels aus „Store und Befehle“ sowie „Raumgrenze zeichnen/löschen“, Standardwerte je Verteilerart (Maße, Montage, Felder), Reserven 25 %/20 % und `perBoardMm` 1500 in Fabrik und Migration, Texte „Feld enthält <n> Geräte“, „Kein Platz …“, „Gleiche im Geschoss auswählen“, „Kombinieren“, „Leitungen zu Verteiler …“, „Vorschlag übernehmen“, „Kanäle automatisch zuordnen“, „Teilnehmer über Busleitungen zuordnen“, Verteilerzuschlag in den Projekteinstellungen.

## Abdeckung
Verdict: PASS

- [A1] [INFO] „Fläche über Baum öffnen“ und „Außenseiten im Baum“ (workspace) haben keinen Test mit diesem Namen. Beide stehen nur im MODIFIED-Block, weil die Requirements „Aufbau der Oberfläche“ und „Strukturbaum“ um die Belegungsansicht und den Baum „Verteiler“ erweitert wurden; sie stammen aus M1 und sind dort getestet (Baum öffnet Wandansichten, „Nord außen“ unter „Flächen ohne Raum“). Die neuen Teile decken „Belegung öffnen“ und „Stromkreis im Baum“ ab.

## Drift
Verdict: PASS nach Nachträgen

### Findings
- [D1] [MAJOR] docs/architektur.md kannte die gedachte Raumgrenze (R.1, `dfcbc62`) nicht: weder `roomBoundaries` in der Geschossdatei noch im Datenmodell. Nachgetragen: Dateiliste, `Project.roomBoundaries`, `interface RoomBoundary`.
- [D2] [MINOR] R.6 (Werkzeug „Verteiler“ greift vorhandene Verteiler) und R.7 (Beschriftung in der Belegung) stehen in design.md „Rückmeldungen während M4“, aber in keinem Spec-Delta. Beide verfeinern die Bedienung und widersprechen keinem Requirement; das Spec-Szenario „Verteiler per Maus verschieben“ (R.5) deckt das Verschieben ab. Kein Nachtrag.
- [D3] [INFO] „Entscheidungen bei der Ausarbeitung“ 1–8 sind so umgesetzt, wie sie dort stehen; der Benutzer hat bei 7.2 keine davon beanstandet.
- [D4] [INFO] Wunsch aus 7.2 „Tabelle aller Geräte mit Anschluss im Verteiler“ ist kein Drift, sondern neuer Umfang. Er steht jetzt als Requirement „Geräteliste“ im m5-Delta `reports` (`08b8fd4`).
- [D5] [INFO] docs/architektur.md nennt in `Settings` bereits `defaultPlotScale: 50`, das Schema kennt das Feld noch nicht. Das gehört zu m5 (PDF-Export); das m5-Proposal sagt „keine Änderung am Datenmodell“ und muss dazu in design.md Stellung nehmen.

## Offene Punkte für spätere Changes
- CI für die Commits ab `f5841b2` ist noch nicht gelaufen (GitHub Actions erst wieder ab 2026-12-01). Lokal liefen alle Prüfungen in Chromium, Firefox und WebKit.
- banatstrasse10: `r84ym8kl` (freie Wand bei x 1147, vermutlich Treppenkante) offen; Flur, Treppe und der Raum zwischen `gn6x5h82` und `mrnxgbtd` legt der Benutzer selbst an.
- Bezeichnungen von Geräten sind im Grundriss und in der Wandansicht nicht sichtbar (nur Symbol und Stromkreis-Kurzname); bei Bedarf in einem späteren Change.
- Wandabstände für Geräte auf Schrägen, Dämmschicht (m6) bleiben offen.
