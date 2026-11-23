/**
 * 3D-Bild als PNG (design.md M6 „3D-Bild speichern“): Rendern in Zielgröße innerhalb des Canvas,
 * Menü „Bild speichern …“ in der Werkzeugleiste.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { IMAGE_SIZES, type CaptureApi } from "./imageSizes";
import * as THREE from "three";

/** Registriert die Aufnahmefunktion; muss innerhalb des Canvas stehen. */
export function CaptureHook({ register }: { register(api: CaptureApi | null): void }) {
  const { gl, scene, camera, invalidate } = useThree();
  useEffect(() => {
    const windowSize = () => {
      const size = gl.getSize(new THREE.Vector2());
      const ratio = gl.getPixelRatio();
      return { width: Math.round(size.x * ratio), height: Math.round(size.y * ratio) };
    };
    const capture = async (width: number, height: number) => {
      const max = gl.capabilities.maxTextureSize;
      const limit = Math.min(
        max,
        (gl.getContext().getParameter(gl.getContext().MAX_RENDERBUFFER_SIZE) as number) ?? max,
      );
      if (width > limit || height > limit)
        throw new Error(`Auflösung zu groß für diesen Browser (höchstens ${limit} px)`);
      const cam = camera as THREE.PerspectiveCamera;
      const size = gl.getSize(new THREE.Vector2());
      const ratio = gl.getPixelRatio();
      const aspect = cam.aspect;
      let url: string;
      try {
        gl.setPixelRatio(1);
        gl.setSize(width, height, false);
        cam.aspect = width / height;
        cam.updateProjectionMatrix();
        gl.render(scene, cam);
        url = gl.domElement.toDataURL("image/png");
      } finally {
        gl.setPixelRatio(ratio);
        gl.setSize(size.x, size.y, false);
        cam.aspect = aspect;
        cam.updateProjectionMatrix();
        invalidate();
      }
      return (await fetch(url)).blob();
    };
    register({ capture, windowSize });
    return () => register(null);
  }, [gl, scene, camera, invalidate, register]);
  return null;
}

/** Menü „Bild speichern …“ (außerhalb des Canvas). */
export function ImageMenu({
  onSave,
}: {
  onSave(size: (typeof IMAGE_SIZES)[number]): Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string>("1920x1080");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="image-menu">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Bild speichern …
      </button>
      {open && (
        <span className="image-menu__body" role="group" aria-label="Bild speichern">
          <label>
            Auflösung{" "}
            <select value={key} onChange={(e) => setKey(e.target.value)}>
              {IMAGE_SIZES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSave(IMAGE_SIZES.find((s) => s.key === key)!);
                setOpen(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Speichern
          </button>
          {error && (
            <span role="alert" className="error">
              {error}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
