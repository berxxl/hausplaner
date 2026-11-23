/**
 * PDF aus Blättern (design.md M5 „Blattmodell“): je Blatt eine Seite im Blattformat, Inhalt als SVG
 * über svg2pdf.js (Vektor, durchsuchbarer Text). Einziges Modul mit jsPDF und svg2pdf.js; läuft nur
 * im Browser (svg2pdf.js misst Text mit getBBox).
 */
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import type { Sheet } from "./sheet";
import { sheetToSvg } from "./svg";

export interface PdfMetadata {
  /** wird in den XMP-Metadaten abgelegt (jsPDF verpackt es als <jspdf:metadata>) */
  text: string;
  namespace: string;
}

const orientationOf = (s: Sheet) => (s.widthMm > s.heightMm ? "landscape" : "portrait");
const formatOf = (s: Sheet): [number, number] => [
  Math.min(s.widthMm, s.heightMm),
  Math.max(s.widthMm, s.heightMm),
];

export async function sheetsToPdf(
  sheets: readonly Sheet[],
  opts: { title: string; metadata?: PdfMetadata; onProgress?(done: number, total: number): void },
): Promise<Blob> {
  if (sheets.length === 0) throw new Error("Keine Blätter ausgewählt");
  const first = sheets[0]!;
  const doc = new jsPDF({
    unit: "mm",
    format: formatOf(first),
    orientation: orientationOf(first),
    compress: false,
  });
  doc.setProperties({ title: opts.title, creator: "Hausplaner" });
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden";
  document.body.appendChild(host);
  try {
    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i]!;
      if (i > 0) doc.addPage(formatOf(s), orientationOf(s));
      const svg = new DOMParser().parseFromString(sheetToSvg(s), "image/svg+xml").documentElement;
      const el = document.importNode(svg, true);
      host.replaceChildren(el);
      await svg2pdf(el, doc, { x: 0, y: 0, width: s.widthMm, height: s.heightMm });
      opts.onProgress?.(i + 1, sheets.length);
    }
  } finally {
    host.remove();
  }
  if (opts.metadata) doc.addMetadata(opts.metadata.text, opts.metadata.namespace);
  return doc.output("blob");
}

export { downloadBlob } from "./download";
