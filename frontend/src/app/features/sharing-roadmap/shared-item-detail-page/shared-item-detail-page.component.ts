import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Item, SharedItem } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SessionStore } from '../../../core/session/session.store';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { friendlyApiError, normalizeReservationRequest } from '../functions';
import { OwnedItemEditor } from '../owned-item-editor/owned-item-editor';
import { SharedItemDetailCardComponent } from '../shared-item-detail-card/shared-item-detail-card.component';
import { SharedItemDetailPageData } from './models';

@Component({
  selector: 'app-shared-item-detail-page',
  imports: [OwnedItemEditor, PageLayout, SharedItemDetailCardComponent],
  templateUrl: './shared-item-detail-page.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class SharedItemDetailPageComponent {
  readonly #sharingApi = inject(SharingApi);
  readonly detail = input.required<SharedItemDetailPageData>();
  readonly session = inject(SessionStore);
  readonly ownedItem = linkedSignal(() => this.detail().ownedItem);
  readonly item = computed(() => this.detail().sharedItem);
  readonly error = linkedSignal(() => this.detail().error);
  readonly pageTitle = computed(() => this.ownedItem()?.name ?? this.item()?.name ?? 'Item');
  readonly backLink = computed(() => (this.ownedItem() ? '/my-stuff' : '/browse'));
  readonly backLabel = computed(() => (this.ownedItem() ? 'My stuff' : 'Browse shared items'));

  updateOwnedItem(item: Item): void {
    this.ownedItem.set(item);
  }

  async requestReservation(item: SharedItem, startLocal: string, endLocal: string): Promise<void> {
    const input = normalizeReservationRequest(startLocal, endLocal);
    if (!input.startLocal || !input.endLocal) return;
    try {
      await this.#sharingApi.requestGlobalReservation(item.id, input);
      this.error.set('');
    } catch (error) {
      this.error.set(friendlyApiError(error, 'We could not request that Reservation.'));
    }
  }
}
