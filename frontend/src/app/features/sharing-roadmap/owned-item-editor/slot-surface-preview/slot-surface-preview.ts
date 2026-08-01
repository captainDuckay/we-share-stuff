import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PlacementSurfaceDetail } from '../../../../core/api/model';
import {
  contentBoundsOf,
  toSceneSlot,
  toSceneStructure,
  type SceneSurface,
} from '../../../my-page/placement-surfaces/scene.model';

const VIEW_PAD_MM = 40;
const EMPTY_VIEW_BOX = '0 0 400 240';

/**
 * Light, read-only parent-Surface diagram with one Slot highlighted.
 * Not the full Placement Surface editor — static SVG only.
 */
@Component({
  selector: 'app-slot-surface-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slot-surface-preview.html',
  styleUrl: './slot-surface-preview.css',
})
export class SlotSurfacePreview {
  readonly surface = input.required<PlacementSurfaceDetail>();
  readonly highlightedSlotId = input.required<string>();

  readonly scene = computed((): SceneSurface => {
    const surface = this.surface();
    return {
      id: surface.id,
      name: surface.name,
      slots: surface.slots.map(toSceneSlot),
      structures: surface.structuralDrawings.map(toSceneStructure),
    };
  });

  readonly viewBox = computed((): string => {
    const bounds = contentBoundsOf(this.scene());
    if (!bounds) return EMPTY_VIEW_BOX;
    return [
      bounds.minX - VIEW_PAD_MM,
      bounds.minY - VIEW_PAD_MM,
      Math.max(80, bounds.width + VIEW_PAD_MM * 2),
      Math.max(60, bounds.height + VIEW_PAD_MM * 2),
    ].join(' ');
  });

  readonly linePoints = (
    points: readonly { readonly x: number; readonly y: number }[],
  ): string => points.map((point) => `${point.x},${point.y}`).join(' ');
}
