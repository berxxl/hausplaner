# Hausplaner

Planung der Haustechnik für eine Kernsanierung: Elektro mit Installationszonen, KNX, Netzwerk, Leerrohre, Kältemittel und Kondensat. Dazu Möbel zur Kontrolle der Gerätepositionen, Verteilerbelegung mit Platzbedarf, Leitungslängen, PDF-Pläne und eine einfache 3D-Ansicht.

> Stand: Spezifikation. Der Code entsteht schrittweise entlang der OpenSpec-Changes unter `openspec/changes/`.

## Nutzung (Ziel)

Voraussetzung: Node 22 LTS und Git. Läuft unter macOS, Windows und Linux in Chrome, Edge, Firefox oder Safari.

```bash
git clone <app-repo> hausplaner
git clone <daten-repo> haus-daten     # privates Repo mit den Planungsdaten
cd hausplaner
npm install
npm start -- ../haus-daten
```

Die Planungsdaten sind YAML-Dateien im Datenordner. Austausch über Git (`git pull`, `git commit`, `git push`) außerhalb der App; die App erkennt geänderte Dateien und lädt nach Rückfrage neu.

## Dokumentation

- [Architektur und Datenmodell](docs/architektur.md)
- Specs und Meilensteine: `openspec/changes/m1-…` bis `m6-…`
