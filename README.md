# Hausplaner

Planung der Haustechnik für eine Kernsanierung: Elektro mit Installationszonen, KNX, Netzwerk, Leerrohre, Kältemittel und Kondensat. Dazu Möbel zur Kontrolle der Gerätepositionen, Verteilerbelegung mit Platzbedarf, Leitungslängen, PDF-Pläne und eine einfache 3D-Ansicht.

> Stand: Umsetzung von `m1-gebaeudemodell` läuft (Projektgerüst, Datenmodell, Serialisierung, lokaler Server). Fortschritt in `openspec/changes/m1-gebaeudemodell/tasks.md`.

## Nutzung

Voraussetzung: Node 22 LTS (ab 22.22) und Git. Läuft unter macOS, Windows und Linux in Chrome, Edge, Firefox oder Safari.

```bash
git clone <app-repo> hausplaner
git clone <daten-repo> haus-daten     # privates Repo mit den Planungsdaten
cd hausplaner
npm install
npm start -- ../haus-daten
```

`npm start -- <ordner>` baut die App, wenn `dist/` fehlt oder älter als die Quellen ist, startet den Server auf `127.0.0.1` (Port 5180, bei Belegung der nächste freie bis 5189) und öffnet den Browser. Der Pfad ist relativ zum Aufrufort. Mit `HAUSPLANER_NO_OPEN=1` bleibt der Browser zu.

Die Planungsdaten sind YAML-Dateien im Datenordner. Austausch über Git (`git pull`, `git commit`, `git push`) außerhalb der App; die App erkennt geänderte Dateien und lädt nach Rückfrage neu. Ist der Ordner leer oder fehlt er, bietet die App an, ein neues Projekt anzulegen.

## Entwicklung

```bash
npm run dev -- ../haus-daten     # API-Server zuerst, dann Vite mit Hot Reload und Proxy auf /api
npm test                         # Unit- und Integrationstests (Vitest)
npm run e2e                      # Playwright (lokal Chromium; PW_ALL_BROWSERS=1 für Firefox und WebKit)
npm run lint
npm run typecheck
```

`npm run dev` startet zuerst den API-Server (Port wie bei `npm start`) und dann Vite; weitere Argumente nach dem Ordner gehen an Vite, z. B. `npm run dev -- ../haus-daten --port 5174`. Der Server läuft ohne Build-Schritt direkt mit Node (Type Stripping). Testdaten liegen unter `tests/fixtures/`.

## Dokumentation

- [Architektur und Datenmodell](docs/architektur.md)
- Specs und Meilensteine: `openspec/changes/m1-…` bis `m6-…`
