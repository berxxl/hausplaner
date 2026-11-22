# Design

## Context

M1 bis M3 sind archiviert (`openspec/changes/archive/2026-11-21-m1-gebaeudemodell/`, `…/2026-11-22-m2-geraete-und-moebel/`, `…/2026-11-22-m3-trassen-und-leitungen/`). Es gibt Geräte auf Flächen (Wand, Decke, Boden, Schräge) und frei im Raum, ein Trassennetz mit Gerätknoten, Leitungen zwischen zwei Geräten mit Wegvorschlag und Längen, Warnungen mit Übergehen und den zentralen Nachbearbeitungsschritt `normalizeAfterCommand`. Der Katalog kennt Reiheneinbaugeräte (`mounting: din-rail`, `teWidth`) und KNX-Funktionen (`knx.consumes`, `knx.provides`). In `docs/architektur.md` sind `Board`, `Circuit`, `KnxAssignment`, `knxLines` und die Platzierungsart `board` vorgezeichnet. Dieses Dokument legt fest, was M4 darüber hinaus braucht, damit beim Umsetzen keine eigenen Designentscheidungen nötig sind.

## Goals / Non-Goals

**Goals:**
- Verteiler (Zählerschrank, Unterverteilung, Medienverteiler) auf Wandseiten, mit Feldern, Reihen und TE-Belegung
- Belegungsansicht mit Einsetzen und Umsetzen von Reiheneinbaugeräten, Reserveprüfung mit vorgemerktem Bedarf
- Verteilerhierarchie mit Zuleitung als Leitung
- Verteiler als Endpunkte von Trassen und Leitungen, Verteilerzuschlag, mehrere Leitungen zu einem Verteiler in einem Schritt (aus M3 verschoben)
- Stromkreise mit Schutzgerät und Standard-Leitungstyp, Zuordnung von Geräten, Beschriftung und Hervorheben
- KNX: Kanalbedarf je Verteiler, Aktorvorschlag, Übernehmen, Kanalzuordnung von Hand und automatisch, Linien mit Teilnehmerzahl

**Non-Goals:**
- Stromkreisliste, Verteilerplan und Beschriftungsstreifen als PDF (M5)
- Normative Berechnungen (Spannungsfall, Selektivität, Auslösecharakteristik), Leistungsbilanz
- KNX-Gruppenadressen, physikalische Adressen, ETS-Export
- Verteiler auf Decke, Boden oder Schräge, frei stehende Verteiler
- Grafische Darstellung der Verdrahtung im Verteiler (Klemmen, Kammschienen)
- Prüfung, ob ein Unterputzverteiler tiefer als die Wand ist

## Decisions

### Schemaversion 4 und Migration
M4 erhöht `schemaVersion` auf 4. Grund wie in M2/M3: Eine M3-App würde `verteiler.yaml` zwar ignorieren, aber `circuitId` an Geräten und `boardId` an Knoten und Endpunkten als unbekannte Felder ablehnen. Mit Version 4 meldet sie stattdessen „Projekt wurde mit neuerer App-Version erstellt“.

Die Migration `3 → 4` setzt `settings.teReservePercent` = 25, `settings.actuatorReservePercent` = 20 und `settings.lengthAllowance.perBoardMm` = 1500. Sie ergänzt außerdem die neuen Standard-Geräte- und -Leitungstypen aus „Katalog“, deren ID im Projektkatalog noch fehlt. Wie bisher schreibt sie nichts von selbst; der Hinweis lautet „Projekt auf Version 4 aktualisiert, wird beim nächsten Speichern geschrieben“. Neue Projekte starten in Version 4.

### Dateiformat M4
Neu ist die Datei `verteiler.yaml` mit `boards`, `devices` (nur Reiheneinbaugeräte mit `placement.kind: board`), `circuits`, `knxLines` und `knxAssignments`. Sie wird nur geschrieben, wenn mindestens eine dieser Listen etwas enthält, sonst gelöscht (`null`), wie `leitungen.yaml`. Neu oder geändert gegenüber M3 (übrige Zeilen gelten unverändert):

| Objekt | Felder in Schreibreihenfolge (`?` = nur wenn gesetzt) | Listen sortiert nach | Flow-Stil |
|---|---|---|---|
| `settings` | `northDeg`, `installZones`, `lengthAllowance`, `teReservePercent`, `actuatorReservePercent` | – | – |
| `lengthAllowance` | `perDeviceMm`, `perBoardMm`, `wastePercent` | – | ja |
| Datei `verteiler.yaml` | `boards`, `devices`, `circuits`, `knxLines`, `knxAssignments` | `boards`, `devices`, `circuits`, `knxLines` nach `id`; `knxAssignments` nach `actuatorDeviceId`, dann `channel` | – |
| `board` | `id`, `label`, `kind`, `placement`, `mounting`, `widthMm`, `heightMm`, `depthMm`, `parentBoardId?`, `feedCableId?`, `fields` | `fields` in Benutzerreihenfolge (links nach rechts) | `placement` |
| `board.placement` | `surface`, `u`, `v` | – | ja |
| `field` | `id`, `kind`, `rows`, `tePerRow` | – | ja |
| `device` | `id`, `label`, `typeId`, `status`, `placement`, `circuitId?`, `knxLineId?` | – | `placement` |
| `placement` (board) | `kind`, `boardId`, `fieldId`, `row`, `slot` | – | ja |
| `circuit` | `id`, `label`, `boardId`, `protectionDeviceId?`, `lineTypeId?` | – | – |
| `knxLine` | `id`, `label`, `boardId?` | – | – |
| `knxAssignment` | `actuatorDeviceId`, `channel`, `consumerDeviceId` | – | ja |
| `routeNode` | `id`, `deviceId?`, `boardId?`, `anchors` | – | – |
| `endpoint` | `deviceId` oder `boardId` (genau eins) | – | ja |

Weitere Regeln:
- **Ablage:** `board.storeyId` ist das Geschoss der Wand von `placement.surface`, ein Reiheneinbaugerät hat das Geschoss seines Verteilers. Beides wird beim Laden gesetzt und nicht geschrieben. Geräte mit `placement.kind: board` stehen nur in `verteiler.yaml`, alle anderen weiter in den Geschossdateien.
- **Felder** sind die einzige Liste, die nicht nach ID sortiert wird: Ihre Reihenfolge ist die Anordnung im Verteiler von links nach rechts. Ein Feld ist eine Spalte, seine Reihen liegen von oben nach unten (Reihe 1 oben), die Plätze einer Reihe von links nach rechts (Platz 1 links).
- `row` und `slot` zählen ab 1. `rows` und `tePerRow` sind ganze Zahlen ≥ 0. Zählerfeld und Anschlussräume haben üblicherweise 0 Reihen.
- `channel` zählt ab 1. In der Oberfläche wird er als Buchstabe angezeigt (1 = A, 2 = B, …).
- `docs/architektur.md` wird angepasst: `Board.feedCableId`, `KnxLine.boardId`, Endpunkt mit `boardId`, `Cable.circuitId` entfällt (abgeleitet, siehe „Stromkreise“), Felder in Benutzerreihenfolge, `verteiler.yaml` wird nur mit Inhalt geschrieben.
- **Verweise ins Leere** öffnen das Projekt. Sie erzeugen nicht übergehbare Warnungen mit Aktion (siehe „Warnungen“): Verteiler auf unbekannter Fläche, Reiheneinbaugerät mit unbekanntem Verteiler oder Feld, Stromkreis mit unbekanntem Verteiler, Knoten mit unbekanntem Verteiler, Leitung mit unbekanntem Verteiler als Endpunkt. Optionale Verweise ins Leere (`circuitId`, `knxLineId`, `protectionDeviceId`, `feedCableId`, `parentBoardId`, `knxLine.boardId`, Zuordnungen mit unbekanntem Aktor oder Verbraucher) gelten als nicht gesetzt. Der nächste Befehl entfernt sie in `normalizeAfterCommand`, wie die Pfadbereinigung in M3.

### Katalog
Neue Standardtypen in M4 (die Migration ergänzt sie, siehe oben):

| ID | Name | Gewerk | Montage | TE | `connects` | KNX |
|---|---|---|---|---|---|---|
| `knx-switch-actuator-16` | Schaltaktor 16-fach | knx | din-rail | 8 | knx, power | provides switch 16 |
| `patch-panel` | Patchfeld 6-fach | data | din-rail | 6 | data | – |
| `network-switch` | Switch 8 Port | data | din-rail | 6 | data, power | – |
| `power-supply` | Netzteil | power | din-rail | 2 | power | – |

Dazu kommt der Leitungstyp `nym-j-5x10` „NYM-J 5×10“ (Strom, Außendurchmesser 17 mm, Farbe `#4e342e`) für Zuleitungen.

Ob ein Typ in einen Verteiler eingesetzt werden kann, bestimmt seine Montageart `din-rail`. Ausnahme Multimediafeld: Dort sind zusätzlich alle Typen des Gewerks Daten erlaubt (Router, Switch, Patchfeld). Die Breite eines Geräts ist `teWidth`, aufgerundet auf ganze TE. Fehlt `teWidth`, gilt `ceil(shape3d.widthMm / 18)`.

### Verteiler platzieren
- **Werkzeug „Verteiler“** in der Flächenansicht, nur auf Wandseiten (Raumansicht oder Wandseite ohne Raum). Ein Klick öffnet einen Dialog mit Art, Bezeichnung, Breite, Höhe, Tiefe und Montage, danach entsteht der Verteiler mit dem Befehl „Verteiler anlegen“. Der Klickpunkt ist die Mitte der Vorderseite, (u, v) wie bei Geräten (v über OKFF des Raums des Abschnitts, ohne Raum über Rohfußboden). Die Werte sind auf ganze mm gerundet, Winkelfang gibt es nicht.
- **Standardwerte je Art:**

  | Art | Bezeichnung | B × H × T | Montage | Felder |
  |---|---|---|---|---|
  | Zählerschrank `meter-cabinet` | „Zählerschrank“ | 800 × 1100 × 210 | Aufputz | Zählerfeld (0 Reihen), APZ-Feld (1 × 12), Verteilerfeld (4 × 12) |
  | Unterverteilung `sub-distribution` | „UV <Geschoss>“ | 550 × 1100 × 120 | Unterputz | Verteilerfeld (4 × 12) |
  | Medienverteiler `media` | „Medienverteiler“ | 550 × 650 × 120 | Unterputz | Multimediafeld (2 × 12) |

- **Bearbeiten:** Verteiler werden mit dem Auswahlwerkzeug auf ihrer Wandseite verschoben (Befehl „Verteiler verschieben“) und in den Verteilereigenschaften numerisch geändert (u, v, Maße, Montage, Art, Bezeichnung; Befehl „Verteiler ändern“). Die Felder werden in einer Tabelle bearbeitet: Art, Reihen und TE je Reihe ändern, Feld hinzufügen, löschen, nach links oder rechts verschieben (Befehl „Felder ändern“). Ein Feld mit Geräten kann nicht gelöscht werden („Feld enthält <n> Geräte“). Wenn Reihen oder TE so verkleinert werden, dass Geräte herausfallen, bleibt der Befehl erlaubt; die Geräte erhalten die Warnung `board-device-outside`.
- **Darstellung:** In der Flächenansicht ist der Verteiler ein Rechteck mit Bezeichnung, Unterputz gestrichelt umrandet. Im Grundriss ist er ein Rechteck Breite × Tiefe an der fertigen Wandoberfläche, bei Unterputz in die Wand hinein, bei Aufputz in den Raum. In 3D ist er ein Quader. Verteiler gehören zu keinem Gewerk und bleiben bei jedem Filter sichtbar, wie das Gebäude.
- **Strukturbaum:** Unter den Geschossen steht ein zweiter Baum „Verteiler“. Er zeigt die Verteiler nach Hierarchie (Kinder unter ihrem übergeordneten Verteiler, Geschwister nach Bezeichnung sortiert) und unter jedem Verteiler seine Stromkreise. Er lässt sich auf- und zuklappen wie der Geschossbaum (R.3 aus M3, gleicher Speicher). Ein Klick auf einen Verteiler wählt ihn aus, ein Klick auf einen Stromkreis wählt den Stromkreis.

### Belegungsansicht
- **Neuer Editor-Tab „Verteiler“** (`EditorKind` `board`). Er zeigt den zuletzt ausgewählten Verteiler (`view.boardId`); ohne Verteiler steht dort „Kein Verteiler gewählt“ mit der Liste aller Verteiler zum Anklicken. Die Verteilereigenschaften enthalten „Belegung öffnen“.
- **Aufbau:** Die Felder stehen als Spalten nebeneinander, jede mit Überschrift (Art) und ihren Reihen als Streifen aus `tePerRow` Plätzen, 1 TE = 18 mm im Maßstab der Ansicht. Reiheneinbaugeräte sind Kästen über ihre TE-Breite mit Bezeichnung und Typ, in der Statusfarbe. Felder ohne Reihen erscheinen als leere Fläche mit ihrer Art. Darunter steht die Zusammenfassung „<belegt> belegt · <vorgemerkt> vorgemerkt · <frei> frei von <gesamt> TE“.
- **Einsetzen:** Am Rand der Ansicht steht eine Palette der erlaubten Typen. Wenn der Benutzer einen Typ auf einen Platz zieht (Zeiger-Ereignisse, kein HTML5-Drag), ergibt die Zeigerposition Feld, Reihe und ersten Platz. Der Befehl „Gerät einsetzen“ legt das Gerät mit Bezeichnung = Typname an. Ein vorhandenes Gerät wird mit dem Befehl „Gerät umsetzen“ gezogen, auch in ein anderes Feld desselben Verteilers. Entf löscht ausgewählte Reiheneinbaugeräte. In den Geräteeigenschaften lassen sich Feld, Reihe und Platz numerisch ändern.
- **Prüfung beim Einsetzen und Umsetzen:** Das Gerät muss ganz in die Reihe passen (`slot + Breite − 1 ≤ tePerRow`) und darf kein anderes Gerät überlappen. Sonst lehnt der Befehl ab und die Ansicht zeigt „Kein Platz: In Reihe <r> sind ab Platz <s> nur <n> TE frei“. Der Typ muss in das Feld passen (siehe „Katalog“), sonst lautet die Meldung „<Typ> passt nicht in ein <Feldart>“.
- **Reserve:** gesamt = Summe `rows · tePerRow` aller Verteilerfelder (`distribution`) des Verteilers; belegt = Summe der Breiten der Geräte in diesen Feldern; vorgemerkt siehe „Bedarf vormerken“; frei = gesamt − belegt − vorgemerkt (kann negativ werden). Ist gesamt > 0 und frei / gesamt < `teReservePercent` / 100, entsteht die Warnung `board-reserve-low` („Reserve unter 25 %: <frei> von <gesamt> TE frei“). APZ-, Multimedia-, Zähler- und Anschlussfelder zählen nicht zur Reserve; die Ansicht zeigt ihre Belegung trotzdem.
- **Bedarf vormerken:** vorgemerkt = (Anzahl Stromkreise des Verteilers ohne `protectionDeviceId`) · Breite des Typs `mcb` (1 TE, wenn der Typ fehlt) + Summe der TE des Aktorvorschlags über alle Funktionen (siehe „KNX“; der Vorschlag deckt nur, was die schon eingesetzten Aktoren nicht abdecken). Spec-Beispiel: Aktorbedarf 16 TE, kein Aktor eingesetzt → 16 TE vorgemerkt.

### Verteilerhierarchie und Zuleitung
- In den Verteilereigenschaften: „Übergeordneter Verteiler“ (alle anderen Verteiler außer den eigenen Nachkommen; beim Zählerschrank nicht vorhanden) und „Zuleitung“ (Leitungstyp des Gewerks Strom). Der Befehl „Verteiler zuordnen“ setzt `parentBoardId` und legt die Zuleitung als Leitung von übergeordnetem zu diesem Verteiler an: Bezeichnung „Zuleitung <Bezeichnung>“, Status geplant, mit Wegvorschlag. Ihre ID steht in `feedCableId`. Bei einem Wechsel ändert derselbe Befehl `from`, Typ und Weg dieser Leitung. „Kein übergeordneter Verteiler“ löscht die Zuleitung.
- Die Zuleitung ist eine gewöhnliche Leitung (Liste, Länge, Status, Weg bearbeiten); löscht der Benutzer sie, entfernt `normalizeAfterCommand` `feedCableId`, `parentBoardId` bleibt.
- Warnung `board-without-parent` („Verteiler ohne Zuleitung: <Bezeichnung>“) für jeden Verteiler außer Zählerschränken ohne `parentBoardId`, aber nur, wenn das Projekt einen Zählerschrank hat. Übergehbar.

### Verteiler als Endpunkt von Trassen und Leitungen
- **Verteilerknoten** (`boardId` gesetzt): genau ein Anker auf der Wandseite des Verteilers, in der Mitte seiner Oberkante (u, v + heightMm/2). Je Verteiler gibt es höchstens einen Verteilerknoten; das Werkzeug „Trasse“ verwendet ihn wieder. Fang beim Zeichnen: Ein Klick ins Rechteck des Verteilers rastet auf den Verteilerknoten ein (Fangreihenfolge: Gerät, Verteiler, Knoten, Segment, Kante, Winkel). `normalizeAfterCommand` setzt den Anker nach jedem Befehl auf die aktuelle Lage. Löscht der Benutzer den Verteiler, wird sein Knoten zu einem gewöhnlichen Knoten.
- **Endpunkt** `{boardId}`: Das Werkzeug „Leitung“ akzeptiert Klicks auf Verteiler in Grundriss und Flächenansicht. Der Wegvorschlag läuft wie in M3 (Dijkstra) zum Verteilerknoten; ohne Verteilerknoten bleibt der Weg leer.
- **Typprüfung:** Verteiler schließen nach Art an: Zählerschrank und Unterverteilung `power`, `knx`, `conduit`, `other`; Medienverteiler `data`, `power`, `conduit`, `other`. Die Prüfung und die Meldung „Keine passende Leitung …“ gelten wie bei Geräten.
- **Länge:** (Summe der Segmentlängen + `perDeviceMm` je Geräteendpunkt + `perBoardMm` je Verteilerendpunkt) · (1 + `wastePercent`/100). Spec-Beispiel: (8,4 + 0,3 + 1,5) × 1,1 = 11,22 → 11,2 m. `perBoardMm` lässt sich in den Projekteinstellungen neben den anderen Zuschlägen einstellen.
- **Mehrere Leitungen gleichzeitig:** Sind mehrere Geräte ausgewählt, bieten die Eigenschaften „Leitungen zu Verteiler …“ an. Der Dialog fragt Verteiler, Leitungstyp und Status ab. Zur Wahl stehen nur Typen, die alle gewählten Geräte und der Verteiler anschließen; ist das keiner, kommt die Meldung „Keine gemeinsame passende Leitung“. Vorbelegt ist der Standard-Leitungstyp des Stromkreises, wenn alle Geräte im selben Stromkreis sind. Der Befehl „Leitungen anlegen“ legt je Gerät eine Leitung an: Bezeichnung „<Gerät> – <Verteiler>“, Wegvorschlag. Er überspringt Geräte, die schon eine Leitung dieses Typs zu diesem Verteiler haben, und meldet „<n> Leitungen angelegt, <m> übersprungen“.
- **Mehrfachauswahl über Flächen:** Damit „alle Rollladenmotoren im OG“ auswählbar sind, wählt Shift-Klick im Grundriss ab M4 Geräte auch über Flächen hinweg aus (in der Flächenansicht weiter nur auf der Fläche). Die Geräteeigenschaften bieten zusätzlich „Gleiche im Geschoss auswählen“ an: Das wählt alle Geräte desselben Typs im Geschoss des ersten gewählten Geräts. „Kombinieren“ ist nur aktiv, wenn alle gewählten Geräte auf derselben Fläche liegen.

### Stromkreise
- **Anlegen** in den Verteilereigenschaften, Abschnitt „Stromkreise“, mit „Stromkreis hinzufügen“. Der Dialog fragt Bezeichnung (Vorschlag „F<n>“, n = höchste Zahl hinter einem führenden „F“ unter den Stromkreisen des Projekts + 1), Schutzgerät (Reiheneinbaugeräte dieses Verteilers des Gewerks Strom ohne `knx.provides`, optional) und Standard-Leitungstyp (Typen des Gewerks Strom, optional) ab. Befehle „Stromkreis anlegen“, „Stromkreis ändern“, „Stromkreis löschen“ (löst die Geräte vom Stromkreis; Bestätigung nennt die Anzahl).
- **Kurzname:** der Text der Bezeichnung bis zum ersten Leerzeichen („F12“ aus „F12 Küche Steckdosen“).
- **Geräte zuordnen:** In den Geräteeigenschaften gibt es das Feld „Stromkreis“ (Liste aller Stromkreise als „<Bezeichnung> (<Verteiler>)“ und „keiner“), auch bei Mehrfachauswahl (Befehl „Stromkreis zuweisen“, ein Undo-Schritt). Das Feld gibt es nur für Geräte des Gewerks Strom, die nicht in einem Verteiler stehen. Bei gemischter Mehrfachauswahl gilt die Zuweisung nur für diese Geräte, die Eigenschaften nennen die Anzahl.
- **Leitungen eines Stromkreises** sind abgeleitet und werden nicht gespeichert: Eine Leitung des Gewerks Strom gehört zu Stromkreis C, wenn beide Endpunkte Geräte von C sind oder ein Endpunkt ein Gerät von C und der andere der Verteiler von C ist. Die Leitungseigenschaften zeigen „Stromkreis: <Bezeichnung>“. Damit gilt das Spec-Szenario „Mehrfachzuordnung“ ohne eigenen Befehl für die Leitungen.
- **Speisender Verteiler eines Geräts** (abgeleitet): Breitensuche über Leitungen des Gewerks Strom, von Gerät zu Gerät, bis zu Verteilern. Durch Verteiler hindurch geht die Suche nicht. Gefunden werden kann kein, ein oder mehrere Verteiler.
- **Warnungen:** `device-without-circuit` („Kein Stromkreis: <Bezeichnung>“) für jedes Gerät des Gewerks Strom, das nicht in einem Verteiler steht und keinen Stromkreis hat. `circuit-board-mismatch` („<Kurzname> liegt in <Verteiler>, Leitung führt zu <anderer Verteiler>“) für ein Gerät mit Stromkreis, dessen speisender Verteiler ein anderer als der des Stromkreises ist. Beide sind übergehbar; ein Klick wählt das Gerät.
- **Beschriftung:** Geräte mit Stromkreis tragen in Grundriss und Flächenansicht den Kurznamen klein unter dem Symbol (Schriftgröße 9 px, unabhängig vom Zoom).
- **Hervorheben:** Neue Auswahlart `circuit`. Ist ein Stromkreis ausgewählt, sind seine Geräte und Leitungen in allen Ansichten in Orange hervorgehoben wie eine ausgewählte Leitung, sein Schutzgerät in der Belegungsansicht ebenso. Der Baum markiert den Verteiler.

### KNX
- **Verbraucher** sind Geräte, deren Typ `knx.consumes` hat und die nicht in einem Verteiler stehen. **Aktoren** sind Reiheneinbaugeräte, deren Typ `knx.provides` hat.
- **Verteiler eines Verbrauchers:** der speisende Verteiler (siehe „Stromkreise“), wenn es genau einen gibt; sonst der Verteiler seines Stromkreises; sonst keiner.
- **Kanalbedarf** je Verteiler und Funktion: Anzahl der Verbraucher dieses Verteilers mit dieser Funktion. Die Verteilereigenschaften zeigen eine Tabelle „KNX“: Funktion, Bedarf, mit Reserve, vorhandene Kanäle, Vorschlag, TE. Nur Funktionen mit Bedarf oder vorhandenen Kanälen erscheinen.
- **Aktorvorschlag** je Funktion f: benötigt = ⌈Bedarf · (1 + `actuatorReservePercent`/100)⌉; fehlend = max(0, benötigt − Kanäle der eingesetzten Aktoren von f in diesem Verteiler). Gesucht ist eine Mehrfachmenge von Aktortypen des Katalogs mit `provides.function` = f und Kanalsumme ≥ fehlend. Sie soll möglichst wenig TE haben, bei Gleichstand möglichst wenig Geräte, bei weiterem Gleichstand gewinnt die lexikografisch kleinste sortierte Folge der Typ-IDs. Gelöst wird das als ganzzahliges Rucksackproblem über die Kanalzahl, bis fehlend + größte Kanalzahl. Gibt es für f keinen Aktortyp, heißt es „Kein Aktor im Katalog“. Spec-Beispiel: 10 · 1,2 = 12, Typen 8-fach (4 TE) und 16-fach (8 TE). 2 × 8-fach und 1 × 16-fach haben beide 8 TE, der 16-fach gewinnt mit weniger Geräten.
- **Vorschlag übernehmen** (Befehl „Aktorvorschlag übernehmen“, für alle Funktionen des Verteilers zugleich): setzt die vorgeschlagenen Aktoren an freie Plätze. Gesucht wird in den Verteilerfeldern in Feldreihenfolge, Reihen von oben, Plätze von links, jeweils der erste zusammenhängende freie Bereich; die Aktoren der Reihe nach in der Folge des Vorschlags (Funktion in der Reihenfolge switch, dim, blind, heating, binary-input). Bezeichnung: Kürzel je Funktion (SA, DA, JA, HA, BE) mit der nächsten freien Nummer im Verteiler, z. B. „JA2“. Reicht der Platz nicht, lehnt der Befehl ganz ab: „Nicht genug Platz: es fehlen <n> TE“.
- **Kanäle zuordnen:** `knxAssignments` mit `actuatorDeviceId`, `channel`, `consumerDeviceId`. Anzeige „<Aktor>.<Buchstabe> → <Verbraucher>“, z. B. „JA2.C → Rollladen Bad“. In den Eigenschaften eines Verbrauchers steht das Feld „KNX-Kanal“ (freie Kanäle passender Funktion in Aktoren seines Verteilers, dazu der eigene Kanal und „keiner“). Bei einem Aktor steht die Kanalliste mit allen Kanälen, belegt oder frei. Befehl „Kanal zuordnen“; ein Verbraucher hat höchstens einen Kanal, eine neue Zuordnung ersetzt die alte. Ein belegter Kanal wird nicht angeboten.
- **Automatisch zuordnen** (Verteilereigenschaften, Befehl „Kanäle automatisch zuordnen“): Verbraucher dieses Verteilers ohne Kanal, sortiert nach Raumname (Raum der Fläche bzw. bei freien Geräten des Grundrisspunkts; ohne Raum zuletzt), dann Bezeichnung, dann ID. Sie erhalten der Reihe nach freie Kanäle passender Funktion: Aktoren sortiert nach Bezeichnung (natürliche Sortierung, „JA2“ vor „JA10“), dann ID, Kanäle aufsteigend. Bleiben Verbraucher übrig, gilt für sie die Warnung unten.
- **Warnungen:** `knx-without-channel` („Kein KNX-Kanal: <Bezeichnung>“) für jeden Verbraucher ohne Zuordnung. `knx-channel-mismatch` („KNX-Kanal passt nicht: <Bezeichnung>“) gilt, wenn der Aktor eine andere Funktion hat, in einem anderen Verteiler steht als der Verteiler des Verbrauchers oder der Kanal über `provides.channels` liegt. Beide sind übergehbar; ein Klick wählt den Verbraucher.
- **Linien:** `knxLines` mit `label` (z. B. „1.1“) und optional `boardId` (Verteiler, in dem die Linie beginnt). Sie werden in den Projekteinstellungen im Abschnitt „KNX-Linien“ verwaltet (hinzufügen, umbenennen, Verteiler wählen, löschen; Befehle „KNX-Linie anlegen/ändern/löschen“). Beim Löschen werden die Geräte von der Linie gelöst. **Busteilnehmer** sind Geräte, deren Typ das Gewerk `knx` hat oder `knx` anschließt. Ihre Eigenschaften haben das Feld „KNX-Linie“, auch bei Mehrfachauswahl (Befehl „KNX-Linie zuweisen“). „Teilnehmer über Busleitungen zuordnen“ an einer Linie mit Verteiler gibt allen Busteilnehmern ohne Linie die Linie, die vom Verteiler aus über Leitungen des Gewerks `knx` erreichbar sind. Zu diesen Teilnehmern gehören die Reiheneinbau-Busteilnehmer im Verteiler; durch weitere Verteiler geht die Suche nicht. Die Liste zeigt je Linie „<n> Teilnehmer“ (Geräte mit dieser `knxLineId`).
- **Medienverteiler:** Die Eigenschaften eines Medienverteilers zeigen „Patchfeldports benötigt: <n>“, n = Anzahl der Leitungen des Gewerks Daten mit diesem Verteiler als Endpunkt.

### Warnungen
Neu in M4:

| Schlüssel | Text | Klick in der Warnungsliste | übergehbar |
|---|---|---|---|
| `board-reserve-low:<boardId>` | „Reserve unter <p> %: <frei> von <gesamt> TE frei“ | wählt den Verteiler, öffnet die Belegung | ja |
| `board-without-parent:<boardId>` | „Verteiler ohne Zuleitung: <Bezeichnung>“ | wählt den Verteiler | ja |
| `board-device-outside:<deviceId>` | „Reiheneinbaugerät außerhalb der Reihe: <Bezeichnung>“ | wählt das Gerät, öffnet die Belegung | ja |
| `board-device-overlap:<deviceId>` | „Reiheneinbaugeräte überlappen: <Bezeichnung>“ (an jedem beteiligten Gerät außer dem mit der kleinsten ID) | wählt das Gerät, öffnet die Belegung | ja |
| `device-without-circuit:<deviceId>` | „Kein Stromkreis: <Bezeichnung>“ | wählt das Gerät | ja |
| `circuit-board-mismatch:<deviceId>` | „<Kurzname> liegt in <Verteiler>, Leitung führt zu <Verteiler>“ | wählt das Gerät | ja |
| `knx-without-channel:<deviceId>` | „Kein KNX-Kanal: <Bezeichnung>“ | wählt das Gerät | ja |
| `knx-channel-mismatch:<deviceId>` | „KNX-Kanal passt nicht: <Bezeichnung>“ | wählt das Gerät | ja |
| `board-without-surface:<boardId>` | „Verteiler ohne Fläche (<SurfaceRef>)“ | Aktion „Löschen“ | nein |
| `board-device-without-board:<deviceId>` | „Reiheneinbaugerät ohne Verteiler oder Feld“ | Aktion „Löschen“ | nein |
| `circuit-without-board:<circuitId>` | „Stromkreis an unbekanntem Verteiler: <Bezeichnung>“ | Aktion „Löschen“ | nein |
| `route-node-without-board:<nodeId>` | „Trassenknoten an unbekanntem Verteiler“ | Aktion „Vom Verteiler lösen“ | nein |

`cable-without-device` heißt ab M4 „Leitung an unbekanntem Gerät oder Verteiler“ und gilt auch für einen unbekannten `boardId`-Endpunkt.

### Löschen und abhängige Änderungen
Alles läuft im selben Befehl. Die Bestätigung nennt, was mitgelöscht wird (Leitungen, Reiheneinbaugeräte, Stromkreise):
- **Verteiler löschen:** löscht seine Reiheneinbaugeräte, seine Stromkreise (die Geräte verlieren `circuitId`), alle Leitungen mit diesem Verteiler als Endpunkt (darunter die eigene Zuleitung und die Zuleitungen der Kinder) und die Zuordnungen seiner Aktoren. Sein Verteilerknoten wird zu einem gewöhnlichen Knoten. Kinder verlieren `parentBoardId` und `feedCableId`, Linien verlieren `boardId`.
- **Wand, Raum, Geschoss löschen:** Verteiler auf einer gelöschten Wandseite werden wie oben gelöscht.
- **Reiheneinbaugerät löschen:** entfernt Zuordnungen mit diesem Aktor; Stromkreise mit diesem Schutzgerät verlieren `protectionDeviceId`.
- **Gerät löschen:** entfernt seine Zuordnung zu einem Kanal (zusätzlich zu M3).
- **Stromkreis löschen:** Geräte verlieren `circuitId`.
- Die Bereinigung optionaler Verweise (siehe „Dateiformat M4“) gehört zu `normalizeAfterCommand`, ebenso das Nachführen der Verteilerknoten.

### Auswahl
Neue Auswahlarten `board` und `circuit`. Reiheneinbaugeräte werden als `device` ausgewählt; die Belegungsansicht erlaubt Shift-Klick für mehrere Geräte desselben Verteilers. Ein ausgewählter Verteiler ist in Grundriss, Flächenansicht, 3D und Baum hervorgehoben.

### Store und Befehle
Neue Befehle (deutsche Labels): „Verteiler anlegen“, „Verteiler verschieben“, „Verteiler ändern“, „Felder ändern“, „Verteiler löschen“, „Verteiler zuordnen“, „Gerät einsetzen“, „Gerät umsetzen“, „Leitungen anlegen“, „Stromkreis anlegen“, „Stromkreis ändern“, „Stromkreis löschen“, „Stromkreis zuweisen“, „Aktorvorschlag übernehmen“, „Kanal zuordnen“, „Kanäle automatisch zuordnen“, „KNX-Linie anlegen“, „KNX-Linie ändern“, „KNX-Linie löschen“, „KNX-Linie zuweisen“, „Teilnehmer über Busleitungen zuordnen“, „Reserven ändern“ (Projekteinstellungen: `teReservePercent`, `actuatorReservePercent`, Prüfung 0–100).

### Module
Neue reine Module: `geometry/boards.ts` (Weltlage, Rechteck im Grundriss, Gerätebreite, Belegung je Reihe, freie Plätze, Reserve, vorgemerkt), `geometry/circuits.ts` (Kurzname, speisender Verteiler, Leitungen eines Stromkreises), `geometry/knx.ts` (Verbraucher, Verteiler eines Verbrauchers, Bedarf, Vorschlag, Platzsuche, automatische Zuordnung, Linienteilnehmer), `rules/boards.ts`, `rules/circuits.ts`, `rules/knx.ts`, `store/boards.ts`, `store/circuits.ts`, `store/knx.ts`. UI: `ui/BoardProperties.tsx`, `ui/CircuitProperties.tsx`, `ui/board/BoardView.tsx`, Erweiterungen in `ui/surface/`, `ui/plan/`, `ui/three/`, `ui/Tree.tsx`, `ui/DeviceProperties.tsx`, `ui/CableProperties.tsx`, `ui/ProjectSettings.tsx`.

### Tests und Fixtures
- Neue Fixture `tests/fixtures/m4/`: die M3-Fixture, ergänzt um diese Verteiler: einen Zählerschrank im EG (Zählerfeld, APZ-Feld, Verteilerfeld 5 × 12), die UV EG (Wohnen), die UV OG (Unterputz 550 × 1100 × 120 im Raum Kind, Verteilerfeld 4 × 12) mit Zuleitung NYM-J 5×10 vom Zählerschrank und einen Medienverteiler im EG. Dazu kommen ein LS-Schalter in der UV EG und ein Jalousieaktor in der UV OG, die Stromkreise „F1 Küche Steckdosen“ (UV EG, mit Schutzgerät) und „F2 Kind“ (UV OG, ohne Schutzgerät), Leitungen von Geräten zu beiden UVs, ein Rollladen im OG, eine Netzwerkdose mit Leitung zum Medienverteiler, die KNX-Linie „1.1“ und eine Kanalzuordnung. Erzeugt wird sie über Store-Befehle und den Writer (Generator `tests/unit/io/fixture-m4.gen.test.ts`); dazu ein Golden-File-Test für alle Dateien.
- Migrations-Test mit der M3-Fixture: Version 4, erster Befehl schreibt `projekt.yaml` (Reserven, `perBoardMm`) und `katalog.yaml` (neue Standardtypen), sonst nichts.
- Unit-Tests: Gerätebreite, Belegung und Platzprüfung (Spec „Aktor einsetzen“, „Kein Platz“), Reserve (Spec „Zu wenig Reserve“), vorgemerkt (Spec „Aktorbedarf vor Belegung“), Vorschlag (Spec „Vorschlag mit Reserve“, Gleichstände, kein Typ), Platzsuche beim Übernehmen, automatische Zuordnung (Sortierung), Bedarf (Spec „Bedarf UV OG“), speisender Verteiler, Leitungen eines Stromkreises, alle neuen Regeln, Löschkaskaden, Normalisierung, Länge mit Verteilerzuschlag (Spec „Längenberechnung“).
- Playwright: Verteiler im Flur OG setzen (erscheint in Wandansicht, Grundriss, 3D, Baum), Belegung öffnen und Aktor einsetzen, Trasse zum Verteiler und Leitung mit Länge, Stromkreis anlegen, fünf Geräte zuweisen und hervorheben, Aktorvorschlag übernehmen, Kanäle automatisch zuordnen, speichern und neu laden.

## Risks / Trade-offs

- [Viele neue Warnungen in bestehenden Projekten: jedes Stromgerät ohne Stromkreis, jeder KNX-Verbraucher ohne Kanal] → bewusst, so steht es in den Specs. Die Warnungen sind übergehbar, und die Übersicht gruppiert schon nach Regel.
- [Speisender Verteiler über Breitensuche bei jedem Regellauf] → Graph einmal je Projektstand aufbauen (Memo über das Projektobjekt, wie bei den Warnungen); Projekte haben Hunderte, nicht Tausende Leitungen.
- [Aktorvorschlag als Rucksackproblem] → Kanalzahlen sind klein (≤ 24 je Typ, Bedarf ≤ ein paar Hundert), die DP ist trivial schnell.
- [Leitungen eines Stromkreises abgeleitet statt gespeichert] → keine Inkonsistenz zwischen Gerät und Leitung möglich; eine Leitung zwischen Geräten verschiedener Stromkreise gehört zu keinem (sichtbar in den Leitungseigenschaften).
- [Migration ergänzt den Projektkatalog] → nur fehlende IDs, nichts wird überschrieben; die Änderung steht im Git-Diff von `katalog.yaml`.
- [Belegungsansicht mit eigenem Ziehen über Zeiger-Ereignisse] → wie die übrigen Editoren; HTML5-Drag ist in Safari und Playwright unzuverlässig.

## Entscheidungen bei der Ausarbeitung (2026-11-22, zur Prüfung durch den Benutzer)

Die Specs ließen diese Punkte offen. Claude hat sie ohne Rückfrage festgelegt, weil der Benutzer weiterarbeiten lassen wollte. Sie lassen sich vor dem Ende der Umsetzung noch ändern:
1. Die Leitungen eines Stromkreises werden abgeleitet, nicht gespeichert (`Cable.circuitId` entfällt).
2. Verteiler nur auf Wandseiten. Der Verteilerknoten liegt oben mittig.
3. Reserve zählt nur Verteilerfelder. Vorgemerkt werden 1 LS je Stromkreis ohne Schutzgerät und der Aktorvorschlag.
4. Die Migration ergänzt die vier neuen Gerätetypen und NYM-J 5×10 im Projektkatalog.
5. Shift-Klick im Grundriss wählt Geräte über Flächen hinweg aus, dazu kommt „Gleiche im Geschoss auswählen“.
6. KNX-Linien mit optionalem Startverteiler. Die Teilnehmer werden gespeichert (`knxLineId`) und lassen sich über Busleitungen übernehmen.

## Open Questions

- Keine.
