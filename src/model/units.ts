/**
 * Anzeige und Eingabe von Maßen (design.md „Oberfläche“, Zahlenformat). Frei von React.
 * Anzeige: mm ohne Tausendertrenner; m und m² mit zwei Nachkommastellen und Dezimalkomma; Winkel mit einer Nachkommastelle.
 */
import { roundDeg, roundMm } from "./rounding";

const comma = (s: string) => s.replace(".", ",");

/** Zwei Nachkommastellen, kaufmännisch gerundet ohne Gleitkommafehler von toFixed (1,005 → 1,01). */
function twoDecimals(hundredths: number): string {
  const v = Math.round(hundredths);
  return comma((Object.is(v, -0) ? 0 : v / 100).toFixed(2));
}

/** „4260“ */
export function formatMm(mm: number): string {
  return String(roundMm(mm));
}

/** „4,26 m“ */
export function formatM(mm: number): string {
  return `${twoDecimals(mm / 10)} m`;
}

/** „4260 mm (4,26 m)“ für die Eigenschaften */
export function formatLength(mm: number): string {
  return `${formatMm(mm)} mm (${formatM(mm)})`;
}

/** Fläche aus mm²: „12,50 m²“ */
export function formatArea(mm2: number): string {
  return `${twoDecimals(mm2 / 1e4)} m²`;
}

/** „1,5°“ */
export function formatDeg(deg: number): string {
  return `${comma(roundDeg(deg).toFixed(1))}°`;
}

const NUMBER = /^([+-]?\d+(?:[.,]\d*)?|[+-]?[.,]\d+)$/;

function parseDecimal(text: string): number | null {
  const t = text.trim();
  if (!NUMBER.test(t)) return null;
  const v = Number(t.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

/**
 * Eingabe in einem Millimeterfeld: Dezimalwerte werden auf ganze mm gerundet,
 * „m“ wird umgerechnet („4,26 m“ → 4260), „mm“ ist erlaubt. Ungültig → null.
 */
export function parseMm(input: string): number | null {
  const t = input.trim().toLowerCase();
  const m = /^(.*?)\s*(mm|m)?$/.exec(t);
  if (!m) return null;
  const value = parseDecimal(m[1] ?? "");
  if (value === null) return null;
  return roundMm(m[2] === "m" ? value * 1000 : value);
}

/** Winkeleingabe mit Komma oder Punkt, optional „°“; gerundet auf 0,1°. Ungültig → null. */
export function parseDeg(input: string): number | null {
  const value = parseDecimal(input.trim().replace(/\s*°$/, ""));
  return value === null ? null : roundDeg(value);
}

/** Dezimalzahl mit Komma oder Punkt, gerundet auf `decimals` Nachkommastellen; sonst null. */
export function parseRounded(text: string, decimals: number): number | null {
  const v = parseDecimal(text);
  if (v === null) return null;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
