import { useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { routeSurfaceTarget } from "./warnings";
import { sortedStoreys } from "../io/project-files";
import { addStorey } from "../store/commands";
import type { ProjectStore } from "../store/history";
import type { SurfaceTarget, ViewStore } from "../store/view";
import { AddStoreyDialog } from "./AddStoreyDialog";
import { freeSurfacesOf, roomViewsOf } from "./derived";

/** Flächeneintrag unter einem Raum oder „Flächen ohne Raum“ */
interface Leaf {
  key: string;
  label: string;
  target: SurfaceTarget;
  wallId?: string;
}

function sameTarget(a: SurfaceTarget | null, b: SurfaceTarget): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

const COLLAPSED_KEY = "hausplaner.tree.collapsed";

function loadCollapsed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function saveCollapsed(ids: Set<string>) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // ohne Speicher gilt der Zustand nur bis zum Neuladen
  }
}

/** Auf- und zugeklappte Einträge; Schlüssel sind IDs, damit sie über Projekte hinweg nicht kollidieren. */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggle = (key: string, open?: boolean) =>
    setCollapsed((prev) => {
      const isOpen = !prev.has(key);
      if (open !== undefined && open === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(key);
      else next.delete(key);
      saveCollapsed(next);
      return next;
    });
  return { collapsed, toggle };
}

function Item({
  label,
  selected,
  marked,
  onActivate,
  children,
  level,
  expanded,
  onToggle,
  containsMark,
}: {
  label: string;
  selected?: boolean;
  marked?: boolean;
  onActivate(): void;
  children?: ReactNode;
  level: number;
  /** nur bei aufklappbaren Einträgen gesetzt */
  expanded?: boolean;
  onToggle?(open?: boolean): void;
  /** zugeklappt: ein Eintrag darunter ist ausgewählt oder markiert */
  containsMark?: boolean;
}) {
  const collapsible = expanded !== undefined && !!onToggle;
  const showMark = marked || (collapsible && !expanded && containsMark);
  return (
    <li
      role="treeitem"
      aria-label={label}
      aria-level={level}
      aria-selected={!!selected}
      aria-expanded={collapsible ? expanded : undefined}
      data-marked={showMark || undefined}
      onClick={(e) => {
        // nur der eigene Eintrag, nicht Klicks aus Unter-Einträgen
        if ((e.target as Element).closest('[role="treeitem"]') === e.currentTarget) onActivate();
      }}
    >
      <div
        tabIndex={0}
        className={`tree__item${selected ? " tree__item--selected" : ""}${showMark ? " tree__item--marked" : ""}`}
        style={{ paddingLeft: `${level - 0.25}rem` }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          } else if (collapsible && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
            e.preventDefault();
            onToggle(e.key === "ArrowRight");
          }
        }}
      >
        {collapsible ? (
          <button
            type="button"
            tabIndex={-1}
            className="tree__toggle"
            aria-label={`${label} ${expanded ? "zuklappen" : "aufklappen"}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="tree__toggle" aria-hidden="true" />
        )}
        <span>{label}</span>
      </div>
      {children && (!collapsible || expanded) && <ul role="group">{children}</ul>}
    </li>
  );
}

/** Strukturbaum: Geschosse, Räume mit Wandansichten, Decke, Boden, Schrägen, dazu „Flächen ohne Raum“. */
export function Tree({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const selection = useStore(view, (s) => s.selection);
  const surface = useStore(view, (s) => s.surface);
  const editor = useStore(view, (s) => s.editor);
  const [adding, setAdding] = useState(false);
  const { collapsed, toggle } = useCollapsed();
  const roomViews = roomViewsOf(project);
  const markedWall = selection?.kind === "wall" ? selection.id : null;
  // Flächen, über die eine ausgewählte Leitung läuft (design.md M3 „Leitungen“)
  const cable =
    selection?.kind === "cable" ? project.cables.find((c) => c.id === selection.id) : null;
  const cableSurfaces = new Set(
    (cable?.path ?? []).flatMap((id) => {
      const t = routeSurfaceTarget(project, { kind: "route-segment", id });
      return t ? [JSON.stringify(t.surface)] : [];
    }),
  );
  const onCable = (t: SurfaceTarget) => cableSurfaces.has(JSON.stringify(t));
  const open = (t: SurfaceTarget, storeyId: string) => view.openSurface(t, storeyId);
  const isOpen = (t: SurfaceTarget) => editor === "surface" && sameTarget(surface, t);
  const leafMarked = (l: Leaf) =>
    isOpen(l.target) || (!!l.wallId && l.wallId === markedWall) || onCable(l.target);
  const renderLeaf = (l: Leaf, storeyId: string) => (
    <Item
      key={l.key}
      level={3}
      label={l.label}
      selected={isOpen(l.target)}
      marked={(!!l.wallId && l.wallId === markedWall) || onCable(l.target)}
      onActivate={() => open(l.target, storeyId)}
    />
  );

  return (
    <nav aria-label="Strukturbaum" className="tree">
      <ul role="tree" aria-label="Geschosse">
        {sortedStoreys(project).map((storey) => {
          const rooms = project.rooms
            .filter((r) => r.storeyId === storey.id)
            .sort((a, b) => a.name.localeCompare(b.name, "de"));
          const free = freeSurfacesOf(project, storey.id);
          // Flächeneinträge je Raum vorab, damit zugeklappte Eltern ihre Markierung kennen
          const roomEntries = rooms.map((room) => {
            const leaves: Leaf[] = [
              ...(roomViews.get(room.id) ?? []).map((v) => ({
                key: v.key,
                label: v.name,
                target: { kind: "room-wall", key: v.key } as SurfaceTarget,
                wallId: v.wallId,
              })),
              { key: "ceiling", label: "Decke", target: { kind: "ceiling", roomId: room.id } },
              { key: "floor", label: "Boden", target: { kind: "floor", roomId: room.id } },
              ...(room.slopes ?? []).map((sl, i) => ({
                key: sl.id,
                label: `Schräge ${i + 1}`,
                target: { kind: "slope", roomId: room.id, slopeId: sl.id } as SurfaceTarget,
              })),
            ];
            const selected = selection?.kind === "room" && selection.id === room.id;
            return { room, leaves, selected, mark: selected || leaves.some(leafMarked) };
          });
          const freeLeaves: Leaf[] = free.map((f) => ({
            key: f.ref,
            label: f.name,
            target: { kind: "wall-side", ref: f.ref },
            wallId: f.wallId,
          }));
          const freeKey = `${storey.id}:free`;
          const freeMark = freeLeaves.some(leafMarked);
          return (
            <Item
              key={storey.id}
              level={1}
              label={storey.name}
              selected={selection?.kind === "storey" && selection.id === storey.id}
              expanded={!collapsed.has(storey.id)}
              onToggle={(o) => toggle(storey.id, o)}
              containsMark={roomEntries.some((r) => r.mark) || freeMark}
              onActivate={() => {
                view.select({ kind: "storey", id: storey.id });
                view.setActiveStorey(storey.id);
              }}
            >
              {roomEntries.map(({ room, leaves, selected, mark }) => (
                <Item
                  key={room.id}
                  level={2}
                  label={room.name}
                  selected={selected}
                  expanded={!collapsed.has(room.id)}
                  onToggle={(o) => toggle(room.id, o)}
                  containsMark={mark}
                  onActivate={() => {
                    view.setActiveStorey(storey.id);
                    view.select({ kind: "room", id: room.id });
                    view.setEditor("plan");
                  }}
                >
                  {leaves.map((l) => renderLeaf(l, storey.id))}
                </Item>
              ))}
              {free.length > 0 && (
                <Item
                  level={2}
                  label="Flächen ohne Raum"
                  expanded={!collapsed.has(freeKey)}
                  onToggle={(o) => toggle(freeKey, o)}
                  containsMark={freeMark}
                  onActivate={() => view.setActiveStorey(storey.id)}
                >
                  {freeLeaves.map((l) => renderLeaf(l, storey.id))}
                </Item>
              )}
            </Item>
          );
        })}
      </ul>
      <button type="button" className="tree__add" onClick={() => setAdding(true)}>
        Geschoss hinzufügen
      </button>
      {adding && (
        <AddStoreyDialog
          project={project}
          onClose={() => setAdding(false)}
          onAdd={(storey) => {
            store.execute(addStorey(storey));
            view.select({ kind: "storey", id: storey.id });
            view.setActiveStorey(storey.id);
            setAdding(false);
          }}
        />
      )}
    </nav>
  );
}
