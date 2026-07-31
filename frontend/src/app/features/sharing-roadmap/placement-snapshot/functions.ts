/** Pure helpers for borrower structured placement snapshot reveal. */

import type {
  FrozenPlacementSlotGeometry,
  FrozenStructuralDrawing,
  StructuredPlacementSnapshot,
} from '../../../core/api/model';
import type {
  ContentBounds,
  SceneSlot,
  SceneStructure,
  SceneSurface,
} from '../../my-page/placement-surfaces/scene.model';

/** Map a frozen structured snapshot into the owner sketch scene shape (read-only use). */
export const sceneFromStructuredSnapshot = (
  snapshot: StructuredPlacementSnapshot,
): SceneSurface => {
  const slots: SceneSlot[] = [
    toSceneSlot(snapshot.targetSlot),
    ...snapshot.otherSlots.map(toSceneSlot),
  ];
  const structures: SceneStructure[] = snapshot.structuralDrawings
    .map(toSceneStructure)
    .filter((shape): shape is SceneStructure => shape !== null);

  return {
    id: 'frozen-surface',
    name: snapshot.surfaceName,
    slots,
    structures,
  };
};

export const contentBoundsPad = (
  bounds: ContentBounds,
  padMm = 40,
): { x: number; y: number; width: number; height: number } => ({
  x: bounds.minX - padMm,
  y: bounds.minY - padMm,
  width: bounds.width + padMm * 2,
  height: bounds.height + padMm * 2,
});

export const polylinePointsAttr = (
  points: readonly { readonly x: number; readonly y: number }[],
): string => points.map((point) => `${point.x},${point.y}`).join(' ');

const toSceneSlot = (slot: FrozenPlacementSlotGeometry): SceneSlot => ({
  kind: 'slot',
  id: slot.id,
  label: slot.label,
  x: slot.x,
  y: slot.y,
  width: slot.width,
  height: slot.height,
});

const toSceneStructure = (drawing: FrozenStructuralDrawing): SceneStructure | null => {
  if (drawing.kind === 'rect') {
    if (
      drawing.x == null ||
      drawing.y == null ||
      drawing.width == null ||
      drawing.height == null
    ) {
      return null;
    }
    return {
      kind: 'structure-rect',
      id: drawing.id,
      x: drawing.x,
      y: drawing.y,
      width: drawing.width,
      height: drawing.height,
    };
  }
  if (drawing.kind === 'polyline' && drawing.points && drawing.points.length >= 2) {
    return {
      kind: 'structure-line',
      id: drawing.id,
      points: drawing.points.map((point) => ({ x: point.x, y: point.y })),
    };
  }
  return null;
};
