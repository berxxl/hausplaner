// Baustellen-PDF und Seitenzuordnung (Tasks 7.1, 7.2)
import { jsPDF } from "jspdf";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  pageToSurface,
  parseSiteMapping,
  SITE_PDF_NAMESPACE,
  siteMappingText,
  type SiteMapping,
} from "../../../src/export/mapping";
import type { Item } from "../../../src/export/sheet";
import { chooseSiteLayout, siteSheets } from "../../../src/export/site";
import { deriveRoomViews } from "../../../src/geometry/surfaces";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

const OPTS = {
  project: "Test",
  date: "22.11.2026",
  planStatus: "Entwurf",
  trades: ["power", "knx", "data", "conduit", "refrigerant", "condensate", "other"] as const,
  statuses: ["planned", "installed", "verified"] as const,
};
const opts = { ...OPTS, trades: [...OPTS.trades], statuses: [...OPTS.statuses] };

function m4(): Project {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error();
  return r.project;
}

const has = (items: Item[], data: string) => items.some((i) => i.data === data);

describe("Baustellen-PDF (7.1)", () => {
  test("Bad: je Wandseite, Decke und Boden eine A4-Seite mit Raster und Bemaßung (Spec-Scenario „Bad für die Baustelle“)", () => {
    const p = m4();
    const r = siteSheets(p, ["r3bad00a"], opts, "2026-11-22T20:00:00.000Z");
    const views = deriveRoomViews(p).get("r3bad00a")!;
    expect(r.errors).toEqual([]);
    expect(r.pages.map((x) => x.content)).toEqual([
      ...views.map((v) => `Bad › ${v.name}`),
      "Bad › Decke",
      "Bad › Boden",
    ]);
    for (const page of r.pages) {
      expect([page.sheet.widthMm, page.sheet.heightMm].sort()).toEqual([210, 297]);
      expect(has(page.sheet.items, "grid-fine")).toBe(true);
      expect(has(page.sheet.items, "grid-bold")).toBe(true);
      expect(has(page.sheet.items, "notes")).toBe(true);
      expect(page.sheet.items.some((i) => i.data?.startsWith("legend"))).toBe(false);
      // größter passender Maßstab, in der Kopfzeile genannt
      expect([20, 25, 50]).toContain(page.mapping.scale);
      expect(page.sheet.items.find((i) => i.data === "site-heading")).toMatchObject({
        text: expect.stringContaining(`Maßstab 1:${page.mapping.scale}`),
      });
    }
    expect(r.pages.map((x) => x.sheet.title.page)).toEqual(
      r.pages.map((_, i) => `${i + 1}/${r.pages.length}`),
    );
    // Wand mit Gerät oder Trassenknoten ist bemaßt
    const kueche = siteSheets(p, ["r1kueche"], opts, "x");
    expect(kueche.pages.some((x) => x.sheet.items.some((i) => i.data?.startsWith("dim-u:")))).toBe(
      true,
    );
  });

  test("zu große Wand: 1:25 bzw. 1:50 mit Angabe auf der Seite (Spec-Scenario „Wand zu groß für 1:20“)", () => {
    expect(chooseSiteLayout({ widthMm: 3000, heightMm: 2500 })).toMatchObject({ scale: 20 });
    expect(chooseSiteLayout({ widthMm: 5000, heightMm: 2500 })).toMatchObject({
      scale: 25,
      format: { orientation: "landscape" },
    });
    expect(chooseSiteLayout({ widthMm: 9000, heightMm: 2500 })).toMatchObject({ scale: 50 });
    expect(chooseSiteLayout({ widthMm: 30000, heightMm: 2500 })).toBeNull();
    // ganze Seite: Kopfzeile nennt den Maßstab mit Hinweis
    const p = m4();
    p.rooms.find((r) => r.id === "r2wohnen")!.polygon = [
      { x: 4150, y: 150 },
      { x: 9000, y: 150 },
      { x: 9000, y: 2940 },
      { x: 4150, y: 2940 },
    ];
    const page = siteSheets(p, ["r2wohnen"], opts, "x").pages.find(
      (x) => x.content === "Wohnen › Decke",
    )!;
    expect(page.mapping.scale).toBe(25);
    expect(page.sheet.items.find((i) => i.data === "site-heading")).toMatchObject({
      text: "Wohnen › Decke · Maßstab 1:25 (nicht 1:20)",
    });
    expect(page.sheet.title.scale).toBe(25);
  });
});

describe("Seitenzuordnung (7.2)", () => {
  const mapping: SiteMapping = {
    format: "hausplaner-site-pdf",
    version: 1,
    project: "Banatstraße <10> & Co",
    exportedAt: "2026-11-22T20:00:00.000Z",
    pages: [
      {
        page: 1,
        surface: "wall:abc:L",
        roomId: "r1",
        view: "Bad › Wand Nord",
        scale: 20,
        originMm: [40, 150],
        uRange: [165, 3925],
      },
    ],
  };

  test("Rundreise über die XMP-Metadaten einer jsPDF-Datei, gelesen mit pdf.js (Spec-Scenario „Zuordnung lesbar“)", async () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.text("Seite", 20, 20);
    doc.addMetadata(siteMappingText(mapping), SITE_PDF_NAMESPACE);
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(doc.output("arraybuffer")) })
      .promise;
    const md = await pdf.getMetadata();
    expect(parseSiteMapping(md.metadata?.getRaw())).toEqual(mapping);
  });

  test("Seitenpunkt → (u, v): x ab Ursprung mal Maßstab plus u0, v nach oben", () => {
    expect(pageToSurface(mapping, 1, 40, 150)).toEqual({ surface: "wall:abc:L", u: 165, v: 0 });
    expect(pageToSurface(mapping, 1, 90, 97.5)).toEqual({
      surface: "wall:abc:L",
      u: 1165,
      v: 1050,
    });
    expect(pageToSurface(mapping, 2, 0, 0)).toBeNull();
  });

  test("fremde oder kaputte Metadaten ergeben keine Zuordnung", () => {
    expect(parseSiteMapping(null)).toBeNull();
    expect(
      parseSiteMapping(
        '<rdf:Description xmlns:jspdf="https://andere.example/ns"><jspdf:metadata>{}</jspdf:metadata>',
      ),
    ).toBeNull();
    expect(
      parseSiteMapping(
        `<rdf:Description xmlns:jspdf="${SITE_PDF_NAMESPACE}"><jspdf:metadata>{kaputt</jspdf:metadata>`,
      ),
    ).toBeNull();
  });

  test("siteSheets: Zuordnung mit Seitennummern, Fläche und Ursprung je Seite", () => {
    const p = m4();
    const r = siteSheets(p, ["r1kueche"], opts, "2026-11-22T20:00:00.000Z");
    expect(r.mapping.pages.map((x) => x.page)).toEqual(r.pages.map((_, i) => i + 1));
    expect(r.mapping.pages.at(-1)).toMatchObject({
      surface: "floor:r1kueche",
      roomId: "r1kueche",
      view: "Küche › Boden",
    });
    expect(r.mapping.project).toBe("Test");
  });
});
