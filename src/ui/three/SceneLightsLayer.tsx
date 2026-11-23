/**
 * Lichtquellen der Leuchten in three.js (design.md M6 „Licht in 3D“): SpotLight, PointLight,
 * RectAreaLight aus dem reinen Modell `sceneLights`.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { SceneLight } from "../../geometry/lighting";

/**
 * Belichtungsfaktor für die physikalischen Lichtstärken (cd, cd/m²). Ohne Faktor brennt ein
 * 450-lm-Spot (≈ 1460 cd) auf 2,5 m Abstand mit rund 240 lx völlig aus; mit 0,05 ergibt die
 * Spotreihe in Wohnen (Fixture m6) einen deutlich hellen, nicht ausgebrannten Kegel (2026-11-23
 * per Bild eingestellt, design.md M6). Ein Wert für alle Leuchten, damit Lichtstrom und Abstand vergleichbar bleiben.
 */
export const LIGHT_EXPOSURE = 0.05;
/** Schattenkarte je Lichtquelle in px. */
const SHADOW_MAP_PX = 512;

const M = 0.001;
const toThree = (p: { x: number; y: number; z: number }) =>
  new THREE.Vector3(p.x * M, p.z * M, -p.y * M);
const dirToThree = (d: { x: number; y: number; z: number }) =>
  new THREE.Vector3(d.x, d.z, -d.y).normalize();

let areaInit = false;

function makeLight(l: SceneLight, shadows: boolean): THREE.Light {
  const color = new THREE.Color().setRGB(l.color.r, l.color.g, l.color.b, THREE.SRGBColorSpace);
  const pos = toThree(l.position);
  const dir = dirToThree(l.direction);
  if (l.kind === "spot") {
    const s = new THREE.SpotLight(
      color,
      l.intensity * LIGHT_EXPOSURE,
      0,
      ((l.angleDeg ?? 18) * Math.PI) / 180,
      0.3,
      2,
    );
    s.position.copy(pos);
    s.target.position.copy(pos.clone().add(dir));
    s.castShadow = shadows;
    s.shadow.mapSize.set(SHADOW_MAP_PX, SHADOW_MAP_PX);
    s.shadow.camera.near = 0.05;
    return s;
  }
  if (l.kind === "point") {
    const p = new THREE.PointLight(color, l.intensity * LIGHT_EXPOSURE, 0, 2);
    p.position.copy(pos);
    p.castShadow = shadows;
    p.shadow.mapSize.set(SHADOW_MAP_PX, SHADOW_MAP_PX);
    p.shadow.camera.near = 0.05;
    return p;
  }
  if (!areaInit) {
    RectAreaLightUniformsLib.init();
    areaInit = true;
  }
  const a = new THREE.RectAreaLight(
    color,
    l.intensity * LIGHT_EXPOSURE,
    (l.widthMm ?? 300) * M,
    (l.heightMm ?? 300) * M,
  );
  a.position.copy(pos);
  a.lookAt(pos.clone().add(dir));
  return a;
}

export function SceneLightsLayer({
  lights,
  shadows,
}: {
  lights: readonly SceneLight[];
  shadows: boolean;
}) {
  // neue three-Lichter nur, wenn sich Lage, Farbe, Stärke oder Schatten ändern (sonst Shader neu)
  const key = JSON.stringify([lights, shadows]);
  const objects = useMemo(() => {
    const [ls, sh] = JSON.parse(key) as [SceneLight[], boolean];
    return ls.map((l) => makeLight(l, sh));
  }, [key]);
  useEffect(() => () => objects.forEach((o) => o.dispose()), [objects]);
  return (
    <>
      {objects.map((o) => (
        <group key={o.uuid}>
          <primitive object={o} />
          {o instanceof THREE.SpotLight && <primitive object={o.target} />}
        </group>
      ))}
    </>
  );
}
