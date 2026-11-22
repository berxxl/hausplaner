import type { Device } from "../model/types";
import { STATUS_COLORS, WARNING_COLOR } from "./labels";
import { SymbolView } from "./SymbolView";
import { HIGHLIGHT_COLOR } from "./surface/routeGeometry";

/**
 * Gerät als Rahmen mit Symbol in Weltkoordinaten (y nach oben), design.md M2 „Darstellung“:
 * geplant = grauer Umriss, verlegt = blau gefüllt, geprüft = grün gefüllt mit Haken;
 * Decken- und Schrägengeräte im Grundriss gestrichelt, offene Warnung = roter Rand.
 */
export function DeviceGlyph({
  device,
  symbol,
  x,
  y,
  width,
  height,
  dashed = false,
  selected = false,
  warned = false,
  highlighted = false,
  rotationDeg = 0,
}: {
  device: Device;
  symbol: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dashed?: boolean;
  selected?: boolean;
  warned?: boolean;
  /** Teil des ausgewählten Stromkreises (M4) */
  highlighted?: boolean;
  rotationDeg?: number;
}) {
  const color = STATUS_COLORS[device.status];
  const filled = device.status !== "planned";
  const s = Math.min(width, height) / 100;
  const stroke = warned
    ? WARNING_COLOR
    : selected
      ? "#0071e3"
      : highlighted
        ? HIGHLIGHT_COLOR
        : color;
  return (
    <g
      data-device={device.id}
      data-status={device.status}
      data-selected={selected || undefined}
      data-warned={warned || undefined}
      data-highlighted={highlighted || undefined}
      className="device"
      transform={`translate(${x} ${y}) rotate(${rotationDeg})`}
    >
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={filled ? color : "#fff"}
        fillOpacity={filled ? 0.18 : 0.85}
        stroke={stroke}
        strokeWidth={selected || warned ? 3 : 1.5}
        strokeDasharray={dashed ? "4 3" : undefined}
        vectorEffect="non-scaling-stroke"
      />
      {/* Symbolraster 0..100 mit y nach unten: in der y-oben-Welt spiegeln */}
      <g transform={`scale(${s} ${-s}) translate(-50 -50)`} style={{ color }}>
        <SymbolView symbol={symbol} color={color} />
        {device.status === "verified" && (
          <path
            d="M62 88 L74 98 L96 74"
            fill="none"
            stroke={color}
            strokeWidth={8}
            data-testid="verified-check"
          />
        )}
      </g>
    </g>
  );
}
