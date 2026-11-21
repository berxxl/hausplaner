# Spec Delta

## ADDED Requirements

### Requirement: Rohbauhöhe je Raum
Das System SHALL für einen Raum eine eigene Rohbauhöhe (Oberkante Rohfußboden bis Unterkante Rohdecke) erfassen lassen, die für diesen Raum die Rohbauhöhe des Geschosses ersetzt. Ohne eigene Angabe MUST die Rohbauhöhe des Geschosses gelten. Wände MUST ihre eigene Höhe behalten.

#### Scenario: Anbau höher als Bestand
- **WHEN** das Geschoss 2405 mm Rohbauhöhe hat und der Benutzer für den Raum „Wohnen“ 2460 mm bei 15 mm Putz einträgt
- **THEN** liegt die fertige Decke in Wohnen 2445 mm über Rohfußboden, in den übrigen Räumen 2390 mm, und die Wandhöhen bleiben unverändert

#### Scenario: Angabe entfernt
- **WHEN** der Benutzer die eigene Rohbauhöhe des Raums leert
- **THEN** gilt wieder die Rohbauhöhe des Geschosses
