import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { ItemPhotosApi } from '../../../core/api/item-photos-api.service';
import { SharingGroup, TypicalLocation } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { TypicalLocationsApi } from '../../../core/api/typical-locations-api.service';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import {
  DEFAULT_ITEM_ICON,
  DEFAULT_SHARING_GROUP_ICON,
  ITEM_PHOTO_ACCEPT,
  friendlyApiError,
  normalizeCategoryInput,
  photoInputError,
} from '../functions';

@Component({
  selector: 'app-share-tool-page',
  imports: [MaterialSymbolIconComponent, ReactiveFormsModule],
  templateUrl: './share-tool-page.component.html',
  styleUrl: './share-tool-page.component.css',
})
export class ShareToolPageComponent implements OnDestroy {
  readonly #inventoryApi = inject(InventoryApi);
  readonly #sharingApi = inject(SharingApi);
  readonly #locationsApi = inject(TypicalLocationsApi);
  readonly #photosApi = inject(ItemPhotosApi);
  readonly defaultItemIcon = DEFAULT_ITEM_ICON;
  readonly defaultSharingGroupIcon = DEFAULT_SHARING_GROUP_ICON;
  readonly itemPhotoAccept = ITEM_PHOTO_ACCEPT;
  readonly groups = signal<readonly SharingGroup[]>([]);
  readonly locations = signal<readonly TypicalLocation[]>([]);
  readonly selectedGroupIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedPhoto = signal<File | null>(null);
  readonly selectedPhotoPreviewUrl = signal('');
  readonly photoError = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly announcement = signal('');
  readonly knownCategories = computed(() => [] as readonly string[]);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    categories: new FormControl('', { nonNullable: true }),
    typicalLocationId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.#revokePhotoPreviewUrl();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [groups, locations] = await Promise.all([
        this.#sharingApi.listGroups(),
        this.#locationsApi.list(),
      ]);
      this.groups.set(groups.sharingGroups);
      this.locations.set(locations.typicalLocations);
    } catch {
      this.error.set('We could not load Share a tool.');
    } finally {
      this.loading.set(false);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedGroupIds().has(id);
  }

  selectPhoto(file: File | null): void {
    const validationError = photoInputError(file);
    this.photoError.set(validationError);
    if (validationError || !file) return;
    this.#revokePhotoPreviewUrl();
    this.selectedPhoto.set(file);
    this.selectedPhotoPreviewUrl.set(URL.createObjectURL(file));
  }

  cancelPhoto(): void {
    this.#revokePhotoPreviewUrl();
    this.selectedPhoto.set(null);
    this.photoError.set('');
  }

  #revokePhotoPreviewUrl(): void {
    const previewUrl = this.selectedPhotoPreviewUrl();
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    this.selectedPhotoPreviewUrl.set('');
  }

  setGroupSelected(id: string, selected: boolean): void {
    this.selectedGroupIds.update((ids) => {
      const next = new Set(ids);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.announcement.set('');
    try {
      const item = await this.#inventoryApi.create({
        name: this.form.controls.name.value.trim(),
        description: this.form.controls.description.value.trim() || null,
        typicalLocationId: this.form.controls.typicalLocationId.value,
        categories: normalizeCategoryInput(this.form.controls.categories.value),
      });
      if (this.selectedPhoto()) await this.#photosApi.upload(item.item.id, this.selectedPhoto()!);
      const selectedGroupIds = Array.from(this.selectedGroupIds());
      const shareResults = await Promise.allSettled(
        selectedGroupIds.map((groupId) => this.#sharingApi.shareItem(item.item.id, groupId)),
      );
      const failedShareCount = shareResults.filter((result) => result.status === 'rejected').length;
      if (failedShareCount > 0) {
        this.error.set(
          `Item created, but ${failedShareCount} Sharing Group selection${failedShareCount === 1 ? '' : 's'} could not be shared. You can finish sharing from Your inventory.`,
        );
        return;
      }
      this.announcement.set(
        selectedGroupIds.length === 0 ? 'Private Item created.' : 'Item created and shared.',
      );
      this.form.reset({
        name: '',
        description: '',
        categories: '',
        typicalLocationId: '',
      });
      this.selectedGroupIds.set(new Set());
      this.cancelPhoto();
    } catch (error) {
      this.error.set(friendlyApiError(error, 'We could not create that Item.'));
    } finally {
      this.saving.set(false);
    }
  }
}
