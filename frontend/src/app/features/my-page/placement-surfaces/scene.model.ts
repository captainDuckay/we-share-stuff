/** Pure scene helpers for Placement Surface sketch (mm plane). */

import type { PlacementSlot, StructuralDrawing } from '../../../core/api/model';

export type ToolMode = 'select' | 'pan' | 'slot' | 'structure-rect' | 'structure-line';

export type SelectableKind = 'slot' | 'structure-rect' | 'structure-line';

export interface ContentBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneSlot {
  readonly kind: 'slot';
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneStructureRect {
  readonly kind: 'structure-rect';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneStructureLine {
  readonly kind: 'structure-line';
  readonly id: string;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

export type SceneStructure = SceneStructureRect | SceneStructureLine;

export interface SceneSurface {
  readonly id: string;
  readonly name: string;
  readonly slots: readonly SceneSlot[];
  readonly structures: readonly SceneStructure[];
}

export interface Selection {
  readonly kind: SelectableKind;
  readonly id: string;
}

export const DEFAULT_SLOT_WIDTH_MM = 120;
export const DEFAULT_SLOT_HEIGHT_MM = 80;
export const DEFAULT_STRUCT_WIDTH_MM = 160;
export const DEFAULT_STRUCT_HEIGHT_MM = 100;
export const DEFAULT_LINE_HALF_LENGTH_MM = 60;
export const MIN_RECT_SIZE_MM = 24;
export const SLOT_LABEL_MAX_LENGTH = 200;
export const SURFACE_NAME_MAX_LENGTH = 200;

export function isLabelTaken(
  surfaces: readonly { readonly slots: readonly { readonly id: string; readonly label: string }[] }[],
  label: string,
  exceptSlotId?: string,
): boolean {
  const key = label.trim().toLowerCase();
  if (!key) return false;
  for (const surface of surfaces) {
    for (const slot of surface.slots) {
      if (exceptSlotId && slot.id === exceptSlotId) continue;
      if (slot.label.trim().toLowerCase() === key) return true;
    }
  }
  return false;
}

export function nextUniqueLabel(
  surfaces: readonly { readonly slots: readonly { readonly id: string; readonly label: string }[] }[],
  base: string,
): string {
  let n = 1;
  let candidate = base;
  while (isLabelTaken(surfaces, candidate)) {
    n += 1;
    candidate = `${base} ${n}`;
  }
  return candidate;
}

/** Surface extent is derived from content — not a user-authored canvas size. */
export function contentBoundsOf(surface: SceneSurface): ContentBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;

  const include = (x: number, y: number, w = 0, h = 0) => {
    any = true;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };

  for (const slot of surface.slots) {
    include(slot.x, slot.y, slot.width, slot.height);
  }
  for (const shape of surface.structures) {
    if (shape.kind === 'structure-rect') {
      include(shape.x, shape.y, shape.width, shape.height);
    } else {
      for (const p of shape.points) include(p.x, p.y);
    }
  }

  if (!any) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function clampRectSize(size: number): number {
  return Math.max(MIN_RECT_SIZE_MM, roundMm(size));
}

/** Sketch millimetres are whole units — avoids float noise in fields and overflow. */
export function roundMm(value: number): number {
  return Math.round(value);
}

/** Display millimetres without fractional float debris. */
export function formatMm(value: number): string {
  return String(roundMm(value));
}

export function roundPoint(point: { readonly x: number; readonly y: number }): {
  x: number;
  y: number;
} {
  return { x: roundMm(point.x), y: roundMm(point.y) };
}

export function toSceneSlot(slot: PlacementSlot): SceneSlot {
  return {
    kind: 'slot',
    id: slot.id,
    label: slot.label,
    x: roundMm(slot.x),
    y: roundMm(slot.y),
    width: clampRectSize(slot.width),
    height: clampRectSize(slot.height),
  };
}

export function toSceneStructure(drawing: StructuralDrawing): SceneStructure {
  if (drawing.kind === 'rect') {
    return {
      kind: 'structure-rect',
      id: drawing.id,
      x: roundMm(drawing.x ?? 0),
      y: roundMm(drawing.y ?? 0),
      width: clampRectSize(drawing.width ?? DEFAULT_STRUCT_WIDTH_MM),
      height: clampRectSize(drawing.height ?? DEFAULT_STRUCT_HEIGHT_MM),
    };
  }
  return {
    kind: 'structure-line',
    id: drawing.id,
    points: (drawing.points ?? []).map(roundPoint),
  };
}
