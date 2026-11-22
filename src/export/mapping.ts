/**
 * Seitenzuordnung der Baustellen-PDF (design.md M5 „Baustellen-PDF“): welche Seite welche Fläche
 * zeigt und wie Seitenpunkte in (u, v) umgerechnet werden. Abgelegt als JSON in den XMP-Metadaten
 * (jsPDF `addMetadata` verpackt den Text entity-kodiert in `<jspdf:metadata>`). Frei von React.
 */
import { z } from "zod";

export const SITE_PDF_NAMESPACE = "https://hausplaner.app/ns/site-pdf/1";
export const SITE_PDF_FORMAT = "hausplaner-site-pdf";

const SitePageSchema = z.object({
  page: z.number().int().positive(),
  surface: z.string(),
  roomId: z.string().nullable(),
  view: z.string(),
  scale: z.number().positive(),
  /** Papierpunkt in mm ab oben links: x bei u = uRange[0], y bei v = 0 */
  originMm: z.tuple([z.number(), z.number()]),
  uRange: z.tuple([z.number(), z.number()]),
});

export const SiteMappingSchema = z.object({
  format: z.literal(SITE_PDF_FORMAT),
  version: z.literal(1),
  project: z.string(),
  exportedAt: z.string(),
  pages: z.array(SitePageSchema),
});

export type SitePageMapping = z.infer<typeof SitePageSchema>;
export type SiteMapping = z.infer<typeof SiteMappingSchema>;

export function siteMappingText(m: SiteMapping): string {
  return JSON.stringify(m);
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

/** Zuordnung aus dem rohen XMP-Text (pdf.js `getMetadata().metadata.getRaw()`); null, wenn keine. */
export function parseSiteMapping(xmpRaw: string | null | undefined): SiteMapping | null {
  if (!xmpRaw) return null;
  const ns = SITE_PDF_NAMESPACE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const m = new RegExp(
    `xmlns:jspdf="${ns}"[^>]*>\\s*<jspdf:metadata>([\\s\\S]*?)</jspdf:metadata>`,
  ).exec(xmpRaw);
  if (!m) return null;
  try {
    const r = SiteMappingSchema.safeParse(JSON.parse(decodeEntities(m[1]!)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Seitenpunkt (mm ab oben links) → Fläche und (u, v); null für unbekannte Seiten. */
export function pageToSurface(
  m: SiteMapping,
  page: number,
  xMm: number,
  yMm: number,
): { surface: string; u: number; v: number } | null {
  const p = m.pages.find((x) => x.page === page);
  if (!p) return null;
  return {
    surface: p.surface,
    u: p.uRange[0] + (xMm - p.originMm[0]) * p.scale,
    v: (p.originMm[1] - yMm) * p.scale,
  };
}
