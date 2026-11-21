import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useStore } from "zustand";
import { openingFootprint } from "../../geometry/openings";
import { pointInPolygon } from "../../geometry/polygon";
import { detectRoom } from "../../geometry/rooms";
import {
  calibrate,
  moveUnderlay,
  pdfToWorld,
  rotateUnderlay,
  underlayMatrix,
  underlayScale,
  worldToPdf,
} from "../../geometry/underlay";
import { moveEndpoint, type WallEditResult } from "../../geometry/wall-edit";
import {
  axisFromDrawn,
  chainCorner,
  snapPoint,
  wallBody,
  type DrawMode,
  type EndRef,
  type WallEnd,
} from "../../geometry/walls";
import { distance, projectOnSegment, sub, type Vec } from "../../geometry/vec";
import { allIds } from "../../model/factory";
import { newId } from "../../model/ids";
import { roundMm } from "../../model/rounding";
import type { Storey, Wall } from "../../model/types";
import {
  addOpening,
  addRoom,
  addSlope,
  addWall,
  applyWallEdit,
  deleteRoom,
  deleteWall,
  redetectRoom,
  wallGeoms,
  type WallJoin,
} from "../../store/building";
import { deleteOpening, setUnderlay } from "../../store/commands";
import type { ProjectStore } from "../../store/history";
import type { PlanTool, ViewStore } from "../../store/view";
import { MmField } from "../fields";
import { NumberPrompt } from "../NumberPrompt";
import {
  fitBounds,
  panBy,
  screenToWorld,
  worldToScreen,
  worldTransform,
  zoomAt,
  type Camera,
  type Viewport,
} from "./camera";
import { OpeningDialog, RoomNameDialog, SlopeDialog } from "./dialogs";
import {
  Grid,
  MeasureOverlay,
  OpenEndMarkers,
  OpeningsLayer,
  RoomLabels,
  RoomsLayer,
  WallsLayer,
} from "./layers";
import { renderScaleFor, useUnderlayImage } from "./useUnderlayImage";
import { PLAN_SYMBOL_MM, planPlacement, planSymbol } from "../../geometry/devices";
import { sideU, wallSides } from "../../geometry/surfaces";
import { surfaceKind } from "../../model/devices";
import type { Device, Furniture } from "../../model/types";
import { footprint, snapFurniture } from "../../geometry/furniture";
import {
  addFurniture,
  deleteFurniture,
  moveFurniture,
  rotateFurniture90,
} from "../../store/furniture";
import { warnedIds, warningsOf } from "../derived";
import { isDeviceVisible } from "../filter";
import { dependentDeviceCount } from "../../store/building";
import { addDevice, deleteDevices, moveDevice, placementStorey } from "../../store/devices";
import { DeviceTypePicker } from "../catalog/DeviceTypePicker";
import { DeviceGlyph } from "../DeviceGlyph";
import { useConfirm } from "../useConfirm";
import { isTextTarget } from "../shortcuts";
import { surfaceAt } from "./navigate";

const DRAW_TOOLS: { tool: PlanTool; label: string }[] = [
  { tool: "select", label: "Auswählen" },
  { tool: "measure", label: "Messen" },
  { tool: "wall", label: "Wand" },
  { tool: "room", label: "Raum" },
  { tool: "opening", label: "Öffnung" },
  { tool: "device", label: "Gerät" },
  { tool: "furniture", label: "Möbel" },
];

const PLAN_TOOLS: { tool: PlanTool; label: string }[] = [
  { tool: "calibrate", label: "Kalibrieren" },
  { tool: "move-underlay", label: "Plan verschieben" },
  { tool: "rotate-underlay", label: "Plan drehen" },
];

const HINTS: Record<PlanTool, string> = {
  select: "Klick wählt aus, Doppelklick öffnet die Wandansicht, Ziehen verschiebt die Ansicht.",
  measure: "Zwei Punkte anklicken.",
  wall: "Anfangspunkt anklicken; jeder weitere Klick setzt eine Wand. Esc beendet.",
  room: "In eine von Wänden umschlossene Fläche klicken.",
  opening: "Auf eine Wand klicken.",
  slope: "Zwei Punkte der Grundlinie anklicken (Ecken des Raums rasten ein).",
  "redetect-room": "In die Fläche klicken, die der Raum künftig einnehmen soll.",
  device: "Gerätetyp wählen und klicken; jeder Klick setzt ein Gerät. Esc beendet.",
  furniture:
    "Möbeltyp wählen und klicken; rastet an Wänden ein (Shift: frei). R dreht um 90°. Esc beendet.",
  calibrate: "Ersten Punkt einer bemaßten Strecke im Plan anklicken.",
  "move-underlay": "Plan mit der Maus an die richtige Stelle ziehen.",
  "rotate-underlay": "Drehpunkt im Plan anklicken.",
};

/** Fangradius: mindestens 20 mm, auf dem Bildschirm mindestens 10 Pixel. */
const snapRadius = (zoom: number) => Math.max(20, 10 / zoom);
const HANDLE_PX = 8;

type Drag =
  | { kind: "pan"; last: Vec }
  | { kind: "move-underlay"; startWorld: Vec }
  | { kind: "endpoint"; wallId: string; end: WallEnd; result: WallEditResult | null }
  | { kind: "device"; deviceId: string }
  | { kind: "furniture"; furnitureId: string; offset: Vec };

type Pending =
  | { kind: "distance"; p1: Vec; p2: Vec }
  | { kind: "angle"; pivot: Vec }
  | { kind: "room"; seed: Vec; polygon: Vec[] }
  | { kind: "opening"; wallId: string; centerMm: number }
  | { kind: "slope"; roomId: string; p1: Vec; p2: Vec };

function initialCamera(vp: Viewport, storey: Storey | undefined, walls: readonly Wall[]): Camera {
  const pts = walls.flatMap((w) => [w.start, w.end]);
  if (pts.length > 0) {
    const min = { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) };
    const max = { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) };
    return fitBounds(vp, min, max);
  }
  if (storey?.underlay) {
    const s = underlayScale(storey.underlay);
    return fitBounds(vp, { x: -100 * s, y: -800 * s }, { x: 1100 * s, y: 100 * s });
  }
  return fitBounds(vp, { x: 0, y: 0 }, { x: 10000, y: 8000 });
}

export interface PlanViewProps {
  store: ProjectStore;
  view: ViewStore;
}

/** Grundriss des aktiven Geschosses mit Planhintergrund, Bauteilen und Werkzeugen. */
export function PlanView({ store, view }: PlanViewProps) {
  const project = useStore(store, (s) => s.project);
  const activeStoreyId = useStore(view, (s) => s.activeStoreyId);
  const selection = useStore(view, (s) => s.selection);
  const deviceTypeId = useStore(view, (s) => s.deviceTypeId);
  const furnitureTypeId = useStore(view, (s) => s.furnitureTypeId);
  const hiddenTrades = useStore(view, (s) => s.hiddenTrades);
  const furnitureHidden = useStore(view, (s) => s.furnitureHidden);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const tool = useStore(view, (s) => s.planTool);
  const toolRoomId = useStore(view, (s) => s.toolRoomId);
  const lastThicknessMm = useStore(view, (s) => s.lastThicknessMm);
  const storey = project.storeys.find((s) => s.id === activeStoreyId);
  const walls = useMemo(
    () => project.walls.filter((w) => w.storeyId === activeStoreyId),
    [project.walls, activeStoreyId],
  );
  const geoms = useMemo(
    () => (activeStoreyId ? wallGeoms(project, activeStoreyId) : []),
    [project, activeStoreyId],
  );
  const storeyDevices = useMemo(
    () =>
      project.devices.filter(
        (d) =>
          d.storeyId === activeStoreyId &&
          isDeviceVisible(project, { hiddenTrades, furnitureHidden }, d),
      ),
    [project, activeStoreyId, hiddenTrades, furnitureHidden],
  );
  const deviceSymbols = useMemo(
    () =>
      storeyDevices
        .map((d) => ({ device: d, at: planSymbol(project, d) }))
        .filter((x): x is { device: Device; at: NonNullable<typeof x.at> } => x.at !== null),
    [project, storeyDevices],
  );
  const storeyFurniture = useMemo(
    () => (furnitureHidden ? [] : project.furniture.filter((f) => f.storeyId === activeStoreyId)),
    [project.furniture, activeStoreyId, furnitureHidden],
  );
  const warned = useMemo(() => warnedIds(project), [project]);
  const rooms = useMemo(
    () => project.rooms.filter((r) => r.storeyId === activeStoreyId),
    [project.rooms, activeStoreyId],
  );
  const openings = useMemo(
    () => project.openings.filter((o) => o.storeyId === activeStoreyId),
    [project.openings, activeStoreyId],
  );
  const invalidOpenings = useMemo(
    () =>
      new Set(
        warningsOf(project)
          .filter((w) => w.key.startsWith("opening-invalid:"))
          .map((w) => w.key.split(":")[1]!),
      ),
    [project],
  );
  const underlay = storey?.underlay;

  const container = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ width: 800, height: 600 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [cursor, setCursor] = useState<Vec | null>(null);
  const [wallStart, setWallStart] = useState<Vec | null>(null);
  /** Laufender Wandzug: vorige und erste Wand, um Ecken auf die Achsschnittpunkte zu legen. */
  const chain = useRef<{ prevId: string; firstId: string; firstClick: Vec } | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>("axis");
  const [wallKind, setWallKind] = useState<Wall["kind"]>("interior");
  const [wallHeight, setWallHeight] = useState<number | null>(null);
  const [measure, setMeasure] = useState<{ a: Vec; b: Vec | null } | null>(null);
  const [slopeP1, setSlopeP1] = useState<Vec | null>(null);
  const [calibrationP1, setCalibrationP1] = useState<Vec | null>(null);
  const [openEnds, setOpenEnds] = useState<EndRef[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
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

  // Kamera beim Geschosswechsel einpassen; laufende Werkzeugschritte verwerfen
  const [cameraFor, setCameraFor] = useState<string | null | undefined>(undefined);
  if (cameraFor !== activeStoreyId) {
    setCameraFor(activeStoreyId);
    setCamera(initialCamera(vp, storey, walls));
    setWallStart(null);
    setMeasure(null);
    setSlopeP1(null);
    setCalibrationP1(null);
    setOpenEnds([]);
  }
  const cam = camera ?? initialCamera(vp, storey, walls);
  const image = useUnderlayImage(
    underlay,
    renderScaleFor(underlay ? cam.zoom * underlayScale(underlay) : 1),
  );

  /** Kamera, die Wände und Planseite einpasst; null, wenn nichts da ist. */
  const cameraForAll = (): Camera | null => {
    const pts: Vec[] = walls.flatMap((w) => [w.start, w.end]);
    if (underlay && image.status === "ready") {
      const { width, height } = image.page;
      for (const c of [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: 0, y: height },
        { x: width, y: height },
      ])
        pts.push(pdfToWorld(underlay, c));
    }
    if (pts.length === 0) return null;
    return fitBounds(
      vp,
      { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) },
      { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) },
      0.02,
    );
  };

  // Neue PDF oder andere Seite: Ansicht einpassen, sonst liegt ein unkalibrierter Plan oft außerhalb
  const planKey = `${activeStoreyId}|${underlay ? `${underlay.file}#${underlay.page}` : ""}`;
  const [knownPlan, setKnownPlan] = useState(planKey);
  if (planKey !== knownPlan && (!underlay || image.status === "ready")) {
    setKnownPlan(planKey);
    // nur innerhalb desselben Geschosses; beim Geschosswechsel passt initialCamera ein
    const sameStorey = knownPlan.split("|")[0] === String(activeStoreyId);
    const fitted = underlay && sameStorey ? cameraForAll() : null;
    if (fitted) setCamera(fitted);
  }

  // Plan-Werkzeuge ohne Plan zurücksetzen
  useEffect(() => {
    if (!underlay && ["calibrate", "move-underlay", "rotate-underlay"].includes(tool))
      view.setPlanTool("select");
  }, [underlay, tool, view]);

  // Werkzeugwechsel verwirft angefangene Schritte
  const [toolFor, setToolFor] = useState(tool);
  if (toolFor !== tool) {
    setToolFor(tool);
    setWallStart(null);
    setMeasure(null);
    setSlopeP1(null);
    setCalibrationP1(null);
  }

  // Markierung offener Enden und Meldungen verschwinden beim nächsten Befehl
  useEffect(
    () => store.subscribe((s, prev) => s.revision !== prev.revision && setOpenEnds([])),
    [store],
  );
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setCamera((c) =>
        zoomAt(
          c ?? cam,
          vp,
          { x: e.clientX - r.left, y: e.clientY - r.top },
          Math.exp(-e.deltaY * 0.0015),
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [cam, vp]);

  /** Löschen der Auswahl; mitgelöschte Geräte werden vorher bestätigt (design.md M2). */
  const deleteSelection = async () => {
    const sel = view.getState().selection;
    if (!sel) return;
    if (sel.kind === "wall" || sel.kind === "room") {
      const n = dependentDeviceCount(project, sel.kind, sel.id);
      if (n > 0) {
        const ok = await confirm({
          title: sel.kind === "wall" ? "Wand löschen?" : "Raum löschen?",
          message: `${n} ${n === 1 ? "Gerät wird" : "Geräte werden"} mitgelöscht.`,
          confirmLabel: "Löschen",
        });
        if (!ok) return;
      }
    }
    if (sel.kind === "wall") store.execute(deleteWall(sel.id));
    else if (sel.kind === "room") store.execute(deleteRoom(sel.id));
    else if (sel.kind === "opening") store.execute(deleteOpening(sel.id));
    else if (sel.kind === "device") store.execute(deleteDevices(view.selectedDevices()));
    else if (sel.kind === "furniture") store.execute(deleteFurniture([sel.id]));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target) || pending) return;
      if (e.key === "Escape") {
        if (wallStart || measure || slopeP1 || calibrationP1) {
          setWallStart(null);
          setMeasure(null);
          setSlopeP1(null);
          setCalibrationP1(null);
        } else if (tool !== "select") view.setPlanTool("select");
        else view.select(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void deleteSelection();
      } else if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const sel = view.getState().selection;
        const f = sel?.kind === "furniture" && project.furniture.find((x) => x.id === sel.id);
        if (f) {
          e.preventDefault();
          store.execute(rotateFurniture90(f.id, f.rotationDeg));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toWorld = (e: { clientX: number; clientY: number }): Vec => {
    const r = container.current?.getBoundingClientRect();
    return screenToWorld(cam, vp, { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) });
  };

  const radius = snapRadius(cam.zoom);
  const snapForWall = (p: Vec) => snapPoint(p, geoms, radius, wallStart ?? undefined).point;

  const hitWall = (p: Vec) => geoms.find((w) => pointInPolygon(p, wallBody(geoms, w)));
  const hitOpening = (p: Vec) =>
    openings.find((o) => {
      const w = geoms.find((x) => x.id === o.wallId);
      return w && pointInPolygon(p, openingFootprint(w, o));
    });
  const hitDevice = (p: Vec) =>
    [...deviceSymbols]
      .reverse()
      .find(
        ({ at }) =>
          Math.abs(p.x - at.x) <= PLAN_SYMBOL_MM / 2 && Math.abs(p.y - at.y) <= PLAN_SYMBOL_MM / 2,
      )?.device;
  const hitFurniture = (p: Vec) =>
    [...storeyFurniture].reverse().find((f) => pointInPolygon(p, footprint(f)));
  const hitRoom = (p: Vec) =>
    rooms.find((r) => r.polygon.length >= 3 && pointInPolygon(p, r.polygon));
  const hitHandle = (p: Vec): { wallId: string; end: WallEnd } | null => {
    if (selection?.kind !== "wall") return null;
    const w = geoms.find((x) => x.id === selection.id);
    if (!w) return null;
    for (const end of ["start", "end"] as const)
      if (distance(p, w[end]) <= HANDLE_PX / cam.zoom) return { wallId: w.id, end };
    return null;
  };

  const snapSlopePoint = (p: Vec): Vec => {
    const room = rooms.find((r) => r.id === toolRoomId);
    if (!room) return p;
    let best: Vec | null = null;
    for (const q of room.polygon)
      if (distance(p, q) <= radius && (!best || distance(p, q) < distance(p, best))) best = q;
    if (best) return best;
    for (let i = 0; i < room.polygon.length; i++) {
      const a = room.polygon[i]!;
      const b = room.polygon[(i + 1) % room.polygon.length]!;
      const proj = projectOnSegment(p, a, b);
      if (proj.t >= 0 && proj.t <= 1 && proj.distance <= radius) return proj.point;
    }
    return p;
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const world = toWorld(e);
    setOpenEnds([]);
    const capture = () => e.currentTarget.setPointerCapture?.(e.pointerId);
    if (e.button === 1) {
      drag.current = { kind: "pan", last: { x: e.clientX, y: e.clientY } };
      capture();
      return;
    }
    switch (tool) {
      case "select": {
        const handle = hitHandle(world);
        if (handle && storey) {
          store.begin("Endpunkt verschieben");
          drag.current = { kind: "endpoint", ...handle, result: null };
          capture();
          return;
        }
        const device = hitDevice(world);
        if (device) {
          if (e.shiftKey) {
            const current = view.selectedDevices();
            const first = project.devices.find((d) => d.id === current[0]);
            const sameSurface =
              !first ||
              (first.placement.kind === "surface" &&
                device.placement.kind === "surface" &&
                first.placement.surface === device.placement.surface);
            if (sameSurface) view.toggleDevice(device.id);
            else setMessage("Mehrfachauswahl nur für Geräte derselben Fläche.");
            return;
          }
          view.select({ kind: "device", id: device.id });
          // Ziehen nur für freie Geräte und entlang der Wand (design.md M2 „Geräte platzieren“)
          const draggable =
            device.placement.kind === "free" || surfaceKind(device.placement.surface) === "wall";
          if (draggable) {
            store.begin("Gerät verschieben");
            drag.current = { kind: "device", deviceId: device.id };
            capture();
          }
          return;
        }
        const furniture = hitFurniture(world);
        if (furniture) {
          view.select({ kind: "furniture", id: furniture.id });
          store.begin("Möbel verschieben");
          drag.current = {
            kind: "furniture",
            furnitureId: furniture.id,
            offset: sub(world, { x: furniture.x, y: furniture.y }),
          };
          capture();
          return;
        }
        const opening = hitOpening(world);
        const wall = opening ? undefined : hitWall(world);
        const room = opening || wall ? undefined : hitRoom(world);
        if (opening) view.select({ kind: "opening", id: opening.id });
        else if (wall) view.select({ kind: "wall", id: wall.id });
        else if (room) view.select({ kind: "room", id: room.id });
        else view.select(null);
        drag.current = { kind: "pan", last: { x: e.clientX, y: e.clientY } };
        capture();
        return;
      }
      case "measure":
        setMeasure((m) => (!m || m.b ? { a: world, b: null } : { a: m.a, b: world }));
        return;
      case "device": {
        if (!storey) return;
        const type = project.catalog.deviceTypes.find((t) => t.id === deviceTypeId);
        if (!type) {
          setMessage("Zuerst einen Gerätetyp wählen.");
          return;
        }
        const r = planPlacement(project, storey.id, type, world);
        if (!r.ok) {
          setMessage(r.error);
          return;
        }
        const id = newId(new Set(allIds(project)));
        store.execute(
          addDevice({
            id,
            label: type.name,
            typeId: type.id,
            status: "planned",
            placement: r.placement,
            storeyId: placementStorey(project, r.placement, storey.id),
          }),
        );
        view.select({ kind: "device", id });
        return;
      }
      case "furniture": {
        if (!storey) return;
        const type = project.catalog.furnitureTypes.find((t) => t.id === furnitureTypeId);
        if (!type) {
          setMessage("Zuerst einen Möbeltyp wählen.");
          return;
        }
        const pose = {
          x: Math.round(world.x),
          y: Math.round(world.y),
          rotationDeg: 0,
          widthMm: type.widthMm,
          depthMm: type.depthMm,
        };
        const snapped = e.shiftKey ? null : snapFurniture(project, storey.id, pose);
        const id = newId(new Set(allIds(project)));
        const f: Furniture = {
          id,
          typeId: type.id,
          ...pose,
          ...snapped,
          heightMm: type.heightMm,
          elevationMm: type.elevationMm,
          storeyId: storey.id,
        };
        store.execute(addFurniture(f));
        view.select({ kind: "furniture", id });
        return;
      }
      case "wall": {
        if (!storey) return;
        // Startpunkt des Zugs hat Vorrang: im Kantenmodus läge sonst das versetzte Achsende der
        // ersten Wand im Fangradius, und der Zug würde nicht als geschlossen erkannt
        const first = chain.current?.firstClick;
        const p = first && distance(world, first) <= radius ? first : snapForWall(world);
        if (!wallStart) {
          chain.current = null;
          setWallStart(p);
          return;
        }
        const axis = axisFromDrawn(wallStart, p, lastThicknessMm, drawMode);
        const rounded = (v: Vec) => ({ x: roundMm(v.x), y: roundMm(v.y) });
        let start = rounded(axis.start);
        let end = rounded(axis.end);
        const joins: WallJoin[] = [];
        const c = chain.current;
        if (c) {
          // Ecke zur vorigen Wand und beim Schließen des Zugs zur ersten Wand auf den Achsschnittpunkt
          const prev = walls.find((w) => w.id === c.prevId);
          const corner =
            prev && chainCorner(prev, axis, wallStart, prev.thicknessMm + lastThicknessMm);
          if (prev && corner) {
            start = rounded(corner);
            joins.push({ id: prev.id, end: "end", point: start });
          }
          const firstWall = c.firstId !== c.prevId && walls.find((w) => w.id === c.firstId);
          const closing =
            firstWall &&
            distance(p, c.firstClick) < 1 &&
            chainCorner(axis, firstWall, p, firstWall.thicknessMm + lastThicknessMm);
          if (firstWall && closing) {
            end = rounded(closing);
            joins.push({ id: firstWall.id, end: "start", point: end });
          }
        }
        if (distance(start, end) >= 1) {
          const id = newId(new Set(allIds(project)));
          store.execute(
            addWall(
              {
                id,
                storeyId: storey.id,
                kind: wallKind,
                start,
                end,
                thicknessMm: lastThicknessMm,
                ...(wallHeight ? { rawHeightMm: wallHeight } : {}),
              },
              joins,
            ),
          );
          chain.current = {
            prevId: id,
            firstId: c?.firstId ?? id,
            firstClick: c?.firstClick ?? wallStart,
          };
        }
        setWallStart(p);
        return;
      }
      case "room": {
        const existing = hitRoom(world);
        if (existing) {
          view.select({ kind: "room", id: existing.id });
          return;
        }
        const d = detectRoom(geoms, world);
        if (d.status === "closed")
          setPending({
            kind: "room",
            seed: { x: roundMm(world.x), y: roundMm(world.y) },
            polygon: d.polygon,
          });
        else if (d.status === "open") {
          setOpenEnds(d.openEnds);
          setMessage("Raum nicht geschlossen: offene Wandenden sind markiert.");
        } else
          setMessage(
            d.status === "in-wall"
              ? "Der Punkt liegt in einer Wand."
              : "Keine Wände in diesem Geschoss.",
          );
        return;
      }
      case "redetect-room": {
        const room = rooms.find((r) => r.id === toolRoomId);
        if (!room) return;
        const d = detectRoom(geoms, world);
        if (d.status === "closed") {
          store.execute(
            redetectRoom(room.id, { x: roundMm(world.x), y: roundMm(world.y) }, d.polygon),
          );
          view.setPlanTool("select");
          view.select({ kind: "room", id: room.id });
        } else if (d.status === "open") {
          setOpenEnds(d.openEnds);
          setMessage("Fläche nicht geschlossen: offene Wandenden sind markiert.");
        } else setMessage("Der Punkt liegt in einer Wand.");
        return;
      }
      case "opening": {
        const wall = hitWall(world);
        if (!wall) {
          setMessage("Auf eine Wand klicken.");
          return;
        }
        const proj = projectOnSegment(world, wall.start, wall.end);
        setPending({
          kind: "opening",
          wallId: wall.id,
          centerMm: proj.t * distance(wall.start, wall.end),
        });
        return;
      }
      case "slope": {
        if (!toolRoomId) return;
        const p = snapSlopePoint(world);
        const q = { x: roundMm(p.x), y: roundMm(p.y) };
        if (!slopeP1) setSlopeP1(q);
        else if (distance(slopeP1, q) > 0) {
          setPending({ kind: "slope", roomId: toolRoomId, p1: slopeP1, p2: q });
          setSlopeP1(null);
        }
        return;
      }
      case "calibrate": {
        if (!underlay) return;
        const pdf = worldToPdf(underlay, world);
        if (!calibrationP1) setCalibrationP1(pdf);
        else {
          setPending({ kind: "distance", p1: calibrationP1, p2: pdf });
          setCalibrationP1(null);
        }
        return;
      }
      case "rotate-underlay":
        if (underlay) setPending({ kind: "angle", pivot: world });
        return;
      case "move-underlay":
        if (!underlay) return;
        store.begin("Plan verschieben");
        drag.current = { kind: "move-underlay", startWorld: world };
        capture();
        return;
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const world = toWorld(e);
    const d = drag.current;
    if (!d) {
      if (tool === "wall") setCursor(snapForWall(world));
      else if (tool === "measure" || tool === "slope")
        setCursor(tool === "slope" ? snapSlopePoint(world) : world);
      return;
    }
    if (d.kind === "pan") {
      const delta = { x: e.clientX - d.last.x, y: e.clientY - d.last.y };
      d.last = { x: e.clientX, y: e.clientY };
      setCamera((c) => panBy(c ?? cam, delta));
    } else if (d.kind === "move-underlay" && storey) {
      const base = store
        .getState()
        .transaction?.base.storeys.find((s) => s.id === storey.id)?.underlay;
      if (!base) return;
      const moved = moveUnderlay(base, sub(world, d.startWorld));
      store.preview((draft) => {
        const s = draft.storeys.find((x) => x.id === storey.id);
        if (s) s.underlay = moved;
      });
    } else if (d.kind === "device" && storey) {
      const base = store.getState().transaction?.base;
      const device = base?.devices.find((x) => x.id === d.deviceId);
      if (!base || !device) return;
      const p = device.placement;
      if (p.kind === "free") {
        store.preview((draft) => {
          const x = draft.devices.find((y) => y.id === d.deviceId);
          if (x?.placement.kind === "free") {
            x.placement.x = Math.round(world.x);
            x.placement.y = Math.round(world.y);
          }
        });
      } else {
        const side = wallSides(base, storey.id).find((sd) => sd.ref === p.surface);
        if (!side) return;
        const u = Math.round(Math.min(side.uMax, Math.max(side.uMin, sideU(side, world))));
        store.preview(moveDevice(d.deviceId, { ...p, u }).run);
      }
    } else if (d.kind === "furniture" && storey) {
      const base = store.getState().transaction?.base;
      const f = base?.furniture.find((x) => x.id === d.furnitureId);
      if (!base || !f) return;
      const c = sub(world, d.offset);
      const pose = { ...f, x: Math.round(c.x), y: Math.round(c.y) };
      // Shift beim Ziehen schaltet das Einrasten ab
      const snapped = e.shiftKey ? null : snapFurniture(base, storey.id, pose);
      store.preview(
        moveFurniture(d.furnitureId, {
          x: snapped?.x ?? pose.x,
          y: snapped?.y ?? pose.y,
          rotationDeg: snapped?.rotationDeg ?? pose.rotationDeg,
        }).run,
      );
    } else if (d.kind === "endpoint" && storey) {
      const base = store.getState().transaction?.base;
      if (!base) return;
      const baseGeoms = wallGeoms(base, storey.id);
      const self = baseGeoms.find((w) => w.id === d.wallId)!;
      const others = baseGeoms.filter((w) => w.id !== d.wallId);
      const fixed = d.end === "start" ? self.end : self.start;
      const target = snapPoint(world, others, radius, fixed).point;
      const result = moveEndpoint(baseGeoms, d.wallId, d.end, target);
      d.result = result;
      store.preview((draft) => applyWallEdit(storey.id, result, "").run(draft));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "move-underlay" || d?.kind === "device" || d?.kind === "furniture")
      store.commit();
    if (d?.kind === "endpoint") {
      store.commit();
      if (d.result && d.result.released.length > 0) setMessage("T-Anschluss gelöst.");
    }
  };

  const showAll = () => {
    const c = cameraForAll();
    if (c) setCamera(c);
  };

  const matrix = underlay ? underlayMatrix(underlay) : null;
  const selectedWall =
    selection?.kind === "wall" ? geoms.find((w) => w.id === selection.id) : undefined;
  const preview =
    tool === "wall" && wallStart && cursor
      ? axisFromDrawn(wallStart, cursor, lastThicknessMm, drawMode)
      : null;
  const hint =
    tool === "calibrate" && calibrationP1
      ? "Zweiten Punkt der Strecke anklicken."
      : tool === "slope" && slopeP1
        ? "Zweiten Punkt der Grundlinie anklicken."
        : HINTS[tool];

  const toolButton = (t: { tool: PlanTool; label: string }, disabled = false) => (
    <button
      key={t.tool}
      type="button"
      aria-pressed={tool === t.tool}
      disabled={disabled}
      onClick={() => view.setPlanTool(t.tool)}
    >
      {t.label}
    </button>
  );

  return (
    <div className="plan">
      <div role="toolbar" aria-label="Werkzeuge" className="plan__toolbar">
        {DRAW_TOOLS.map((t) => toolButton(t, !storey))}
        <span className="plan__sep" />
        {PLAN_TOOLS.map((t) => toolButton(t, !underlay))}
        <button type="button" onClick={showAll}>
          Alles zeigen
        </button>
      </div>
      {tool === "device" && (
        <div role="group" aria-label="Geräteoptionen" className="plan__options">
          <DeviceTypePicker
            types={project.catalog.deviceTypes}
            value={deviceTypeId}
            onChange={(id) => view.setDeviceType(id)}
          />
        </div>
      )}
      {tool === "furniture" && (
        <div role="group" aria-label="Möbeloptionen" className="plan__options">
          <label>
            Möbeltyp{" "}
            <select
              value={furnitureTypeId ?? ""}
              onChange={(e) => view.setFurnitureType(e.target.value || null)}
            >
              <option value="">– wählen –</option>
              {[...project.catalog.furnitureTypes]
                .sort((a, b) => a.name.localeCompare(b.name, "de"))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      {tool === "wall" && (
        <div role="group" aria-label="Wandoptionen" className="plan__options">
          <label>
            Modus{" "}
            <select value={drawMode} onChange={(e) => setDrawMode(e.target.value as DrawMode)}>
              <option value="axis">Achse</option>
              <option value="left">linke Kante</option>
              <option value="right">rechte Kante</option>
            </select>
          </label>
          <MmField
            label="Dicke"
            min={1}
            value={lastThicknessMm}
            onCommit={(v) => view.setLastThickness(v)}
          />
          <label>
            Art{" "}
            <select value={wallKind} onChange={(e) => setWallKind(e.target.value as Wall["kind"])}>
              <option value="interior">Innenwand</option>
              <option value="exterior">Außenwand</option>
            </select>
          </label>
          <MmField
            label="Höhe (leer = Geschoss)"
            min={1}
            value={wallHeight ?? 0}
            onCommit={(v) => setWallHeight(v > 0 ? v : null)}
          />
        </div>
      )}
      <div className="plan__status">
        <span role="status" aria-label="Werkzeughinweis">
          {hint}
          {image.status === "error" ? ` Plan: ${image.message}` : ""}
        </span>
        {message && (
          <span role="status" aria-label="Meldung" className="plan__message">
            {message}
          </span>
        )}
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
          onDoubleClick={(e) => {
            if (!storey || (tool !== "select" && tool !== "room")) return;
            const target = surfaceAt(project, storey.id, toWorld(e), Math.max(1000, 40 / cam.zoom));
            if (target) view.openSurface(target, storey.id);
          }}
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
            <Grid cam={cam} vp={vp} />
            <RoomsLayer rooms={rooms} selection={selection} />
            <WallsLayer walls={geoms} selection={selection} />
            <OpeningsLayer
              walls={geoms}
              openings={openings}
              selection={selection}
              invalid={invalidOpenings}
            />
            <g data-testid="plan-furniture">
              {storeyFurniture.map((f) => (
                <polygon
                  key={f.id}
                  data-furniture={f.id}
                  className={`furniture${selection?.kind === "furniture" && selection.id === f.id ? " furniture--selected" : ""}`}
                  points={footprint(f)
                    .map((q) => `${q.x},${q.y}`)
                    .join(" ")}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>
                    {project.catalog.furnitureTypes.find((t) => t.id === f.typeId)?.name ??
                      f.typeId}
                  </title>
                </polygon>
              ))}
            </g>
            <g data-testid="plan-devices">
              {deviceSymbols.map(({ device, at }) => (
                <DeviceGlyph
                  key={device.id}
                  device={device}
                  symbol={
                    project.catalog.deviceTypes.find((t) => t.id === device.typeId)?.symbol ?? ""
                  }
                  x={at.x}
                  y={at.y}
                  width={PLAN_SYMBOL_MM}
                  height={PLAN_SYMBOL_MM}
                  dashed={at.frame === "ceiling"}
                  warned={warned.has(device.id)}
                  selected={
                    !!(
                      selection?.kind === "device" &&
                      (selection.ids ?? [selection.id]).includes(device.id)
                    )
                  }
                />
              ))}
            </g>
            {preview && (
              <line
                className="wall-preview"
                data-testid="wall-preview"
                x1={preview.start.x}
                y1={preview.start.y}
                x2={preview.end.x}
                y2={preview.end.y}
                strokeWidth={lastThicknessMm}
              />
            )}
            {selectedWall &&
              (["start", "end"] as const).map((end) => (
                <circle
                  key={end}
                  className="handle"
                  data-testid={`handle-${end}`}
                  cx={selectedWall[end].x}
                  cy={selectedWall[end].y}
                  r={HANDLE_PX / cam.zoom}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {openEnds.length > 0 && (
              <OpenEndMarkers walls={geoms} ends={openEnds} zoom={cam.zoom} />
            )}
            {calibrationP1 && underlay && (
              <CalibrationMarker world={pdfToWorld(underlay, calibrationP1)} zoom={cam.zoom} />
            )}
            {slopeP1 && <CalibrationMarker world={slopeP1} zoom={cam.zoom} />}
          </g>
          <RoomLabels rooms={rooms} storey={storey} cam={cam} vp={vp} />
          {measure && (
            <MeasureOverlay
              a={measure.a}
              b={measure.b ?? (tool === "measure" ? cursor : null)}
              cam={cam}
              vp={vp}
            />
          )}
          {selectedWall && <WallLength wall={selectedWall} cam={cam} vp={vp} />}
        </svg>
      </div>
      {confirmDialog}
      {pending?.kind === "distance" && underlay && storey && (
        <NumberPrompt
          title="Kalibrieren"
          label="Realer Abstand der beiden Punkte"
          unit="mm"
          onCancel={() => setPending(null)}
          onSubmit={(mm) => {
            store.execute(
              setUnderlay(
                storey.id,
                calibrate(underlay, pending.p1, pending.p2, mm),
                "Kalibrieren",
              ),
            );
            setPending(null);
            view.setPlanTool("select");
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
            view.setPlanTool("select");
          }}
        />
      )}
      {pending?.kind === "room" && storey && (
        <RoomNameDialog
          onCancel={() => setPending(null)}
          onSubmit={(name) => {
            const id = newId(new Set(allIds(project)));
            store.execute(
              addRoom({
                id,
                storeyId: storey.id,
                name,
                seed: pending.seed,
                polygon: pending.polygon,
              }),
            );
            view.select({ kind: "room", id });
            setPending(null);
          }}
        />
      )}
      {pending?.kind === "opening" && storey && (
        <OpeningDialog
          centerMm={pending.centerMm}
          onCancel={() => setPending(null)}
          onSubmit={(values) => {
            const id = newId(new Set(allIds(project)));
            store.execute(
              addOpening({ id, storeyId: storey.id, wallId: pending.wallId, ...values }),
            );
            view.select({ kind: "opening", id });
            setPending(null);
          }}
        />
      )}
      {pending?.kind === "slope" && (
        <SlopeDialog
          onCancel={() => setPending(null)}
          onSubmit={(values) => {
            store.execute(
              addSlope(pending.roomId, {
                id: newId(new Set(allIds(project))),
                baseLine: [pending.p1, pending.p2],
                ...values,
              }),
            );
            view.setPlanTool("select");
            view.select({ kind: "room", id: pending.roomId });
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

function CalibrationMarker({ world, zoom }: { world: Vec; zoom: number }) {
  const r = 6 / zoom;
  return (
    <g className="marker" data-testid="calibration-p1">
      <line
        x1={world.x - r}
        y1={world.y}
        x2={world.x + r}
        y2={world.y}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={world.x}
        y1={world.y - r}
        x2={world.x}
        y2={world.y + r}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/** Länge der ausgewählten Wand an ihrer Mitte (Bemaßung in mm). */
function WallLength({
  wall,
  cam,
  vp,
}: {
  wall: { start: Vec; end: Vec };
  cam: Camera;
  vp: Viewport;
}) {
  const mid = worldToScreen(cam, vp, {
    x: (wall.start.x + wall.end.x) / 2,
    y: (wall.start.y + wall.end.y) / 2,
  });
  return (
    <text
      x={mid.x}
      y={mid.y - 10}
      textAnchor="middle"
      className="dimension"
      data-testid="wall-length"
    >
      {Math.round(distance(wall.start, wall.end))}
    </text>
  );
}
