import {
  fitBounds,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from "../../../src/ui/plan/camera";

const vp = { width: 800, height: 600 };

test("Welt ↔ Bildschirm mit y nach oben", () => {
  const cam = { cx: 1000, cy: 2000, zoom: 0.1 };
  expect(worldToScreen(cam, vp, { x: 1000, y: 2000 })).toEqual({ x: 400, y: 300 });
  expect(worldToScreen(cam, vp, { x: 2000, y: 3000 })).toEqual({ x: 500, y: 200 });
  expect(screenToWorld(cam, vp, { x: 500, y: 200 })).toEqual({ x: 2000, y: 3000 });
});

test("Zoom um den Cursor hält den Weltpunkt fest", () => {
  const cam = { cx: 0, cy: 0, zoom: 0.1 };
  const s = { x: 650, y: 120 };
  const before = screenToWorld(cam, vp, s);
  const after = screenToWorld(zoomAt(cam, vp, s, 2), vp, s);
  expect(after.x).toBeCloseTo(before.x, 9);
  expect(after.y).toBeCloseTo(before.y, 9);
});

test("Pan und Einpassen", () => {
  const cam = panBy({ cx: 0, cy: 0, zoom: 0.5 }, { x: 100, y: 50 });
  expect(cam).toEqual({ cx: -200, cy: 100, zoom: 0.5 });
  const fit = fitBounds(vp, { x: 0, y: 0 }, { x: 8000, y: 6000 });
  expect(fit.cx).toBe(4000);
  expect(fit.zoom).toBeCloseTo(0.08, 9);
});
