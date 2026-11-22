# Review m2-geraete-und-moebel

- Modus: --drift (Abgleich von Specs, design.md und docs/architektur.md mit der Umsetzung vor dem Archivieren)
- Datum: 2026-11-22
- Stand: `0fd34a3` (alle Tasks einschließlich der Folge-Tasks 9.2.1 und 9.2.2 abgehakt) plus die Nachträge aus diesem Review
- Hinweis: Der Skill `/openspec-review` war nicht verfügbar. Den Review hat Claude von Hand erstellt, nach dem Schema des m1-Drift-Reviews, ohne getrennte Prüfer-Agenten. Nach den Spec-Nachträgen wurde `openspec validate` erneut ausgeführt.

## Vorgehen

1. Abdeckung: Die 47 Szenarien der acht Capabilities sind über die Test-Angaben in tasks.md den Tests zugeordnet. Stichproben über Zahlen und Stichwörter der Szenarien (1150, 1190, 2445, 71-mm-Kombination, „Typ wird von 12 Geräten“, „Steckdose USB-C“, „Präsenzmelder KNX“, „Gerät durch Möbel verdeckt“, nicht übergehbar, Hängeschrank 1450) fanden jeweils mindestens einen Test.
2. Drift: Die Umsetzungs-Commits seit dem Review vor der Umsetzung (`790960b` bis `0fd34a3`) wurden darauf geprüft, ob sie Verhalten ändern, das in design.md, den Specs oder docs/architektur.md beschrieben ist oder dort fehlt.

## Abdeckung
Verdict: PASS

## Drift
Verdict: PASS nach Nachträgen

### Findings
- [D1] [MAJOR] design.md „Bezug und Bemaßung“ vs. Abschnitt 3: Für Decke, Boden und Schräge waren in den Eigenschaften nur u und v umgesetzt. design.md verlangte die Abstände zur nächsten fertigen Wand (in tasks.md 3.5 als Folgepunkt vermerkt). Nachgeholt für Decke und Boden (`finishedWallDistances` in `geometry/devices.ts`, Felder „Abstand zur Wand links/rechts/oben/unten (Grundriss)“, Unit- und Komponententests). Für Schrägen bleibt es bei u und v; design.md ist entsprechend angepasst.
- [D2] [MAJOR] Befund 9.2 vs. design.md/Specs: Öffnungen aufziehen und verschieben sowie der geänderte Öffnungsdialog (`0fd34a3`) waren nur in tasks.md und im Spec-Delta `building-geometry` beschrieben. Nachgetragen in design.md „Öffnungen zeichnen (Befund 9.2)“.
- [D3] [MINOR] docs/architektur.md:Device vs. `src/model/types.ts`: `storeyId` steht am Gerät (für alle Platzierungen beim Laden gesetzt), nicht in `placement.free`. Korrigiert.
- [D4] [MINOR] docs/architektur.md:Room vs. Abschnitt 8: `room.rawHeightMm?` fehlte im Datenmodell. Nachgetragen.
- [D5] [INFO] design.md „Zuführung“: Der Schalter heißt in der Oberfläche „Zuführungen“, nicht „Zuführungen zeigen“. design.md angepasst.
- [D6] [INFO] `isSuppressible` gilt für alle Warnungen ohne Löschaktion. Das entspricht der Tabelle in design.md (`opening-without-wall` und die drei Verweise ins Leere sind nicht übergehbar).
- [D7] [INFO] Der Migrationshinweis, das Bereinigen übergangener Warnungen in `normalizeAfterCommand`, die Übersicht mit „Ort“ und „übergangen (n)“ und der Gewerkfilter entsprechen design.md.

## Offene Punkte für spätere Changes
- Wandabstände für Geräte auf Schrägen (siehe D1).
- Gedachte Raumgrenze (m1 9.4.3), weiterhin offen.
- Dämmschicht an Außenwänden (m1 9.4.1), in m6.
- Manueller Durchlauf 9.2: In banatstrasse10 wurden keine Geräte oder Möbel gespeichert. Die Befunde betrafen nur Öffnungen. Geräte und Möbel im echten Projekt sind daher noch nicht im Alltag erprobt.
- e2e „Endpunkt ziehen“ war einmal flaky auf macOS.
