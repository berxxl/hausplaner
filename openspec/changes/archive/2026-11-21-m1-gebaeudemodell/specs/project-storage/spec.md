# Spec Delta

## Purpose

Speichert ein Projekt als Ordner mit YAML-Dateien, die sich über Git zwischen mehreren Personen austauschen, gut diffen und mit wenig Konflikten mergen lassen.

## ADDED Requirements

### Requirement: Start mit Projektordner
Das System SHALL über einen Befehl mit dem Pfad eines Projektordners gestartet werden, auf macOS, Windows und Linux laufen und die Oberfläche in einem aktuellen Browser (Chrome, Edge, Firefox, Safari) öffnen.

#### Scenario: Start
- **WHEN** der Benutzer `npm start -- ../haus-daten` ausführt
- **THEN** öffnet sich der Browser mit dem Projekt aus `../haus-daten`

#### Scenario: Leerer Ordner
- **WHEN** der angegebene Ordner weder `projekt.yaml` noch Geschossdateien enthält (andere Dateien wie `.git`, README oder unbekannte YAML-Dateien zählen nicht) oder nicht existiert
- **THEN** bietet die Oberfläche im Browser an, dort ein neues Projekt mit Name und erstem Geschoss anzulegen und den Ordner bei Bedarf zu erstellen; stimmt der Benutzer zu, werden `projekt.yaml` und die Datei des ersten Geschosses sofort geschrieben und andere Dateien bleiben unberührt; lehnt er ab, zeigt sie nur den Hinweis und schreibt nichts

### Requirement: Nur lokaler Zugriff
Das System SHALL nur Verbindungen von diesem Rechner annehmen und Dateien ausschließlich innerhalb des Projektordners lesen und schreiben.

#### Scenario: Zugriff aus dem Netz
- **WHEN** ein anderer Rechner im Netzwerk die Adresse aufruft
- **THEN** erhält er keine Verbindung

#### Scenario: Pfad außerhalb
- **WHEN** eine Anfrage eine Datei mit `..` im Pfad lesen oder schreiben will
- **THEN** lehnt der Server sie ab

#### Scenario: Symlink nach außen
- **WHEN** ein Unterordner des Projektordners ein Symlink auf einen Ordner außerhalb ist und eine Anfrage dort eine neue Datei schreiben will
- **THEN** lehnt der Server die ganze Anfrage ab und schreibt keine Datei

### Requirement: Aufteilung auf Dateien
Das System SHALL das Projekt als YAML-Dateien speichern: eine Datei für Projekt und Einstellungen und je Geschoss eine Datei mit dessen Bauteilen; spätere Meilensteine ergänzen weitere Dateien. Eine fehlende Datei MUST als leer gelten. YAML-Dateien, die das System nicht kennt, MUST es ignorieren und MUST NOT sie schreiben oder löschen. PDF-Pläne MUST als eigene Dateien im Projektordner liegen und relativ referenziert werden.

#### Scenario: Änderung im DG
- **WHEN** der Benutzer nur eine Wand im DG um 200 mm verschiebt und speichert
- **THEN** ändert sich ausschließlich die Datei des DG, und zwar nur in den Zeilen dieser Wand, der angeschlossenen Wände und der Konturen angrenzender Räume

#### Scenario: PDF-Plan hinzufügen
- **WHEN** der Benutzer für das EG eine PDF wählt
- **THEN** legt das System sie im Planordner des Projekts ab, bei gleichem Namen mit Suffix `-2`, `-3` …, und speichert nur den relativen Pfad

#### Scenario: Gleiche PDF erneut wählen
- **WHEN** der Benutzer für das OG dieselbe PDF wählt, die schon im Planordner liegt
- **THEN** legt das System keine Kopie an und verweist auf die vorhandene Datei

#### Scenario: Geschoss umbenennen
- **WHEN** der Benutzer das Geschoss „DG“ in „Dachgeschoss“ umbenennt
- **THEN** ändert sich nur der Name in der Datei, der Dateiname des Geschosses bleibt gleich

### Requirement: Deterministisches Schreiben
Das System SHALL gleichen Inhalt immer byteweise gleich speichern: stabile IDs, sortierte Listen, feste Feldreihenfolge, keine abgeleiteten Werte. Längen MUST in ganzen Millimetern, Winkel auf 0,1° und PDF-Koordinaten auf 0,1 Punkt gerundet werden. Eine Datei MUST nur geschrieben werden, wenn ihre Serialisierung vom zuletzt gelesenen oder geschriebenen Inhalt abweicht. Von Hand nicht kanonisch bearbeitete Dateien MUST beim nächsten Speichern kanonisch geschrieben werden.

#### Scenario: Laden und Speichern ohne Änderung
- **WHEN** der Benutzer ein Projekt öffnet und ohne Änderung speichert
- **THEN** zeigt `git status` keine geänderten Dateien

#### Scenario: Reihenfolge der Bearbeitung
- **WHEN** zwei Personen dieselben drei Wände aus einer gemeinsamen Vorlage in unterschiedlicher Reihenfolge bearbeiten
- **THEN** stehen die Wände in beiden Dateien in derselben Reihenfolge

#### Scenario: Unbeteiligter Raum
- **WHEN** eine Wand verschoben wird, die nur an die Küche grenzt
- **THEN** bleiben die Zeilen aller anderen Räume des Geschosses unverändert

#### Scenario: Handbearbeitete Datei
- **WHEN** jemand eine Geschossdatei von Hand mit anderer Einrückung bearbeitet und der Benutzer danach eine Wand ändert
- **THEN** schreibt das System die Datei kanonisch

### Requirement: Lesbarer Diff
Das System SHALL zu jedem benannten Objekt den Namen direkt nach der ID schreiben und Punkte einzeilig darstellen, sodass ein Diff ohne die App verständlich ist.

#### Scenario: Diff auf GitHub
- **WHEN** ein Fenster um 200 mm verschoben wurde
- **THEN** zeigt der Diff genau eine geänderte Zeile mit dem Abstand vom Wandanfang innerhalb des Blocks dieses Fensters

### Requirement: Speichern
Das System SHALL Änderungen mit Cmd/Strg+S sowie automatisch 2 Sekunden nach der letzten Änderung speichern; der Speicherstand (gespeichert, ungespeichert, Fehler) MUST sichtbar sein. Nach einem Fehler MUST das System das Speichern beim nächsten Befehl und alle 10 Sekunden erneut versuchen.

#### Scenario: Autospeichern
- **WHEN** der Benutzer eine Wand ändert und 2 Sekunden nichts tut
- **THEN** sind die Dateien gespeichert und die Oberfläche zeigt „gespeichert“

#### Scenario: Speicherfehler
- **WHEN** eine Datei nicht geschrieben werden kann, weil sie schreibgeschützt ist, und der Schreibschutz danach aufgehoben wird
- **THEN** zeigt die Oberfläche „Fehler“, bis ein erneuter Versuch spätestens nach 10 Sekunden gelingt, und danach „gespeichert“

### Requirement: Prüfung beim Laden
Das System SHALL beim Laden alle Dateien prüfen und Fehler mit Datei, Zeile und Ursache melden. Bei YAML-Syntaxfehlern, Merge-Konfliktmarkern und Schemaverstößen, auch unbekannten Feldern und fehlender Schemaversion, MUST das System das Projekt nicht öffnen und nichts schreiben. Bei Verweisen auf nicht vorhandene Objekte MUST es das Projekt öffnen und eine Warnung erzeugen, aus der das verweisende Objekt gelöscht werden kann.

#### Scenario: Konfliktmarker
- **WHEN** `geschosse/og.yaml` nach einem Merge noch `<<<<<<<` enthält
- **THEN** meldet das System Datei und Zeile des Konflikts und öffnet das Projekt nicht; nach Korrektur der Datei lädt es automatisch erneut

#### Scenario: Unbekanntes Feld
- **WHEN** eine Wand von Hand ein Feld `color` erhalten hat
- **THEN** meldet das System Datei, Zeile und das unbekannte Feld und öffnet das Projekt nicht

#### Scenario: Verweis ins Leere
- **WHEN** ein Fenster nach einem Merge auf eine Wand verweist, die nicht mehr existiert
- **THEN** öffnet das System das Projekt, zeigt das Fenster nicht an und meldet es mit der fehlenden Wand-ID als Warnung mit der Aktion „Löschen“

### Requirement: Konsistenz der Dateien
Das System SHALL beim Laden prüfen, dass IDs projektweit und Geschoss-Kurznamen eindeutig sind, jeder Geschoss-Kurzname zum Dateinamen passt und `projekt.yaml` vorhanden ist, sobald Geschossdateien existieren. Bei einem Verstoß MUST es das Projekt nicht öffnen und nichts schreiben.

#### Scenario: Doppelte ID nach Merge
- **WHEN** nach einem Merge zwei Wände in `geschosse/eg.yaml` und `geschosse/og.yaml` dieselbe ID tragen
- **THEN** meldet das System beide Fundstellen mit Datei und Zeile und öffnet das Projekt nicht

#### Scenario: Kurzname passt nicht zur Datei
- **WHEN** `geschosse/og.yaml` den Kurznamen `dg` enthält
- **THEN** meldet das System Datei und Zeile und öffnet das Projekt nicht

### Requirement: Externe Änderungen
Das System SHALL erkennen, wenn sich Dateien des Projektordners außerhalb der App ändern, entstehen oder gelöscht werden, etwa nach `git pull`, und das Neuladen anbieten. Bis zum Neuladen MUST das automatische Speichern pausieren. Eigene Speichervorgänge und Dateien im Planordner MUST NOT als externe Änderung gelten.

#### Scenario: Nach git pull
- **WHEN** der Benutzer bei geöffneter App ohne ungespeicherte Änderungen `git pull` ausführt
- **THEN** fragt die App, ob sie neu laden soll, und zeigt danach den neuen Stand

#### Scenario: Eigene ungespeicherte Änderungen
- **WHEN** zugleich ungespeicherte Änderungen in der App vorliegen und der Benutzer „Neu laden“ wählt
- **THEN** fragt die App, ob die ungespeicherten Änderungen verworfen werden sollen, und leert nach dem Neuladen die Rückgängig-Historie

#### Scenario: Später
- **WHEN** der Benutzer „Später“ wählt und danach Cmd/Strg+S drückt
- **THEN** bleibt das automatische Speichern pausiert, und die App schreibt erst nach der Bestätigung „Externe Änderungen überschreiben?“; danach verschwindet der Hinweis und das automatische Speichern läuft wieder

### Requirement: Schemaversion
Das System SHALL die Schemaversion im Projekt speichern und ältere Projekte beim Laden im Speicher auf die aktuelle Version migrieren. Die Migration allein MUST NOT ein automatisches Speichern auslösen. Ein Projekt mit neuerer Schemaversion als der der App MUST das System nicht öffnen.

#### Scenario: Älteres Projekt
- **WHEN** ein Projekt mit älterer Schemaversion geladen wird
- **THEN** migriert das System es, zeigt einen Hinweis und schreibt die neue Version erst beim nächsten Speichern einer Änderung oder mit Cmd/Strg+S

#### Scenario: Neueres Projekt
- **WHEN** ein Projekt geladen wird, das eine neuere App-Version mit höherer Schemaversion geschrieben hat
- **THEN** zeigt das System „Projekt wurde mit neuerer App-Version erstellt“, öffnet es nicht und schreibt nichts
