import { describe, expect, it } from 'vitest';
import { Item, ItemPhoto, SharedItem } from '../../../core/api/model';
import { ownedSharedItemView, typicalPlacementOwnerLabel } from './functions';

const ITEM: Item = {
  id: 'item-1',
  name: 'Updated Tent',
  description: 'Updated description',
  typicalLocation: null,
  typicalPlacement: 'Shelf A',
  placementSlotId: null,
  placementSlot: null,
  categories: [{ name: 'camping' }],
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const SHARED_ITEM: SharedItem = {
  id: ITEM.id,
  owner: { id: 'user-1', displayName: 'Owner', profilePhotoUrl: null },
  name: 'Tent',
  description: null,
  visibleThrough: [{ id: 'group-1', name: 'Friends' }],
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
  reservationState: { requestable: false, acceptedRanges: [] },
};
const PHOTO: ItemPhoto = {
  id: 'photo-1',
  itemId: ITEM.id,
  url: '/api/item-photos/photo-1/content',
  contentType: 'image/jpeg',
  sizeBytes: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('owned Shared Item view', () => {
  it('keeps sharing context while displaying current editable Item values', () => {
    const view = ownedSharedItemView(ITEM, SHARED_ITEM, [PHOTO]);

    expect(view.name).toBe('Updated Tent');
    expect(view.visibleThrough).toEqual(SHARED_ITEM.visibleThrough);
    expect(view.typicalLocation).toEqual(SHARED_ITEM.typicalLocation);
    expect(view.typicalPlacement).toEqual({ visible: true, value: 'Shelf A' });
    expect(view.itemPhotos).toEqual([PHOTO]);
  });

  it('uses the Placement Slot as the primary address when linked', () => {
    const view = ownedSharedItemView(
      {
        ...ITEM,
        typicalPlacement: 'behind paint',
        placementSlotId: 'slot-a',
        placementSlot: {
          id: 'slot-a',
          label: 'Bin 1',
          surfaceId: 'surface-a',
          surfaceName: 'Garage wall',
        },
      },
      SHARED_ITEM,
      [PHOTO],
    );
    expect(view.typicalPlacement).toEqual({
      visible: true,
      value: 'Garage wall → Bin 1 (behind paint)',
    });
  });
});

describe('typicalPlacementOwnerLabel', () => {
  it('labels free-text and linked Typical Placement for the owner', () => {
    expect(typicalPlacementOwnerLabel(null, null)).toBe('Not noted');
    expect(typicalPlacementOwnerLabel('Blue bin', null)).toBe('Blue bin');
    expect(
      typicalPlacementOwnerLabel('behind paint', {
        id: 'slot-a',
        label: 'Bin 1',
        surfaceId: 'surface-a',
        surfaceName: 'Garage wall',
      }),
    ).toBe('Garage wall → Bin 1 (behind paint)');
    expect(
      typicalPlacementOwnerLabel(null, {
        id: 'slot-a',
        label: 'Bin 1',
        surfaceId: 'surface-a',
        surfaceName: 'Garage wall',
      }),
    ).toBe('Garage wall → Bin 1');
  });
});
