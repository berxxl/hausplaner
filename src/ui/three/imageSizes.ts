/** Auflösungen für „Bild speichern …“ (design.md M6 „3D-Bild speichern“). */
export const IMAGE_SIZES = [
  { key: "1280x720", label: "1280 × 720", width: 1280, height: 720 },
  { key: "1920x1080", label: "1920 × 1080", width: 1920, height: 1080 },
  { key: "2560x1440", label: "2560 × 1440", width: 2560, height: 1440 },
  { key: "3840x2160", label: "3840 × 2160", width: 3840, height: 2160 },
  { key: "window", label: "wie Fenster", width: 0, height: 0 },
] as const;

export interface CaptureApi {
  /** Rendert die aktuelle Ansicht in dieser Größe als PNG */
  capture(width: number, height: number): Promise<Blob>;
  /** Größe der Zeichenfläche × Pixeldichte */
  windowSize(): { width: number; height: number };
}
