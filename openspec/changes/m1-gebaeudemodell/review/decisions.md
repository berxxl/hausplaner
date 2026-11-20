# Entscheidungen zum Review 2026-11-20 14:57

- F2.1: ACCEPTED: Gebäudeteile (Wände, Öffnungen, Schrägen) werden in Rohbaumaßen gespeichert, Geräte ab M2 bezogen auf OKFF und fertige Oberfläche; Scenario auf Fensterbrüstung umgestellt
- F2.2: ACCEPTED: Schrägenhöhe ab OK Rohfußboden bis Unterseite Rohschräge, Anstieg zur Raumseite, fertige Schräge um Verkleidung tiefer; Scenario neu gerechnet
- F2.3: ACCEPTED (Variante): Fläche = ganze Wandseite, Ansicht je Raum ist Ausschnitt; SurfaceRef bleibt `wall:<wallId>:L|R`, damit Geräte und Trassen beim Neuerkennen oder Teilen von Räumen erhalten bleiben
- F2.4: ACCEPTED: Scenarios in project-storage auf M1-Objekte umgestellt
- F2.5: ACCEPTED: Syntax-, Konflikt- und Schemafehler → Ablehnen; Verweis ins Leere → öffnen, Warnung, Objekt markiert
- F2.6: ACCEPTED: nach „behalten“ werden extern geänderte Dateien nicht automatisch gespeichert; Überschreiben nur ausdrücklich nach Warnhinweis
- F2.7: ACCEPTED: Raumkontur folgt Wandänderungen, bei Wegfall bleibt sie mit Warnung; Fangtoleranz 20 mm
- F2.8: ACCEPTED: Längenänderung bewegt den Endpunkt, Anfangspunkt bleibt; Lage bezieht sich auf die Achse; T-Anschluss-Scenario
- F2.9: ACCEPTED: Wandauswahl markiert die Wandseiten im Baum; Wände ohne Raum unter „Wände ohne Raum“
- F2.10: ACCEPTED: Gewerkfilter nach M2 verschoben, mit Möbel als Zusatzkategorie
- F2.11: ACCEPTED: Wandansicht zeigt fertige Laibung, Bemaßung fertig, Rohbaumaß abrufbar
- F2.12: ACCEPTED: Verteiler und Listen aus dem M1-Delta entfernt
- F2.13: ACCEPTED: „lotrecht, im Grundriss beliebiger Winkel“, abweichende Wandhöhe ergänzt
- F2.14: ACCEPTED: Geometrie des Rollladenkastens je Lage festgelegt
- F2.15: ACCEPTED: Oberkante Außenseite, Schrägenansicht, Navigation aus Decke und Boden ergänzt
- F2.16: ACCEPTED: Scenario umformuliert, Drehpunkt festgelegt
- F2.17: ACCEPTED: Rundungsregeln je Größe; Migration löst kein Autospeichern aus
- F2.18: ACCEPTED: Anlegen im Browser, Speichern mit Cmd/Strg+S
- F2.19: ACCEPTED: Grammatik korrigiert
- Offene Fragen: Hintergrund und Kalibrierung sind undo-fähig; Eingaben und Bemaßung in mm, Gesamtlängen in m

# Entscheidungen zum Review 2026-11-20 15:10 (--after-fixes)

- F4.1: ACCEPTED (Variante b): abschnittsweiser v-Bezug je Raum bewusst beibehalten; Begründung in design.md, Requirement „Höhenbezug auf der Wandseite“ mit Scenario, Test in Task 7.2
- F5.1: ACCEPTED: Baum- und Markierungs-Tasks nach 7.1/7.2 verschoben (7.6), 4.5 nur Gerüst
- F5.2: ACCEPTED: Benennung „Wand <Himmelsrichtung>“ in 8 Sektoren, Nordrichtung `settings.northDeg`, Nummerierung bei Dopplung; Requirement in surface-views
- F5.3: ACCEPTED: Angrenzung (≤ 20 mm, ≤ 0,5°, Überlappung) und Außenseite (Seite ohne Raum, sonst `outsideSide`, Standard L)
- F5.4 + F4.4: ACCEPTED: Baumknoten „Flächen ohne Raum“ statt „Wände ohne Raum“, Doppelklick außerhalb aller Räume öffnet ganze Wandseite
- F5.5 + F4.5: ACCEPTED: Tabelle „Dateiformat M1“ in design.md; alle Listen nach ID; M1 schreibt nur `projekt.yaml` und Geschossdateien, fehlt = leer; keine Geschossliste in `projekt.yaml`
- F5.6: ACCEPTED: API-Tabelle mit Bodies und Statuscodes, `/api/raw` für PDFs, temp+rename, Port 5180–5189
- F5.7: ACCEPTED: leer = keine `*.yaml`; Ordner nur nach Zustimmung anlegen; Standardwerte genannt
- F5.8: ACCEPTED: Slug einmalig gebildet und gespeichert, ändert sich beim Umbenennen nicht
- F5.9: ACCEPTED: Transformationsformel, Drehung um gewählten Punkt, Neu-Kalibrieren hält p1 fest
- F5.10: ACCEPTED: Endpunkt verschieben → Eck-Nachbarn übernehmen Endpunkt; parallel verschieben → Nachbarn behalten Richtung; Achse = Mittellinie; Rechteck-Scenario mit Zahlen
- F5.11: ACCEPTED: Regeln der Raumerkennung in design.md, Status abgeleitet, Warnungsleiste in workspace
- F5.12 + F4.3: ACCEPTED: Verweis ins Leere nur mit Warnung und Aktion „Löschen“; Task 6.7
- F5.13: ACCEPTED: Schrägenformel, 3D-Kappung über alle angrenzenden Räume, fertige Öffnungsmaße, Slopes mit stabiler `id`
- F4.2: ACCEPTED: bei externer Änderung pausiert das Autospeichern ganz bis Neuladen oder bestätigtem Überschreiben
- F5.14–F5.22: ACCEPTED wie vorgeschlagen
- Offene Fragen: Zeichenmodus Achse/linke/rechte Kante; Geschosse nach Höhenlage; auswählbar Geschoss, Wand, Raum, Öffnung, Schräge (3D-Klick auf Decke/Boden wählt Raum); frei stehende Wand gehört zum umgebenden Raum

# Entscheidungen zum Review 2026-11-20 15:22 (--after-fixes, Runde 3)

Status: vom Benutzer alle ACCEPTED, am 2026-11-20 in design.md, specs, tasks.md und docs/architektur.md eingearbeitet. Der offene Punkt zum v-Bezug steht in design.md unter Open Questions und im Workflow-Follow-up von tasks.md, weil es `m2-geraete-und-moebel/design.md` noch nicht gibt.

## MAJOR
- F5.1: `suspendedMm` in `storey.defaults` (Reihenfolge floorBuildupMm, plasterMm, suspendedMm; Standard 0); architektur.md anpassen
- F5.2 + F4.6: verbindliches vollständiges Beispiel einer M1-Geschossdatei in design.md (underlay als Block, Raum mit slopes, Öffnung mit shutterBox); Formatregeln: yaml `lineWidth: 0`, `flowCollectionPadding: false`, Einrückung 2, Sequenzen eingerückt; Ganzzahlen ohne `.0`, sonst kürzeste Dezimaldarstellung, `-0` → `0`; Feldreihenfolge Unterobjekte: point {x, y}, defaults {floorBuildupMm, plasterMm, suspendedMm}, calibration {p1, p2, distanceMm}, shutterBox {position, heightMm}; Beispiel in architektur.md angleichen
- F5.3: `schemaVersion` > aktuelle → Fehlerseite „Projekt wurde mit neuerer App-Version erstellt“, nicht öffnen; unbekannte Felder = Schemaverstoß (zod `.strict()`); unbekannte `*.yaml` (außer projekt.yaml, geschosse/*.yaml) ignorieren, nie schreiben oder löschen; fehlende `schemaVersion` = Schemaverstoß (Dummy-Migration v0 nur im Test registriert); Tests in 2.5/2.6
- F5.4: Ladefehler bei Slug ≠ Dateiname, doppelten IDs (projektweit), doppelten Slugs, Geschossdateien ohne `projekt.yaml`; Tests in 2.5
- F5.5: kanonisches Raumpolygon: Clipper (npm `clipper-lib`), Miter-Join, auf mm runden, Duplikate und kollineare Punkte (≤ 0,5°) entfernen, Umlauf gegen den Uhrzeigersinn, Start bei kleinstem y, dann kleinstem x; Test: Wandänderung an Raum A lässt Zeilen von Raum B unverändert
- F5.6: Region enthält fremden Saatpunkt → gespeichertes Polygon bleibt, Warnung `room-merged:<roomId>` „Raum mit <Name> verschmolzen“; Spec-Scenario in building-geometry „Raumkontur folgt“; Test in 6.5
- F5.7 + F4.2: Endpunkt verschieben: T-angeschlossene Wände behalten Richtung, Endpunkt = Schnitt mit neuer Achse; liegt der Schnitt außerhalb der Achse (± 20 mm), wird der Anschluss gelöst und eine Meldung angezeigt (keine gespeicherte Warnung); ein eigener T-Anschluss der bewegten Wand darf sich lösen; „kollinear“ = ≤ 0,5° und Achsabstand ≤ 20 mm mit gemeinsamem Endpunkt, transitiv; Scenario + Tests in 6.3
- F5.8: Wandseite: u=0 = Projektion des aus Sicht vor dieser Seite linken Achsendpunkts, u entlang der Achse, Länge = Achslänge, Kontur an Gehrungen beschnitten; Schräge: u=0 am linken Ende der Grundlinie (Blick vom Raum auf die Schräge), v=0 auf der Grundlinie (d=0), v entlang der Schräge aufwärts; Decke (u, v) = (−x, y); Boden (u, v) = (x, y); architektur.md anpassen
- F5.9: Datei wird geschrieben, wenn ihre Serialisierung vom zuletzt gelesenen/geschriebenen Inhalt abweicht; Autospeichern nur durch Befehle ausgelöst; Cmd/Strg+S schreibt alle abweichenden Dateien (auch nach Migration); nicht kanonische Handänderungen werden beim nächsten Speichern kanonisch umgeschrieben; Test: nach Migration + erster Änderung wird projekt.yaml mit schemaVersion 1 geschrieben
- F5.10: PDFs immer per Upload `PUT /api/raw/plaene/<name>`; Server sucht in `plaene/` eine Datei mit gleichem SHA-256 → 200 `{"path": vorhandene}`; sonst schreiben mit Kollisionssuffix → 201 `{"path": neu}`; kein Listen-Endpunkt; Spec-Scenario „PDF-Plan hinzufügen“ anpassen

## MINOR
- F4.1 + F5.14: `null` = löschen bleibt; neue Tasks: Löschen von Geschoss (Datei löschen), Raum, Öffnung, Schräge, jeweils undo-fähig mit Test; Events melden nur `*.yaml` (plaene/* streichen)
- F4.3: Scenario „Raum neu erkennen“ in building-geometry (Raum behält Name und Werte, neue Kontur)
- F4.4 + F5.17: Warnungsschlüssel: `room-open`, `room-merged`, `opening-without-wall`, `opening-invalid`, `slope-invalid` (Text „Schräge ungültig: <Raum>“); Klickziele: Raum-/Schrägen-Warnungen → Raum im Grundriss, `opening-without-wall` → nur Liste mit „Löschen“, `opening-invalid` → Öffnung in Wandansicht; Markierung offener Endpunkte verschwindet beim nächsten Klick oder Befehl
- F4.5 + F5.16: „außen“ nur für Außenseiten von Außenwänden, Innenwandseiten ohne Raum „Wandseite <Richtung>“; Nummerierung gleicher Richtung im Uhrzeigersinn um den Raumschwerpunkt ab 0° (Nord); Sektoren halboffen [−22,5°, 22,5°); Mindestüberlappung 1 mm; „Flächen ohne Raum“ nach Richtung, dann Wand-ID; frei stehende Wandseiten: Normale in Blickrichtung, keine Nachbarn
- F4.7: architektur.md: „localhost“ → `127.0.0.1`; „Ursprung frei wählbar“ → p1 der ersten Kalibrierung ist Weltursprung
- F4.8: Task „Projekteinstellungen“ (Projektname, Nordrichtung) mit Test, dass sich Wandnamen nach Änderung ändern; Requirement in workspace
- F4.9 + F5.23: Fixture-PDFs einchecken statt Skript: Vektorplan A3, 2 Seiten, 1:100, bemaßte Referenzstrecke 4260 mm; Scan = Rasterbild von Seite 1, 150 dpi, um 1,5° gedreht; Herkunft in tests/fixtures/README.md
- F4.10: markiert werden Endpunkte ohne Anschluss, deren Wandkörper an die offene Region grenzt; Testfall in „Lücke 30 mm“
- F5.11: Scenario „Änderung im DG“ um „der angeschlossenen Wände“ ergänzen
- F5.12: `page` ab 1; Viewport `page.getViewport({scale: 1})` inkl. Seitenrotation; `rotationDeg` positiv gegen den Uhrzeigersinn; Δ numerisch in 0,1°
- F5.13: Neues Projekt schreibt sofort projekt.yaml + geschosse/eg.yaml; weiteres Geschoss übernimmt rawHeightMm und defaults des höchsten Geschosses, Höhenlage = dessen elevationMm + rawHeightMm + 300; Gleichstand der Höhenlage nach Name
- F5.15: ungültige Öffnungen (über Wandende, überlappend, sillMm + heightMm > Wandhöhe) erlaubt, Warnung `opening-invalid:<id>`; Test
- F5.18: Raumfläche = fertige Fläche (Rohbaupolygon um Putz nach innen versetzt)
- F5.19: realpath-Prüfung über nächsten existierenden Vorfahren; 403 bricht wie 400 den ganzen Stapel ab; `null` auf fehlende Datei = "ok"; `npm run dev` startet zuerst den Server und übergibt den gewählten Port an den Vite-Proxy
- F5.20: Speicherfehler: erneuter Versuch beim nächsten Befehl und alle 10 s; nach bestätigtem Überschreiben verschwindet der Hinweis und das Autospeichern läuft wieder; plaene/* löst keinen Hinweis aus
- F5.21: neue Wand: Innenwand, Dicke = zuletzt verwendete (Start 240 mm); orthogonale Bevorzugung bis 5°; Raster 1 m / 100 mm ohne Rasterfang; mm-Felder runden Dezimaleingaben, Eingabe mit „m“ wird umgerechnet; Winkel mit Komma oder Punkt
- F5.22: Raumneuberechnung läuft im selben Befehl/Patch wie die Wandänderung
- Coverage-Lücken als Tests ergänzen: Hintergrund verschieben und Deckkraft (5.4), Kalibrierung rückgängig (5.3), niedrige Wand (6.2), Fenster setzen in Grundriss/beiden Seiten/3D (6.7), Aufsatzkasten innen (7.3), Messen in Decken-/Boden-/Schrägenansicht (7.5), Geschossstapelung in 3D (8.1)

## Offene Fragen
- Wandseite ohne Raum bekommt später einen Raum → v-Bezug wechselt: DEFERRED nach M2 (als offener Punkt in M2 design.md aufnehmen)
- Migration „Version 0“: nur Testfall; echte Dateien ohne schemaVersion sind ein Ladefehler (siehe F5.3)

# Entscheidungen zum Review 2026-11-20 16:15 (--quick)

Status: vom Benutzer alle ACCEPTED wie vorgeschlagen, eingearbeitet in design.md, specs und tasks.md.

- Q4.1: ACCEPTED: Anschluss lösen (± 20 mm, Meldung, Nachbar unverändert) gilt auch beim Parallelverschieben; Scenario in building-geometry, Test in 6.3
- Q4.2: ACCEPTED: Gründe „über Wandende“, „überlappt <andere Öffnung>“, „höher als die Wand“; bei mehreren der erste in dieser Reihenfolge
- Q5.1: ACCEPTED: fehlt `projekt.yaml` und gibt es keine Geschossdatei, gilt der Ordner als leer; Anlegen lässt unbekannte Dateien unberührt
- Q5.2: ACCEPTED: `room-open` hat Vorrang, `room-merged` nur bei geschlossener Region
- Q5.3: ACCEPTED: Klick auf `opening-invalid` öffnet die Ansicht des Raums an Seite L (Abschnitt mit der Öffnungsmitte), sonst die ganze Wandseite L
- Q5.4: ACCEPTED: ungültige Öffnung an der Wandkontur abschneiden und rot umranden
