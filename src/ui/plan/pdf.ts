/** Laden und Rendern von PDF-Seiten mit pdf.js (nur im Browser). */
import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjs: typeof import("pdfjs-dist") | null = null;

async function lib() {
  if (!pdfjs) {
    pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

const documents = new Map<string, Promise<PDFDocumentProxy>>();

/** Lädt eine PDF aus dem Projektordner (über /api/raw), zwischengespeichert je Pfad. */
export function loadPdf(path: string): Promise<PDFDocumentProxy> {
  let doc = documents.get(path);
  if (!doc) {
    doc = (async () => {
      const res = await fetch(`/api/raw/${path.split("/").map(encodeURIComponent).join("/")}`);
      if (!res.ok) throw new Error(`PDF nicht gefunden: ${path}`);
      const { getDocument } = await lib();
      return getDocument({ data: new Uint8Array(await res.arrayBuffer()) }).promise;
    })();
    documents.set(path, doc);
    doc.catch(() => documents.delete(path));
  }
  return doc;
}

export interface RenderedPage {
  /** Seitengröße in Punkten bei Maßstab 1, einschließlich Seitenrotation */
  width: number;
  height: number;
  /** Bild der Seite als Object-URL */
  url: string;
  scale: number;
}

/** Rendert eine Seite (ab 1) im Viewport getViewport({scale}) inkl. Seitenrotation. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas nicht verfügbar");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Seite konnte nicht gerendert werden");
  return { width: base.width, height: base.height, url: URL.createObjectURL(blob), scale };
}
