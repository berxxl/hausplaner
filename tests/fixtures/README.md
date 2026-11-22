# Testdaten

## Projekte

| Ordner | Inhalt |
|---|---|
| `klein/` | ein Geschoss „EG“, 8000 × 6000 mm Außenmaß (Achsen), Außenwände 300 mm, Innenwände 120 mm, vier Räume (Küche, Wohnen, Bad mit 140 mm Fußbodenaufbau, Schlafen), ein Fenster mit innen liegendem Rollladenkasten, eine Tür |
| `leer/` | ein Geschoss „EG“ ohne Bauteile, Ausgangspunkt für Zeichentests |
| `dg/` | `geschosse/dg.yaml` ist das verbindliche Beispiel aus `openspec/changes/m1-gebaeudemodell/design.md` (Abschnitt „Dateiformat M1“): Raum „Schlafen“ mit Schräge 45° ab 1000 mm an der Südwand (Kniestock), Ost- und Westwand als Giebelwände unter der Schräge, Fenster mit Aufsatzkasten in der Nordwand |
| `m2/` | `klein/` mit Katalog (eigener Typ „Steckdose USB-C“, Möbeltypen Küchenunterschrank und Kleiderschrank), sechs Geräten auf Wand, Decke, Boden und frei, einem Kleiderschrank und der übergangenen Warnung `device-covered:d6usbsch` |
| `m3/` | `m2/` plus OG auf 2800 mm (gleiche Wände, Raum „Kind“ über der Küche, Bodendose); Trassen in der Küche vom Schalter in die obere Zone, über die Raumecke zur Bohrung in die Innenwand (40 mm) und über die Oberkante zum Deckenauslass, Leerrohr M20, Kernbohrung 65 mm Küchendecke → Boden OG; drei Leitungen (eine über beide Geschosse, eine ohne Weg). Erzeugt über die Store-Befehle, daher normalisiert |

Alle Dateien sind kanonisch geschrieben: Laden und Speichern muss sie byteweise unverändert lassen.

## PDFs

Beide PDFs sind eingecheckt und werden nicht beim Build erzeugt.

### `pdf/vektorplan.pdf`

- A3 quer (1190,55 × 841,89 pt), zwei Seiten, Maßstab 1:100, reine Vektorgrafik
- Seite 1 „Grundriss EG“: Grundriss des Projekts `klein/` (Wände als Flächen, Achsmaße 8000 × 6000 mm)
- Seite 2 „Grundriss OG“: gleiche Außenwände, andere Innenwände
- Referenzstrecke „4,26“ unter dem Grundriss, auf beiden Seiten an derselben Stelle: 4260 mm in Wirklichkeit, 42,6 mm auf dem Papier
- Endpunkte der Referenzstrecke in pdf.js-Viewport-Koordinaten (`getViewport({scale: 1})`, Ursprung oben links, y nach unten): p1 = (170,1; 705,8), p2 = (290,8; 705,8)
- Weltursprung (0, 0) des Grundrisses, also die Achsecke unten links, liegt bei (170,1; 671,8)

Erzeugt am 2026-11-20 mit einem einmaligen Node-Skript über `pdf-lib` 1.x: Wände als Rechtecke um die Achse, Weltursprung 60 mm vom linken und 60 mm vom unteren Blattrand, 1 mm Wirklichkeit = 0,01 mm Papier.

### `pdf/scan.pdf`

- Rasterbild von Seite 1 des Vektorplans, 150 dpi (2481 × 1754 Pixel, Graustufen), eine Seite im A3-Format
- um 1,5° gegen den Uhrzeigersinn um die Bildmitte gedreht, leicht weichgezeichnet (Gauß 0,6 px), 4000 dunkle Störpixel (Zufallsstartwert 1)

Erzeugt mit `pdftoppm -r 150` (Poppler) und Pillow 11 (`rotate(1.5, BICUBIC)`, Speichern als PDF mit 150 dpi).
