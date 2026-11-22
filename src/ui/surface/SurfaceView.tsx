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
import { frontRect, viewPlacement, wallDeviceBuildup } from "../../geometry/devices";
import { allIds } from "../../model/factory";
import { newId } from "../../model/ids";
import type { Device, DevicePlacement } from "../../model/types";
import { addDevice, deleteDevices, placementStorey } from "../../store/devices";
import type { SurfaceTool } from "../../store/view";
import { DeviceTypePicker } from "../catalog/DeviceTypePicker";
import { DeviceGlyph } from "../DeviceGlyph";
import { isTextTarget } from "../shortcuts";
import { useConfirm } from "../useConfirm";
import { cascadeMessage } from "../labels";
import { dependentCableCount } from "../../store/routes";
import { feedFor, viewZones } from "../../geometry/zones";
import { sectionSilhouettes } from "../../geometry/furniture";
import { warnedIds } from "../derived";
import { isDeviceVisible } from "../filter";

type Tool = SurfaceTool;
type SurfacePlacement = Extract<DevicePlacement, { kind: "surface" }>;

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
  const deviceTypeId = useStore(view, (s) => s.deviceTypeId);
  const showZones = useStore(view, (s) => s.showZones);
  const showFeeds = useStore(view, (s) => s.showFeeds);
  const hiddenTrades = useStore(view, (s) => s.hiddenTrades);
  const furnitureHidden = useStore(view, (s) => s.furnitureHidden);
  const [message, setMessage] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const model = useMemo(() => (target ? surfaceModel(project, target) : null), [project, target]);

  const hasModel = model !== null;
  const container = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ width: 800, height: 600 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [measure, setMeasure] = useState<{ a: Vec; b: Vec | null } | null>(null);
  const [cursor, setCursor] = useState<Vec | null>(null);
  const drag = useRef<
    | { kind: "pan"; last: Vec }
    | { kind: "device"; id: string; start: Vec; base: SurfacePlacement }
    | null
  >(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);
  // Entf löscht ausgewählte Geräte auch in der Flächenansicht
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return;
      const ids = view.selectedDevices();
      if ((e.key === "Delete" || e.key === "Backspace") && ids.length > 0) {
        e.preventDefault();
        void (async () => {
          const msg = cascadeMessage(0, dependentCableCount(store.getState().project, ids));
          if (
            msg &&
            !(await confirm({ title: "Gerät löschen?", message: msg, confirmLabel: "Löschen" }))
          )
            return;
          store.execute(deleteDevices(ids));
        })();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, view, confirm]);

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
  // Geräte dieser Fläche; ganze Wandseite zeigt Rohbauhöhen (v + Fußbodenaufbau)
  const shownDevices = project.devices.flatMap((device) => {
    const p = device.placement;
    if (p.kind !== "surface" || p.surface !== model.ref) return [];
    if (!isDeviceVisible(project, { hiddenTrades, furnitureHidden }, device)) return [];
    if (model.uRange && (p.u < model.uRange[0] || p.u > model.uRange[1])) return [];
    const type = project.catalog.deviceTypes.find((t) => t.id === device.typeId);
    const dv = model.kind === "wall-side" ? wallDeviceBuildup(project, device) : 0;
    const r = frontRect(device, type)!;
    return [
      {
        device,
        symbol: type?.symbol ?? "",
        rect: { uMin: r.uMin, uMax: r.uMax, vMin: r.vMin + dv, vMax: r.vMax + dv },
      },
    ];
  });
  // Möbel vor dieser Raumansicht als halbtransparente Silhouette (design.md M2 „Möbel“)
  const silhouettes =
    model.roomView && !furnitureHidden ? sectionSilhouettes(project, model.roomView) : [];
  const warned = warnedIds(project);
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

  const hitDevice = (p: Vec) =>
    [...shownDevices].reverse().find(({ rect }) => {
      return p.x >= rect.uMin && p.x <= rect.uMax && p.y >= rect.vMin && p.y <= rect.vMax;
    })?.device;

  const placeDevice = (world: Vec) => {
    const type = project.catalog.deviceTypes.find((t) => t.id === deviceTypeId);
    if (!type) return setMessage("Zuerst einen Gerätetyp wählen.");
    const r = viewPlacement(type, model.ref, world.x, world.y);
    if (!r.ok) return setMessage(r.error);
    let placement = r.placement;
    // Ganze Wandseite zeigt Rohbauhöhen: ohne Standardhöhe auf OKFF des Abschnitts umrechnen
    if (model.kind === "wall-side" && placement.kind === "surface" && !type.defaultHeightMm) {
      const probe = { placement, storeyId: model.storeyId } as Device;
      placement = { ...placement, v: placement.v - wallDeviceBuildup(project, probe) };
    }
    const id = newId(new Set(allIds(project)));
    store.execute(
      addDevice({
        id,
        label: type.name,
        typeId: type.id,
        status: "planned",
        placement,
        storeyId: placementStorey(project, placement, model.storeyId),
      }),
    );
    view.select({ kind: "device", id });
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const world = toWorld(e);
    if (tool === "measure") {
      const p = snap(world);
      setMeasure((m) => (!m || m.b ? { a: p, b: null } : { a: m.a, b: p }));
      return;
    }
    if (tool === "device") return placeDevice(world);
    const device = hitDevice(world);
    if (device && device.placement.kind === "surface") {
      if (e.shiftKey) return view.toggleDevice(device.id);
      view.select({ kind: "device", id: device.id });
      store.begin("Gerät verschieben");
      drag.current = { kind: "device", id: device.id, start: world, base: device.placement };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    const sil = [...silhouettes]
      .reverse()
      .find(
        (x) => world.x >= x.uFrom && world.x <= x.uTo && world.y >= x.vFrom && world.y <= x.vTo,
      );
    const o = sil ? undefined : hitOpening(world);
    if (sil) view.select({ kind: "furniture", id: sil.furnitureId });
    else if (o) view.select({ kind: "opening", id: o.id });
    drag.current = { kind: "pan", last: { x: e.clientX, y: e.clientY } };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "measure") setCursor(snap(toWorld(e)));
    const d = drag.current;
    if (!d) return;
    if (d.kind === "device") {
      const w = toWorld(e);
      const u = Math.round(d.base.u + w.x - d.start.x);
      const v = Math.round(d.base.v + w.y - d.start.y);
      store.preview((draft) => {
        const x = draft.devices.find((y) => y.id === d.id);
        if (x?.placement.kind === "surface") {
          x.placement.u = u;
          x.placement.v = v;
        }
      });
      return;
    }
    const delta = { x: e.clientX - d.last.x, y: e.clientY - d.last.y };
    d.last = { x: e.clientX, y: e.clientY };
    setCamera((c) => panBy(c ?? cam, delta));
  };
  const onPointerUp = () => {
    if (drag.current?.kind === "device") store.commit();
    drag.current = null;
  };

  const s = (u: number, v: number) => worldToScreen(cam, vp, { x: u, y: v });
  const contourBottom = Math.min(...model.contour.map((p) => p.v));
  const contourLeft = Math.min(...model.contour.map((p) => p.u));
  const contourRight = Math.max(...model.contour.map((p) => p.u));
  const selectedOpening =
    selection?.kind === "opening" ? model.openings.find((o) => o.id === selection.id) : undefined;
  // Installationszonen und Zuführungen nur in Raumansichten einer Wandseite
  const installZones = project.settings.installZones;
  const zones = model.roomView ? viewZones(model.roomView, installZones) : null;
  const roomView = model.roomView;
  const feeds =
    roomView && zones && showFeeds
      ? shownDevices.flatMap(({ device }) => {
          const p = device.placement;
          if (p.kind !== "surface") return [];
          const f = feedFor(roomView, installZones, p.u, p.v, zones);
          return f ? [{ id: device.id, ...f }] : [];
        })
      : [];
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
          <button type="button" aria-pressed={tool === "device"} onClick={() => setTool("device")}>
            Gerät
          </button>
          {model.roomView && (
            <>
              <button
                type="button"
                aria-pressed={showZones}
                onClick={() => view.setShowZones(!showZones)}
              >
                Zonen
              </button>
              <button
                type="button"
                aria-pressed={showFeeds}
                onClick={() => view.setShowFeeds(!showFeeds)}
              >
                Zuführungen
              </button>
            </>
          )}
          {tool === "device" && (
            <DeviceTypePicker
              types={project.catalog.deviceTypes}
              value={deviceTypeId}
              onChange={(id) => view.setDeviceType(id)}
            />
          )}
        </div>
        {message && (
          <span role="status" aria-label="Meldung" className="plan__message">
            {message}
          </span>
        )}
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
          className={`plan__svg plan__svg--${tool === "select" ? "select" : "measure"}`}
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
            {silhouettes.length > 0 && (
              <g data-testid="surface-furniture">
                {silhouettes.map((x) => (
                  <rect
                    key={x.furnitureId}
                    data-furniture={x.furnitureId}
                    className={`surface__silhouette${selection?.kind === "furniture" && selection.id === x.furnitureId ? " surface__silhouette--selected" : ""}`}
                    x={x.uFrom}
                    y={x.vFrom}
                    width={x.uTo - x.uFrom}
                    height={x.vTo - x.vFrom}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            )}
            {zones && showZones && (
              <g className="surface__zones" data-testid="install-zones">
                <polygon data-zone="top" points={zones.top.map((p) => `${p.u},${p.v}`).join(" ")} />
                <rect
                  data-zone="bottom"
                  x={zones.bottom.uFrom}
                  y={zones.bottom.vFrom}
                  width={zones.bottom.uTo - zones.bottom.uFrom}
                  height={zones.bottom.vTo - zones.bottom.vFrom}
                />
                {zones.vertical.map((z) => (
                  <polygon
                    key={`${z.edge}:${z.openingId ?? ""}`}
                    data-zone={z.edge}
                    points={z.polygon.map((p) => `${p.u},${p.v}`).join(" ")}
                  />
                ))}
              </g>
            )}
            <g data-testid="surface-devices">
              {shownDevices.map(({ device, symbol, rect }) => (
                <DeviceGlyph
                  key={device.id}
                  device={device}
                  symbol={symbol}
                  x={(rect.uMin + rect.uMax) / 2}
                  y={(rect.vMin + rect.vMax) / 2}
                  width={rect.uMax - rect.uMin}
                  height={rect.vMax - rect.vMin}
                  warned={warned.has(device.id)}
                  selected={
                    selection?.kind === "device" &&
                    (selection.ids ?? [selection.id]).includes(device.id)
                  }
                />
              ))}
            </g>
            {feeds.length > 0 && (
              <g className="surface__feeds" data-testid="device-feeds">
                {feeds.map((f) => (
                  <line
                    key={f.id}
                    data-feed={f.id}
                    data-from={f.from}
                    className={`surface__feed${f.inZone ? "" : " surface__feed--outside"}`}
                    x1={f.u}
                    y1={f.vFrom}
                    x2={f.u}
                    y2={f.vTo}
                    vectorEffect="non-scaling-stroke"
                  >
                    {!f.inZone && <title>Zuführung außerhalb der Zonen</title>}
                  </line>
                ))}
              </g>
            )}
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
      {confirmDialog}
    </div>
  );
}
