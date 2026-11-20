# Spec Delta

## ADDED Requirements

### Requirement: Gewerkfilter
Das System SHALL Elemente nach Gewerk (Strom, KNX, Daten, Leerrohr, Kältemittel, Kondensat, Sonstiges) und zusätzlich die Kategorie Möbel ein- und ausblenden. Der Filter MUST in Grundriss, Flächenansichten und 3D gleichzeitig gelten; das Gebäude bleibt immer sichtbar.

#### Scenario: Nur KNX
- **WHEN** der Benutzer alle Gewerke außer KNX und die Möbel ausblendet
- **THEN** zeigen Grundriss, Flächenansichten und 3D nur Gebäude und KNX-Geräte

#### Scenario: Möbel ausblenden
- **WHEN** der Benutzer die Kategorie Möbel ausblendet
- **THEN** verschwinden Möbel und ihre Silhouetten in allen Ansichten, Geräte bleiben sichtbar
