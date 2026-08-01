import { describe, expect, it } from 'vitest';
import type { Item } from '../../../core/api/model';
import {
  itemSlotAssignHint,
  itemsAssignableToSlot,
  itemsLinkedToSlot,
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
