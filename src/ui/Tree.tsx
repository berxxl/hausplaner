import { useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { routeSurfaceTarget } from "./warnings";
import { sortedStoreys } from "../io/project-files";
import { addStorey } from "../store/commands";
import type { ProjectStore } from "../store/history";
import type { SurfaceTarget, ViewStore } from "../store/view";
import { AddStoreyDialog } from "./AddStoreyDialog";
import { freeSurfacesOf, roomViewsOf } from "./derived";

function sameTarget(a: SurfaceTarget | null, b: SurfaceTarget): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

function Item({
  label,
  selected,
  marked,
  onActivate,
  children,
  level,
}: {
  label: string;
  selected?: boolean;
  marked?: boolean;
  onActivate(): void;
  children?: ReactNode;
  level: number;
}) {
  return (
    <li
      role="treeitem"
      aria-label={label}
      aria-level={level}
      aria-selected={!!selected}
      aria-expanded={children ? true : undefined}
      data-marked={marked || undefined}
      onClick={(e) => {
        // nur der eigene Eintrag, nicht Klicks aus Unter-Einträgen
        if ((e.target as Element).closest('[role="treeitem"]') === e.currentTarget) onActivate();
      }}
    >
      <div
        tabIndex={0}
        className={`tree__item${selected ? " tree__item--selected" : ""}${marked ? " tree__item--marked" : ""}`}
        style={{ paddingLeft: `${level - 0.25}rem` }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          }
        }}
      >
        {label}
      </div>
      {children && <ul role="group">{children}</ul>}
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

  return (
    <nav aria-label="Strukturbaum" className="tree">
      <ul role="tree" aria-label="Geschosse">
        {sortedStoreys(project).map((storey) => {
          const rooms = project.rooms
            .filter((r) => r.storeyId === storey.id)
            .sort((a, b) => a.name.localeCompare(b.name, "de"));
          const free = freeSurfacesOf(project, storey.id);
          return (
            <Item
              key={storey.id}
              level={1}
              label={storey.name}
              selected={selection?.kind === "storey" && selection.id === storey.id}
              onActivate={() => {
                view.select({ kind: "storey", id: storey.id });
                view.setActiveStorey(storey.id);
              }}
            >
              {rooms.map((room) => (
                <Item
                  key={room.id}
                  level={2}
                  label={room.name}
                  selected={selection?.kind === "room" && selection.id === room.id}
                  onActivate={() => {
                    view.setActiveStorey(storey.id);
                    view.select({ kind: "room", id: room.id });
                    view.setEditor("plan");
                  }}
                >
                  {(roomViews.get(room.id) ?? []).map((v) => {
                    const t: SurfaceTarget = { kind: "room-wall", key: v.key };
                    return (
                      <Item
                        key={v.key}
                        level={3}
                        label={v.name}
                        selected={isOpen(t)}
                        marked={v.wallId === markedWall || onCable(t)}
                        onActivate={() => open(t, storey.id)}
                      />
                    );
                  })}
                  <Item
                    level={3}
                    label="Decke"
                    selected={isOpen({ kind: "ceiling", roomId: room.id })}
                    marked={onCable({ kind: "ceiling", roomId: room.id })}
                    onActivate={() => open({ kind: "ceiling", roomId: room.id }, storey.id)}
                  />
                  <Item
                    level={3}
                    label="Boden"
                    selected={isOpen({ kind: "floor", roomId: room.id })}
                    marked={onCable({ kind: "floor", roomId: room.id })}
                    onActivate={() => open({ kind: "floor", roomId: room.id }, storey.id)}
                  />
                  {(room.slopes ?? []).map((s, i) => {
                    const t: SurfaceTarget = { kind: "slope", roomId: room.id, slopeId: s.id };
                    return (
                      <Item
                        key={s.id}
                        level={3}
                        label={`Schräge ${i + 1}`}
                        selected={isOpen(t)}
                        marked={onCable(t)}
                        onActivate={() => open(t, storey.id)}
                      />
                    );
                  })}
                </Item>
              ))}
              {free.length > 0 && (
                <Item
                  level={2}
                  label="Flächen ohne Raum"
                  onActivate={() => view.setActiveStorey(storey.id)}
                >
                  {free.map((f) => {
                    const t: SurfaceTarget = { kind: "wall-side", ref: f.ref };
                    return (
                      <Item
                        key={f.ref}
                        level={3}
                        label={f.name}
                        selected={isOpen(t)}
                        marked={f.wallId === markedWall || onCable(t)}
                        onActivate={() => open(t, storey.id)}
                      />
                    );
                  })}
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
