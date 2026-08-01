import { describe, expect, it } from 'vitest';
import type { Item } from '../../../core/api/model';
import {
  blockedDeleteFromError,
  blockedDeleteMessage,
  itemSlotAssignHint,
  itemsAssignableToSlot,
  itemsLinkedToSlot,
  viewItemsQueryParams,
} from './functions';

const item = (overrides: Partial<Item> & Pick<Item, 'id' | 'name'>): Item => ({
  description: null,
  typicalLocation: null,
  typicalPlacement: null,
  placementSlotId: null,
  placementSlot: null,
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const ITEMS: readonly Item[] = [
  item({
    id: 'item-b',
    name: 'Ladder',
    placementSlotId: 'slot-a',
    placementSlot: {
      id: 'slot-a',
      label: 'Shelf A',
      surfaceId: 'surface-1',
      surfaceName: 'Garage wall',
    },
  }),
  item({
    id: 'item-a',
    name: 'Drill',
    placementSlotId: 'slot-a',
    placementSlot: {
      id: 'slot-a',
      label: 'Shelf A',
      surfaceId: 'surface-1',
      surfaceName: 'Garage wall',
    },
  }),
  item({
    id: 'item-c',
    name: 'Saw',
    placementSlotId: 'slot-b',
    placementSlot: {
      id: 'slot-b',
      label: 'Bin 1',
      surfaceId: 'surface-1',
      surfaceName: 'Garage wall',
    },
  }),
  item({
    id: 'item-d',
    name: 'Tent',
    typicalPlacement: 'near the door',
  }),
];

describe('canvas slot item assign mapping', () => {
  it('lists Items linked to a Slot sorted by name', () => {
    expect(itemsLinkedToSlot(ITEMS, 'slot-a').map((entry) => entry.id)).toEqual([
      'item-a',
      'item-b',
    ]);
  });

  it('returns no linked Items for an empty Slot id', () => {
    expect(itemsLinkedToSlot(ITEMS, '')).toEqual([]);
  });

  it('lists Items assignable to a Slot (everyone not already on it)', () => {
    expect(itemsAssignableToSlot(ITEMS, 'slot-a').map((entry) => entry.id)).toEqual([
      'item-c',
      'item-d',
    ]);
  });

  it('describes an Item’s current placement for the assign picker', () => {
    expect(itemSlotAssignHint(ITEMS[0]!)).toBe('Shelf A · Garage wall');
    expect(itemSlotAssignHint(ITEMS[3]!)).toBe('near the door');
    expect(itemSlotAssignHint(item({ id: 'x', name: 'Empty' }))).toBe('No Placement Slot');
  });
});

describe('placement surfaces delete helpers', () => {
  it('parses slot in-use problem with linked count', () => {
    const info = blockedDeleteFromError({
      status: 409,
      error: {
        type: 'https://we-share-stuff.local/problems/placement-slot-in-use',
        title: 'Placement Slot is linked to Items',
        status: 409,
        code: 'placement_slot_in_use',
        errors: { linkedItemCount: '3' },
      },
    });
    expect(info).toEqual({ kind: 'slot', linkedItemCount: 3 });
  });

  it('parses surface in-use problem with linked count', () => {
    const info = blockedDeleteFromError({
      status: 409,
      error: {
        type: 'https://we-share-stuff.local/problems/placement-surface-in-use',
        title: 'Placement Surface has Slots linked to Items',
        status: 409,
        code: 'placement_surface_in_use',
        errors: { linkedItemCount: '1' },
      },
    });
    expect(info).toEqual({ kind: 'surface', linkedItemCount: 1 });
  });

  it('returns null for unrelated errors', () => {
    expect(blockedDeleteFromError(new Error('nope'))).toBeNull();
    expect(
      blockedDeleteFromError({
        status: 409,
        error: {
          type: 'x',
          title: 'y',
          status: 409,
          code: 'placement_slot_label_conflict',
        },
      }),
    ).toBeNull();
  });

  it('builds blocked delete messages with pluralization', () => {
    expect(blockedDeleteMessage({ kind: 'slot', linkedItemCount: 1 })).toContain(
      '1 Item',
    );
    expect(blockedDeleteMessage({ kind: 'surface', linkedItemCount: 2 })).toContain(
      '2 Items',
    );
  });

  it('builds View items query params for slot and surface', () => {
    expect(
      viewItemsQueryParams({ locationId: 'loc-1', placementSlotId: 'slot-9' }),
    ).toEqual({
      typicalLocationId: 'loc-1',
      placementSlotId: 'slot-9',
    });
    expect(viewItemsQueryParams({ locationId: 'loc-1' })).toEqual({
      typicalLocationId: 'loc-1',
    });
  });
});
