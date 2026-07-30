import { Component, input, output, signal } from '@angular/core';
import { FormField, FormRoot, form, validate } from '@angular/forms/signals';
import { SharedItem } from '../../../core/api/model';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import {
  DEFAULT_ITEM_ICON,
  formatUtcRangeInTimezone,
  itemPhotoUrl,
  reservationEndTimeError,
  reservationStartTimeError,
  sharedItemAvailabilityLabel,
  typicalPlacementLabel,
} from '../functions';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';

export interface SharedItemReservationRequest {
  readonly item: SharedItem;
  readonly startLocal: string;
  readonly endLocal: string;
}

@Component({
  selector: 'app-shared-item-detail-card',
  imports: [FormField, FormRoot, MaterialSymbolIconComponent, UserAvatar],
  templateUrl: './shared-item-detail-card.component.html',
  styleUrl: './shared-item-detail-card.component.css',
})
export class SharedItemDetailCardComponent {
  readonly defaultItemIcon = DEFAULT_ITEM_ICON;
  readonly item = input.required<SharedItem>();
  readonly currentUserId = input<string | null | undefined>(null);
  readonly reservationRequested = output<SharedItemReservationRequest>();
  readonly reservationModel = signal({ startLocal: '', endLocal: '' });
  readonly reservationForm = form(
    this.reservationModel,
    (path) => {
      validate(path.startLocal, ({ value }) => {
        if (!value()) return { kind: 'required', message: 'Choose a start time.' };
        const message = reservationStartTimeError(value(), this.item().typicalLocation.timezone);
        return message ? { kind: 'future', message } : undefined;
      });
      validate(path.endLocal, ({ value, valueOf }) => {
        if (!value()) return { kind: 'required', message: 'Choose an end time.' };
        const message = reservationEndTimeError(valueOf(path.startLocal), value());
        return message ? { kind: 'afterStart', message } : undefined;
      });
    },
    {
      submission: {
        action: async () => {
          const { startLocal, endLocal } = this.reservationModel();
          this.reservationRequested.emit({ item: this.item(), startLocal, endLocal });
        },
      },
    },
  );

  isOwnItem(): boolean {
    return this.item().owner.id === this.currentUserId();
  }

  photoUrl(): string | null {
    return itemPhotoUrl(this.item());
  }

  placementLabel(): string {
    return typicalPlacementLabel(this.item().typicalPlacement);
  }

  availabilityLabel(): string {
    return sharedItemAvailabilityLabel(this.item(), Date.now());
  }

  acceptedRanges(): readonly string[] {
    return this.item().reservationState.acceptedRanges.map((range) =>
      formatUtcRangeInTimezone(range.startAt, range.endAt, range.timezone),
    );
  }
}
