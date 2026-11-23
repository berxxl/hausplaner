# Review m5-plan-export

- Modus: --drift (Abgleich von Specs, design.md und docs/architektur.md mit der Umsetzung vor dem Archivieren)
- Datum: 2026-11-23
- Stand: `7a2468a` (Abschnitte 1–8.1 umgesetzt; 8.2 vom Benutzer am 2026-11-23 zurückgestellt und abgehakt) plus die Nachträge aus diesem Review
- Hinweis: Der Skill `/openspec-review` war nicht verfügbar. Den Review hat Claude von Hand erstellt, nach dem Schema der m1–m4-Drift-Reviews, ohne getrennte Prüfer-Agenten. Nach den Nachträgen wurde `openspec validate --strict` erneut ausgeführt.

## Vorgehen

1. Abdeckung: Alle 21 Szenarien der drei Spec-Deltas (`plan-export`, `reports`, `workspace`) wurden über ihren Namen in den Tests gesucht. 20 haben mindestens einen Test mit dem Szenarionamen.
2. Drift: Die Umsetzungs-Commits seit dem Review vor der Umsetzung (`b0ba3fa` bis `7a2468a`) wurden gegen design.md, die Specs und docs/architektur.md geprüft. Stichproben im Code: jsPDF/svg2pdf.js nur in `export/pdf.ts` (der Dialog lädt es erst beim Exportieren nach), `localStorage` `hausplaner.export`, Maßstäbe 20/25/50/100, XMP-Namensraum `https://hausplaner.app/ns/site-pdf/1` und Format `hausplaner-site-pdf`, Texte „nicht angeschlossen“, „<Verteiler> · ohne Stromkreis“, „Gerätedose <Tiefe> mm“, „… und <n> weitere“, „Bestandsplan“/„Planung“, „Maßstab 1:<m> (nicht 1:20)“, „Seite i von n …“, Knöpfe „Exportieren …“ und „Baustellen-PDF …“, Dialogtitel „PDF exportieren“, Dateiname, `pdfText`-Ersetzungen.

## Abdeckung
Verdict: PASS

- [A1] [INFO] „Fläche über Baum öffnen“ (workspace) hat keinen Test mit diesem Namen. Es steht nur im MODIFIED-Block, weil „Aufbau der Oberfläche“ um den Editor „Listen“ erweitert wurde; es stammt aus M1 und ist dort getestet. Der neue Teil ist durch „Gerät aus der Liste auswählen“ abgedeckt.
- [A2] [INFO] Maßhaltigkeit ist im Blattmodell (5 m → 100 mm bei 1:50) und in der heruntergeladenen PDF (Seitengröße, Lage einer Beschriftung in pt) geprüft, nicht am Ausdruck (siehe offene Punkte).

## Drift
Verdict: PASS nach Nachträgen

### Findings
- [D1] [MINOR] docs/architektur.md verwies für Blattaufbau und Seitenzuordnung auf `openspec/changes/m5-plan-export/design.md`; der Pfad ändert sich beim Archivieren. Nachgetragen: Verweis auf `openspec/changes/archive/2026-11-23-m5-plan-export/design.md`.
- [D2] [MINOR] Module, die design.md „Module“ nicht nennt: `export/compose.ts` (gemeinsame Exportoptionen, Filter, Planart, Zusammenbau, Dateiname), `export/settings.ts` (Exporteinstellungen mit zod), `reports/lists.ts` (Liste der Listen), `ui/export/useExportSettings.ts`. Alle rein bzw. reine UI-Hilfen, ohne Widerspruch zum Modulschnitt. Kein Nachtrag in docs/architektur.md nötig (dort nur Ordner).
- [D3] [MINOR] Exporteinstellungen: design.md nennt `{ scale, format, planStatus, trades, statuses }`, der Code speichert `format` als `paper` (A4/A3) und `orientation` (hoch/quer). Gleicher Inhalt, nur aufgeteilt; Ansichtszustand ohne Dateiformat. Kein Nachtrag.
- [D4] [MINOR] Maßstabsleiste: design.md nennt 0–1–2–5 m. Umgesetzt ist die längste Leiste aus 0–1–2–5–10 m, 0–1–2–5 m, 0–0,5–1–2 m und 0–0,25–0,5–1 m, die in die verfügbare Breite passt (bei 1:20 auf A4 passen 5 m nicht). Verfeinerung ohne Widerspruch zur Spec.
- [D5] [INFO] Die Baustellen-PDF schreibt den Maßstab bei 1:20 als „Maßstab 1:20“ neben die Zeichnung, bei 1:25/1:50 „Maßstab 1:<m> (nicht 1:20)“ wie festgelegt.
- [D6] [INFO] „Entscheidungen bei der Ausarbeitung“ 1–8 sind so umgesetzt, wie sie dort stehen. Der Benutzer hat sie noch nicht geprüft, weil 8.2 zurückgestellt ist.

## Offene Punkte für spätere Changes
- **Manuelle Prüfung aus 8.2, vom Benutzer am 2026-11-23 zurückgestellt:** Grundriss EG von banatstrasse10 in 1:50 auf A3 ausdrucken und eine Wand nachmessen; Wandansichten eines Raums, Baustellen-PDF und Listen in Safari prüfen (Safari ist älter als Playwright-WebKit; jsPDF und svg2pdf.js wurden nur auf sehr neue JS-APIs durchsucht). Befunde kommen als Folge-Tasks in den dann aktiven Change.
- 1:20 auf A4 reicht für Wände bis etwa 3,1 m Breite (hoch) bzw. 4,0 m (quer); breitere Wände kommen in 1:25 oder 1:50 mit Hinweis.
- CI für die Commits ab `f5841b2` ist noch nicht gelaufen (GitHub Actions erst wieder ab 2026-12-01). Lokal liefen alle Prüfungen in Chromium, Firefox und WebKit.
- Aus M4 weiter offen: banatstrasse10 `r84ym8kl`, Flur/Treppe im OG; Gerätebezeichnungen im Grundriss nicht sichtbar; Wandabstände für Schrägengeräte; Dämmschicht (m6).
