import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PlacementSlot,
  PlacementSurfaceDetail,
  PlacementSurfaceSummary,
  StructuralDrawing,
} from '../../../core/api/model';
import { PlacementSurfacesApi } from '../../../core/api/placement-surfaces-api.service';
import { TypicalLocationsApi } from '../../../core/api/typical-locations-api.service';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import {
  DEFAULT_LINE_HALF_LENGTH_MM,
  DEFAULT_SLOT_HEIGHT_MM,
  DEFAULT_SLOT_WIDTH_MM,
  DEFAULT_STRUCT_HEIGHT_MM,
  DEFAULT_STRUCT_WIDTH_MM,
  SceneSlot,
  SceneStructure,
  SceneSurface,
  SelectableKind,
  Selection,
  SLOT_LABEL_MAX_LENGTH,
  SURFACE_NAME_MAX_LENGTH,
  ToolMode,
  clampRectSize,
  isLabelTaken,
  nextUniqueLabel,
} from './scene.model';
import { SurfaceCanvasComponent } from './surface-canvas.component';

interface ToolDef {
  id: ToolMode;
  label: string;
  icon: string;
  hint: string;
}

@Component({
  selector: 'app-placement-surfaces-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MaterialSymbolIconComponent,
    PageLayout,
    RouterLink,
    SurfaceCanvasComponent,
  ],
  templateUrl: './placement-surfaces-page.html',
  styleUrl: './placement-surfaces-page.css',
})
export class PlacementSurfacesPage implements AfterViewInit {
  readonly #route = inject(ActivatedRoute);
  readonly #api = inject(PlacementSurfacesApi);
  readonly #locationsApi = inject(TypicalLocationsApi);

  private readonly canvas = viewChild(SurfaceCanvasComponent);

  readonly locationId = signal(this.#route.snapshot.paramMap.get('locationId') ?? '');
  readonly locationName = signal('Typical Location');
  readonly surfaces = signal<readonly PlacementSurfaceSummary[]>([]);
  readonly activeSurfaceId = signal('');
  readonly detail = signal<PlacementSurfaceDetail | null>(null);
  readonly tool = signal<ToolMode>('select');
  readonly selection = signal<Selection | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly announcement = signal('');

  surfaceNameDraft = '';
  slotLabelDraft = '';
  slotX = '';
  slotY = '';
  slotW = '';
  slotH = '';

  readonly tools: ToolDef[] = [
    { id: 'select', label: 'Select', icon: 'arrow-selector-tool', hint: 'Select / move / resize' },
    { id: 'pan', label: 'Pan', icon: 'pan-tool', hint: 'Pan the infinite sketch (or middle-drag)' },
    {
      id: 'structure-rect',
      label: 'Structure box',
      icon: 'crop-square',
      hint: 'Non-linkable structure rectangle',
    },
    {
      id: 'structure-line',
      label: 'Structure line',
      icon: 'horizontal-rule',
      hint: 'Non-linkable shelf / divider line',
    },
    { id: 'slot', label: 'Slot', icon: 'label', hint: 'Labeled Placement Slot' },
  ];

  readonly sceneSurface = computed((): SceneSurface | null => {
    const d = this.detail();
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      slots: d.slots.map(toSceneSlot),
      structures: d.structuralDrawings.map(toSceneStructure),
    };
  });

  readonly selectedSlot = computed(() => {
    const sel = this.selection();
    const d = this.detail();
    if (!sel || sel.kind !== 'slot' || !d) return null;
    return d.slots.find((slot) => slot.id === sel.id) ?? null;
  });

  readonly selectedStructure = computed(() => {
    const sel = this.selection();
    const d = this.detail();
    if (!sel || sel.kind === 'slot' || !d) return null;
    return d.structuralDrawings.find((drawing) => drawing.id === sel.id) ?? null;
  });

  constructor() {
    effect(() => {
      const slot = this.selectedSlot();
      this.slotLabelDraft = slot?.label ?? '';
      this.slotX = slot != null ? String(slot.x) : '';
      this.slotY = slot != null ? String(slot.y) : '';
      this.slotW = slot != null ? String(slot.width) : '';
      this.slotH = slot != null ? String(slot.height) : '';
    });
    effect(() => {
      this.activeSurfaceId();
      queueMicrotask(() => this.canvas()?.fitContent());
    });
    void this.#bootstrap();
  }

  ngAfterViewInit(): void {
    this.canvas()?.fitContent();
  }

  setTool(tool: ToolMode): void {
    this.tool.set(tool);
  }

  fit(): void {
    this.canvas()?.fitContent();
  }

  async selectSurface(surfaceId: string): Promise<void> {
    if (surfaceId === this.activeSurfaceId() || this.busy()) return;
    this.selection.set(null);
    this.formError.set('');
    await this.#loadDetail(surfaceId);
  }

  async addSurface(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      const name = `Surface ${this.surfaces().length + 1}`;
      const response = await this.#api.create(this.locationId(), { name });
      const surface = response.placementSurface as PlacementSurfaceSummary;
      this.surfaces.update((list) => [...list, surface]);
      this.announcement.set(`${surface.name} created.`);
      await this.#loadDetail(surface.id);
    } catch {
      this.formError.set('We could not create that Placement Surface.');
    } finally {
      this.busy.set(false);
    }
  }

  async applySurfaceName(): Promise<void> {
    const detail = this.detail();
    if (!detail || this.busy()) return;
    const name = this.surfaceNameDraft.trim();
    if (!name || name === detail.name) return;
    if (name.length > SURFACE_NAME_MAX_LENGTH) {
      this.formError.set(`Use at most ${SURFACE_NAME_MAX_LENGTH} characters for the name.`);
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      const response = await this.#api.update(this.locationId(), detail.id, { name });
      const updated = response.placementSurface as PlacementSurfaceSummary;
      this.detail.update((d) => (d ? { ...d, name: updated.name, updatedAt: updated.updatedAt } : d));
      this.surfaces.update((list) =>
        list.map((surface) =>
          surface.id === updated.id
            ? { ...surface, name: updated.name, updatedAt: updated.updatedAt }
            : surface,
        ),
      );
      this.surfaceNameDraft = updated.name;
      this.announcement.set(`Surface renamed to ${updated.name}.`);
    } catch {
      this.formError.set('We could not rename that Placement Surface.');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteSurface(): Promise<void> {
    const detail = this.detail();
    if (!detail || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.#api.remove(this.locationId(), detail.id);
      const remaining = this.surfaces().filter((surface) => surface.id !== detail.id);
      this.surfaces.set(remaining);
      this.selection.set(null);
      this.announcement.set(`${detail.name} deleted.`);
      if (remaining.length === 0) {
        this.detail.set(null);
        this.activeSurfaceId.set('');
      } else {
        await this.#loadDetail(remaining[0]!.id);
      }
    } catch {
      this.formError.set('We could not delete that Placement Surface.');
    } finally {
      this.busy.set(false);
    }
  }

  onSelectShape(selection: { kind: SelectableKind; id: string } | null): void {
    this.selection.set(selection);
    if (selection) this.tool.set('select');
  }

  async onPlaceAt(event: { tool: ToolMode; x: number; y: number }): Promise<void> {
    const detail = this.detail();
    if (!detail || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      if (event.tool === 'slot') {
        const label = nextUniqueLabel(
          [{ slots: detail.slots }, ...this.#otherSurfaceSlotLabels()],
          'Slot',
        );
        const response = await this.#api.createSlot(this.locationId(), detail.id, {
          label,
          x: event.x - DEFAULT_SLOT_WIDTH_MM / 2,
          y: event.y - DEFAULT_SLOT_HEIGHT_MM / 2,
          width: DEFAULT_SLOT_WIDTH_MM,
          height: DEFAULT_SLOT_HEIGHT_MM,
        });
        const slot = response.placementSlot;
        this.detail.update((d) => (d ? { ...d, slots: [...d.slots, slot] } : d));
        this.#bumpActiveSlotCount(1);
        this.selection.set({ kind: 'slot', id: slot.id });
        this.tool.set('select');
        this.announcement.set(`Slot “${slot.label}” added.`);
      } else if (event.tool === 'structure-rect') {
        const response = await this.#api.createDrawing(this.locationId(), detail.id, {
          kind: 'rect',
          x: event.x - DEFAULT_STRUCT_WIDTH_MM / 2,
          y: event.y - DEFAULT_STRUCT_HEIGHT_MM / 2,
          width: DEFAULT_STRUCT_WIDTH_MM,
          height: DEFAULT_STRUCT_HEIGHT_MM,
        });
        const drawing = response.structuralDrawing;
        this.detail.update((d) =>
          d ? { ...d, structuralDrawings: [...d.structuralDrawings, drawing] } : d,
        );
        this.selection.set({ kind: 'structure-rect', id: drawing.id });
        this.tool.set('select');
        this.announcement.set('Structure rectangle added.');
      } else if (event.tool === 'structure-line') {
        const response = await this.#api.createDrawing(this.locationId(), detail.id, {
          kind: 'polyline',
          points: [
            { x: event.x - DEFAULT_LINE_HALF_LENGTH_MM, y: event.y },
            { x: event.x + DEFAULT_LINE_HALF_LENGTH_MM, y: event.y },
          ],
        });
        const drawing = response.structuralDrawing;
        this.detail.update((d) =>
          d ? { ...d, structuralDrawings: [...d.structuralDrawings, drawing] } : d,
        );
        this.selection.set({ kind: 'structure-line', id: drawing.id });
        this.tool.set('select');
        this.announcement.set('Structure line added.');
      }
    } catch (error) {
      this.formError.set(this.#friendlyError(error, 'We could not add that shape.'));
    } finally {
      this.busy.set(false);
    }
  }

  onMoveDelta(event: { dx: number; dy: number }): void {
    const sel = this.selection();
    const detail = this.detail();
    if (!sel || !detail) return;
    if (sel.kind === 'slot') {
      this.detail.update((d) => {
        if (!d) return d;
        return {
          ...d,
          slots: d.slots.map((slot) =>
            slot.id === sel.id
              ? { ...slot, x: slot.x + event.dx, y: slot.y + event.dy }
              : slot,
          ),
        };
      });
    } else if (sel.kind === 'structure-rect') {
      this.detail.update((d) => {
        if (!d) return d;
        return {
          ...d,
          structuralDrawings: d.structuralDrawings.map((drawing) =>
            drawing.id === sel.id && drawing.kind === 'rect'
              ? {
                  ...drawing,
                  x: (drawing.x ?? 0) + event.dx,
                  y: (drawing.y ?? 0) + event.dy,
                }
              : drawing,
          ),
        };
      });
    } else {
      this.detail.update((d) => {
        if (!d) return d;
        return {
          ...d,
          structuralDrawings: d.structuralDrawings.map((drawing) =>
            drawing.id === sel.id && drawing.kind === 'polyline' && drawing.points
              ? {
                  ...drawing,
                  points: drawing.points.map((p) => ({
                    x: p.x + event.dx,
                    y: p.y + event.dy,
                  })),
                }
              : drawing,
          ),
        };
      });
    }
  }

  onResizeTo(event: { width: number; height: number }): void {
    const sel = this.selection();
    if (!sel) return;
    const width = clampRectSize(event.width);
    const height = clampRectSize(event.height);
    if (sel.kind === 'slot') {
      this.detail.update((d) => {
        if (!d) return d;
        return {
          ...d,
          slots: d.slots.map((slot) =>
            slot.id === sel.id ? { ...slot, width, height } : slot,
          ),
        };
      });
    } else if (sel.kind === 'structure-rect') {
      this.detail.update((d) => {
        if (!d) return d;
        return {
          ...d,
          structuralDrawings: d.structuralDrawings.map((drawing) =>
            drawing.id === sel.id && drawing.kind === 'rect'
              ? { ...drawing, width, height }
              : drawing,
          ),
        };
      });
    }
  }

  async onInteractionEnd(): Promise<void> {
    await this.#persistSelectionGeometry();
  }

  async applySlotLabel(): Promise<void> {
    const slot = this.selectedSlot();
    const detail = this.detail();
    if (!slot || !detail || this.busy()) return;
    const label = this.slotLabelDraft.trim();
    if (!label) {
      this.formError.set('Slot label cannot be empty.');
      this.slotLabelDraft = slot.label;
      return;
    }
    if (label.length > SLOT_LABEL_MAX_LENGTH) {
      this.formError.set(`Use at most ${SLOT_LABEL_MAX_LENGTH} characters for the label.`);
      return;
    }
    if (label === slot.label) return;
    const allSurfaces = [
      { slots: detail.slots },
      ...this.#otherSurfaceSlotLabels(),
    ];
    if (isLabelTaken(allSurfaces, label, slot.id)) {
      this.formError.set(
        `“${label}” is already used on this Typical Location. Labels must be unique.`,
      );
      this.slotLabelDraft = slot.label;
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      const response = await this.#api.updateSlot(this.locationId(), detail.id, slot.id, {
        label,
      });
      const updated = response.placementSlot;
      this.detail.update((d) =>
        d
          ? {
              ...d,
              slots: d.slots.map((entry) => (entry.id === updated.id ? updated : entry)),
            }
          : d,
      );
      this.announcement.set(`Slot label → “${updated.label}”.`);
    } catch (error) {
      this.formError.set(this.#friendlyError(error, 'We could not rename that Slot.'));
      this.slotLabelDraft = slot.label;
    } finally {
      this.busy.set(false);
    }
  }

  async applySlotGeometryFields(): Promise<void> {
    const slot = this.selectedSlot();
    const detail = this.detail();
    if (!slot || !detail || this.busy()) return;
    const x = Number(this.slotX);
    const y = Number(this.slotY);
    const width = Number(this.slotW);
    const height = Number(this.slotH);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      this.formError.set('Slot geometry must be finite numbers with width and height > 0.');
      this.slotX = String(slot.x);
      this.slotY = String(slot.y);
      this.slotW = String(slot.width);
      this.slotH = String(slot.height);
      return;
    }
    if (x === slot.x && y === slot.y && width === slot.width && height === slot.height) {
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      const response = await this.#api.updateSlot(this.locationId(), detail.id, slot.id, {
        x,
        y,
        width,
        height,
      });
      const updated = response.placementSlot;
      this.detail.update((d) =>
        d
          ? {
              ...d,
              slots: d.slots.map((entry) => (entry.id === updated.id ? updated : entry)),
            }
          : d,
      );
      this.announcement.set('Slot geometry updated.');
    } catch {
      this.formError.set('We could not update Slot geometry.');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteSelection(): Promise<void> {
    const sel = this.selection();
    const detail = this.detail();
    if (!sel || !detail || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      if (sel.kind === 'slot') {
        await this.#api.removeSlot(this.locationId(), detail.id, sel.id);
        this.detail.update((d) =>
          d ? { ...d, slots: d.slots.filter((slot) => slot.id !== sel.id) } : d,
        );
        this.#bumpActiveSlotCount(-1);
        this.announcement.set('Slot deleted.');
      } else {
        await this.#api.removeDrawing(this.locationId(), detail.id, sel.id);
        this.detail.update((d) =>
          d
            ? {
                ...d,
                structuralDrawings: d.structuralDrawings.filter(
                  (drawing) => drawing.id !== sel.id,
                ),
              }
            : d,
        );
        this.announcement.set('Structural drawing deleted.');
      }
      this.selection.set(null);
    } catch {
      this.formError.set('We could not delete the selection.');
    } finally {
      this.busy.set(false);
    }
  }

  slotCountFor(surfaceId: string): number {
    const active = this.detail();
    if (active && active.id === surfaceId) return active.slots.length;
    return this.surfaces().find((surface) => surface.id === surfaceId)?.slotCount ?? 0;
  }

  async #bootstrap(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [locations, surfacesResponse] = await Promise.all([
        this.#locationsApi.list(),
        this.#api.list(this.locationId()),
      ]);
      const location = locations.typicalLocations.find(
        (entry) => entry.id === this.locationId(),
      );
      if (!location) {
        this.error.set('Typical Location was not found.');
        return;
      }
      this.locationName.set(location.name);
      this.surfaces.set(surfacesResponse.placementSurfaces);
      if (surfacesResponse.placementSurfaces.length > 0) {
        await this.#loadDetail(surfacesResponse.placementSurfaces[0]!.id);
      }
    } catch {
      this.error.set('We could not load Placement Surfaces for this Typical Location.');
    } finally {
      this.loading.set(false);
    }
  }

  async #loadDetail(surfaceId: string): Promise<void> {
    this.busy.set(true);
    this.formError.set('');
    try {
      const response = await this.#api.get(this.locationId(), surfaceId);
      const detail = response.placementSurface as PlacementSurfaceDetail;
      this.detail.set(detail);
      this.activeSurfaceId.set(detail.id);
      this.surfaceNameDraft = detail.name;
      this.selection.set(null);
    } catch {
      this.formError.set('We could not load that Placement Surface.');
    } finally {
      this.busy.set(false);
    }
  }

  async #persistSelectionGeometry(): Promise<void> {
    const sel = this.selection();
    const detail = this.detail();
    if (!sel || !detail || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      if (sel.kind === 'slot') {
        const slot = detail.slots.find((entry) => entry.id === sel.id);
        if (!slot) return;
        const response = await this.#api.updateSlot(this.locationId(), detail.id, slot.id, {
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
        });
        const updated = response.placementSlot;
        this.detail.update((d) =>
          d
            ? {
                ...d,
                slots: d.slots.map((entry) => (entry.id === updated.id ? updated : entry)),
              }
            : d,
        );
      } else {
        const drawing = detail.structuralDrawings.find((entry) => entry.id === sel.id);
        if (!drawing) return;
        if (drawing.kind === 'rect') {
          const response = await this.#api.updateDrawing(
            this.locationId(),
            detail.id,
            drawing.id,
            {
              x: drawing.x ?? 0,
              y: drawing.y ?? 0,
              width: drawing.width ?? DEFAULT_STRUCT_WIDTH_MM,
              height: drawing.height ?? DEFAULT_STRUCT_HEIGHT_MM,
            },
          );
          const updated = response.structuralDrawing;
          this.detail.update((d) =>
            d
              ? {
                  ...d,
                  structuralDrawings: d.structuralDrawings.map((entry) =>
                    entry.id === updated.id ? updated : entry,
                  ),
                }
              : d,
          );
        } else if (drawing.points) {
          const response = await this.#api.updateDrawing(
            this.locationId(),
            detail.id,
            drawing.id,
            { points: drawing.points },
          );
          const updated = response.structuralDrawing;
          this.detail.update((d) =>
            d
              ? {
                  ...d,
                  structuralDrawings: d.structuralDrawings.map((entry) =>
                    entry.id === updated.id ? updated : entry,
                  ),
                }
              : d,
          );
        }
      }
    } catch {
      this.formError.set('We could not save geometry changes.');
      await this.#loadDetail(detail.id);
    } finally {
      this.busy.set(false);
    }
  }

  #otherSurfaceSlotLabels(): { slots: { id: string; label: string }[] }[] {
    // Only the active surface detail is loaded with slots; uniqueness is also enforced by the API.
    return [];
  }

  #bumpActiveSlotCount(delta: number): void {
    const activeId = this.activeSurfaceId();
    this.surfaces.update((list) =>
      list.map((surface) =>
        surface.id === activeId
          ? { ...surface, slotCount: Math.max(0, surface.slotCount + delta) }
          : surface,
      ),
    );
  }

  #friendlyError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const code = (error.error as { code?: string } | null)?.code;
      if (code === 'placement_slot_label_conflict') {
        return 'That Slot label is already used on this Typical Location.';
      }
    }
    return fallback;
  }
}

function toSceneSlot(slot: PlacementSlot): SceneSlot {
  return {
    kind: 'slot',
    id: slot.id,
    label: slot.label,
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
  };
}

function toSceneStructure(drawing: StructuralDrawing): SceneStructure {
  if (drawing.kind === 'rect') {
    return {
      kind: 'structure-rect',
      id: drawing.id,
      x: drawing.x ?? 0,
      y: drawing.y ?? 0,
      width: drawing.width ?? DEFAULT_STRUCT_WIDTH_MM,
      height: drawing.height ?? DEFAULT_STRUCT_HEIGHT_MM,
    };
  }
  return {
    kind: 'structure-line',
    id: drawing.id,
    points: drawing.points ?? [],
  };
}
