/**
 * Installationszonen und senkrechte Zuführung je Raumansicht einer Wandseite (design.md M2
 * „Installationszonen“). Alle Werte in fertigen Maßen der Raumansicht: u wie die Wandseite, v über OKFF.
 * Frei von React.
 */
import type { InstallZones } from "../model/types";
import type { RoomView } from "./surfaces";

export interface UV {
  u: number;
  v: number;
}

/** Senkrechte Zone neben einer fertigen Raumecke oder Laibung, über die ganze Höhe zwischen OKFF und Decke. */
export interface VerticalZone {
  /** Kante, an der die Zone liegt */
  edge: "corner-left" | "corner-right" | "reveal-left" | "reveal-right";
  /** Öffnung bei Laibungen */
  openingId?: string;
  uFrom: number;
  uTo: number;
  /** Umriss: unten OKFF, oben die fertige Deckenkontur */
  polygon: UV[];
}

export interface ViewZones {
  /** Obere waagerechte Zone als Band unter der fertigen Deckenkontur */
  top: UV[];
  /** Untere waagerechte Zone über OKFF */
  bottom: { uFrom: number; uTo: number; vFrom: number; vTo: number };
  vertical: VerticalZone[];
}

/** Fertige Decke über OKFF an u (lineare Interpolation der Knickfolge, außerhalb konstant fortgesetzt). */
export function topAt(view: Pick<RoomView, "top">, u: number): number {
  const t = view.top;
  if (t.length === 0) return 0;
  if (u <= t[0]!.u) return t[0]!.v;
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i]!;
    const b = t[i + 1]!;
    if (u <= b.u) return b.u === a.u ? b.v : a.v + ((b.v - a.v) * (u - a.u)) / (b.u - a.u);
  }
  return t[t.length - 1]!.v;
}

/** Knickfolge der Decke zwischen u1 und u2 (inklusive der Endpunkte). */
function topBetween(view: Pick<RoomView, "top">, u1: number, u2: number): UV[] {
  const inner = view.top.filter((p) => p.u > u1 && p.u < u2);
  return [{ u: u1, v: topAt(view, u1) }, ...inner, { u: u2, v: topAt(view, u2) }];
}

const ZONE_OPENINGS = new Set(["door", "window"]);

/** Zonen einer Raumansicht aus den Projekteinstellungen. */
export function viewZones(
  view: Pick<RoomView, "finished" | "top" | "openings">,
  zones: InstallZones,
): ViewZones {
  const { uFrom, uTo } = view.finished;
  const [ta, tb] = zones.horizontalTop;
  const [ba, bb] = zones.horizontalBottom;
  const [va, vb] = zones.verticalFromEdge;
  const contour = topBetween(view, uFrom, uTo);
  const top = [
    ...contour.map((p) => ({ u: p.u, v: Math.max(0, p.v - ta) })),
    ...[...contour].reverse().map((p) => ({ u: p.u, v: Math.max(0, p.v - tb) })),
  ];
  const vertical: VerticalZone[] = [];
  const push = (edge: VerticalZone["edge"], u1: number, u2: number, openingId?: string) => {
    const a = Math.max(uFrom, u1);
    const b = Math.min(uTo, u2);
    if (b - a <= 0) return;
    vertical.push({
      edge,
      ...(openingId ? { openingId } : {}),
      uFrom: a,
      uTo: b,
      polygon: [{ u: a, v: 0 }, { u: b, v: 0 }, ...topBetween(view, a, b).reverse()],
    });
  };
  push("corner-left", uFrom + va, uFrom + vb);
  push("corner-right", uTo - vb, uTo - va);
  for (const o of view.openings) {
    if (!ZONE_OPENINGS.has(o.kind)) continue;
    push("reveal-left", o.uFrom - vb, o.uFrom - va, o.id);
    push("reveal-right", o.uTo + va, o.uTo + vb, o.id);
  }
  return { top, bottom: { uFrom, uTo, vFrom: ba, vTo: bb }, vertical };
}

/** Senkrechte Zuführung eines Wandgeräts: Linie von der Gerätemitte zur Zone. */
export interface Feed {
  u: number;
  vFrom: number;
  vTo: number;
  /** Zone, aus der zugeführt wird */
  from: "top" | "bottom";
  /** Linie liegt vollständig in einer senkrechten Zone */
  inZone: boolean;
}

/** Zuführung zu einem Gerät mit Mitte (u, v); null, wenn die Mitte in einer waagerechten Zone liegt. */
export function feedFor(
  view: Pick<RoomView, "finished" | "top" | "openings">,
  zones: InstallZones,
  u: number,
  v: number,
  computed: ViewZones = viewZones(view, zones),
): Feed | null {
  const [ba, bb] = zones.horizontalBottom;
  const [ta, tb] = zones.horizontalTop;
  const ceiling = topAt(view, u);
  const topLow = ceiling - tb;
  const topHigh = ceiling - ta;
  if (v >= ba && v <= bb) return null;
  if (v >= topLow && v <= topHigh) return null;
  const inZone = computed.vertical.some((z) => u >= z.uFrom && u <= z.uTo);
  // DIN 18015-3: unterhalb der unteren Zone von unten, sonst von oben
  if (v < ba) return { u, vFrom: v, vTo: ba, from: "bottom", inZone };
  if (v < topLow) return { u, vFrom: v, vTo: topLow, from: "top", inZone };
  return { u, vFrom: topHigh, vTo: v, from: "top", inZone };
}
