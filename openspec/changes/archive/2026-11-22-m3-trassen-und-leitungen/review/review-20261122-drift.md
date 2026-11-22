# Review m3-trassen-und-leitungen

- Modus: --drift (Abgleich von Specs, design.md und docs/architektur.md mit der Umsetzung vor dem Archivieren)
- Datum: 2026-11-22
- Stand: `fc1f71d` (alle Tasks einschließlich 7.2 und der Rückmeldungen R.1–R.3 abgehakt) plus die Nachträge aus diesem Review
- Hinweis: Der Skill `/openspec-review` war nicht verfügbar. Den Review hat Claude von Hand erstellt, nach dem Schema der m1/m2-Drift-Reviews, ohne getrennte Prüfer-Agenten. Nach den Nachträgen wurde `openspec validate --strict` erneut ausgeführt.

## Vorgehen

1. Abdeckung: Die Szenarien der vier Spec-Deltas (`cable-routes`, `cables`, `workspace`, `building-geometry`) sind über die Test-Angaben in tasks.md den Tests zugeordnet. Stichproben über Zahlen und Stichwörter der Szenarien (1830 mm, 9,9 m, 40-mm-Bohrung, Kernbohrung 65 mm, M20/M25, „Busleitung zum Präsenzmelder“, Cat 7 am Rollladenmotor, „Nur KNX“, „Trassen ausblenden“, Nordrichtung 30°, Werkzeug „Öffnung“) fanden jeweils mindestens einen Test.
2. Drift: Die Umsetzungs-Commits seit dem Review vor der Umsetzung (`c13edb6` bis `fc1f71d`) wurden darauf geprüft, ob sie Verhalten ändern, das in design.md, den Specs oder docs/architektur.md beschrieben ist oder dort fehlt. Stichproben im Code: Fangradius 12 px (`ROUTE_SNAP_PX`), Standarddurchmesser der Durchbrüche, Leerrohrliste M16–M50, alle Warnungstexte der Tabelle, „Kein Raum unter/über diesem Punkt“, „Keine passende Leitung“, „Typ wird von <n> Leitungen verwendet“, Befehlslabels, Decke im Grundriss gestrichelt, Hervorhebung Orange.

## Abdeckung
Verdict: PASS

## Drift
Verdict: PASS nach Nachträgen

### Findings
- [D1] [MAJOR] design.md „Auswahl“ vs. `ui/surface/SurfaceView.tsx`: Laut design.md wählt ein Alt-Klick auf ein Segment eine Leitung darauf. Umgesetzt war nur der Eintrag in den Segmenteigenschaften. Nachgeholt: Ein Alt-Klick wählt die erste sichtbare Leitung (nach ID), jeder weitere die nächste; ohne Leitung wird das Segment gewählt. Dazu ein Komponententest.
- [D2] [MAJOR] R.1 Nordpfeil (`0f46b16`) stand nur in tasks.md. Nachgetragen: Spec-Delta `workspace` mit dem Requirement „Nordpfeil im Grundriss“ und Abschnitt „Rückmeldungen während M3“ in design.md.
- [D3] [MINOR] R.2 Werkzeug „Öffnung“ und R.3 Baum auf- und zuklappen hatten Spec-Deltas, aber keinen Eintrag in design.md. Nachgetragen, darunter der Speicherort im `localStorage` (Ansichtszustand, nicht in den Projektdateien) und die Regel für die Markierung zugeklappter Einträge.
- [D4] [INFO] Zonenprüfung Bedingung 5 (Aufstieg zur Decke, Abstieg zum Boden) wurde schon bei der Umsetzung in design.md nachgetragen. Das Spec-Requirement „Zonenprüfung für Trassen“ nennt nur den Stich zum Gerät; die zusätzliche Ausnahme lässt weniger Warnungen zu und widerspricht keinem Szenario.
- [D5] [INFO] Spec „Übergänge an Kanten“ nennt Wand–Schräge. Umgesetzt ist das wie in design.md: Der Übergang an der Oberkante unter einer Schräge liegt auf der Schräge. Decke–Schräge und Schräge–Schräge gibt es nicht (Non-Goal in design.md).
- [D6] [INFO] Das Spec-Szenario „Leitung über zwei Geschosse“ nennt DG → EG. Der Test verwendet die Fixture mit EG/OG; geprüft wird dasselbe Verhalten (zwei Geschosse, Deckendurchbruch).
- [D7] [INFO] Die Werkzeugleiste im Grundriss bricht um (`f5841b2`). Das ist eine reine Layoutkorrektur, in design.md nur vermerkt.
- [D8] [INFO] docs/architektur.md entspricht dem Stand: `lengthAllowance` mit `perBoardMm` ab M4, `RouteNode.boardId` und `Endpoint.boardId` ab M4, `conduit {size, innerDiameterMm}`.

## Offene Punkte für spätere Changes
- Verteiler als Knoten und Leitungsendpunkte, Verteilerzuschlag (m4, Deltas liegen dort).
- CI für die Commits ab `f5841b2` ist noch nicht gelaufen (GitHub Actions erst wieder ab 2026-12-01). Lokal liefen alle Prüfungen in Chromium, Firefox und WebKit.
- Wandabstände für Geräte auf Schrägen, gedachte Raumgrenze (m1 9.4.3), Dämmschicht (m6) bleiben offen.
