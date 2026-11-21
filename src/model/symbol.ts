/**
 * Gerätesymbole (design.md M2 „Symbole“): SVG-Fragmente im Raster viewBox 0 0 100 100.
 * Parsen nach Positivliste, kanonisch serialisieren (Attribute in einfachen Anführungszeichen),
 * eigene SVG-Dateien auf das Raster umrechnen. Gerendert wird nur der geparste Baum, nie HTML.
 * Frei von React; braucht DOMParser (Browser, jsdom).
 */

export const ALLOWED_TAGS = [
  "path",
  "line",
  "polyline",
  "polygon",
  "circle",
  "ellipse",
  "rect",
  "text",
  "g",
] as const;
export type SymbolTag = (typeof ALLOWED_TAGS)[number];

export const ALLOWED_ATTRIBUTES = [
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "points",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "transform",
  "font-size",
  "font-family",
  "text-anchor",
] as const;

export interface SymbolNode {
  tag: SymbolTag;
  attrs: [string, string][];
  children: SymbolNode[];
  /** Nur bei `text`. */
  text?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const TAGS = new Set<string>(ALLOWED_TAGS);
const ATTRS = new Set<string>(ALLOWED_ATTRIBUTES);
/** Werte, die auf Fremdes verweisen oder Code enthalten könnten. */
const FORBIDDEN_VALUE = /url\(|javascript:|expression\(|[<>]/i;

function parseSvgDocument(svgText: string): Element | null {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "svg" || doc.getElementsByTagName("parsererror").length > 0)
    return null;
  return root;
}

function convert(element: Element): SymbolNode | null {
  const tag = element.localName;
  if (!TAGS.has(tag)) return null; // unbekannte Elemente samt Inhalt verwerfen
  const attrs: [string, string][] = [];
  for (const attr of Array.from(element.attributes)) {
    if (ATTRS.has(attr.name) && !FORBIDDEN_VALUE.test(attr.value))
      attrs.push([attr.name, attr.value]);
  }
  const node: SymbolNode = { tag: tag as SymbolTag, attrs, children: [] };
  if (tag === "text") {
    node.text = element.textContent ?? "";
    return node;
  }
  for (const child of Array.from(element.children)) {
    const c = convert(child);
    if (c) node.children.push(c);
  }
  return node;
}

/** Parst ein Symbol (Fragment ohne äußeres svg) nach Positivliste. Ungültiges XML → []. */
export function parseSymbol(fragment: string): SymbolNode[] {
  const root = parseSvgDocument(`<svg xmlns="${SVG_NS}">${fragment}</svg>`);
  if (!root) return [];
  return Array.from(root.children)
    .map(convert)
    .filter((n): n is SymbolNode => n !== null);
}

const escapeAttr = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/'/g, "&apos;").replace(/</g, "&lt;");
const escapeText = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Kanonische Textform: Attribute in Quellreihenfolge, einfache Anführungszeichen, eine Zeile. */
export function serializeSymbol(nodes: SymbolNode[]): string {
  return nodes
    .map((n) => {
      const attrs = n.attrs.map(([k, v]) => ` ${k}='${escapeAttr(v)}'`).join("");
      if (n.tag === "text") return `<text${attrs}>${escapeText(n.text ?? "")}</text>`;
      if (n.children.length === 0) return `<${n.tag}${attrs}/>`;
      return `<${n.tag}${attrs}>${serializeSymbol(n.children)}</${n.tag}>`;
    })
    .join("");
}

/** Bereinigt ein Symbol-Fragment; ein bereits bereinigtes Symbol bleibt unverändert. */
export function sanitizeSymbol(fragment: string): string {
  return serializeSymbol(parseSymbol(fragment));
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export type SymbolImport = { ok: true; symbol: string } | { ok: false; error: string };

/**
 * Übernimmt eine SVG-Datei als Symbol: Kindelemente bereinigen und die viewBox der Datei
 * (sonst width/height) mit gleichem Seitenverhältnis zentriert auf 0..100 abbilden.
 */
export function importSvgSymbol(svgText: string): SymbolImport {
  const root = parseSvgDocument(svgText);
  if (!root) return { ok: false, error: "Die Datei ist kein gültiges SVG" };
  const nodes = Array.from(root.children)
    .map(convert)
    .filter((n): n is SymbolNode => n !== null);
  if (nodes.length === 0)
    return { ok: false, error: "Das Symbol enthält keine zulässigen Zeichenelemente" };
  const vb = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [minX, minY, w, h] =
    vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0
      ? (vb as [number, number, number, number])
      : [
          0,
          0,
          parseFloat(root.getAttribute("width") ?? "100"),
          parseFloat(root.getAttribute("height") ?? "100"),
        ];
  const width = w > 0 ? w : 100;
  const height = h > 0 ? h : 100;
  const s = 100 / Math.max(width, height);
  const tx = (100 - width * s) / 2 - minX * s;
  const ty = (100 - height * s) / 2 - minY * s;
  if (s === 1 && tx === 0 && ty === 0) return { ok: true, symbol: serializeSymbol(nodes) };
  const group: SymbolNode = {
    tag: "g",
    attrs: [["transform", `translate(${round3(tx)} ${round3(ty)}) scale(${round3(s)})`]],
    children: nodes,
  };
  return { ok: true, symbol: serializeSymbol([group]) };
}
