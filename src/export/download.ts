/** Download im Browser, ohne PDF-Bibliotheken (M5, ab M6 auch für 3D-Bilder). */

/** Datei herunterladen (Safari-tauglich: Link im Dokument, URL erst später freigeben). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
