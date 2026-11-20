import { useEffect, useState } from "react";
import type { Underlay } from "../../model/types";
import { loadPdf, renderPage, type RenderedPage } from "./pdf";

export type UnderlayImage =
  | { status: "none" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; page: RenderedPage; numPages: number };

/** Renderschärfe in Stufen (Potenzen von 2) passend zu Pixeln je PDF-Punkt, begrenzt auf 4. */
export function renderScaleFor(pixelsPerPt: number): number {
  const wanted = pixelsPerPt * (globalThis.devicePixelRatio || 1);
  const step = 2 ** Math.ceil(Math.log2(Math.max(wanted, 0.25)));
  return Math.min(4, Math.max(0.5, step));
}

/** Lädt und rendert die Seite des Planhintergrunds; neu bei anderer Datei, Seite oder Renderstufe. */
export function useUnderlayImage(
  underlay: Underlay | undefined,
  renderScale: number,
): UnderlayImage {
  const file = underlay?.file;
  const pageNumber = underlay?.page;
  const [image, setImage] = useState<UnderlayImage>({ status: "none" });
  const [key, setKey] = useState("");
  // Bei anderer Renderstufe bleibt das bisherige Bild stehen, bis das neue fertig ist.
  const nextKey = file ? `${file}#${pageNumber}` : "";
  if (key !== nextKey) {
    setKey(nextKey);
    setImage(file ? { status: "loading" } : { status: "none" });
  }
  useEffect(() => {
    if (!file || !pageNumber) return;
    let cancelled = false;
    loadPdf(file)
      .then(async (doc) => {
        if (pageNumber > doc.numPages)
          throw new Error(`Seite ${pageNumber} fehlt (PDF hat ${doc.numPages} Seiten)`);
        const page = await renderPage(doc, pageNumber, renderScale);
        if (cancelled) {
          URL.revokeObjectURL(page.url);
          return;
        }
        setImage((previous) => {
          if (previous.status === "ready") revokeLater(previous.page.url);
          return { status: "ready", page, numPages: doc.numPages };
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setImage({ status: "error", message: (e as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [file, pageNumber, renderScale]);
  return image;
}

/** Gibt eine Object-URL frei, nachdem das Nachfolgebild gezeichnet wurde. */
function revokeLater(url: string): void {
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
