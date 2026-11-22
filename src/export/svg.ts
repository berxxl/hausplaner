/** Blatt → SVG-Text für svg2pdf.js und die Vorschau (design.md M5 „Blattmodell“). Frei von React. */
import { COLOR, type Item, type Sheet } from "./sheet";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const n = (v: number) => String(Math.round(v * 1000) / 1000);

function style(
  i: { width?: number; color?: string; dash?: number[] },
  stroke: string | null | undefined,
) {
  if (stroke === null) return ` stroke="none"`;
  const parts = [
    ` stroke="${esc(stroke ?? i.color ?? COLOR.text)}"`,
    ` stroke-width="${n(i.width ?? 0.25)}"`,
  ];
  if (i.dash && i.dash.length > 0) parts.push(` stroke-dasharray="${i.dash.map(n).join(" ")}"`);
  return parts.join("");
}

function itemSvg(i: Item): string {
  const data = i.data ? ` data-item="${esc(i.data)}"` : "";
  switch (i.kind) {
    case "line":
      return `<line x1="${n(i.x1)}" y1="${n(i.y1)}" x2="${n(i.x2)}" y2="${n(i.y2)}"${style(i, undefined)} stroke-linecap="butt"${data}/>`;
    case "poly": {
      const pts = i.points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
      const tag = i.closed ? "polygon" : "polyline";
      return `<${tag} points="${pts}" fill="${esc(i.fill ?? "none")}"${style(i, i.stroke)} stroke-linejoin="miter"${data}/>`;
    }
    case "circle":
      return `<circle cx="${n(i.cx)}" cy="${n(i.cy)}" r="${n(i.r)}" fill="${esc(i.fill ?? "none")}"${style(i, i.stroke)}${data}/>`;
    case "text": {
      const rot = i.rotate ? ` transform="rotate(${n(i.rotate)} ${n(i.x)} ${n(i.y)})"` : "";
      const anchor = i.anchor && i.anchor !== "start" ? ` text-anchor="${i.anchor}"` : "";
      const weight = i.bold ? ` font-weight="bold"` : "";
      return `<text x="${n(i.x)}" y="${n(i.y)}" font-size="${n(i.size)}" font-family="Helvetica" fill="${esc(i.color ?? COLOR.text)}"${anchor}${weight}${rot}${data}>${esc(i.text)}</text>`;
    }
    case "symbol": {
      const k = i.size / 100;
      const rot = i.rotate ? ` rotate(${n(i.rotate)} 50 50)` : "";
      // Katalogsymbole zeichnen mit currentColor; svg2pdf.js bekommt die Farbe ausgeschrieben
      const body = i.svg.replace(/currentColor/g, i.color ?? COLOR.text);
      return `<g transform="translate(${n(i.x - i.size / 2)} ${n(i.y - i.size / 2)}) scale(${n(k)})${rot}"${data}>${body}</g>`;
    }
  }
}

export function sheetToSvg(sheet: Sheet): string {
  const w = n(sheet.widthMm);
  const h = n(sheet.heightMm);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">${sheet.items.map(itemSvg).join("")}</svg>`;
}
