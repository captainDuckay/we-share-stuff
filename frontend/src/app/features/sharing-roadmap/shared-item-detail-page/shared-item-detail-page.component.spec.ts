import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Item, SharedItem } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SessionStore } from '../../../core/session/session.store';
import { SharedItemDetailPageComponent } from './shared-item-detail-page.component';

const ITEM_ID = 'item-1';
const OWNED_ITEM: Item = {
  id: ITEM_ID,
  name: 'Tent',
  description: null,
  typicalLocation: null,
  typicalPlacement: null,
  placementSlotId: null,
  placementSlot: null,
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const SHARED_ITEM: SharedItem = {
  id: ITEM_ID,
  owner: { id: 'owner-2', displayName: 'Owner', profilePhotoUrl: null },
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
  typicalPlacement: { visible: false, value: null },
  reservationState: { requestable: true, acceptedRanges: [] },
};

describe('SharedItemDetailPageComponent', () => {
  const sharingApi = { requestGlobalReservation: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: SharingApi, useValue: sharingApi },
        { provide: SessionStore, useValue: { user: signal(null) } },
      ],
    });
  });

  it('presents the detail supplied by the route resolver', () => {
    const fixture = TestBed.createComponent(SharedItemDetailPageComponent);
    fixture.componentRef.setInput('detail', {
      ownedItem: OWNED_ITEM,
      sharedItem: SHARED_ITEM,
      error: '',
    });

    expect(fixture.componentInstance.ownedItem()).toEqual(OWNED_ITEM);
    expect(fixture.componentInstance.item()).toEqual(SHARED_ITEM);
    expect(fixture.componentInstance.pageTitle()).toBe('Tent');
    expect(fixture.componentInstance.backLink()).toBe('/my-stuff');
    expect(fixture.componentInstance.backLabel()).toBe('My stuff');
  });

  it('requests a Reservation without reloading the route data', async () => {
    sharingApi.requestGlobalReservation.mockResolvedValue({ reservation: {} });
    const fixture = TestBed.createComponent(SharedItemDetailPageComponent);
    fixture.componentRef.setInput('detail', {
      ownedItem: null,
      sharedItem: SHARED_ITEM,
      error: '',
    });

    await fixture.componentInstance.requestReservation(
      SHARED_ITEM,
      ' 2099-01-01T10:00 ',
      ' 2099-01-01T11:00 ',
    );

    expect(sharingApi.requestGlobalReservation).toHaveBeenCalledOnce();
    expect(sharingApi.requestGlobalReservation).toHaveBeenCalledWith(ITEM_ID, {
      startLocal: '2099-01-01T10:00',
      endLocal: '2099-01-01T11:00',
    });
    expect(fixture.componentInstance.item()).toEqual(SHARED_ITEM);
  });
});
