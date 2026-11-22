# Design

## Context

M1 und M2 sind archiviert (`openspec/changes/archive/2026-11-21-m1-gebaeudemodell/`, `…/2026-11-22-m2-geraete-und-moebel/`). Es gibt Flächen mit (u, v)-Koordinaten (`deriveSurfaces`, `deriveRoomViews` mit Nachbarn links/rechts, fertigen Ecken und Deckenkontur), Geräte auf Flächen, Installationszonen je Raumansicht (`geometry/zones.ts`), Leitungstypen im Katalog, Warnungen mit Übergehen und den zentralen Nachbearbeitungsschritt `normalizeAfterCommand`. Trassen und Leitungen sind in `docs/architektur.md` vorgezeichnet (`RouteNode`, `RouteSegment`, `Cable`). Dieses Dokument legt fest, was M3 darüber hinaus braucht, damit beim Umsetzen keine eigenen Designentscheidungen nötig sind.

## Goals / Non-Goals

**Goals:**
- Trassennetz aus Knoten und Segmenten auf Wand, Decke, Boden und Schräge, zusammenhängend über Kanten
- Durchbrüche durch Wände und Geschossdecken mit Art, Durchmesser und berechneter Länge
- Leerrohre auf Segmenten, Belegung und Füllgrad
- Leitungen zwischen zwei Geräten, Wegvorschlag, Weg bearbeiten, Längen mit Zuschlägen
- Zonenprüfung für Wandsegmente, Status für Segmente und Leitungen

**Non-Goals:**
- Verteiler als Knoten oder Leitungsendpunkte, Verteilerzuschlag, mehrere Leitungen zu einem Verteiler in einem Schritt (ab M4, entschieden am 2026-11-22)
- Listen und PDF-Export der Leitungen und Durchbrüche (ab M5)
- Kältemittel- und Kondensatregeln (Länge, Gefälle; ab M6); Kältemittelleitungen sind in M3 gewöhnliche Leitungen
- Dämmschicht an Außenwänden (M6); Kernbohrungen nach außen enden an der rohen Außenseite
- Trassen im Grundriss zeichnen; der Grundriss zeigt Trassen nur an
- Automatisches Umlegen von Leitungen, wenn sich das Netz ändert (der Weg bleibt, bis der Benutzer ihn neu vorschlagen lässt)

## Decisions

### Schemaversion 3 und Migration
M3 erhöht `schemaVersion` auf 3. Grund wie in M2: Eine M2-App würde `routeNodes` in Geschossdateien als unbekanntes Feld ablehnen; mit Version 3 meldet sie „Projekt wurde mit neuerer App-Version erstellt“. Die Migration `2 → 3` setzt `settings.lengthAllowance` auf die Standardwerte und schreibt nichts von selbst (Hinweis „Projekt auf Version 3 aktualisiert, wird beim nächsten Speichern geschrieben“). Neue Projekte starten in Version 3.

### Dateiformat M3
M3 schreibt zusätzlich `routeNodes` und `routeSegments` in die Geschossdateien und `leitungen.yaml`. `leitungen.yaml` wird nur geschrieben, wenn es mindestens eine Leitung gibt, sonst gelöscht (`null`), wie `warnungen.yaml`. Neu oder geändert gegenüber M2 (übrige Zeilen gelten unverändert):

| Objekt | Felder in Schreibreihenfolge (`?` = nur wenn gesetzt) | Listen sortiert nach | Flow-Stil |
|---|---|---|---|
| `settings` | `northDeg`, `installZones`, `lengthAllowance` | – | – |
| `lengthAllowance` | `perDeviceMm`, `wastePercent` | – | ja |
| Geschossdatei | `storey`, `walls`, `rooms`, `openings`, `devices`, `furniture`, `routeNodes`, `routeSegments` | je Liste nach `id` | – |
| `routeNode` | `id`, `deviceId?`, `anchors` | – | – |
| `anchor` | `surface`, `u`, `v` | – | ja |
| `routeSegment` | `id`, `a`, `b`, `kind`, `surface?`, `penetration?`, `conduit?`, `status` | – | `penetration`, `conduit` |
| `penetration` | `method`, `diameterMm` | – | – |
| `conduit` | `size`, `innerDiameterMm` | – | – |
| Datei `leitungen.yaml` | `cables` | nach `id` | – |
| `cable` | `id`, `label`, `lineTypeId`, `status`, `from`, `to`, `path` | – | `from`, `to`, `path` |
| `endpoint` | `deviceId` | – | – |

Weitere Regeln:
- **Ablage:** Ein Knoten steht in der Datei des Geschosses seines ersten Ankers, ein Segment in der Datei des Geschosses seines Knotens `a`. Ein Durchbruch durch eine Geschossdecke hat einen Knoten in jedem der beiden Geschosse; sein Knoten `a` ist der im oberen Geschoss, damit er in dessen Datei steht. Bei Wanddurchbrüchen ist `a` der Knoten auf der Seite, auf der der Benutzer geklickt hat. `storeyId` wird nicht geschrieben, sondern beim Laden gesetzt.
- **Leitungen** stehen geschossübergreifend in `leitungen.yaml`; `path` ist die geordnete Liste der Segment-IDs vom Endpunkt `from` zum Endpunkt `to`, einzeilig im Flow-Stil.
- `docs/architektur.md` wird angepasst: `RouteNode.boardId`, `RouteSegment.conduit` mit `size` und `innerDiameterMm`, `Endpoint` mit `boardId` (ab M4), `settings.lengthAllowance`.
- **Verweise ins Leere** öffnen das Projekt und erzeugen nicht übergehbare Warnungen mit Aktion „Löschen“: Knoten mit unbekannter Fläche in einem Anker, Knoten mit unbekanntem Gerät (Aktion „Vom Gerät lösen“ statt Löschen), Segment mit unbekanntem Knoten, Leitung mit unbekanntem Typ oder Gerät. Unbekannte Segment-IDs in `path` werden beim Laden nicht entfernt, sie machen den Weg unterbrochen (siehe Warnungen); der nächste Befehl entfernt sie mit der Pfadbereinigung in `normalizeAfterCommand`.

### Knoten und Anker
- Ein Anker ist eine Position (u, v) auf einer Fläche, bezogen auf die **fertige** Oberfläche wie bei Geräten (Wandseite: v über OKFF des Raums des Abschnitts, ohne Raum über Rohfußboden).
- Ein Knoten hat einen Anker oder, auf einer Kante zwischen zwei Flächen, mehrere (Übergang). Der erste Anker ist maßgebend; die übrigen leitet `normalizeAfterCommand` nach jedem Befehl aus ihm ab (siehe „Übergänge an Kanten“).
- **Gerätknoten** (`deviceId` gesetzt): genau ein Anker auf der Fläche des Geräts an dessen Mitte. `normalizeAfterCommand` setzt den Anker nach jedem Befehl auf die aktuelle Gerätelage; verschiebt der Benutzer das Gerät, folgen Knoten und Segmente. Freie Geräte haben keine Fläche und bekommen in M3 keine Knoten.
- Weltposition eines Ankers wie bei Geräten (`deviceWorld`), als gemeinsame Funktion `anchorWorld` in `geometry/routes.ts`.

### Trassen zeichnen
- **Werkzeug „Trasse“** nur in der Flächenansicht. Jeder Klick setzt einen Punkt; ab dem zweiten Punkt entsteht ein Segment vom vorigen zum neuen Punkt. Esc oder ein Klick auf den letzten Punkt beendet den Zug. Jedes Segment ist ein Befehl („Trasse zeichnen“), wie beim Wandzug in M1.
- **Fang**, in dieser Reihenfolge, im Fangradius von 12 px: Gerätemitte (Gerätknoten; vorhandener Gerätknoten wird wiederverwendet, sonst neu angelegt), bestehender Knoten, Punkt auf einem bestehenden Segment (teilt das Segment, siehe „Abzweig“), Kante der Fläche (Übergangsknoten), senkrecht oder waagerecht zum vorigen Punkt (Winkelfang 0°/90°, mit Shift abschaltbar). Ohne Fang: Klickpunkt, auf ganze mm gerundet.
- **Abzweig:** Ein Klick auf ein Segment (beim Zeichnen oder mit dem Werkzeug „Trasse“ als erster Punkt) teilt es im Befehl „Segment teilen“ an der Projektion des Klickpunkts in zwei Segmente mit gleichem Status, gleichem Leerrohr und gleicher Fläche; jede Leitung, deren `path` das Segment enthält, erhält an dessen Stelle die beiden Teile in Wegrichtung.
- **Bearbeiten:** Knoten lassen sich mit dem Auswahlwerkzeug ziehen (ein Befehl „Knoten verschieben“, bleibt auf der Fläche, Übergangsknoten nur entlang ihrer Kante, Gerätknoten nicht) und numerisch über u und v bzw. Abstand zur Bezugskante wie bei Wandgeräten ändern (Spec „Aufmaß übernehmen“). Segmente und Knoten sind auswählbar und löschbar; ein Knoten wird mit allen anliegenden Segmenten gelöscht, ein Segment allein. Knoten ohne Segmente werden im selben Befehl entfernt, Gerätknoten auch.
- Die Segmentlänge ist der Abstand der beiden Anker in (u, v) derselben Fläche (u und v sind auf allen Flächenarten wahre Längen).

### Übergänge an Kanten
- **Wand–Wand (Raumecke):** Eine fertige Raumecke einer Raumansicht ist eine Kante zur Nachbaransicht (`RoomView.left`/`right`). Ein Knoten auf der rechten Ecke (u = `finished.uTo`) hat den zweiten Anker auf der rechten Nachbaransicht bei u = deren `finished.uFrom` mit gleicher Höhe über Rohfußboden (v wird um die Differenz der Fußbodenaufbauten korrigiert; im selben Raum ist sie null).
- **Wand–Decke:** Ein Knoten auf der fertigen Oberkante einer Raumansicht (v = Deckenkontur bei u) hat den zweiten Anker auf der Decke des Raums am Punkt der fertigen Wandoberfläche bei u (Grundriss-Punkt um den Putz nach innen versetzt, (u, v) = (−x, y)). Unter einer Schräge liegt der zweite Anker auf der Schräge (Koordinaten der Schräge).
- **Wand–Boden:** analog auf v = 0 (OKFF) mit dem Boden des Raums.
- **Decke–Schräge, Schräge–Schräge:** nicht in M3; der Benutzer zeichnet über die Wand.
- Fang auf eine Kante gibt es nur in Raumansichten (fertige Maße) und in Decken-, Boden- und Schrägenansichten an den Rändern, die an Raumansichten grenzen. Die Nachbarfläche lässt sich über die vorhandene Navigation öffnen; dort ist der Übergangsknoten Startpunkt eines neuen Zugs.
- Nach jedem Befehl leitet `normalizeAfterCommand` die weiteren Anker aus dem ersten neu ab. Gibt es die Kante nicht mehr (Raum gelöscht, Wand verschoben), bleiben die Anker stehen und die Warnung `route-node-off-edge` entsteht.

### Durchbrüche
- **Werkzeug „Durchbruch“** in der Flächenansicht: Klick auf einen Punkt der Fläche (auch auf einen bestehenden Knoten), Dialog mit Art (Bohrung, Kernbohrung, Schlitz, Leerrohr) und Durchmesser (Standard: Bohrung 40 mm, Kernbohrung 65 mm, Schlitz 50 mm, Leerrohr 25 mm). Ein Befehl „Durchbruch anlegen“ erzeugt bei Bedarf den Knoten auf dieser Seite, den Gegenknoten und ein Segment `kind: penetration` ohne `surface`.
- **Wand:** Gegenknoten auf der anderen Seite derselben Wand am gespiegelten Punkt: gleicher Grundrisspunkt auf der Achse, u auf der Gegenseite = Wandlänge − u, gleiche Höhe über Rohfußboden. Außenwand: die Gegenseite ist die Außenseite (v über Rohfußboden).
- **Boden → Decke darunter:** Gegenknoten in der Decke des Raums im nächsttieferen Geschoss (größte `elevationMm` kleiner als die eigene), der den Grundrisspunkt enthält. **Decke → Boden darüber** analog. Gibt es dort keinen Raum, wird der Durchbruch abgelehnt: „Kein Raum unter diesem Punkt“ bzw. „… über diesem Punkt“.
- **Länge** (abgeleitet): Wand = Rohbaudicke + Putz der Raumseiten, die einen Raum haben; Decke/Boden = Abstand der beiden Anker in Weltkoordinaten in z (von der fertigen Decke unten bis OKFF oben, also inklusive Fußbodenaufbau, Rohdecke, Abhängung und Putz).
- In den Ansichten erscheint ein Durchbruch als Kreis mit Durchmesser am Knoten; in 3D als Zylinder.

### Leerrohre
- Ein Segment hat optional `conduit: {size, innerDiameterMm}`. Auswahl in den Segmenteigenschaften aus einer festen Liste (flexibles Wellrohr nach DIN EN 61386-22, Innendurchmesser übliche Werte): M16 10,7 mm, M20 14,1 mm, M25 18,3 mm, M32 24,3 mm, M40 31,2 mm, M50 39,6 mm; der Innendurchmesser ist danach editierbar.
- Füllgrad = Summe der Querschnitte (π · (Außendurchmesser/2)²) aller Leitungen auf dem Segment / Innenquerschnitt. Über 40 % → Warnung „Leerrohr überfüllt“.
- Ein Durchbruch der Art „Leerrohr“ mit Durchmesser verhält sich für die Belegung wie ein Leerrohr mit diesem Innendurchmesser.

### Leitungen
- **Anlegen:** Werkzeug „Leitung“ in Grundriss und Flächenansicht: erstes Gerät anklicken, zweites Gerät anklicken (auch in einer anderen Ansicht oder einem anderen Geschoss; die Auswahl des ersten bleibt bis Esc), dann Dialog mit Leitungstyp (nur Typen, deren Gewerk beide Geräte anschließen; ist das keiner, Meldung „Keine passende Leitung: <Gerät 1> schließt <Gewerke> an, <Gerät 2> <Gewerke>“) und Bezeichnung (Vorschlag „<Gerät 1> – <Gerät 2>“). Ein Befehl „Leitung anlegen“, der den Wegvorschlag enthält. Status `planned`.
- **Typprüfung:** Der Leitungstyp ist zulässig, wenn sein Gewerk in `connects` beider Gerätetypen steht. Die Prüfung gilt beim Anlegen und beim Ändern von Typ oder Endpunkt (Ablehnung mit derselben Meldung).
- **Wegvorschlag:** kürzester Weg (Dijkstra, Gewicht = Segmentlänge in mm, Durchbrüche mit ihrer Länge) im ungerichteten Graphen aller Segmente von einem Gerätknoten des ersten zu einem Gerätknoten des zweiten Geräts. Gibt es mehrere gleich lange Wege, gewinnt der mit der lexikografisch kleineren Folge der Segment-IDs (deterministisch). Ohne Weg bleibt `path` leer.
- **Weg bearbeiten:** In den Leitungseigenschaften „Weg bearbeiten“: Klicks auf Segmente in Flächenansichten und Grundriss fügen sie hinzu oder entfernen sie; „Fertig“ ordnet die gewählten Segmente zu einer Kette vom ersten zum zweiten Gerät und speichert sie als ein Befehl „Weg ändern“. Lässt sich keine Kette bilden, wird die Auswahl trotzdem gespeichert (in gegebener Reihenfolge) und die Leitung gilt als unterbrochen. „Weg vorschlagen“ ersetzt den Weg durch den Wegvorschlag (Befehl).
- **Länge:** (Summe der Segmentlängen + 2 · `perDeviceMm`) · (1 + `wastePercent`/100), angezeigt in m mit einer Nachkommastelle, intern in mm. Standard `perDeviceMm` 300, `wastePercent` 10; einstellbar in den Projekteinstellungen (Befehl „Leitungszuschläge ändern“, Prüfung ≥ 0). Für eine Leitung ohne zusammenhängenden Weg wird keine Länge angezeigt („–“).
- **Hervorheben:** Ist eine Leitung ausgewählt, werden ihre Segmente in allen Flächenansichten, im Grundriss und in 3D hervorgehoben; der Baum markiert alle Flächen, über die sie läuft.

### Darstellung
- **Flächenansicht:** Segmente als Linien in Strichstärke 2 px, Knoten als Punkte, Übergangsknoten als Raute, Durchbrüche als Kreis mit Durchmesser. Statusfarben wie bei Geräten (geplant grau, verlegt blau, geprüft grün). Leerrohre zusätzlich als doppelte Linie. Hervorgehobene Leitung in Orange über allem.
- **Grundriss:** Boden- und Deckensegmente des aktiven Geschosses als Linien (Decke gestrichelt), Wandsegmente nicht (sie liegen in der Wandfläche), Wanddurchbrüche als kurzer Strich quer durch die Wand, Deckendurchbrüche als Kreis.
- **3D:** Segmente als Linien bzw. dünne Zylinder (Ø 20 mm) auf der fertigen Oberfläche, Durchbrüche als Zylinder mit ihrem Durchmesser; Statusfarben.
- **Belegung** in den Segmenteigenschaften: Anzahl Leitungen, Summe der Querschnitte in mm², bei Leerrohr Füllgrad in %, Liste der Leitungen.
- **Gewerkfilter:** neuer Schalter „Trassen“ (blendet Segmente, Knoten und Durchbrüche aus); Leitungen werden über das Gewerk ihres Typs gefiltert (ausgeblendet = nicht hervorhebbar, nicht anklickbar).

### Zonenprüfung
Regel `route-outside-zone:<segmentId>` für Segmente `kind: surface` auf Wandseiten innerhalb einer Raumansicht. Ein Segment ist in Ordnung, wenn eine der Bedingungen gilt (Toleranz 1 mm):
1. es ist waagerecht und liegt vollständig in der oberen oder unteren waagerechten Zone (bei schräger Oberkante: beide Enden im Band unter der Kontur),
2. es ist senkrecht und liegt vollständig in einer senkrechten Zone,
3. es ist senkrecht, ein Ende liegt in einer waagerechten Zone und das andere an einem Gerätknoten (Stich zum Gerät),
4. es ist senkrecht und Teil einer senkrechten Kette von Segmenten, die von einer waagerechten Zone zu einem Gerätknoten führt (Stich über einen Abzweig).

Segmente auf Wandseiten ohne Raum, auf Decken, Böden und Schrägen werden nicht geprüft. Text: „Trasse außerhalb Installationszone“. Klick wählt das Segment und öffnet die Raumansicht. Übergehbar.

### Warnungen
Neu in M3:

| Schlüssel | Text | Klick in der Warnungsliste | übergehbar |
|---|---|---|---|
| `route-outside-zone:<segmentId>` | „Trasse außerhalb Installationszone“ | wählt das Segment, öffnet seine Raumansicht | ja |
| `cable-without-path:<cableId>` | „Leitung ohne Weg: <Bezeichnung>“ (leerer Weg) bzw. „Weg unterbrochen: <Bezeichnung>“ (keine zusammenhängende Kette von Gerät zu Gerät) | wählt die Leitung | ja |
| `conduit-overfull:<segmentId>` | „Leerrohr überfüllt (<n> %)“ | wählt das Segment, öffnet seine Fläche | ja |
| `route-node-off-edge:<nodeId>` | „Übergang nicht mehr auf der Kante“ | wählt den Knoten, öffnet die Fläche des ersten Ankers | ja |
| `route-node-without-surface:<nodeId>` | „Trassenknoten ohne Fläche (<SurfaceRef>)“ | nur Eintrag mit Aktion „Löschen“ | nein |
| `route-node-without-device:<nodeId>` | „Trassenknoten an unbekanntem Gerät“ | Aktion „Vom Gerät lösen“ | nein |
| `route-segment-without-node:<segmentId>` | „Segment mit unbekanntem Knoten“ | Aktion „Löschen“ | nein |
| `cable-without-type:<cableId>` | „Leitung mit unbekanntem Typ (<lineTypeId>)“ | Aktion „Löschen“ | nein |
| `cable-without-device:<cableId>` | „Leitung an unbekanntem Gerät“ | Aktion „Löschen“ | nein |

Ein Leitungstyp, der von Leitungen verwendet wird, kann nicht gelöscht werden („Typ wird von <n> Leitungen verwendet“, wie bei Geräten).

### Löschen und abhängige Änderungen
Alles im selben Befehl, die Bestätigung nennt die Anzahl mitgelöschter Leitungen:
- **Gerät löschen:** löscht Leitungen, die an ihm enden; sein Gerätknoten wird zu einem gewöhnlichen Knoten (bleibt mit seinen Segmenten stehen).
- **Wand, Raum, Geschoss löschen:** Knoten, deren einziger Anker auf einer gelöschten Fläche liegt, werden mit ihren Segmenten gelöscht; Übergangsknoten verlieren nur den betroffenen Anker. Durchbrüche, deren Knoten gelöscht wird, werden mitgelöscht.
- **Segment löschen:** die Segment-ID wird aus allen `path` entfernt; die betroffenen Leitungen gelten danach als unterbrochen.
- Diese Bereinigung (Pfade, verwaiste Knoten) gehört zu `normalizeAfterCommand`, damit sie bei jedem Befehl greift.

### Status
Segmente und Leitungen haben `status` (`planned`, `installed`, `verified`), neue Objekte `planned`. Status wird in den Eigenschaften gesetzt, für mehrere ausgewählte Segmente gemeinsam. Keine Kopplung zwischen Segment- und Leitungsstatus in M3.

### Auswahl
Neue Auswahlarten `route-node`, `route-segment`, `cable`. Mehrfachauswahl mit Shift für Segmente (für Status, Leerrohr und Löschen). Die Auswahl gilt wie in M2 in allen Ansichten. Leitungen sind in der Flächenansicht über ein Segment wählbar (Klick auf ein Segment wählt das Segment; Alt-Klick bzw. ein Eintrag in den Segmenteigenschaften wählt eine Leitung darauf). Der Baum zeigt in M3 keine Trassen und Leitungen, markiert aber die Flächen einer ausgewählten Leitung.

### Store und Befehle
Neue Befehle (deutsche Labels): „Trasse zeichnen“, „Segment teilen“, „Knoten verschieben“, „Segment ändern“, „Trasse löschen“, „Durchbruch anlegen“, „Leitung anlegen“, „Leitung ändern“, „Weg ändern“, „Weg vorschlagen“, „Leitung löschen“, „Leitungszuschläge ändern“. Abhängige Änderungen in `normalizeAfterCommand`: Gerätknoten auf Gerätelage, weitere Anker von Übergangsknoten, verwaiste Knoten entfernen, gelöschte Segmente aus Pfaden entfernen (vor dem Bereinigen übergangener Warnungen).

### Module
Neue reine Module: `geometry/routes.ts` (Anker → Welt, Übergänge an Kanten, Gegenknoten von Durchbrüchen, Segment- und Durchbruchlängen, Teilen), `geometry/cables.ts` (Graph, Dijkstra, Kette ordnen, Länge, Belegung, Füllgrad), `rules/routes.ts` (Zonenprüfung, Leerrohr, Knoten), `rules/cables.ts` (Weg, Verweise), `store/routes.ts`, `store/cables.ts`. UI: `ui/RouteProperties.tsx`, `ui/CableProperties.tsx`, Erweiterungen in `ui/surface/`, `ui/plan/`, `ui/three/`, `ui/ProjectSettings.tsx`, `ui/TradeFilter.tsx`.

### Tests und Fixtures
- Neue Fixture `tests/fixtures/m3/`: Kopie der M2-Fixture mit zwei Geschossen (EG und OG), Trassen in Küche und Flur über eine Raumecke und zur Decke, einem Wanddurchbruch, einem Deckendurchbruch EG/OG, einem Leerrohr M20 und drei Leitungen (eine über beide Geschosse); Golden-File-Test für alle Dateien.
- Migrations-Test mit der M2-Fixture: Version 3, erster Befehl schreibt `projekt.yaml` mit `lengthAllowance`, sonst nichts.
- Unit-Tests für Übergänge (Ecke, Decke, Schräge), Gegenknoten (Innenwand, Außenwand, Decke), Längen, Dijkstra (gleich lange Wege deterministisch), Kette ordnen, Füllgrad, Zonenprüfung (alle vier Bedingungen und Diagonale), Teilen mit Pfadanpassung, Löschkaskaden, Normalisierung.
- Playwright: Trasse von der oberen Zone zur Steckdose zeichnen, über die Ecke fortsetzen, Durchbruch durch die Innenwand, Leitung anlegen und Weg in 3D hervorgehoben, Zuschläge ändern ändert die Länge, speichern und neu laden.

## Risks / Trade-offs

- [Ableitung weiterer Anker nach jedem Befehl kostet Rechenzeit] → nur für Übergangsknoten, nur wenn Wände, Räume, Geschosse oder Knoten geändert wurden (wie beim Höhenbezug in M2)
- [Gespeicherter Weg veraltet, wenn das Netz umgebaut wird] → bewusst: Wege ändern sich nie von selbst; unterbrochene Wege erzeugen eine Warnung, „Weg vorschlagen“ repariert
- [Zonenprüfung mit Toleranz 1 mm kann bei gerundeten Eingaben knapp scheitern] → Fang auf Zonengrenzen ist Teil des Zeichenwerkzeugs (waagerechter/senkrechter Winkelfang, Fang auf Gerätemitte)
- [Durchbruchlänge durch Außenwände ohne Dämmung zu kurz] → bekannt aus m1 9.4.1, Lösung in M6
- [Leitungen an Geräten ohne Fläche (frei) haben keinen Gerätknoten] → Klima-Außengeräte erhalten erst in M6 eine Anbindung; bis dahin endet die Trasse am Durchbruch nach außen, die Leitung gilt als ohne Weg

## Entschieden am 2026-11-22

- Verteiler kommen erst mit M4. In M3 enden Trassen und Leitungen an Geräten; die Verteiler-Szenarien (Leitung zur UV, Verteilerzuschlag 1,5 m, mehrere Leitungen zu einem Verteiler) stehen als Spec-Deltas in `m4-verteiler-und-stromkreise`.

## Open Questions

- Keine.
