import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useStore } from "zustand";
import { distance, type Vec } from "../../geometry/vec";
import { OPENING_LABELS } from "../../geometry/openings";
import { formatLength } from "../../model/units";
import type { ProjectStore } from "../../store/history";
import type { ViewStore } from "../../store/view";
import {
  fitBounds,
  panBy,
  screenToWorld,
  worldToScreen,
  worldTransform,
  zoomAt,
  type Camera,
  type Viewport,
} from "../plan/camera";
import { snapPoints, surfaceModel, type SurfaceModel } from "./model";

type Tool = "select" | "measure";

const pt = (p: { u: number; v: number }): Vec => ({ x: p.u, y: p.v });

function fit(vp: Viewport, model: SurfaceModel): Camera {
  const xs = model.contour.map((p) => p.u);
  const ys = model.contour.map((p) => p.v);
  return fitBounds(
    vp,
    { x: Math.min(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.max(...ys) },
    0.12,
  );
}

/** Flächenansicht: Wandansicht eines Raums, ganze Wandseite, Deckenspiegel, Boden oder Schräge in wahrer Größe. */
export function SurfaceView({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const target = useStore(view, (s) => s.surface);
  const selection = useStore(view, (s) => s.selection);
  const model = useMemo(() => (target ? surfaceModel(project, target) : null), [project, target]);

  const hasModel = model !== null;
  const container = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ width: 800, height: 600 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [measure, setMeasure] = useState<{ a: Vec; b: Vec | null } | null>(null);
  const [cursor, setCursor] = useState<Vec | null>(null);
  const drag = useRef<{ last: Vec } | null>(null);

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
  }, [hasModel]);

  const targetKey = JSON.stringify(target);
  const [cameraFor, setCameraFor] = useState<string>("");
  if (model && cameraFor !== targetKey) {
    setCameraFor(targetKey);
    setCamera(fit(vp, model));
    setMeasure(null);
  }
  const cam = camera ?? (model ? fit(vp, model) : { cx: 0, cy: 0, zoom: 0.1 });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setCamera(
        (c) =>
          c &&
          zoomAt(
            c,
            vp,
            { x: e.clientX - r.left, y: e.clientY - r.top },
            Math.exp(-e.deltaY * 0.0015),
          ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [vp]);

  if (!target || !model) {
    return (
      <p className="placeholder">
        Eine Fläche im Strukturbaum wählen oder im Grundriss neben eine Wand doppelklicken.
      </p>
    );
  }

  const toWorld = (e: { clientX: number; clientY: number }): Vec => {
    const r = container.current?.getBoundingClientRect();
    return screenToWorld(cam, vp, { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) });
  };
  const snap = (p: Vec): Vec => {
    let best: Vec | null = null;
    for (const q of snapPoints(model).map(pt))
      if (distance(p, q) * cam.zoom <= 10 && (!best || distance(p, q) < distance(p, best)))
        best = q;
    return best ?? p;
  };
  const hitOpening = (p: Vec) =>
    model.openings.find(
      (o) => p.x >= o.raw.uFrom && p.x <= o.raw.uTo && p.y >= o.raw.vFrom && p.y <= o.raw.vTo,
    );

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const world = toWorld(e);
    if (tool === "measure") {
      const p = snap(world);
      setMeasure((m) => (!m || m.b ? { a: p, b: null } : { a: m.a, b: p }));
      return;
    }
    const o = hitOpening(world);
    if (o) view.select({ kind: "opening", id: o.id });
    drag.current = { last: { x: e.clientX, y: e.clientY } };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "measure") setCursor(snap(toWorld(e)));
    const d = drag.current;
    if (!d) return;
    const delta = { x: e.clientX - d.last.x, y: e.clientY - d.last.y };
    d.last = { x: e.clientX, y: e.clientY };
    setCamera((c) => panBy(c ?? cam, delta));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const s = (u: number, v: number) => worldToScreen(cam, vp, { x: u, y: v });
  const contourBottom = Math.min(...model.contour.map((p) => p.v));
  const contourLeft = Math.min(...model.contour.map((p) => p.u));
  const contourRight = Math.max(...model.contour.map((p) => p.u));
  const selectedOpening =
    selection?.kind === "opening" ? model.openings.find((o) => o.id === selection.id) : undefined;
  const measureB = measure ? (measure.b ?? (tool === "measure" ? cursor : null)) : null;

  return (
    <div className="surface">
      <div className="surface__head">
        <h2 aria-label="Fläche">{model.title}</h2>
        <nav aria-label="Navigation" className="surface__nav">
          {model.nav.map((n) => (
            <button
              key={n.rel}
              type="button"
              aria-label={
                n.rel === "left"
                  ? `Nächste Wand links: ${n.label.slice(2)}`
                  : n.rel === "right"
                    ? `Nächste Wand rechts: ${n.label.slice(0, -2)}`
                    : n.label
              }
              onClick={() => view.openSurface(n.target)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div role="toolbar" aria-label="Werkzeuge der Fläche">
          <button type="button" aria-pressed={tool === "select"} onClick={() => setTool("select")}>
            Auswählen
          </button>
          <button
            type="button"
            aria-pressed={tool === "measure"}
            onClick={() => setTool("measure")}
          >
            Messen
          </button>
        </div>
        <span className="hint">
          {model.finished
            ? "Fertige Maße über OKFF"
            : model.kind === "wall-side"
              ? "Rohbau ab Oberkante Rohfußboden"
              : "Wahre Größe"}
        </span>
      </div>
      <div ref={container} className="surface__canvas">
        <svg
          role="img"
          aria-label="Flächenansicht"
          width={vp.width}
          height={vp.height}
          data-cx={cam.cx}
          data-cy={cam.cy}
          data-zoom={cam.zoom}
          className={`plan__svg plan__svg--${tool === "measure" ? "measure" : "select"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g transform={worldTransform(cam, vp)}>
            <polygon
              className="surface__contour"
              data-testid="surface-contour"
              points={model.contour.map((p) => `${p.u},${p.v}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
            {model.openings.map((o) => (
              <g
                key={o.id}
                data-opening={o.id}
                className={`surface__opening${selectedOpening?.id === o.id ? " surface__opening--selected" : ""}`}
              >
                <rect
                  x={o.uFrom}
                  y={o.vFrom}
                  width={Math.max(0, o.uTo - o.uFrom)}
                  height={Math.max(0, o.vTo - o.vFrom)}
                  vectorEffect="non-scaling-stroke"
                />
                {o.shutter && (
                  <rect
                    data-testid={`shutter-${o.shutter.position}`}
                    className="surface__shutter"
                    x={o.shutter.uFrom}
                    y={o.shutter.vFrom}
                    width={o.shutter.uTo - o.shutter.uFrom}
                    height={o.shutter.vTo - o.shutter.vFrom}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            ))}
          </g>
          {/* Bemaßung in fertigen Maßen (Raumansicht) bzw. Rohbau */}
          {model.widthMm !== undefined && (
            <text
              className="dimension"
              data-testid="dim-width"
              x={(s(contourLeft, 0).x + s(contourRight, 0).x) / 2}
              y={s(0, contourBottom).y + 18}
              textAnchor="middle"
            >
              {Math.round(model.widthMm)}
            </text>
          )}
          {model.openings.map((o) => {
            const top = s((o.uFrom + o.uTo) / 2, o.vTo);
            const right = s(o.uTo, (o.vFrom + o.vTo) / 2);
            return (
              <g key={o.id} className="dimension-group" data-testid={`dims-${o.id}`}>
                <text
                  className="dimension"
                  x={top.x}
                  y={top.y - 6}
                  textAnchor="middle"
                  data-dim="width"
                >
                  {Math.round(o.uTo - o.uFrom)}
                </text>
                <text className="dimension" x={right.x + 6} y={s(0, o.vFrom).y} data-dim="sill">
                  {Math.round(o.vFrom)}
                </text>
                <text className="dimension" x={right.x + 6} y={s(0, o.vTo).y + 10} data-dim="head">
                  {Math.round(o.vTo)}
                </text>
              </g>
            );
          })}
          {model.labels.map((l) => {
            const p = s(l.at.u, l.at.v);
            return (
              <text
                key={`${l.text}@${l.at.u},${l.at.v}`}
                role="button"
                tabIndex={0}
                aria-label={`Kante ${l.text}`}
                className="surface__label"
                x={p.x}
                y={p.y}
                textAnchor="middle"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => view.openSurface(l.target)}
                onKeyDown={(e) => e.key === "Enter" && view.openSurface(l.target)}
              >
                {l.text}
              </text>
            );
          })}
          {measure && (
            <g className="measure">
              {measureB && (
                <>
                  <line
                    x1={s(measure.a.x, measure.a.y).x}
                    y1={s(measure.a.x, measure.a.y).y}
                    x2={s(measureB.x, measureB.y).x}
                    y2={s(measureB.x, measureB.y).y}
                  />
                  <text
                    data-testid="measure-label"
                    x={(s(measure.a.x, measure.a.y).x + s(measureB.x, measureB.y).x) / 2}
                    y={(s(measure.a.x, measure.a.y).y + s(measureB.x, measureB.y).y) / 2 - 8}
                    textAnchor="middle"
                  >
                    {formatLength(distance(measure.a, measureB))}
                  </text>
                </>
              )}
              <circle cx={s(measure.a.x, measure.a.y).x} cy={s(measure.a.x, measure.a.y).y} r={3} />
            </g>
          )}
        </svg>
      </div>
      {selectedOpening && (
        <p role="note" aria-label="Rohbaumaß" className="surface__raw">
          {OPENING_LABELS[selectedOpening.kind]}: Rohbau {selectedOpening.raw.widthMm} ×{" "}
          {selectedOpening.raw.heightMm} mm, Brüstung {selectedOpening.raw.sillMm} mm über
          Rohfußboden
        </p>
      )}
    </div>
  );
}
