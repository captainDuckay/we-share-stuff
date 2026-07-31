import { Component, computed, input, output } from '@angular/core';
import { Item, ItemPhoto, SharedItem } from '../../../core/api/model';
import { DEFAULT_ITEM_ICON, displayCategoryName, itemPhotoUrl } from '../functions';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import { SharedItemDetailCardComponent } from '../shared-item-detail-card/shared-item-detail-card.component';
import { ownedSharedItemView, typicalPlacementOwnerLabel } from './functions';

@Component({
  selector: 'app-owned-item-summary',
  imports: [MaterialSymbolIconComponent, SharedItemDetailCardComponent],
  templateUrl: './owned-item-summary.html',
  styleUrls: [
    './owned-item-summary.css',
    '../shared-item-detail-card/shared-item-detail-card.component.css',
  ],
})
export class OwnedItemSummary {
  readonly defaultItemIcon = DEFAULT_ITEM_ICON;
  readonly item = input.required<Item>();
  readonly photos = input<readonly ItemPhoto[]>([]);
  readonly photosLoaded = input(false);
  readonly sharedItem = input<SharedItem | null>(null);
  readonly currentUserId = input<string | null | undefined>(null);
  readonly editRequested = output<void>();

  readonly sharedItemView = computed<SharedItem | null>(() => {
    const sharedItem = this.sharedItem();
    if (!sharedItem) return null;
    const photos = this.photosLoaded() ? this.photos() : sharedItem.itemPhotos;
    return ownedSharedItemView(this.item(), sharedItem, photos);
  });

  readonly placementLabel = computed(() => {
    const item = this.item();
    return typicalPlacementOwnerLabel(item.typicalPlacement, item.placementSlot);
  });

  photoUrl(): string | null {
    return this.photos()[0]?.url ?? itemPhotoUrl(this.item());
  }

  categoryLabels(): readonly string[] {
    return this.item().categories?.map(({ name }) => displayCategoryName(name)) ?? [];
  }
}
