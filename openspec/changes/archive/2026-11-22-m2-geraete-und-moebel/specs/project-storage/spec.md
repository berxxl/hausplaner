# Spec Delta

## MODIFIED Requirements

### Requirement: Start mit Projektordner
Das System SHALL über einen Befehl mit dem Pfad eines Projektordners gestartet werden, auf macOS, Windows und Linux laufen und die Oberfläche in einem aktuellen Browser (Chrome, Edge, Firefox, Safari) öffnen.

#### Scenario: Start
- **WHEN** der Benutzer `npm start -- ../haus-daten` ausführt
- **THEN** öffnet sich der Browser mit dem Projekt aus `../haus-daten`

#### Scenario: Leerer Ordner
- **WHEN** der angegebene Ordner weder `projekt.yaml` noch Geschossdateien enthält (andere Dateien wie `.git`, README oder unbekannte YAML-Dateien zählen nicht) oder nicht existiert
- **THEN** bietet die Oberfläche im Browser an, dort ein neues Projekt mit Name und erstem Geschoss anzulegen und den Ordner bei Bedarf zu erstellen; stimmt der Benutzer zu, werden `projekt.yaml`, der Katalog und die Datei des ersten Geschosses sofort geschrieben und andere Dateien bleiben unberührt; lehnt er ab, zeigt sie nur den Hinweis und schreibt nichts

#### Scenario: Leerer Ordner mit vorhandenem Katalog
- **WHEN** der Ordner nur einen Katalog enthält, etwa aus einem anderen Projekt kopiert, und der Benutzer ein neues Projekt anlegt
- **THEN** übernimmt das System diesen Katalog unverändert statt des Standardkatalogs und schreibt nur `projekt.yaml` und die Datei des ersten Geschosses
