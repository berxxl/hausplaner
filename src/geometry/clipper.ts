/** Dünne Hülle um clipper-lib (Ganzzahlkoordinaten in 1/100 mm). */
import * as ClipperLib from "clipper-lib";
import type { Vec } from "./vec";

export const SCALE = 100;

export type Path = ClipperLib.IntPoint[];

export const toPath = (poly: readonly Vec[]): Path =>
  poly.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));
export const fromPath = (path: Path): Vec[] =>
  path.map((p) => ({ x: p.X / SCALE, y: p.Y / SCALE }));

export function union(polys: readonly Vec[][]): Path[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(polys.map(toPath), ClipperLib.PolyType.ptSubject, true);
  const out: Path[] = [];
  c.Execute(
    ClipperLib.ClipType.ctUnion,
    out,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return out;
}

/** Versatz mit Miter-Join; positiv = nach außen. */
export function offset(paths: Path[], deltaMm: number): Path[] {
  const o = new ClipperLib.ClipperOffset(4, 0.25);
  o.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const out: Path[] = [];
  o.Execute(out, deltaMm * SCALE);
  return out;
}

export interface Region {
  outer: Vec[];
  holes: Vec[][];
}

/** rect − solid als Regionen (Außenkontur mit Löchern), verschachtelte Inseln eingeschlossen. */
export function difference(rect: readonly Vec[], solid: Path[]): Region[] {
  const c = new ClipperLib.Clipper();
  c.AddPath(toPath(rect), ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(solid, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(
    ClipperLib.ClipType.ctDifference,
    tree,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  const regions: Region[] = [];
  const visit = (node: ClipperLib.PolyNode) => {
    for (const outer of node.Childs()) {
      regions.push({
        outer: fromPath(outer.Contour()),
        holes: outer.Childs().map((h) => fromPath(h.Contour())),
      });
      for (const hole of outer.Childs()) visit(hole);
    }
  };
  visit(tree);
  return regions;
}
