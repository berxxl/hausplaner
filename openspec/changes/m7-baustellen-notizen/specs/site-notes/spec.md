# Spec Delta

## Purpose

Holt Stiftnotizen aus annotierten Baustellen-PDFs maßstabsgerecht als Notizebene auf die passenden Flächen zurück, damit verlegte Leitungen und Dosen danach im Plan nachgezeichnet werden können.

## ADDED Requirements

### Requirement: Annotierte PDF einlesen
Das System SHALL eine von ihm erzeugte Baustellen-PDF einlesen und deren Freihand-, Linien- und Textannotationen über die eingebettete Seitenzuordnung in Flächenkoordinaten umrechnen.

#### Scenario: Stiftstrich auf Wand
- **WHEN** auf der Seite „Bad OG – Wand Nord“ ein Strich 1830 mm rechts der Raumecke senkrecht gezogen wurde
- **THEN** liegt die importierte Notiz in der Wandansicht Bad OG Nord bei u = 1830 mm

#### Scenario: Textnotiz
- **WHEN** auf einer Seite die Textnotiz „Dose 5 cm tiefer gesetzt“ steht
- **THEN** erscheint der Text an der entsprechenden Stelle der Fläche

### Requirement: Nicht lesbare Annotationen melden
Das System SHALL melden, wenn eine PDF keine Seitenzuordnung enthält oder keine Annotationen, weil die Tablet-App sie ins Seitenbild eingebrannt hat.

#### Scenario: Eingebrannte Notizen
- **WHEN** eine PDF importiert wird, deren Notizen nur noch als Bildinhalt vorliegen
- **THEN** meldet das System, dass keine Annotationen gefunden wurden, und nennt als Ursache die Exportart der Tablet-App

#### Scenario: Fremde PDF
- **WHEN** eine PDF ohne Seitenzuordnung importiert wird
- **THEN** lehnt das System den Import mit Hinweis ab

### Requirement: Veralteter Planstand
Das System SHALL warnen, wenn sich eine Fläche seit dem Export der Baustellen-PDF geometrisch geändert hat, und die Notizen trotzdem importieren.

#### Scenario: Wand seither geändert
- **WHEN** die Wand nach dem Export verlängert wurde
- **THEN** importiert das System die Notizen und kennzeichnet sie mit „Planstand geändert“

### Requirement: Notizebene
Das System SHALL importierte Notizen je Fläche als einblendbare Ebene über Geräten und Trassen anzeigen, mit Herkunft (Datei, Seite, Importzeitpunkt).

#### Scenario: Nachzeichnen
- **WHEN** der Benutzer die Notizebene einblendet und eine Trasse zeichnet
- **THEN** sieht er die Stiftstriche als Vorlage und kann auf deren Endpunkte einrasten

### Requirement: Notizen erledigen
Das System SHALL Notizen einzeln oder je Import als erledigt markieren, ausblenden und löschen lassen.

#### Scenario: Übertragen und erledigt
- **WHEN** der Benutzer alle Notizen einer Wand übertragen hat und „erledigt“ wählt
- **THEN** werden sie standardmäßig ausgeblendet, bleiben aber abrufbar

### Requirement: Notizen speichern
Das System SHALL Notizen im Projekt speichern, sodass sie über Git ausgetauscht werden; Striche MUST in ganzen Millimetern in Flächenkoordinaten gespeichert werden.

#### Scenario: Tochter sieht Notizen
- **WHEN** der Benutzer Notizen importiert, speichert und pusht
- **THEN** sieht eine andere Person nach `git pull` dieselben Notizen auf denselben Flächen
