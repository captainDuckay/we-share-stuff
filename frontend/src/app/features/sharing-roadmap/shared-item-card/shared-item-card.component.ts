import { Component, input } from '@angular/core';
import { Item, SharedItem } from '../../../core/api/model';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import { compactCategoryLabels, DEFAULT_ITEM_ICON, itemPhotoUrl } from '../functions';

@Component({
  selector: 'a[app-shared-item-card]',
  imports: [MaterialSymbolIconComponent, UserAvatar],
  templateUrl: './shared-item-card.component.html',
  styleUrl: './shared-item-card.component.css',
})
export class SharedItemCardComponent {
  readonly item = input.required<Item | SharedItem>();
  readonly ownerName = input('');
  readonly ownerPhotoUrl = input<string | null>(null);

  readonly defaultItemIcon = DEFAULT_ITEM_ICON;

  photoUrl(item: Item | SharedItem): string | null {
    return itemPhotoUrl(item);
  }

  categoryLabels(item: Item | SharedItem): readonly string[] {
    return compactCategoryLabels(item.categories);
  }

  typicalLocationName(item: Item | SharedItem): string {
    return item.typicalLocation?.name ?? 'No Typical Location';
  }
}
