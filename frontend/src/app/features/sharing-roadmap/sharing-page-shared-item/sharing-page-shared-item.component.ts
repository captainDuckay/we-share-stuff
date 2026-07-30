import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SharedItem, SharingGroup, SharingGroupSummary } from '../../../core/api/model';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import { DEFAULT_ITEM_ICON, formatUtcRangeInTimezone, typicalPlacementLabel } from '../functions';

export interface SharingPageSharedItemReservationRequest {
  readonly group: SharingGroup;
  readonly item: SharedItem;
  readonly startLocal: string;
  readonly endLocal: string;
}

@Component({
  selector: 'article[app-sharing-page-shared-item]',
  imports: [MaterialSymbolIconComponent, RouterLink, UserAvatar],
  templateUrl: './sharing-page-shared-item.component.html',
  styleUrl: './sharing-page-shared-item.component.css',
})
export class SharingPageSharedItemComponent {
  readonly defaultItemIcon = DEFAULT_ITEM_ICON;
  readonly group = input<SharingGroup | null>(null);
  readonly item = input.required<SharedItem>();
  readonly currentUserId = input<string | null | undefined>(null);
  readonly showDetails = input(true);
  readonly visibleThrough = input<readonly SharingGroupSummary[]>([]);
  readonly reservationRequested = output<SharingPageSharedItemReservationRequest>();

  acceptedRanges(): readonly string[] {
    return this.item().reservationState.acceptedRanges.map((range) =>
      formatUtcRangeInTimezone(range.startAt, range.endAt, range.timezone),
    );
  }

  placementLabel(): string {
    return typicalPlacementLabel(this.item().typicalPlacement);
  }

  isOwnItem(): boolean {
    return this.item().owner.id === this.currentUserId();
  }

  requestReservation(startLocal: string, endLocal: string): void {
    const group = this.group();
    if (!group) return;

    this.reservationRequested.emit({
      group,
      item: this.item(),
      startLocal,
      endLocal,
    });
  }
}
