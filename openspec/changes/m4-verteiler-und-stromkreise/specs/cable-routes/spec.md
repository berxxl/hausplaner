# Spec Delta

## MODIFIED Requirements

### Requirement: Trassen zeichnen
Das System SHALL in jeder Flächenansicht Trassen als Linienzüge aus Knoten und geraden Segmenten zeichnen lassen. Knoten MUST an Geräten, Verteilern und bestehenden Knoten einrasten.

#### Scenario: Trasse zur Steckdose
- **WHEN** der Benutzer in der Wandansicht von der oberen Zone senkrecht zur Steckdose zeichnet
- **THEN** endet die Trasse in einem Knoten am Gerät

#### Scenario: Abzweig
- **WHEN** der Benutzer auf ein bestehendes Segment klickt
- **THEN** wird das Segment dort geteilt und ein Abzweigknoten entsteht

#### Scenario: Trasse zum Verteiler
- **WHEN** der Benutzer eine Trasse bis an die UV EG zeichnet
- **THEN** endet sie in einem Knoten am Verteiler
