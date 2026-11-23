/**
 * Leuchten als Lichtquellen in 3D (design.md M6 „Licht in 3D“): Lichtfarbe, Lichtstärke,
 * Lage und Richtung, Schalten je Leuchte, Begrenzung. Frei von React und three.js.
 */
import { deviceWorld } from "./devices";
import type { Device, Project } from "../model/types";

export type LightKind = "spot" | "point" | "area";

/** Höchstzahl gleichzeitig dargestellter Lichtquellen (Shader-Grenzen, Leistung). */
export const MAX_LIGHTS = 32;
/** Abstrahlwinkel eines Spots ohne Angabe. */
export const DEFAULT_BEAM_DEG = 36;
/** Abstand der Lichtquelle vor der Gerätevorderseite in mm. */
const FRONT_OFFSET_MM = 5;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Farbe eines Schwarzen Strahlers (Näherung nach Tanner Helland, 1000–40000 K), je Kanal 0…1
 * (sRGB).
 */
export function kelvinToRgb(kelvin: number): Rgb {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return { r: clamp01(r / 255), g: clamp01(g / 255), b: clamp01(b / 255) };
}

/** Farbe als „#rrggbb“. */
export function rgbHex({ r, g, b }: Rgb): string {
  const h = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Lichtstärke in cd: Spot Φ / (2π (1 − cos(θ/2))), Punkt Φ / (4π). */
export function luminousIntensity(
  kind: "spot" | "point",
  lumen: number,
  beamDeg = DEFAULT_BEAM_DEG,
) {
  if (kind === "point") return lumen / (4 * Math.PI);
  const half = (beamDeg * Math.PI) / 360;
  return lumen / (2 * Math.PI * (1 - Math.cos(half)));
}

/** Leuchtdichte einer Flächenleuchte in cd/m²: Φ / (π · A), A in m². */
export function areaLuminance(lumen: number, widthMm: number, heightMm: number) {
  return lumen / (Math.PI * ((widthMm * heightMm) / 1e6));
}

export interface SceneLight {
  deviceId: string;
  kind: LightKind;
  /** Welt-mm, z über Geländenull */
  position: { x: number; y: number; z: number };
  /** Einheitsvektor im Grundriss (x, y) mit z nach oben */
  direction: { x: number; y: number; z: number };
  color: Rgb;
  /** cd (Spot, Punkt) bzw. cd/m² (Fläche), physikalisch, ohne Belichtungsfaktor */
  intensity: number;
  /** halber Öffnungswinkel in Grad (Spot) */
  angleDeg?: number;
  widthMm?: number;
  heightMm?: number;
}

/** Ist das Gerät eine Leuchte, die als Lichtquelle dargestellt werden kann? */
export function isLight(project: Project, device: Device): boolean {
  return (
    device.placement.kind === "surface" &&
    !!project.catalog.deviceTypes.find((t) => t.id === device.typeId)?.light
  );
}

/** Lichtquelle einer Leuchte; null ohne Lichtangaben oder ohne Lage. */
export function lightOf(project: Project, device: Device): SceneLight | null {
  if (device.placement.kind !== "surface") return null;
  const type = project.catalog.deviceTypes.find((t) => t.id === device.typeId);
  const light = type?.light;
  if (!type || !light) return null;
  const w = deviceWorld(project, device);
  if (!w) return null;
  const elevation = project.storeys.find((s) => s.id === device.storeyId)?.elevationMm ?? 0;
  const front = type.shape3d.depthMm + FRONT_OFFSET_MM;
  const n = w.normal;
  const base = {
    deviceId: device.id,
    kind: light.kind,
    position: { x: w.x + n.x * front, y: w.y + n.y * front, z: w.z + elevation + n.z * front },
    direction: { x: n.x, y: n.y, z: n.z },
    color: kelvinToRgb(light.colorTempK),
  };
  if (light.kind === "area")
    return {
      ...base,
      intensity: areaLuminance(light.lumen, type.shape3d.widthMm, type.shape3d.heightMm),
      widthMm: type.shape3d.widthMm,
      heightMm: type.shape3d.heightMm,
    };
  const beam = light.beamAngleDeg ?? DEFAULT_BEAM_DEG;
  return {
    ...base,
    intensity: luminousIntensity(light.kind, light.lumen, beam),
    ...(light.kind === "spot" ? { angleDeg: beam / 2 } : {}),
  };
}

export interface SceneLights {
  lights: SceneLight[];
  /** eingeschaltete Leuchten insgesamt (vor der Begrenzung) */
  on: number;
}

/**
 * Dargestellte Lichtquellen: die eingeschalteten unter den gegebenen (sichtbaren) Geräten,
 * höchstens MAX_LIGHTS; zuerst die des obersten angezeigten Geschosses, dann nach Geräte-ID.
 */
export function sceneLights(
  project: Project,
  devices: readonly Device[],
  off: ReadonlySet<string>,
  topStoreyId: string | null,
): SceneLights {
  const candidates = devices
    .filter((d) => !off.has(d.id))
    .map((d) => lightOf(project, d))
    .filter((l): l is SceneLight => l !== null);
  const storeyOf = new Map(devices.map((d) => [d.id, d.storeyId]));
  candidates.sort((a, b) => {
    const ta = storeyOf.get(a.deviceId) === topStoreyId ? 0 : 1;
    const tb = storeyOf.get(b.deviceId) === topStoreyId ? 0 : 1;
    return ta - tb || (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0);
  });
  return { lights: candidates.slice(0, MAX_LIGHTS), on: candidates.length };
}

export interface LightGroup {
  circuitId: string | null;
  label: string;
  deviceIds: string[];
}

/**
 * Leuchten je Stromkreis für die Lichtleiste: Kreise nach Verteiler und Bezeichnung (numerisch),
 * am Ende „ohne Stromkreis“; Leuchten nach Bezeichnung.
 */
export function lightGroups(project: Project, devices: readonly Device[]): LightGroup[] {
  const lights = devices
    .filter((d) => isLight(project, d))
    .sort((a, b) => a.label.localeCompare(b.label, "de", { numeric: true }));
  const circuits = new Map(project.circuits.map((c) => [c.id, c]));
  const boards = new Map(project.boards.map((b) => [b.id, b]));
  const groups = new Map<string | null, LightGroup>();
  for (const d of lights) {
    const c = d.circuitId ? circuits.get(d.circuitId) : undefined;
    const key = c?.id ?? null;
    let g = groups.get(key);
    if (!g) {
      const board = c ? boards.get(c.boardId)?.label : undefined;
      g = {
        circuitId: key,
        label: c ? (board ? `${c.label} (${board})` : c.label) : "ohne Stromkreis",
        deviceIds: [],
      };
      groups.set(key, g);
    }
    g.deviceIds.push(d.id);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.circuitId === null) return 1;
    if (b.circuitId === null) return -1;
    return a.label.localeCompare(b.label, "de", { numeric: true });
  });
}

/** Schaltet eine Gruppe: sind alle an, gehen alle aus, sonst alle an. Liefert die neue Menge. */
export function toggleGroup(off: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(off);
  const allOn = ids.every((id) => !off.has(id));
  for (const id of ids) {
    if (allOn) next.add(id);
    else next.delete(id);
  }
  return next;
}
