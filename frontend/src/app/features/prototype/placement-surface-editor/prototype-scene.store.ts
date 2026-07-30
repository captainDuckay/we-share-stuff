import { Injectable, computed, signal } from '@angular/core';
import {
  PlacementSurfaceDraft,
  SceneSnapshot,
  Selection,
  SlotShape,
  StructureShape,
  ToolMode,
  contentBoundsOf,
  createSeedLocation,
  isLabelTaken,
  newId,
  nextUniqueLabel,
} from './scene.model';

/**
 * PROTOTYPE ONLY — ephemeral in-memory store. Wipe on reload.
 */
@Injectable()
export class PrototypeSceneStore {
  private readonly locationSignal = signal(createSeedLocation());
  private readonly activeSurfaceIdSignal = signal('surface-wall-a');
  private readonly toolSignal = signal<ToolMode>('select');
  private readonly selectionSignal = signal<Selection | null>(null);
  private readonly lastActionSignal = signal('Seeded Home with two Surfaces');

  readonly location = this.locationSignal.asReadonly();
  readonly activeSurfaceId = this.activeSurfaceIdSignal.asReadonly();
  readonly tool = this.toolSignal.asReadonly();
  readonly selection = this.selectionSignal.asReadonly();
  readonly lastAction = this.lastActionSignal.asReadonly();

  readonly activeSurface = computed(() => {
    const loc = this.locationSignal();
    const id = this.activeSurfaceIdSignal();
    return loc.surfaces.find((s) => s.id === id) ?? loc.surfaces[0]!;
  });

  readonly selectedSlot = computed(() => {
    const sel = this.selectionSignal();
    if (!sel || sel.kind !== 'slot') return null;
    const surface = this.locationSignal().surfaces.find((s) => s.id === sel.surfaceId);
    return surface?.slots.find((s) => s.id === sel.id) ?? null;
  });

  /** Derived sketch extent — user never sets surface canvas size. */
  readonly contentBounds = computed(() => contentBoundsOf(this.activeSurface()));

  readonly snapshot = computed((): SceneSnapshot => ({
    location: this.locationSignal(),
    activeSurfaceId: this.activeSurfaceIdSignal(),
    tool: this.toolSignal(),
    selection: this.selectionSignal(),
    lastAction: this.lastActionSignal(),
  }));

  setTool(tool: ToolMode): void {
    this.toolSignal.set(tool);
    this.lastActionSignal.set(`Tool → ${tool}`);
  }

  selectSurface(surfaceId: string): void {
    this.activeSurfaceIdSignal.set(surfaceId);
    this.selectionSignal.set(null);
    this.lastActionSignal.set(`Active surface → ${surfaceId}`);
  }

  addSurface(name?: string): void {
    const loc = this.locationSignal();
    const surface: PlacementSurfaceDraft = {
      id: newId('surface'),
      name: name?.trim() || `Surface ${loc.surfaces.length + 1}`,
      canvas: { width: 640, height: 400 },
      physical: { widthCm: null, heightCm: null },
      slots: [],
      structures: [],
    };
    this.locationSignal.update((l) => ({ ...l, surfaces: [...l.surfaces, surface] }));
    this.activeSurfaceIdSignal.set(surface.id);
    this.selectionSignal.set(null);
    this.lastActionSignal.set(`Created surface “${surface.name}”`);
  }

  renameSurface(surfaceId: string, name: string): void {
    const trimmed = name.trim() || 'Untitled surface';
    this.locationSignal.update((l) => ({
      ...l,
      surfaces: l.surfaces.map((s) => (s.id === surfaceId ? { ...s, name: trimmed } : s)),
    }));
    this.lastActionSignal.set(`Renamed surface → “${trimmed}”`);
  }

  setSurfacePhysical(surfaceId: string, widthCm: number | null, heightCm: number | null): void {
    this.locationSignal.update((l) => ({
      ...l,
      surfaces: l.surfaces.map((s) =>
        s.id === surfaceId ? { ...s, physical: { widthCm, heightCm } } : s,
      ),
    }));
    this.lastActionSignal.set(`Surface physical size (preferred) updated`);
  }

  select(kind: Selection['kind'] | null, id: string | null): void {
    if (!kind || !id) {
      this.selectionSignal.set(null);
      this.lastActionSignal.set('Cleared selection');
      return;
    }
    const surfaceId = this.activeSurfaceIdSignal();
    this.selectionSignal.set({ surfaceId, kind, id });
    this.toolSignal.set('select');
    this.lastActionSignal.set(`Selected ${kind} ${id}`);
  }

  addSlotAt(x: number, y: number): void {
    const surfaceId = this.activeSurfaceIdSignal();
    const label = nextUniqueLabel(this.locationSignal(), 'Slot');
    const slot: SlotShape = {
      kind: 'slot',
      id: newId('slot'),
      label,
      x: x - 60,
      y: y - 40,
      width: 120,
      height: 80,
      widthCm: null,
      heightCm: null,
    };
    this.patchSurface(surfaceId, (s) => ({ ...s, slots: [...s.slots, slot] }));
    this.selectionSignal.set({ surfaceId, kind: 'slot', id: slot.id });
    this.toolSignal.set('select');
    this.lastActionSignal.set(`Added slot “${label}”`);
  }

  addStructureRectAt(x: number, y: number): void {
    const surfaceId = this.activeSurfaceIdSignal();
    const shape: StructureShape = {
      kind: 'structure-rect',
      id: newId('struct'),
      x: x - 80,
      y: y - 50,
      width: 160,
      height: 100,
    };
    this.patchSurface(surfaceId, (s) => ({ ...s, structures: [...s.structures, shape] }));
    this.selectionSignal.set({ surfaceId, kind: 'structure-rect', id: shape.id });
    this.toolSignal.set('select');
    this.lastActionSignal.set('Added structure rectangle (non-linkable)');
  }

  addStructureLineAt(x: number, y: number): void {
    const surfaceId = this.activeSurfaceIdSignal();
    const shape: StructureShape = {
      kind: 'structure-line',
      id: newId('struct'),
      points: [
        { x: x - 60, y },
        { x: x + 60, y },
      ],
    };
    this.patchSurface(surfaceId, (s) => ({ ...s, structures: [...s.structures, shape] }));
    this.selectionSignal.set({ surfaceId, kind: 'structure-line', id: shape.id });
    this.toolSignal.set('select');
    this.lastActionSignal.set('Added structure line (non-linkable)');
  }

  updateSlotLabel(slotId: string, label: string): void {
    const trimmed = label.trim();
    if (!trimmed) {
      this.lastActionSignal.set('Label rejected: empty');
      return;
    }
    if (isLabelTaken(this.locationSignal(), trimmed, slotId)) {
      this.lastActionSignal.set(`Label rejected: “${trimmed}” already used at this Typical Location`);
      return;
    }
    this.mapSlot(slotId, (slot) => ({ ...slot, label: trimmed }));
    this.lastActionSignal.set(`Slot label → “${trimmed}”`);
  }

  updateSlotPhysical(slotId: string, widthCm: number | null, heightCm: number | null): void {
    this.mapSlot(slotId, (slot) => ({ ...slot, widthCm, heightCm }));
    this.lastActionSignal.set('Slot physical size (preferred) updated');
  }

  moveSelection(dx: number, dy: number): void {
    const sel = this.selectionSignal();
    if (!sel) return;
    // Infinite plane: no clamp to a fixed canvas origin.
    if (sel.kind === 'slot') {
      this.mapSlot(sel.id, (slot) => ({
        ...slot,
        x: slot.x + dx,
        y: slot.y + dy,
      }));
    } else if (sel.kind === 'structure-rect') {
      this.mapStructure(sel.id, (shape) => {
        if (shape.kind !== 'structure-rect') return shape;
        return {
          ...shape,
          x: shape.x + dx,
          y: shape.y + dy,
        };
      });
    } else if (sel.kind === 'structure-line') {
      this.mapStructure(sel.id, (shape) => {
        if (shape.kind !== 'structure-line') return shape;
        return {
          ...shape,
          points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        };
      });
    }
  }

  resizeSelectedRect(width: number, height: number): void {
    const sel = this.selectionSignal();
    if (!sel) return;
    const w = Math.max(24, width);
    const h = Math.max(24, height);
    if (sel.kind === 'slot') {
      this.mapSlot(sel.id, (slot) => ({ ...slot, width: w, height: h }));
    } else if (sel.kind === 'structure-rect') {
      this.mapStructure(sel.id, (shape) =>
        shape.kind === 'structure-rect' ? { ...shape, width: w, height: h } : shape,
      );
    }
  }

  deleteSelection(): void {
    const sel = this.selectionSignal();
    if (!sel) return;
    const surfaceId = sel.surfaceId;
    if (sel.kind === 'slot') {
      this.patchSurface(surfaceId, (s) => ({
        ...s,
        slots: s.slots.filter((x) => x.id !== sel.id),
      }));
    } else {
      this.patchSurface(surfaceId, (s) => ({
        ...s,
        structures: s.structures.filter((x) => x.id !== sel.id),
      }));
    }
    this.selectionSignal.set(null);
    this.lastActionSignal.set(`Deleted ${sel.kind}`);
  }

  private patchSurface(
    surfaceId: string,
    fn: (s: PlacementSurfaceDraft) => PlacementSurfaceDraft,
  ): void {
    this.locationSignal.update((l) => ({
      ...l,
      surfaces: l.surfaces.map((s) => (s.id === surfaceId ? fn(s) : s)),
    }));
  }

  private mapSlot(slotId: string, fn: (slot: SlotShape) => SlotShape): void {
    this.locationSignal.update((l) => ({
      ...l,
      surfaces: l.surfaces.map((s) => ({
        ...s,
        slots: s.slots.map((slot) => (slot.id === slotId ? fn(slot) : slot)),
      })),
    }));
  }

  private mapStructure(id: string, fn: (shape: StructureShape) => StructureShape): void {
    this.locationSignal.update((l) => ({
      ...l,
      surfaces: l.surfaces.map((s) => ({
        ...s,
        structures: s.structures.map((shape) => (shape.id === id ? fn(shape) : shape)),
      })),
    }));
  }
}
