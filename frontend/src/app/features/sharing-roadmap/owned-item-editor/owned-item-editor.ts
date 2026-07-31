import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormField, form, maxLength, submit, validate } from '@angular/forms/signals';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { ItemPhotosApi } from '../../../core/api/item-photos-api.service';
import {
  Item,
  ItemPhoto,
  PlacementSurfaceDetail,
  SharedItem,
  TypicalLocation,
} from '../../../core/api/model';
import { PlacementSurfacesApi } from '../../../core/api/placement-surfaces-api.service';
import { TypicalLocationsApi } from '../../../core/api/typical-locations-api.service';
import { friendlyApiError, ITEM_PHOTO_ACCEPT, photoInputError } from '../functions';
import { OwnedItemSummary } from '../owned-item-summary/owned-item-summary';
import {
  applyTypicalLocationSelection,
  itemEditModel,
  itemUpdateInput,
  placementSlotOptions,
} from './functions';

const ITEM_NAME_MAX_LENGTH = 200;
const ITEM_DESCRIPTION_MAX_LENGTH = 2_000;
const ITEM_PLACEMENT_MAX_LENGTH = 2_000;

@Component({
  selector: 'app-owned-item-editor',
  imports: [FormField, OwnedItemSummary],
  templateUrl: './owned-item-editor.html',
  styleUrl: './owned-item-editor.css',
})
export class OwnedItemEditor implements OnDestroy, OnInit {
  readonly #inventoryApi = inject(InventoryApi);
  readonly #photosApi = inject(ItemPhotosApi);
  readonly #locationsApi = inject(TypicalLocationsApi);
  readonly #surfacesApi = inject(PlacementSurfacesApi);

  readonly item = input.required<Item>();
  readonly sharedItem = input<SharedItem | null>(null);
  readonly currentUserId = input<string | null | undefined>(null);
  readonly itemUpdated = output<Item>();
  readonly editModel = linkedSignal(() => itemEditModel(this.item()));
  readonly editForm = form(this.editModel, (path) => {
    validate(path.name, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter an Item name.' },
    );
    maxLength(path.name, ITEM_NAME_MAX_LENGTH, {
      message: `Use at most ${ITEM_NAME_MAX_LENGTH} characters.`,
    });
    maxLength(path.description, ITEM_DESCRIPTION_MAX_LENGTH, {
      message: `Use at most ${ITEM_DESCRIPTION_MAX_LENGTH} characters.`,
    });
    maxLength(path.typicalPlacement, ITEM_PLACEMENT_MAX_LENGTH, {
      message: `Use at most ${ITEM_PLACEMENT_MAX_LENGTH} characters.`,
    });
  });
  readonly itemPhotoAccept = ITEM_PHOTO_ACCEPT;
  readonly locations = signal<readonly TypicalLocation[]>([]);
  readonly photos = signal<readonly ItemPhoto[]>([]);
  readonly photosLoaded = signal(false);
  readonly selectedPhoto = signal<File | null>(null);
  readonly selectedPhotoPreviewUrl = signal('');
  readonly loadingSupport = signal(true);
  readonly loadingSlots = signal(false);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly photoBusy = signal(false);
  readonly error = signal('');
  readonly photoError = signal('');
  readonly announcement = signal('');
  readonly slotClearedNotice = signal('');
  readonly #locationSurfaces = signal<readonly PlacementSurfaceDetail[]>([]);
  readonly slotOptions = computed(() => {
    const linked = this.item().placementSlot;
    const ensureSlot =
      linked && this.editModel().placementSlotId === linked.id
        ? {
            id: linked.id,
            label: linked.label,
            surfaceName: linked.surfaceName,
          }
        : null;
    return placementSlotOptions(this.#locationSurfaces(), ensureSlot);
  });
  /** Location id before the latest location control change (for slot auto-clear). */
  #committedLocationId = '';

  constructor() {
    effect(() => {
      const locationId = this.editModel().typicalLocationId;
      if (!this.editing() || !locationId) {
        this.#locationSurfaces.set([]);
        return;
      }
      void this.#loadSlotsForLocation(locationId);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.#loadSupport();
  }

  ngOnDestroy(): void {
    this.#revokePhotoPreview();
  }

  startEditing(): void {
    this.editModel.set(itemEditModel(this.item()));
    this.#committedLocationId = this.editModel().typicalLocationId;
    this.editing.set(true);
    this.announcement.set('');
    this.slotClearedNotice.set('');
  }

  cancelEditing(): void {
    this.editModel.set(itemEditModel(this.item()));
    this.#committedLocationId = this.editModel().typicalLocationId;
    this.cancelPhotoSelection();
    this.error.set('');
    this.slotClearedNotice.set('');
    this.editing.set(false);
  }

  onTypicalLocationChange(event: Event): void {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select) return;
    const result = applyTypicalLocationSelection(
      this.editModel(),
      select.value,
      this.#committedLocationId,
    );
    this.editModel.set(result.model);
    this.#committedLocationId = result.model.typicalLocationId;
    this.slotClearedNotice.set(result.slotClearedNotice ?? '');
  }

  unlinkPlacementSlot(): void {
    this.editModel.update((model) => ({ ...model, placementSlotId: '' }));
    this.slotClearedNotice.set('');
  }

  submitEdit(): void {
    if (this.saving()) return;
    void submit(this.editForm, async () => this.#save());
  }

  selectPhoto(event: Event): void {
    const inputElement = event.target instanceof HTMLInputElement ? event.target : null;
    const file = inputElement?.files?.item(0) ?? null;
    const validationError = photoInputError(file);
    this.photoError.set(validationError);
    this.#revokePhotoPreview();
    this.selectedPhoto.set(validationError ? null : file);
    if (file && !validationError) {
      this.selectedPhotoPreviewUrl.set(URL.createObjectURL(file));
    }
  }

  cancelPhotoSelection(): void {
    this.#revokePhotoPreview();
    this.selectedPhoto.set(null);
    this.photoError.set('');
  }

  async uploadPhoto(): Promise<void> {
    const file = this.selectedPhoto();
    if (!file || this.photoBusy()) return;
    this.photoBusy.set(true);
    this.photoError.set('');
    try {
      const response = await this.#photosApi.upload(this.item().id, file);
      this.photos.update((photos) => [...photos, response.itemPhoto]);
      this.cancelPhotoSelection();
      this.announcement.set('Item Photo added.');
    } catch (error) {
      this.photoError.set(friendlyApiError(error, 'We could not upload that Item Photo.'));
    } finally {
      this.photoBusy.set(false);
    }
  }

  async removePhoto(photo: ItemPhoto): Promise<void> {
    if (this.photoBusy()) return;
    this.photoBusy.set(true);
    this.photoError.set('');
    try {
      await this.#photosApi.remove(this.item().id, photo.id);
      this.photos.update((photos) => photos.filter(({ id }) => id !== photo.id));
      this.announcement.set('Item Photo removed.');
    } catch (error) {
      this.photoError.set(friendlyApiError(error, 'We could not remove that Item Photo.'));
    } finally {
      this.photoBusy.set(false);
    }
  }

  async #loadSupport(): Promise<void> {
    this.loadingSupport.set(true);
    this.error.set('');
    try {
      const [locations, photos] = await Promise.all([
        this.#locationsApi.list(),
        this.#photosApi.list(this.item().id),
      ]);
      this.locations.set(locations.typicalLocations);
      this.photos.set(photos.itemPhotos);
      this.photosLoaded.set(true);
    } catch (error) {
      this.error.set(friendlyApiError(error, 'We could not load the Item editing options.'));
    } finally {
      this.loadingSupport.set(false);
    }
  }

  async #loadSlotsForLocation(locationId: string): Promise<void> {
    this.loadingSlots.set(true);
    try {
      const listed = await this.#surfacesApi.list(locationId);
      const details = await Promise.all(
        listed.placementSurfaces.map(async (summary) => {
          const response = await this.#surfacesApi.get(locationId, summary.id);
          const surface = response.placementSurface;
          if (!('slots' in surface)) {
            return {
              ...surface,
              slots: [],
              structuralDrawings: [],
            } satisfies PlacementSurfaceDetail;
          }
          return surface;
        }),
      );
      if (this.editModel().typicalLocationId === locationId) {
        this.#locationSurfaces.set(details);
      }
    } catch {
      if (this.editModel().typicalLocationId === locationId) {
        this.#locationSurfaces.set([]);
      }
    } finally {
      this.loadingSlots.set(false);
    }
  }

  async #save(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    this.announcement.set('');
    try {
      const response = await this.#inventoryApi.update(
        this.item().id,
        itemUpdateInput(this.editModel()),
      );
      this.itemUpdated.emit(response.item);
      this.announcement.set('Item updated.');
      this.slotClearedNotice.set('');
      this.editing.set(false);
    } catch (error) {
      this.error.set(friendlyApiError(error, 'We could not update that Item.'));
    } finally {
      this.saving.set(false);
    }
  }

  #revokePhotoPreview(): void {
    const previewUrl = this.selectedPhotoPreviewUrl();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    this.selectedPhotoPreviewUrl.set('');
  }
}
