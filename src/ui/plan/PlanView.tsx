import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useStore } from "zustand";
import {
  calibrate,
  moveUnderlay,
  pdfToWorld,
  rotateUnderlay,
  underlayMatrix,
  underlayScale,
  worldToPdf,
} from "../../geometry/underlay";
import { sub, type Vec } from "../../geometry/vec";
import type { Storey, Wall } from "../../model/types";
import { setUnderlay } from "../../store/commands";
import type { ProjectStore } from "../../store/history";
import type { ViewStore } from "../../store/view";
import { NumberPrompt } from "../NumberPrompt";
import {
  fitBounds,
  panBy,
  screenToWorld,
  worldTransform,
  zoomAt,
  type Camera,
  type Viewport,
} from "./camera";
import { renderScaleFor, useUnderlayImage } from "./useUnderlayImage";

export type PlanTool = "select" | "calibrate" | "move-underlay" | "rotate-underlay";

const TOOLS: { tool: PlanTool; label: string; needsUnderlay: boolean }[] = [
  { tool: "select", label: "Auswählen", needsUnderlay: false },
  { tool: "calibrate", label: "Kalibrieren", needsUnderlay: true },
  { tool: "move-underlay", label: "Plan verschieben", needsUnderlay: true },
  { tool: "rotate-underlay", label: "Plan drehen", needsUnderlay: true },
];

const HINTS: Record<PlanTool, string> = {
  select: "Ziehen verschiebt die Ansicht, Mausrad zoomt.",
  calibrate: "Ersten Punkt einer bemaßten Strecke im Plan anklicken.",
  "move-underlay": "Plan mit der Maus an die richtige Stelle ziehen.",
  "rotate-underlay": "Drehpunkt im Plan anklicken.",
};

type Drag = { kind: "pan"; last: Vec } | { kind: "move-underlay"; startWorld: Vec };

function wallPolygon(w: Wall): string {
  const dx = w.end.x - w.start.x;
  const dy = w.end.y - w.start.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w.thicknessMm / 2);
  const ny = (dx / len) * (w.thicknessMm / 2);
  return [
    [w.start.x + nx, w.start.y + ny],
    [w.end.x + nx, w.end.y + ny],
    [w.end.x - nx, w.end.y - ny],
    [w.start.x - nx, w.start.y - ny],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

function initialCamera(vp: Viewport, storey: Storey | undefined, walls: Wall[]): Camera {
  const pts = walls.flatMap((w) => [w.start, w.end]);
  if (pts.length > 0) {
    const min = { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) };
    const max = { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) };
    return fitBounds(vp, min, max);
  }
  if (storey?.underlay) {
    // A3 quer als Annahme, bis die Seitengröße bekannt ist
    const s = underlayScale(storey.underlay);
    return fitBounds(vp, { x: -100 * s, y: -800 * s }, { x: 1100 * s, y: 100 * s });
  }
  return fitBounds(vp, { x: 0, y: 0 }, { x: 10000, y: 8000 });
}

export interface PlanViewProps {
  store: ProjectStore;
  view: ViewStore;
}

/** Grundriss des aktiven Geschosses: Planhintergrund unter den Bauteilen, Zoom, Pan und Plan-Werkzeuge. */
export function PlanView({ store, view }: PlanViewProps) {
  const project = useStore(store, (s) => s.project);
  const activeStoreyId = useStore(view, (s) => s.activeStoreyId);
  const selection = useStore(view, (s) => s.selection);
  const storey = project.storeys.find((s) => s.id === activeStoreyId);
  const walls = project.walls.filter((w) => w.storeyId === activeStoreyId);
  const rooms = project.rooms.filter((r) => r.storeyId === activeStoreyId);
  const underlay = storey?.underlay;

  const container = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ width: 800, height: 600 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [tool, setTool] = useState<PlanTool>("select");
  const [calibrationP1, setCalibrationP1] = useState<Vec | null>(null);
  const [pending, setPending] = useState<
    { kind: "distance"; p1: Vec; p2: Vec } | { kind: "angle"; pivot: Vec } | null
  >(null);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setVp({ width: r.width, height: r.height });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Kamera beim Geschosswechsel einpassen
  const [cameraFor, setCameraFor] = useState<string | null | undefined>(undefined);
  if (cameraFor !== activeStoreyId) {
    setCameraFor(activeStoreyId);
    setCamera(initialCamera(vp, storey, walls));
  }
  const cam = camera ?? initialCamera(vp, storey, walls);

  const pixelsPerPt = underlay ? cam.zoom * underlayScale(underlay) : 1;
  const image = useUnderlayImage(underlay, renderScaleFor(pixelsPerPt));

  // Werkzeug zurücksetzen, wenn der Plan fehlt oder das Geschoss wechselt
  const [toolFor, setToolFor] = useState(activeStoreyId);
  if (toolFor !== activeStoreyId || (!underlay && tool !== "select")) {
    setToolFor(activeStoreyId);
    setTool("select");
    setCalibrationP1(null);
  }

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    // passive: false, damit die Seite beim Zoomen nicht scrollt
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      setCamera((c) =>
        zoomAt(c ?? cam, vp, { x: e.clientX - r.left, y: e.clientY - r.top }, factor),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [cam, vp]);

  const toWorld = (e: { clientX: number; clientY: number }): Vec => {
    const r = container.current?.getBoundingClientRect();
    return screenToWorld(cam, vp, { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) });
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const world = toWorld(e);
    if (e.button === 1 || tool === "select") {
      drag.current = { kind: "pan", last: { x: e.clientX, y: e.clientY } };
    } else if (tool === "move-underlay" && underlay && storey) {
      store.begin("Plan verschieben");
      drag.current = { kind: "move-underlay", startWorld: world };
    } else if (tool === "calibrate" && underlay) {
      const pdf = worldToPdf(underlay, world);
      if (!calibrationP1) setCalibrationP1(pdf);
      else {
        setPending({ kind: "distance", p1: calibrationP1, p2: pdf });
        setCalibrationP1(null);
      }
      return;
    } else if (tool === "rotate-underlay" && underlay) {
      setPending({ kind: "angle", pivot: world });
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      const delta = { x: e.clientX - d.last.x, y: e.clientY - d.last.y };
      d.last = { x: e.clientX, y: e.clientY };
      setCamera((c) => panBy(c ?? cam, delta));
    } else if (d.kind === "move-underlay" && storey) {
      const base = store
        .getState()
        .transaction?.base.storeys.find((s) => s.id === storey.id)?.underlay;
      if (!base) return;
      const moved = moveUnderlay(base, sub(toWorld(e), d.startWorld));
      store.preview((draft) => {
        const s = draft.storeys.find((x) => x.id === storey.id);
        if (s) s.underlay = moved;
      });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "move-underlay") store.commit();
  };

  /** Passt Wände und Planseite des Geschosses ein. */
  const showAll = () => {
    const pts: Vec[] = walls.flatMap((w) => [w.start, w.end]);
    if (underlay && image.status === "ready") {
      const { width, height } = image.page;
      for (const corner of [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: 0, y: height },
        { x: width, y: height },
      ])
        pts.push(pdfToWorld(underlay, corner));
    }
    if (pts.length === 0) return;
    setCamera(
      fitBounds(
        vp,
        { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) },
        { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) },
        0.02,
      ),
    );
  };

  const selectWall = (id: string) => {
    if (tool === "select") view.select({ kind: "wall", id });
  };

  const matrix = underlay ? underlayMatrix(underlay) : null;

  return (
    <div className="plan">
      <div role="toolbar" aria-label="Werkzeuge" className="plan__toolbar">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            type="button"
            aria-pressed={tool === t.tool}
            disabled={t.needsUnderlay && !underlay}
            onClick={() => {
              setTool(t.tool);
              setCalibrationP1(null);
            }}
          >
            {t.label}
          </button>
        ))}
        <button type="button" onClick={showAll}>
          Alles zeigen
        </button>
        <span className="plan__hint" role="status" aria-label="Werkzeughinweis">
          {tool === "calibrate" && calibrationP1
            ? "Zweiten Punkt der Strecke anklicken."
            : HINTS[tool]}
          {image.status === "error" ? ` Plan: ${image.message}` : ""}
        </span>
      </div>
      <div ref={container} className="plan__canvas">
        <svg
          role="img"
          aria-label="Grundriss"
          width={vp.width}
          height={vp.height}
          data-cx={cam.cx}
          data-cy={cam.cy}
          data-zoom={cam.zoom}
          className={`plan__svg plan__svg--${tool}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g transform={worldTransform(cam, vp)}>
            {underlay?.visible && matrix && image.status === "ready" && (
              <g transform={`matrix(${matrix.join(" ")})`} opacity={underlay.opacity}>
                <image
                  data-testid="underlay"
                  href={image.page.url}
                  x={0}
                  y={0}
                  width={image.page.width}
                  height={image.page.height}
                  preserveAspectRatio="none"
                />
              </g>
            )}
            {rooms.map((r) => (
              <polygon
                key={r.id}
                points={r.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                className={
                  selection?.kind === "room" && selection.id === r.id
                    ? "room room--selected"
                    : "room"
                }
              />
            ))}
            {walls.map((w) => (
              <polygon
                key={w.id}
                data-wall={w.id}
                points={wallPolygon(w)}
                className={
                  selection?.kind === "wall" && selection.id === w.id
                    ? "wall wall--selected"
                    : "wall"
                }
                vectorEffect="non-scaling-stroke"
                onPointerDown={() => selectWall(w.id)}
              />
            ))}
            {calibrationP1 && underlay && (
              <CalibrationMarker underlay={underlay} pdf={calibrationP1} zoom={cam.zoom} />
            )}
          </g>
        </svg>
      </div>
      {pending?.kind === "distance" && underlay && storey && (
        <NumberPrompt
          title="Kalibrieren"
          label="Realer Abstand der beiden Punkte"
          unit="mm"
          onCancel={() => setPending(null)}
          onSubmit={(distanceMm) => {
            store.execute(
              setUnderlay(
                storey.id,
                calibrate(underlay, pending.p1, pending.p2, distanceMm),
                "Kalibrieren",
              ),
            );
            setPending(null);
            setTool("select");
          }}
        />
      )}
      {pending?.kind === "angle" && underlay && storey && (
        <NumberPrompt
          title="Plan drehen"
          label="Drehwinkel (positiv gegen den Uhrzeigersinn)"
          unit="deg"
          onCancel={() => setPending(null)}
          onSubmit={(deg) => {
            store.execute(
              setUnderlay(storey.id, rotateUnderlay(underlay, pending.pivot, deg), "Plan drehen"),
            );
            setPending(null);
            setTool("select");
          }}
        />
      )}
    </div>
  );
}

function CalibrationMarker({
  underlay,
  pdf,
  zoom,
}: {
  underlay: Parameters<typeof underlayMatrix>[0];
  pdf: Vec;
  zoom: number;
}) {
  const m = underlayMatrix(underlay);
  const x = m[0] * pdf.x + m[2] * pdf.y + m[4];
  const y = m[1] * pdf.x + m[3] * pdf.y + m[5];
  const r = 6 / zoom;
  return (
    <g className="marker" data-testid="calibration-p1">
      <line x1={x - r} y1={y} x2={x + r} y2={y} vectorEffect="non-scaling-stroke" />
      <line x1={x} y1={y - r} x2={x} y2={y + r} vectorEffect="non-scaling-stroke" />
    </g>
  );
}
