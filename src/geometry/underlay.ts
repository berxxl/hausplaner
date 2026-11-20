/**
 * Transformation des Planhintergrunds (design.md „PDF-Hintergrund“):
 * welt = offset + R(rotationDeg) · s · F · (pdf − p1), s = distanceMm / |p2 − p1|, F = diag(1, −1).
 * PDF-Koordinaten: Punkte im Viewport getViewport({scale: 1}), Ursprung oben links, y nach unten.
 */
import { roundDeg, roundMm, roundPt } from "../model/rounding";
import type { Underlay } from "../model/types";
import { add, distance, rotate, sub, type Vec } from "./vec";

/** Maßstab unkalibrierter Pläne: 1:100, 1 pt = 25,4/72 mm Papier. */
export const UNCALIBRATED_MM_PER_PT = (25.4 / 72) * 100;

type Placement = Pick<Underlay, "calibration" | "offset" | "rotationDeg">;

/** mm Welt je PDF-Punkt. */
export function underlayScale(u: Placement): number {
  if (!u.calibration) return UNCALIBRATED_MM_PER_PT;
  const d = distance(u.calibration.p1, u.calibration.p2);
  return d > 0 ? u.calibration.distanceMm / d : UNCALIBRATED_MM_PER_PT;
}

function p1Of(u: Placement): Vec {
  return u.calibration?.p1 ?? { x: 0, y: 0 };
}

export function pdfToWorld(u: Placement, pdf: Vec): Vec {
  const s = underlayScale(u);
  const d = sub(pdf, p1Of(u));
  return add(u.offset, rotate({ x: s * d.x, y: -s * d.y }, u.rotationDeg));
}

export function worldToPdf(u: Placement, world: Vec): Vec {
  const s = underlayScale(u);
  const local = rotate(sub(world, u.offset), -u.rotationDeg);
  const p1 = p1Of(u);
  return { x: p1.x + local.x / s, y: p1.y - local.y / s };
}

/**
 * Affine Matrix [a, b, c, d, e, f] (SVG-Reihenfolge) für PDF → Welt: x' = a·x + c·y + e, y' = b·x + d·y + f.
 */
export function underlayMatrix(u: Placement): [number, number, number, number, number, number] {
  const o = pdfToWorld(u, { x: 0, y: 0 });
  const ex = sub(pdfToWorld(u, { x: 1, y: 0 }), o);
  const ey = sub(pdfToWorld(u, { x: 0, y: 1 }), o);
  return [ex.x, ex.y, ey.x, ey.y, o.x, o.y];
}

const roundPdf = (p: Vec): Vec => ({ x: roundPt(p.x), y: roundPt(p.y) });
const roundWorld = (p: Vec): Vec => ({ x: roundMm(p.x), y: roundMm(p.y) });

/**
 * Kalibrierung über zwei PDF-Punkte und ihren realen Abstand. Erste Kalibrierung: p1 wird Weltursprung,
 * Drehung 0. Neu kalibrieren: Weltposition des neuen p1 unter der alten Transformation wird offset, Drehung bleibt.
 */
export function calibrate(u: Underlay, p1: Vec, p2: Vec, distanceMm: number): Underlay {
  const calibration = { p1: roundPdf(p1), p2: roundPdf(p2), distanceMm: roundMm(distanceMm) };
  if (!u.calibration) {
    return { ...u, calibration, offset: { x: 0, y: 0 }, rotationDeg: 0 };
  }
  return { ...u, calibration, offset: roundWorld(pdfToWorld(u, calibration.p1)) };
}

/** Verschieben um einen Weltvektor. */
export function moveUnderlay(u: Underlay, delta: Vec): Underlay {
  return { ...u, offset: roundWorld(add(u.offset, delta)) };
}

/** Drehen um einen gewählten Weltpunkt q um Δ (gegen den Uhrzeigersinn positiv). */
export function rotateUnderlay(u: Underlay, q: Vec, deltaDeg: number): Underlay {
  return {
    ...u,
    rotationDeg: roundDeg(u.rotationDeg + deltaDeg),
    offset: roundWorld(add(q, rotate(sub(u.offset, q), deltaDeg))),
  };
}

/** Neue PDF für ein Geschoss: Seite 1, unkalibriert, Standarddarstellung. */
export function newUnderlay(file: string): Underlay {
  return { file, page: 1, offset: { x: 0, y: 0 }, rotationDeg: 0, opacity: 0.5, visible: true };
}
