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
import { FormField, form, maxLength, validate } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Item, PlacementSurfaceDetail, PlacementSurfaceSummary } from '../../../core/api/model';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { PlacementSurfacesApi } from '../../../core/api/placement-surfaces-api.service';
import { TypicalLocationsApi } from '../../../core/api/typical-locations-api.service';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import {
  itemSlotAssignHint,
  itemsAssignableToSlot,
  itemsLinkedToSlot,
} from './functions';
import {
  DEFAULT_LINE_HALF_LENGTH_MM,
  DEFAULT_SLOT_HEIGHT_MM,
  DEFAULT_SLOT_WIDTH_MM,
  DEFAULT_STRUCT_HEIGHT_MM,
  DEFAULT_STRUCT_WIDTH_MM,
  SceneSurface,
  SelectableKind,
  Selection,
  SLOT_LABEL_MAX_LENGTH,
  SURFACE_NAME_MAX_LENGTH,
  ToolMode,
  clampRectSize,
  formatMm,
  isLabelTaken,
  nextUniqueLabel,
  roundMm,
  roundPoint,
  toSceneSlot,
  toSceneStructure,
} from './scene.model';
import { SurfaceCanvas } from './surface-canvas';

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
    FormField,
    MaterialSymbolIconComponent,
    PageLayout,
    RouterLink,
    SurfaceCanvas,
  ],
  templateUrl: './placement-surfaces-page.html',
  styleUrl: './placement-surfaces-page.css',
})
export class PlacementSurfacesPage implements AfterViewInit {
  readonly #route = inject(ActivatedRoute);
  readonly #api = inject(PlacementSurfacesApi);
  readonly #locationsApi = inject(TypicalLocationsApi);
  readonly #inventoryApi = inject(InventoryApi);

  // Angular forbids ES private on viewChild fields (NG1053).
  private readonly canvas = viewChild(SurfaceCanvas);

  readonly locationId = signal(this.#route.snapshot.paramMap.get('locationId') ?? '');
  readonly locationName = signal('Typical Location');
  readonly surfaces = signal<readonly PlacementSurfaceSummary[]>([]);
  readonly activeSurfaceId = signal('');
  readonly detail = signal<PlacementSurfaceDetail | null>(null);
  /** Owner inventory at this Typical Location (for canvas Slot assign). */
  readonly locationItems = signal<readonly Item[]>([]);
  /** Slot id/label by surface — for location-wide uniqueness (not only active surface). */
  readonly #slotCatalog = signal<
    ReadonlyMap<string, readonly { readonly id: string; readonly label: string }[]>
  >(new Map());
  readonly tool = signal<ToolMode>('select');
  readonly selection = signal<Selection | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly itemsBusy = signal(false);
  readonly itemsLoading = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly announcement = signal('');
  /** Draft Item id for the compact assign control when a Slot is selected. */
  readonly assignItemId = signal('');

  readonly surfaceModel = signal({ name: '' });
  readonly surfaceForm = form(this.surfaceModel, (path) => {
    validate(path.name, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter a surface name.' },
    );
    maxLength(path.name, SURFACE_NAME_MAX_LENGTH, {
      message: `Use at most ${SURFACE_NAME_MAX_LENGTH} characters.`,
    });
  });

  readonly slotModel = signal({
    label: '',
    x: '',
    y: '',
    width: '',
    height: '',
  });
  readonly slotForm = form(this.slotModel, (path) => {
    validate(path.label, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Slot label cannot be empty.' },
    );
    maxLength(path.label, SLOT_LABEL_MAX_LENGTH, {
      message: `Use at most ${SLOT_LABEL_MAX_LENGTH} characters for the label.`,
    });
  });

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

  readonly linkedItems = computed(() => {
    const slot = this.selectedSlot();
    if (!slot) return [];
    return itemsLinkedToSlot(this.locationItems(), slot.id);
  });

  readonly assignableItems = computed(() => {
    const slot = this.selectedSlot();
    if (!slot) return [];
    return itemsAssignableToSlot(this.locationItems(), slot.id);
  });

  constructor() {
    effect(() => {
      const slot = this.selectedSlot();
      this.slotModel.set({
        label: slot?.label ?? '',
        x: slot != null ? formatMm(slot.x) : '',
        y: slot != null ? formatMm(slot.y) : '',
        width: slot != null ? formatMm(slot.width) : '',
        height: slot != null ? formatMm(slot.height) : '',
      });
    });
    effect(() => {
      this.activeSurfaceId();
      queueMicrotask(() => this.canvas()?.fitContent());
    });
    void this.#bootstrap();
  }

  itemAssignHint = itemSlotAssignHint;

  onAssignItemChange(event: Event): void {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select) return;
    this.assignItemId.set(select.value);
  }

  async linkItemToSelectedSlot(): Promise<void> {
    const slot = this.selectedSlot();
    const itemId = this.assignItemId();
    if (!slot || !itemId || this.itemsBusy()) return;
    this.itemsBusy.set(true);
    this.formError.set('');
    try {
      const response = await this.#inventoryApi.update(itemId, {
        placementSlotId: slot.id,
      });
      this.#upsertLocationItem(response.item);
      this.assignItemId.set('');
      this.announcement.set(`Linked “${response.item.name}” to “${slot.label}”.`);
    } catch {
      this.formError.set('We could not link that Item to the Slot.');
    } finally {
      this.itemsBusy.set(false);
    }
  }

  async unlinkItemFromSlot(item: Item): Promise<void> {
    const slot = this.selectedSlot();
    if (!slot || this.itemsBusy()) return;
    this.itemsBusy.set(true);
    this.formError.set('');
    try {
      const response = await this.#inventoryApi.update(item.id, {
        placementSlotId: null,
      });
      this.#upsertLocationItem(response.item);
      this.announcement.set(`Unlinked “${response.item.name}” from “${slot.label}”.`);
    } catch {
      this.formError.set('We could not unlink that Item from the Slot.');
    } finally {
      this.itemsBusy.set(false);
    }
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
      this.#rememberSurfaceSlots(surface.id, []);
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
    const name = this.surfaceModel().name.trim();
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
      this.surfaceModel.set({ name: updated.name });
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
      this.#forgetSurfaceSlots(detail.id);
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
    this.assignItemId.set('');
    if (selection) this.tool.set('select');
  }

  async onPlaceAt(event: { tool: ToolMode; x: number; y: number }): Promise<void> {
    const detail = this.detail();
    if (!detail || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      if (event.tool === 'slot') {
        await this.#ensureSlotCatalog();
        const label = nextUniqueLabel(this.#surfacesForLabelUniqueness(detail.slots), 'Slot');
        const response = await this.#api.createSlot(this.locationId(), detail.id, {
          label,
          x: roundMm(event.x - DEFAULT_SLOT_WIDTH_MM / 2),
          y: roundMm(event.y - DEFAULT_SLOT_HEIGHT_MM / 2),
          width: DEFAULT_SLOT_WIDTH_MM,
          height: DEFAULT_SLOT_HEIGHT_MM,
        });
        const slot = response.placementSlot;
        this.detail.update((d) => (d ? { ...d, slots: [...d.slots, slot] } : d));
        this.#rememberSurfaceSlots(detail.id, [...detail.slots, slot]);
        this.#bumpActiveSlotCount(1);
        this.selection.set({ kind: 'slot', id: slot.id });
        this.tool.set('select');
        this.announcement.set(`Slot “${slot.label}” added.`);
      } else if (event.tool === 'structure-rect') {
        const response = await this.#api.createDrawing(this.locationId(), detail.id, {
          kind: 'rect',
          x: roundMm(event.x - DEFAULT_STRUCT_WIDTH_MM / 2),
          y: roundMm(event.y - DEFAULT_STRUCT_HEIGHT_MM / 2),
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
            roundPoint({ x: event.x - DEFAULT_LINE_HALF_LENGTH_MM, y: event.y }),
            roundPoint({ x: event.x + DEFAULT_LINE_HALF_LENGTH_MM, y: event.y }),
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

  onMoveEndpoint(event: { index: number; x: number; y: number }): void {
    const sel = this.selection();
    if (!sel || sel.kind !== 'structure-line') return;
    this.detail.update((d) => {
      if (!d) return d;
      return {
        ...d,
        structuralDrawings: d.structuralDrawings.map((drawing) => {
          if (drawing.id !== sel.id || drawing.kind !== 'polyline' || !drawing.points) {
            return drawing;
          }
          return {
            ...drawing,
            points: drawing.points.map((point, index) =>
              index === event.index ? { x: event.x, y: event.y } : point,
            ),
          };
        }),
      };
    });
  }

  async onInteractionEnd(): Promise<void> {
    this.#snapSelectionGeometry();
    await this.#persistSelectionGeometry();
  }

  async applySlotLabel(): Promise<void> {
    const slot = this.selectedSlot();
    const detail = this.detail();
    if (!slot || !detail || this.busy()) return;
    const label = this.slotModel().label.trim();
    if (!label) {
      this.formError.set('Slot label cannot be empty.');
      this.slotModel.update((m) => ({ ...m, label: slot.label }));
      return;
    }
    if (label.length > SLOT_LABEL_MAX_LENGTH) {
      this.formError.set(`Use at most ${SLOT_LABEL_MAX_LENGTH} characters for the label.`);
      return;
    }
    if (label === slot.label) return;
    await this.#ensureSlotCatalog();
    if (isLabelTaken(this.#surfacesForLabelUniqueness(detail.slots), label, slot.id)) {
      this.formError.set(
        `“${label}” is already used on this Typical Location. Labels must be unique.`,
      );
      this.slotModel.update((m) => ({ ...m, label: slot.label }));
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    try {
      const response = await this.#api.updateSlot(this.locationId(), detail.id, slot.id, {
        label,
      });
      const updated = response.placementSlot;
      const nextSlots = detail.slots.map((entry) =>
        entry.id === updated.id ? updated : entry,
      );
      this.detail.update((d) =>
        d
          ? {
              ...d,
              slots: nextSlots,
            }
          : d,
      );
      this.#rememberSurfaceSlots(detail.id, nextSlots);
      this.announcement.set(`Slot label → “${updated.label}”.`);
    } catch (error) {
      this.formError.set(this.#friendlyError(error, 'We could not rename that Slot.'));
      this.slotModel.update((m) => ({ ...m, label: slot.label }));
    } finally {
      this.busy.set(false);
    }
  }

  async applySlotGeometryFields(): Promise<void> {
    const slot = this.selectedSlot();
    const detail = this.detail();
    if (!slot || !detail || this.busy()) return;
    const draft = this.slotModel();
    const x = roundMm(Number(draft.x));
    const y = roundMm(Number(draft.y));
    const width = clampRectSize(Number(draft.width));
    const height = clampRectSize(Number(draft.height));
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      this.formError.set('Slot geometry must be whole millimetres with width and height > 0.');
      this.slotModel.set({
        label: slot.label,
        x: formatMm(slot.x),
        y: formatMm(slot.y),
        width: formatMm(slot.width),
        height: formatMm(slot.height),
      });
      return;
    }
    if (
      x === roundMm(slot.x) &&
      y === roundMm(slot.y) &&
      width === clampRectSize(slot.width) &&
      height === clampRectSize(slot.height)
    ) {
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
        const nextSlots = detail.slots.filter((slot) => slot.id !== sel.id);
        this.detail.update((d) => (d ? { ...d, slots: nextSlots } : d));
        this.#rememberSurfaceSlots(detail.id, nextSlots);
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
      await Promise.all([this.#ensureSlotCatalog(), this.#loadLocationItems()]);
      if (surfacesResponse.placementSurfaces.length > 0) {
        await this.#loadDetail(surfacesResponse.placementSurfaces[0]!.id);
      }
    } catch {
      this.error.set('We could not load Placement Surfaces for this Typical Location.');
    } finally {
      this.loading.set(false);
    }
  }

  async #loadLocationItems(): Promise<void> {
    this.itemsLoading.set(true);
    try {
      const response = await this.#inventoryApi.list(this.locationId());
      this.locationItems.set(response.items);
    } catch {
      this.locationItems.set([]);
    } finally {
      this.itemsLoading.set(false);
    }
  }

  #upsertLocationItem(item: Item): void {
    this.locationItems.update((items) => {
      const index = items.findIndex((entry) => entry.id === item.id);
      if (index < 0) return [...items, item];
      return items.map((entry) => (entry.id === item.id ? item : entry));
    });
  }

  async #loadDetail(surfaceId: string): Promise<void> {
    this.busy.set(true);
    this.formError.set('');
    try {
      const response = await this.#api.get(this.locationId(), surfaceId);
      const detail = response.placementSurface as PlacementSurfaceDetail;
      this.detail.set(detail);
      this.activeSurfaceId.set(detail.id);
      this.surfaceModel.set({ name: detail.name });
      this.selection.set(null);
      this.#rememberSurfaceSlots(detail.id, detail.slots);
    } catch {
      this.formError.set('We could not load that Placement Surface.');
    } finally {
      this.busy.set(false);
    }
  }

  #snapSelectionGeometry(): void {
    const sel = this.selection();
    if (!sel) return;
    this.detail.update((d) => {
      if (!d) return d;
      if (sel.kind === 'slot') {
        return {
          ...d,
          slots: d.slots.map((slot) =>
            slot.id === sel.id
              ? {
                  ...slot,
                  x: roundMm(slot.x),
                  y: roundMm(slot.y),
                  width: clampRectSize(slot.width),
                  height: clampRectSize(slot.height),
                }
              : slot,
          ),
        };
      }
      return {
        ...d,
        structuralDrawings: d.structuralDrawings.map((drawing) => {
          if (drawing.id !== sel.id) return drawing;
          if (drawing.kind === 'rect') {
            return {
              ...drawing,
              x: roundMm(drawing.x ?? 0),
              y: roundMm(drawing.y ?? 0),
              width: clampRectSize(drawing.width ?? DEFAULT_STRUCT_WIDTH_MM),
              height: clampRectSize(drawing.height ?? DEFAULT_STRUCT_HEIGHT_MM),
            };
          }
          return {
            ...drawing,
            points: (drawing.points ?? []).map(roundPoint),
          };
        }),
      };
    });
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
          x: roundMm(slot.x),
          y: roundMm(slot.y),
          width: clampRectSize(slot.width),
          height: clampRectSize(slot.height),
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
              x: roundMm(drawing.x ?? 0),
              y: roundMm(drawing.y ?? 0),
              width: clampRectSize(drawing.width ?? DEFAULT_STRUCT_WIDTH_MM),
              height: clampRectSize(drawing.height ?? DEFAULT_STRUCT_HEIGHT_MM),
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
            { points: drawing.points.map(roundPoint) },
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

  /**
   * Surfaces used for location-wide slot label uniqueness.
   * Active surface slots come from live detail; others from the catalog.
   */
  #surfacesForLabelUniqueness(
    activeSlots: readonly { readonly id: string; readonly label: string }[],
  ): { slots: readonly { readonly id: string; readonly label: string }[] }[] {
    const activeId = this.activeSurfaceId();
    const others = [...this.#slotCatalog().entries()]
      .filter(([surfaceId]) => surfaceId !== activeId)
      .map(([, slots]) => ({ slots }));
    return [{ slots: activeSlots }, ...others];
  }

  #rememberSurfaceSlots(
    surfaceId: string,
    slots: readonly { readonly id: string; readonly label: string }[],
  ): void {
    this.#slotCatalog.update((previous) => {
      const next = new Map(previous);
      next.set(
        surfaceId,
        slots.map((slot) => ({ id: slot.id, label: slot.label })),
      );
      return next;
    });
  }

  #forgetSurfaceSlots(surfaceId: string): void {
    this.#slotCatalog.update((previous) => {
      const next = new Map(previous);
      next.delete(surfaceId);
      return next;
    });
  }

  /** Load slot labels for any surfaces not yet in the catalog (location-wide uniqueness). */
  async #ensureSlotCatalog(): Promise<void> {
    const known = this.#slotCatalog();
    const missing = this.surfaces().filter((surface) => !known.has(surface.id));
    if (missing.length === 0) return;
    const responses = await Promise.all(
      missing.map((surface) => this.#api.get(this.locationId(), surface.id)),
    );
    this.#slotCatalog.update((previous) => {
      const next = new Map(previous);
      for (const response of responses) {
        const detail = response.placementSurface as PlacementSurfaceDetail;
        next.set(
          detail.id,
          detail.slots.map((slot) => ({ id: slot.id, label: slot.label })),
        );
      }
      return next;
    });
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
