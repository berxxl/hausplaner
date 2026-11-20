/** Kamera des Grundrisses: Weltmittelpunkt und Zoom (Pixel je mm). Frei von React. */
import type { Vec } from "../../geometry/vec";

export interface Camera {
  cx: number;
  cy: number;
  /** Pixel je mm */
  zoom: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.002; // 1 px = 500 mm
export const MAX_ZOOM = 5; // 1 mm = 5 px

export function worldToScreen(cam: Camera, vp: Viewport, p: Vec): Vec {
  return {
    x: (p.x - cam.cx) * cam.zoom + vp.width / 2,
    y: vp.height / 2 - (p.y - cam.cy) * cam.zoom,
  };
}

export function screenToWorld(cam: Camera, vp: Viewport, s: Vec): Vec {
  return {
    x: (s.x - vp.width / 2) / cam.zoom + cam.cx,
    y: (vp.height / 2 - s.y) / cam.zoom + cam.cy,
  };
}

/** Zoomt um einen Bildschirmpunkt, der dabei an derselben Weltposition bleibt. */
export function zoomAt(cam: Camera, vp: Viewport, s: Vec, factor: number): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
  const before = screenToWorld(cam, vp, s);
  const next = { ...cam, zoom };
  const after = screenToWorld(next, vp, s);
  return { cx: cam.cx + before.x - after.x, cy: cam.cy + before.y - after.y, zoom };
}

/** Verschiebt die Ansicht um einen Bildschirmvektor. */
export function panBy(cam: Camera, d: Vec): Camera {
  return { ...cam, cx: cam.cx - d.x / cam.zoom, cy: cam.cy + d.y / cam.zoom };
}

/** Kamera, die ein Weltrechteck mit Rand einpasst. */
export function fitBounds(vp: Viewport, min: Vec, max: Vec, margin = 0.1): Camera {
  const w = Math.max(max.x - min.x, 1000);
  const h = Math.max(max.y - min.y, 1000);
  const zoom = Math.min(vp.width / w, vp.height / h) * (1 - 2 * margin);
  return {
    cx: (min.x + max.x) / 2,
    cy: (min.y + max.y) / 2,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
  };
}

/** SVG-Transformation der Weltgruppe (y nach oben). */
export function worldTransform(cam: Camera, vp: Viewport): string {
  return `translate(${vp.width / 2} ${vp.height / 2}) scale(${cam.zoom} ${-cam.zoom}) translate(${-cam.cx} ${-cam.cy})`;
}
