import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SharedItem } from '../../../core/api/model';
import {
  SharedItemDetailCardComponent,
  SharedItemReservationRequest,
} from './shared-item-detail-card.component';

const SHARED_ITEM: SharedItem = {
  id: 'item-1',
  owner: { id: 'owner-1', displayName: 'Owner', profilePhotoUrl: null },
  name: 'Ladder',
  description: null,
  visibleThrough: [{ id: 'group-1', name: 'Neighbours' }],
  itemPhotos: [],
  typicalLocation: {
    id: 'location-1',
    name: 'Garage',
    details: null,
    timezone: 'Europe/Copenhagen',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    assignedItemCount: 1,
  },
  typicalPlacement: { visible: false, value: null, structured: null },
  reservationState: { requestable: true, acceptedRanges: [] },
};

describe('SharedItemDetailCardComponent', () => {
  it('only emits valid future Reservation requests', async () => {
    const fixture = TestBed.createComponent(SharedItemDetailCardComponent);
    fixture.componentRef.setInput('item', SHARED_ITEM);
    const reservationRequested = vi.fn<(request: SharedItemReservationRequest) => void>();
    fixture.componentInstance.reservationRequested.subscribe(reservationRequested);

    fixture.detectChanges();
    const formElement = fixture.nativeElement.querySelector('form') as HTMLFormElement;

    fixture.componentInstance.reservationModel.set({
      startLocal: '2000-01-01T10:00',
      endLocal: '2000-01-01T11:00',
    });
    formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(reservationRequested).not.toHaveBeenCalled();

    fixture.componentInstance.reservationModel.set({
      startLocal: '2099-01-01T10:00',
      endLocal: '2099-01-01T11:00',
    });
    formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(reservationRequested).toHaveBeenCalledWith({
        item: SHARED_ITEM,
        startLocal: '2099-01-01T10:00',
        endLocal: '2099-01-01T11:00',
      }),
    );
  });
});
