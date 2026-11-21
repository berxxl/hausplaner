# Design

## Context

M1 ist archiviert (`openspec/changes/archive/2026-11-21-m1-gebaeudemodell/`). Es gibt Projektmodell, Store mit Befehlen und Undo, Serialisierung nach festen Feldlisten, Flächen (`deriveSurfaces`, `deriveRoomViews`), Grundriss, Flächenansichten, 3D und eine Warnungsleiste mit berechneten Warnungen. Datenmodell und Dateiaufteilung für Katalog, Geräte, Möbel und übergangene Warnungen sind in `docs/architektur.md` vorgezeichnet. Dieses Dokument legt fest, was M2 darüber hinaus braucht, damit beim Umsetzen keine eigenen Designentscheidungen nötig sind.

Erste Erfahrungen aus dem Nachzeichnen von banatstrasse10 (m1, Task 9.4) fließen ein: Altbau mit Anbau, Außenwände ohne modellierte Dämmung, unterschiedliche Rohbauhöhen in Bestand und Anbau.

## Goals / Non-Goals

**Goals:**
- Katalog als Daten im Projekt, Standardkatalog für neue und für migrierte M1-Projekte
- Geräte auf Wand, Decke, Boden und Schräge setzen, exakt bemaßen, mit Status
- Installationszonen und senkrechte Zuführung in Wandansichten
- Möbel als Quader mit Einrasten an Wandseiten, Silhouette in Wandansichten, Kollisionswarnung
- Warnungen bewusst übergehen; Gewerkfilter in allen Ansichten

**Non-Goals:**
- Reiheneinbaugeräte im Verteiler (`placement: board`, ab M4); Typen mit Montageart `din-rail` erscheinen im Katalog, sind in M2 aber nicht platzierbar
- Stromkreise, KNX-Linien und -Zuordnungen (`circuitId`, `knxLineId`, ab M4), Leitungen und Trassen (ab M3)
- Listen und PDF-Export (ab M5); die Symbolwahl gilt dort später unverändert
- Lichtberechnung und Kältemittelregeln (ab M6); die Katalogfelder `light` und `refrigerant` werden in M2 nur gespeichert und bearbeitet
- Dämmschicht an Außenwänden (m1 9.4.1, in M6); Geräte an der Fassade sitzen in M2 auf der rohen Außenseite
- Möbel als Freiformkörper, Möbel auf Schrägen oder Decken

## Decisions

### Schemaversion 2 und Migration
M2 erhöht `schemaVersion` auf 2. Grund: Eine M1-App würde Geschossdateien mit `devices` als Schemaverstoß „unbekanntes Feld“ ablehnen; mit Version 2 meldet sie stattdessen verständlich „Projekt wurde mit neuerer App-Version erstellt“. Die Migration `1 → 2` ist die erste echte Migration:
- setzt `settings.installZones` auf die Standardwerte,
- setzt den Katalog auf den Standardkatalog, wenn `katalog.yaml` fehlt (vorhandene `katalog.yaml` bleibt unverändert),
- schreibt nichts von selbst; wie in M1 löst erst der nächste Befehl oder Cmd/Strg+S das Schreiben aus, mit dem Hinweis „Projekt auf Version 2 aktualisiert, wird beim nächsten Speichern geschrieben“.

Ein neues Projekt startet direkt in Version 2 und schreibt beim Anlegen `projekt.yaml`, `geschosse/eg.yaml` und, falls noch keine vorhanden ist, `katalog.yaml` mit dem Standardkatalog. Liegt im leeren Ordner bereits eine `katalog.yaml` (etwa aus einem anderen Projekt kopiert), wird sie geladen und unverändert übernommen; ist sie ungültig, erscheint die Fehlerseite wie bei jedem Ladefehler. Die Dummy-Migration „0 → 1“ bleibt Testgerüst.

### Dateiformat M2
M2 schreibt `projekt.yaml`, `katalog.yaml`, `geschosse/<slug>.yaml` und `warnungen.yaml`. Fehlt eine Datei, gilt sie als leer; `warnungen.yaml` wird gelöscht (`null`), wenn keine Warnung übergangen ist, und nur geschrieben, wenn mindestens eine übergangen ist. Unbekannte `*.yaml` werden weiter ignoriert. Neu oder geändert gegenüber M1 (übrige Zeilen der M1-Tabelle gelten unverändert):

| Objekt | Felder in Schreibreihenfolge (`?` = nur wenn gesetzt) | Listen sortiert nach | Flow-Stil |
|---|---|---|---|
| `settings` | `northDeg`, `installZones` | – | – |
| `installZones` | `horizontalTop`, `horizontalBottom`, `verticalFromEdge` | – | jedes Tupel |
| Datei `katalog.yaml` | `deviceTypes`, `lineTypes`, `furnitureTypes` | je Liste nach `id` | – |
| `deviceType` | `id`, `name`, `trade`, `symbol`, `shape3d`, `mounting`, `defaultHeightMm?`, `flush?`, `teWidth?`, `connects`, `knx?`, `light?`, `refrigerant?` | – | `shape3d`, `mounting`, `flush`, `connects`, `light`, `refrigerant` |
| `knx` | `consumes?`, `provides?` | – | `provides` |
| `lineType` | `id`, `name`, `trade`, `outerDiameterMm`, `color` | – | – |
| `furnitureType` | `id`, `name`, `widthMm`, `depthMm`, `heightMm`, `elevationMm` | – | – |
| Geschossdatei | `storey`, `walls`, `rooms`, `openings`, `devices`, `furniture` | je Liste nach `id` | – |
| `room` | wie M1, zusätzlich `rawHeightMm?` nach `name` (siehe „Rohbauhöhe je Raum“) | – | – |
| `device` | `id`, `label`, `typeId`, `status`, `placement` | – | `placement` |
| `placement` | `surface`: `kind`, `surface`, `u`, `v`, `rotationDeg`; `free`: `kind`, `x`, `y`, `z` | – | ja |
| `furniture` | `id`, `typeId`, `x`, `y`, `rotationDeg`, `widthMm`, `depthMm`, `heightMm`, `elevationMm` | – | – |
| Datei `warnungen.yaml` | `suppressedWarnings` | Schlüssel alphabetisch | – |

Weitere Regeln:
- **Ablage der Geräte:** Ein Gerät mit `placement.kind: surface` steht in der Datei des Geschosses, zu dem seine Fläche gehört; `free` in der Datei seines Geschosses. `storeyId` wird nicht geschrieben, sondern beim Laden gesetzt (wie bei Wänden). `docs/architektur.md` wird entsprechend angepasst: dort führt `free` noch ein `storeyId`.
- **Symbole** sind einzeilige Texte (siehe „Symbole“); lange Zeilen werden wie überall nicht umbrochen.
- **IDs im Katalog:** Typen des Standardkatalogs haben lesbare, feste IDs aus `[a-z0-9-]` (z. B. `socket-double`, `nym-3x1-5`), damit `typeId` in Geschossdateien lesbar ist und Standardtypen in allen Projekten gleich heißen. Vom Benutzer angelegte oder kopierte Typen erhalten eine zufällige ID nach der Regel aus `docs/architektur.md`. IDs bleiben projektweit eindeutig; die Ladeprüfung auf doppelte IDs umfasst den Katalog. `docs/architektur.md` wird um diese Ausnahme ergänzt.
- **Verweise ins Leere** öffnen das Projekt wie in M1 und erzeugen Warnungen mit Aktion „Löschen“: Gerät mit unbekannter `typeId` oder unbekannter Fläche, Möbel mit unbekannter `typeId`.

### Katalog
`Catalog`, `DeviceType`, `LineType` und `FurnitureType` wie in `docs/architektur.md`. Zusätzlich gilt:
- **Montagearten und Flächen:** `wall` → Wandseiten; `ceiling` → Decken und Schrägen; `floor` → Böden; `free` → freie Platzierung im Geschoss; `din-rail` → Verteiler (ab M4). Ein Typ ohne platzierbare Montageart erscheint in M2 nicht in der Geräteauswahl.
- **Bearbeiten:** Ein Katalogfenster listet Geräte-, Leitungs- und Möbeltypen getrennt, Gerätetypen gruppiert nach Gewerk. Anlegen, Kopieren („<Name> Kopie“, neue ID), Ändern und Löschen sind Befehle mit Undo. Löschen wird abgelehnt, solange Geräte bzw. Möbel den Typ verwenden: „Typ wird von <n> Geräten verwendet“ bzw. „… Möbeln“. Leitungstypen sind in M2 nie in Verwendung.
- **Änderungen am Typ** wirken sofort auf alle Geräte dieses Typs (Symbol, Form, Gewerk). Die Standardhöhe wirkt nur beim Setzen neuer Geräte; bestehende Geräte behalten ihre Höhe. Eine Montageart, auf der noch Geräte dieses Typs sitzen, kann nicht entfernt werden: „Montageart <Art> wird von <n> Geräten verwendet“.
- **Formularfelder:** alle Felder des Typs; `knx.consumes` als Auswahl, `knx.provides` als Funktion und Kanalzahl, `light` und `refrigerant` als Zahlenfelder. Pflichtfelder: Name, Gewerk, mindestens eine Montageart, `shape3d` mit positiven Maßen.

### Standardkatalog
Der Standardkatalog liegt als Daten in `src/model/default-catalog.ts` (nicht als YAML-Datei, damit er typgeprüft ist) und wird beim Anlegen bzw. bei der Migration ins Projekt kopiert. Er enthält mindestens die in der Spec genannten Geräte- und Leitungstypen und als Grundmöbel: Bett 1600 × 2000, Bett 900 × 2000, Kleiderschrank 2000 × 600 × 2200, Kommode, Schreibtisch, Esstisch, Sofa, Küchenunterschrank 600 × 600 × 900, Küchenhängeschrank 600 × 350 × 700 auf 1450 mm, Hochschrank, Waschtisch, Badewanne, Duschwanne, WC.

Standardhöhen über OKFF (DIN 18015-3 und übliche Praxis): Steckdose, Doppelsteckdose und Netzwerkdose 300 mm, Schalter und KNX-Taster 1050 mm, Wandauslass 2000 mm, Klima-Innengerät 2100 mm, Rollladenmotor ohne Standardhöhe (wird an der Öffnung gesetzt). Unterputz-Dosentiefe 60 mm für Dosen, Schalter und Taster. Die vollständige Tabelle (ID, Name, Gewerk, Montage, Höhe, Form, Symbol) steht im Code und wird mit einem Unit-Test gegen die Liste der Spec geprüft.

### Symbole
- Ein Symbol ist ein SVG-Fragment (Kindelemente ohne äußeres `<svg>`) im Koordinatensystem `viewBox="0 0 100 100"`, y nach unten. `docs/architektur.md` spricht von „0..1 normiert“; das wird auf 0..100 geändert, weil Strichstärken und Text in ganzen Zahlen lesbarer sind.
- **Erlaubte Elemente:** `path`, `line`, `polyline`, `polygon`, `circle`, `ellipse`, `rect`, `text`, `g`. **Erlaubte Attribute:** Geometrie, `fill`, `stroke`, `stroke-width`, `transform`, `font-size`, `text-anchor`. Alles andere (Skripte, Ereignis-Attribute, `href`, `style`, externe Verweise) wird beim Import entfernt. Gerendert wird über React-Elemente aus dem geparsten, bereinigten Baum, nie über `innerHTML`.
- **Import eines eigenen Symbols:** SVG-Datei wählen; die App übernimmt die Kindelemente, rechnet die `viewBox` der Datei auf 0..100 um (Seitenverhältnis bleibt, zentriert) und speichert das Ergebnis bereinigt in einer Zeile. Ein Symbol, das nach dem Bereinigen leer ist, wird abgelehnt.
- `currentColor` als Farbe ist erlaubt; die Ansicht setzt dafür die Status- bzw. Warnfarbe.

### Geräte platzieren
- **Werkzeug „Gerät“** in Grundriss und Flächenansicht: Typ in einer Auswahl (nach Gewerk gruppiert, mit Suche) wählen, dann klicken. Jeder Klick setzt ein Gerät; Esc beendet. Neue Geräte: Status `planned`, `label` = Typname, `rotationDeg` 0.
- **Flächenansicht:** Die Fläche der Ansicht muss zur Montageart passen, sonst Meldung „<Typ> ist nur für <Montagearten> zulässig“ und nichts wird gesetzt. Wandseite: u an der Klickposition, v = Standardhöhe des Typs (ohne Standardhöhe: Klickhöhe). Decke, Boden, Schräge: (u, v) an der Klickposition.
- **Grundriss:** Liegt der Klick höchstens 300 mm vor einer fertigen Wandoberfläche (oder innerhalb des Wandkörpers) und erlaubt der Typ `wall`, wird das Gerät auf die Wandseite gesetzt, auf deren Seite der Klick liegt: u = Projektion des Klickpunkts, v = Standardhöhe (ohne Standardhöhe: 1000 mm). Sonst, innerhalb eines Raums: `ceiling`, wenn erlaubt (bei Schrägen auf die Schräge, deren Fläche über dem Punkt am tiefsten liegt, sonst auf die Decke), sonst `floor`. Außerhalb aller Räume oder wenn nur `free` erlaubt ist: freie Platzierung mit z = 0. Passt nichts, erscheint dieselbe Meldung wie oben.
- **Verschieben:** Ziehen in der Flächenansicht (ein Befehl beim Loslassen, bleibt auf der Fläche); Ziehen im Grundriss nur für freie Geräte und für die u-Richtung von Wandgeräten. Wechsel auf eine andere Fläche über Ausschneiden und Einfügen ist nicht vorgesehen; stattdessen löschen und neu setzen.
- **Löschen** ist ein Befehl. Löschen einer Wand löscht ihre Wandgeräte mit (wie Öffnungen), Löschen eines Raums die Geräte auf seiner Decke, seinem Boden und seinen Schrägen, Löschen eines Geschosses alle Geräte und Möbel darin. Die Bestätigung nennt die Anzahl mitgelöschter Geräte.

### Bezug und Bemaßung
- **Wandseite:** u wie in M1 ab dem linken Achsendpunkt; v über OKFF des Raums, in dessen u-Abschnitt das Gerät liegt, ohne Raum über Rohfußboden. Rohbauhöhe = v + Fußbodenaufbau dieses Raums.
- **Anzeige in den Eigenschaften:** Abstand zur Bezugskante, Höhe über OKFF, Rohbauhöhe (nur Anzeige), Status, Bezeichnung, Typ. Bezugskanten zur Wahl: linke Raumecke (Standard), rechte Raumecke, linke oder rechte fertige Laibung einer Öffnung derselben Wandseite. Gemessen wird von der fertigen Kante (Raumecke bzw. Laibung, jeweils um den Putz versetzt) bis zur Gerätemitte. Die gewählte Bezugskante ist Ansichtszustand und wird nicht gespeichert. Auf Wandseiten ohne Raum gibt es nur „Wandanfang links“ (u selbst).
- **Decke, Boden, Schräge:** Abstand zur nächsten fertigen Wandoberfläche in beiden Richtungen; editierbar sind u und v bzw. die beiden Abstände.
- **Freie Geräte:** x, y, z editierbar, z über Rohfußboden des Geschosses.
- Eingaben wie in M1 (mm, „m“-Eingabe, Rundung auf ganze mm).

### Höhenbezug bei geänderter Raumzuordnung
Offener Punkt aus M1: Bekommt ein Wandabschnitt einen anderen Raum (Raum angelegt, gelöscht, neu erkannt, Kontur durch Wandänderung verschoben), würde ein bereits gesetztes Gerät um die Differenz der Fußbodenaufbauten springen. Entscheidung: Der Befehl, der die Raumzuordnung ändert, passt im selben Befehl `v` aller betroffenen Wandgeräte so an, dass ihre **Rohbauhöhe gleich bleibt** (v_neu = v_alt + Aufbau_alt − Aufbau_neu, ohne Raum gilt Aufbau 0). Ändert sich dagegen nur der Fußbodenaufbau eines Raums, bleibt v (Höhe über OKFF) unverändert, und die Rohbauhöhe ändert sich. So bleibt ein Gerät physisch an seinem Platz, wenn sich nur die Zuordnung ändert, und behält seine Höhe über OKFF, wenn der Estrich anders wird. Umgesetzt als reine Funktion `rebaseDeviceHeights(before, after)` in `geometry/`, aufgerufen in allen Befehlen, die Räume neu berechnen.

### Gerätekombinationen
„Waagerecht kombinieren“ und „senkrecht kombinieren“ wirken auf mindestens zwei ausgewählte Geräte derselben Fläche (sonst Meldung „Kombinieren nur auf einer Fläche“). Abstand in einem Dialog, Standard 71 mm. Waagerecht: Reihenfolge nach u, alle erhalten das v des ersten Geräts dieser Reihenfolge, u = u_1 + i · Abstand. Senkrecht: Reihenfolge nach v absteigend, alle erhalten das u des obersten, v = v_1 − i · Abstand. Ein Befehl. Mehrfachauswahl mit Shift-Klick in Grundriss und Flächenansicht.

### Darstellung
- **Flächenansicht:** Symbol in einem Rechteck der Frontmaße (`shape3d.widthMm` × `heightMm`) um (u, v), gedreht um `rotationDeg`. Maßstabsgetreu, damit 71-mm-Kombinationen und Abstände sichtbar stimmen.
- **Grundriss:** Wandgeräte als Symbol der Größe 250 mm, mittig auf der fertigen Wandoberfläche, nach innen versetzt; Deckengeräte und Schrägengeräte als Symbol an (x, y) mit gestricheltem Rahmen; Bodengeräte und freie Geräte als Symbol mit durchgezogenem Rahmen. Nur Geräte des aktiven Geschosses.
- **3D:** `shape3d` als Quader oder Zylinder, Rückseite auf der fertigen Oberfläche, Tiefe in den Raum; freie Geräte mit Unterseite auf z.
- **Status:** `planned` mit Umriss in Grau, `installed` gefüllt in Blau, `verified` gefüllt in Grün mit Haken. In 3D dieselben Farben.
- **Warnung am Element:** Geräte und Möbel mit offener Warnung erhalten in allen Ansichten einen roten Rand (3D: rote Kante bzw. rote Farbe), übergangene nicht.

### Möbel
- **Lage:** (x, y) ist die Mitte der Grundfläche; `rotationDeg` gegen den Uhrzeigersinn. Im lokalen System liegt die Breite entlang x, die Tiefe entlang y; die **Rückseite** ist die Kante bei lokal +y·Tiefe/2. Höhe über OKFF `elevationMm` bezieht sich auf den Raum, in dem die Mitte liegt (außerhalb aller Räume: Rohfußboden).
- **Setzen:** Werkzeug „Möbel“ im Grundriss, Typ wählen, klicken; Maße aus dem Typ, danach je Möbel editierbar. Möbel stehen in der Geschossdatei.
- **Einrasten:** Beim Setzen und Ziehen rastet ein Möbel ein, wenn seine Rückseite höchstens 200 mm von einer fertigen Wandoberfläche entfernt ist und höchstens 15° von deren Richtung abweicht: Drehung parallel zur Wand, Rückseite bündig auf der fertigen Oberfläche (Rohbaufläche + Putz des Raums auf dieser Seite). Shift beim Ziehen schaltet das Einrasten ab.
- **Silhouette:** Ein Möbel grenzt an eine Wandseite, wenn seine Grundfläche höchstens 100 mm vor der fertigen Oberfläche beginnt und sich mit dem Raumabschnitt in u überlappt. In der Wandansicht erscheint seine Projektion (u-Bereich × elevation bis elevation + Höhe) halbtransparent vor der Wand.
- **Kollision** `device-covered:<deviceId>`: ein Wandgerät, dessen Frontrechteck sich in u und v mit der Silhouette eines Möbels überlappt, das an diese Wandseite grenzt (also höchstens 100 mm vor der Oberfläche beginnt). Text „Gerät durch Möbel verdeckt: <Gerät> (<Möbeltyp>)“. Eine Dose 150 mm über der Arbeitsplatte überlappt in v nicht und erzeugt keine Warnung.
- Möbel sind auswählbar, verschiebbar, drehbar (numerisch und um 90° per Taste R), löschbar; alles Befehle.

### Installationszonen
- **Zonen je Raumansicht einer Wandseite** (nicht in der Ansicht der ganzen Wandseite ohne Raum), aus `settings.installZones`, alle Werte in mm:
  - obere waagerechte Zone: `horizontalTop` = [a, b] unter der fertigen Decke; folgt der fertigen Deckenkontur einschließlich Schrägen (Band zwischen Kontur − a und Kontur − b),
  - untere waagerechte Zone: `horizontalBottom` = [a, b] über OKFF,
  - senkrechte Zonen: `verticalFromEdge` = [a, b] neben den fertigen Raumecken des Abschnitts und neben beiden fertigen Laibungen jeder Tür und jedes Fensters, jeweils über die ganze Höhe zwischen OKFF und fertiger Decke; an Öffnungen auf beiden Seiten der Laibung außerhalb der Öffnung.
- **Ein- und Ausblenden** über einen Schalter in der Werkzeugleiste der Flächenansicht; Ansichtszustand, nicht gespeichert, gilt für alle Wandansichten.
- **Einstellungen:** Die drei Bereiche sind in den Projekteinstellungen editierbar (Befehl mit Undo). Prüfung: 0 ≤ a < b.
- **Zuführung** (Schalter „Zuführungen zeigen“): Für jedes Wandgerät, dessen Mitte in keiner waagerechten Zone liegt, zeigt die Ansicht eine senkrechte Linie von der Gerätemitte zur Zone, aus der es zugeführt wird: zur unteren Zone, wenn die Gerätemitte unterhalb deren Unterkante liegt, sonst zur oberen Zone (DIN 18015-3: Schalter und höher liegende Geräte von oben). Liegt die Linie vollständig in einer senkrechten Zone, ist sie grau gestrichelt, sonst orange („Zuführung außerhalb der Zonen“). Das ist eine Darstellung, keine Warnung; eine Zonenwarnung ist in M2 nicht vorgesehen.

### Rohbauhöhe je Raum
Befund 9.4.4 aus M1 (Anbau 2460 mm, Bestand 2405 mm im selben Geschoss), entschieden am 2026-11-21: `room.rawHeightMm?` überschreibt `storey.rawHeightMm` für diesen Raum. In der Deckenhöhenfunktion aus M1 tritt sie an die Stelle der Rohbauhöhe des Geschosses (Rohdecke H(p) = min(Rohbauhöhe des Raums − Abhängung, alle Schrägen)); damit folgen fertige Decke, obere Installationszone, Deckengeräte, Wandansichten und die 3D-Decke. Wände behalten ihre eigene Höhe (`wall.rawHeightMm` oder Geschoss) und werden nicht automatisch angepasst; im Anbau setzt der Benutzer die Wandhöhe bei Bedarf selbst. Die Raumeigenschaften zeigen das Feld mit dem Geschosswert als Platzhalter; leer = Geschosswert. Fehlt das Feld in der Datei, gilt wie bisher die Geschosshöhe; eine Migration ist dafür nicht nötig, weil es mit Version 2 eingeführt wird.

### Warnungen
Alle Warnungen werden wie in M1 berechnet und tragen den stabilen Schlüssel `<regel>:<objektId>`. Neu in M2:

| Schlüssel | Text | Klick in der Warnungsliste | übergehbar |
|---|---|---|---|
| `device-off-surface:<deviceId>` | „Gerät außerhalb der Fläche: <Gerät>“ | wählt das Gerät, öffnet die Ansicht seiner Fläche (Wandseite: Raumansicht des Abschnitts, sonst ganze Wandseite) | ja |
| `device-covered:<deviceId>` | „Gerät durch Möbel verdeckt: <Gerät> (<Möbeltyp>)“ | wie oben | ja |
| `device-without-surface:<deviceId>` | „Gerät ohne Fläche (<SurfaceRef>)“ | nur Eintrag mit Aktion „Löschen“ | nein |
| `device-without-type:<deviceId>` | „Gerät mit unbekanntem Typ (<typeId>)“ | nur Eintrag mit Aktion „Löschen“ | nein |
| `furniture-without-type:<furnitureId>` | „Möbel mit unbekanntem Typ (<typeId>)“ | nur Eintrag mit Aktion „Löschen“ | nein |

„Außerhalb der Fläche“ heißt: Die Gerätemitte liegt außerhalb der Kontur der Fläche (Wandseite: ganze Wandseite in Rohbaumaßen, verglichen mit der Rohbauhöhe des Geräts v + Fußbodenaufbau; Decke, Boden, Schräge: Kontur der Fläche).

- **Übergehen:** Jede übergehbare Warnung (alle M1-Warnungen außer `opening-without-wall` und die oben als nicht übergehbar markierten) hat in der Liste die Aktion „Übergehen“. Übergangene Warnungen zählen nicht zur Anzahl, stehen in einem eigenen aufklappbaren Abschnitt „übergangen (<n>)“ mit der Aktion „Wieder aktivieren“. Beides sind Befehle mit Undo; gespeichert wird in `warnungen.yaml`.
- **Bereinigen:** Am Ende jedes Befehls entfernt der Store alle übergangenen Schlüssel, zu denen keine Warnung mehr berechnet wird, im selben Befehl. Damit entfällt die Markierung, wenn das Element gelöscht oder der Verstoß behoben wurde; tritt der Verstoß später erneut auf, ist die Warnung wieder offen. Beim Laden wird nicht bereinigt (sonst würde Laden eine Änderung erzeugen).
- **Übersicht:** Die Warnungsleiste aus M1 wird zur Übersicht mit Spalten Regel (Text), Element und Ort (`<Geschoss> › <Raum> › <Ansicht>`); Sortierung nach Geschoss, dann Raum, dann Text.

### Auswahl
Geräte und Möbel sind wie die M1-Objekte auswählbar; die Auswahl gilt in Grundriss, Flächenansichten, 3D und Baum gleichzeitig. Mehrfachauswahl gibt es nur für Geräte derselben Fläche (Shift-Klick in Grundriss und Flächenansicht); sie dient dem Kombinieren und gemeinsamen Löschen. Der Baum zeigt in M2 keine Geräte und Möbel.

### Gewerkfilter
Schalter je Gewerk (Strom, KNX, Daten, Leerrohr, Kältemittel, Kondensat, Sonstiges) und für Möbel in der Kopfzeile des Editorbereichs. Ansichtszustand im View-Store, nicht gespeichert, beim Start alles sichtbar. Ein Gerät ist sichtbar, wenn das Gewerk seines Typs sichtbar ist. Der Filter gilt gleichzeitig in Grundriss, allen Flächenansichten und 3D; das Gebäude bleibt immer sichtbar. Ausgeblendete Elemente sind nicht anklickbar; eine bestehende Auswahl eines ausgeblendeten Elements wird aufgehoben. Warnungen ausgeblendeter Elemente bleiben in der Übersicht.

### Store und Befehle
Neue Befehle (deutsche Labels): „Gerät setzen“, „Gerät verschieben“, „Gerät ändern“, „Gerät löschen“, „Geräte kombinieren“, „Möbel setzen“, „Möbel verschieben“, „Möbel ändern“, „Möbel löschen“, „Typ anlegen“, „Typ kopieren“, „Typ ändern“, „Typ löschen“, „Installationszonen ändern“, „Warnung übergehen“, „Warnung wieder aktivieren“. Abhängige Änderungen im selben Befehl: mitgelöschte Geräte, Höhenanpassung bei geänderter Raumzuordnung, Bereinigen übergangener Warnungen.

### Module
Neue reine Module: `geometry/devices.ts` (Fläche → Welt für Geräte, Grundriss-Platzierung, `rebaseDeviceHeights`), `geometry/zones.ts` (Zonen und Zuführung je Raumansicht), `geometry/furniture.ts` (Grundfläche, Einrasten, Silhouette), `rules/devices.ts` (Gerät außerhalb, ohne Fläche, ohne Typ), `rules/furniture.ts` (Kollision), `model/default-catalog.ts`, `model/symbol.ts` (Bereinigen, Umrechnen, Parsen). UI unter `ui/catalog/`, Erweiterungen in `ui/plan/`, `ui/surface/`, `ui/three/`, `ui/WarningBar.tsx`.

### Tests und Fixtures
- Neue Fixture `tests/fixtures/m2/`: Projekt mit Katalog, Geräten auf allen Flächenarten, Möbeln und einer übergangenen Warnung; Golden-File-Test für alle vier Dateien.
- Migrations-Test mit der M1-Fixture `klein`: lädt, migriert auf 2, schreibt erst beim ersten Befehl, `katalog.yaml` entsteht mit dem Standardkatalog, Geschossdateien bleiben byteweise gleich.
- Unit-Tests für Zonen (Fenster, Schräge, geänderte Einstellungen), Zuführung, Einrasten, Silhouette, Kollision (Schrank, Arbeitsplatte), Höhenbezug (Raum anlegen, löschen, Aufbau ändern), Kombinationen, Symbolbereinigung (Skript, `onload`, `href` entfernt).
- Playwright: Steckdose in der Wandansicht setzen, Schalter im Grundriss auf der Flurseite, Deckenauslass erscheint in Deckenspiegel, Grundriss und 3D, Katalog kopieren und neuen Typ setzen, Warnung übergehen und nach Löschen bereinigt, Gewerkfilter „nur KNX“.

## Risks / Trade-offs

- [Feste lesbare IDs im Standardkatalog weichen von der ID-Regel ab] → nur für Standardtypen; Eindeutigkeit wird weiter beim Laden geprüft; Diffs werden lesbarer
- [Bereinigen übergangener Warnungen nach jedem Befehl kostet Rechenzeit] → Warnungen werden ohnehin nach jedem Befehl für die Leiste berechnet; dasselbe Ergebnis wird verwendet
- [Höhenanpassung bei geänderter Raumzuordnung verändert Geräte, die der Benutzer nicht angefasst hat] → physisch bleibt das Gerät am Platz; Undo nimmt alles zurück; Unit-Tests für alle auslösenden Befehle
- [Geräte wandern beim Verlängern einer Wand am linken Ende mit, weil u ab dem linken Achsendpunkt zählt] → wie in der Architektur festgelegt; „Gerät außerhalb der Fläche“ fängt den Fall ab, dass eine Kürzung Geräte von der Fläche schiebt
- [Eigene SVG-Symbole als Einfallstor für Skripte] → strikte Positivliste, Rendern nur über React-Elemente, Unit-Tests für bösartige Eingaben
- [Fassadengeräte sitzen ohne Dämmschicht 16 cm zu weit innen] → bekannt aus m1 9.4.1, Lösung in M6

## Entschieden am 2026-11-21

- Rohbauhöhe je Raum (m1 9.4.4): in M2, siehe „Rohbauhöhe je Raum“.
- Gedachte Raumgrenze (m1 9.4.3): nicht in M2. Wohnen und Küche/Essen bleiben in banatstrasse10 ein Raum; der Befund bleibt offen für einen späteren Change.
- Dämmschicht (m1 9.4.1): bleibt in M6.
- Höhenbezug bei geänderter Raumzuordnung: Rohbauhöhe bleibt; bei geändertem Estrich bleibt die Höhe über OKFF.
- Übergangene Warnungen werden bereinigt, sobald die Warnung nicht mehr auftritt (Löschen oder Behebung).

## Open Questions

- Keine.
