# Spec Delta

## Purpose

Modelliert Zählerschrank, Unterverteilungen und Medienverteiler mit ihrem inneren Aufbau, um Platzbedarf und Reserve vor der Bestellung zu klären.

## ADDED Requirements

### Requirement: Verteiler platzieren
Das System SHALL Verteiler der Arten Zählerschrank, Unterverteilung und Medienverteiler mit Außenmaß, Einbautiefe und Montage (Unterputz, Aufputz) auf einer Wandseite platzieren.

#### Scenario: UV im Flur
- **WHEN** der Benutzer eine Unterputz-UV 550 × 1100 × 120 mm im Flur OG setzt
- **THEN** erscheint sie in Wandansicht, Grundriss, 3D und im Strukturbaum unter „Verteiler“

### Requirement: Felder und Reihen
Das System SHALL je Verteiler Felder der Arten Zählerfeld, APZ-Feld, oberer und unterer Anschlussraum, Verteilerfeld und Multimediafeld mit Anzahl Reihen und TE je Reihe verwalten.

#### Scenario: Zählerschrank aufbauen
- **WHEN** der Benutzer einen Zählerschrank mit Zählerfeld, APZ-Feld und Verteilerfeld 5 Reihen à 12 TE anlegt
- **THEN** zeigt die Belegungsansicht drei Felder und 60 TE im Verteilerfeld

### Requirement: Reiheneinbaugeräte belegen
Das System SHALL Reiheneinbaugeräte per Ziehen in eine Reihe eines Verteilerfelds setzen; ein Gerät MUST die TE-Breite seines Typs belegen und darf keine anderen Geräte überlappen.

#### Scenario: Aktor einsetzen
- **WHEN** der Benutzer einen 8-TE-Schaltaktor in Reihe 3 ab Platz 1 zieht
- **THEN** belegt er die Plätze 1–8 in Reihe 3

#### Scenario: Kein Platz
- **WHEN** in der Reihe nur noch 4 TE frei sind
- **THEN** lehnt das System das Einsetzen dort ab

### Requirement: Reserve prüfen
Das System SHALL je Verteiler belegte, freie und vorgemerkte TE anzeigen und eine Warnung erzeugen, wenn die freie Reserve unter den eingestellten Prozentsatz (Standard 25 %) fällt.

#### Scenario: Zu wenig Reserve
- **WHEN** in einer UV mit 48 TE 42 TE belegt sind
- **THEN** meldet das System „Reserve unter 25 %“

### Requirement: Bedarf vormerken
Das System SHALL den aus dem Plan abgeleiteten, aber noch nicht eingesetzten Gerätebedarf (Schutzgeräte, Aktoren) als vorgemerkte TE in die Reserveprüfung einbeziehen.

#### Scenario: Aktorbedarf vor Belegung
- **WHEN** der Aktorbedarf 16 TE beträgt, aber noch kein Aktor eingesetzt ist
- **THEN** zählen die 16 TE als vorgemerkt und die Reserve sinkt entsprechend

### Requirement: Verteilerhierarchie
Das System SHALL jedem Verteiler außer dem Zählerschrank einen übergeordneten Verteiler und eine Zuleitung zuordnen.

#### Scenario: UV am Zählerschrank
- **WHEN** die UV OG dem Zählerschrank mit Zuleitung NYM-J 5×10 zugeordnet wird
- **THEN** zeigt der Strukturbaum die UV unterhalb des Zählerschranks und die Zuleitung erscheint als Leitung

### Requirement: Medienverteiler
Das System SHALL im Medienverteiler Router, Switch, Patchfeld und Netzteile als Geräte führen und Datenleitungen dort enden lassen.

#### Scenario: Netzwerkdosen an Patchfeld
- **WHEN** alle Netzwerkdosen eines Geschosses Leitungen zum Medienverteiler haben
- **THEN** zeigt der Medienverteiler die Anzahl benötigter Patchfeldports
