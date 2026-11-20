/** Rundung auf Speichergenauigkeit. Wird beim Setzen eines Werts angewandt, nicht erst beim Schreiben. */

function clean(v: number): number {
  return Object.is(v, -0) ? 0 : v;
}

function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return clean(Math.round(v * f) / f);
}

/** Längen und Koordinaten: ganze Millimeter. */
export const roundMm = (v: number): number => roundTo(v, 0);
/** Winkel: 0,1°. */
export const roundDeg = (v: number): number => roundTo(v, 1);
/** PDF-Koordinaten: 0,1 Punkt. */
export const roundPt = (v: number): number => roundTo(v, 1);
/** Anteile wie Deckkraft: zwei Nachkommastellen. */
export const roundFraction = (v: number): number => roundTo(v, 2);
