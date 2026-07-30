/**
 * PROTOTYPE ONLY — in-memory scene for Placement Surface editor intent (#7).
 * Not production domain models. Geometry matches decisions #2 + #4 at product level.
 */

export type ToolMode = 'select' | 'slot' | 'structure-rect' | 'structure-line';

export interface CanvasSize {
  width: number;
  height: number;
}

export interface PhysicalSizeCm {
  widthCm: number | null;
  heightCm: number | null;
}

export interface SlotShape {
  kind: 'slot';
  id: string;
  /** Human label — primary findability contract; unique per location (case-insensitive). */
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  widthCm: number | null;
  heightCm: number | null;
}

export interface StructureRect {
  kind: 'structure-rect';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StructureLine {
  kind: 'structure-line';
  id: string;
  points: { x: number; y: number }[];
}

export type StructureShape = StructureRect | StructureLine;
export type SelectableKind = 'slot' | 'structure-rect' | 'structure-line';

export interface PlacementSurfaceDraft {
  id: string;
  name: string;
  canvas: CanvasSize;
  physical: PhysicalSizeCm;
  slots: SlotShape[];
  structures: StructureShape[];
}

export interface TypicalLocationDraft {
  id: string;
  name: string;
  surfaces: PlacementSurfaceDraft[];
}

export interface Selection {
  surfaceId: string;
  kind: SelectableKind;
  id: string;
}

export interface SceneSnapshot {
  location: TypicalLocationDraft;
  activeSurfaceId: string;
  tool: ToolMode;
  selection: Selection | null;
  lastAction: string;
}

let idSeq = 1;
export function newId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

export function createSeedLocation(): TypicalLocationDraft {
  const wallA: PlacementSurfaceDraft = {
    id: 'surface-wall-a',
    name: 'Garage wall A',
    canvas: { width: 800, height: 480 },
    physical: { widthCm: 400, heightCm: 240 },
    structures: [
      { kind: 'structure-rect', id: 'struct-cabinet', x: 40, y: 40, width: 720, height: 400 },
      {
        kind: 'structure-line',
        id: 'struct-shelf',
        points: [
          { x: 60, y: 200 },
          { x: 740, y: 200 },
        ],
      },
    ],
    slots: [
      {
        kind: 'slot',
        id: 'slot-e27',
        label: 'E27',
        x: 80,
        y: 60,
        width: 140,
        height: 100,
        widthCm: 70,
        heightCm: 50,
      },
      {
        kind: 'slot',
        id: 'slot-blue',
        label: 'Blue bin',
        x: 280,
        y: 220,
        width: 160,
        height: 120,
        widthCm: null,
        heightCm: null,
      },
    ],
  };

  const shed: PlacementSurfaceDraft = {
    id: 'surface-shed',
    name: 'Shed shelves',
    canvas: { width: 600, height: 400 },
    physical: { widthCm: null, heightCm: null },
    structures: [
      { kind: 'structure-rect', id: 'struct-frame', x: 30, y: 30, width: 540, height: 340 },
    ],
    slots: [
      {
        kind: 'slot',
        id: 'slot-top-left',
        label: 'Top left',
        x: 50,
        y: 50,
        width: 120,
        height: 80,
        widthCm: null,
        heightCm: null,
      },
    ],
  };

  return {
    id: 'loc-home',
    name: 'Home',
    surfaces: [wallA, shed],
  };
}

/** Case-insensitive uniqueness across all surfaces under the location. */
export function isLabelTaken(
  location: TypicalLocationDraft,
  label: string,
  exceptSlotId?: string,
): boolean {
  const key = label.trim().toLowerCase();
  if (!key) return false;
  for (const surface of location.surfaces) {
    for (const slot of surface.slots) {
      if (exceptSlotId && slot.id === exceptSlotId) continue;
      if (slot.label.trim().toLowerCase() === key) return true;
    }
  }
  return false;
}

export function nextUniqueLabel(location: TypicalLocationDraft, base: string): string {
  let n = 1;
  let candidate = base;
  while (isLabelTaken(location, candidate)) {
    n += 1;
    candidate = `${base} ${n}`;
  }
  return candidate;
}
