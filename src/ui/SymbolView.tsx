import { createElement, useMemo, type ReactNode } from "react";
import { parseSymbol, type SymbolNode } from "../model/symbol";

/** React-Attributnamen für die erlaubten SVG-Attribute. */
const PROP_NAMES: Record<string, string> = {
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "font-size": "fontSize",
  "font-family": "fontFamily",
  "text-anchor": "textAnchor",
};

function render(nodes: SymbolNode[], keyPrefix = ""): ReactNode[] {
  return nodes.map((n, i) => {
    const props: Record<string, string> = { key: `${keyPrefix}${i}` };
    for (const [k, v] of n.attrs) props[PROP_NAMES[k] ?? k] = v;
    const children = n.tag === "text" ? n.text : render(n.children, `${keyPrefix}${i}.`);
    return createElement(n.tag, props, children);
  });
}

/**
 * Gerätesymbol aus dem geparsten, bereinigten Baum (design.md M2 „Symbole“), nie über innerHTML.
 * Ohne Rahmen als <g> zum Einbetten in eine Zeichnung (Raster 0..100), sonst als eigenes <svg>.
 */
export function SymbolView({
  symbol,
  size,
  color = "currentColor",
  title,
}: {
  symbol: string;
  /** Kantenlänge in px für ein eigenes <svg>; ohne Angabe ein <g>. */
  size?: number;
  color?: string;
  /** Ohne Titel ist das Symbol dekorativ und für Screenreader ausgeblendet. */
  title?: string;
}) {
  const nodes = useMemo(() => render(parseSymbol(symbol)), [symbol]);
  if (size === undefined) return <g color={color}>{nodes}</g>;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      color={color}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      {nodes}
    </svg>
  );
}
