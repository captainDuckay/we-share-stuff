import { describe, expect, it } from 'vitest';
import { Item, PlacementSurfaceDetail } from '../../../core/api/model';
import {
  applyPlacementSlotLink,
  applyPlacementSlotUnlink,
  applyTypicalLocationSelection,
  filterPlacementSlotOptions,
  filteredPlacementSlotOptions,
  itemEditModel,
  itemUpdateInput,
  parentSurfaceForSlot,
  placementSlotOptions,
  rankPlacementSlotSuggestions,
} from './functions';

const ITEM: Item = {
  id: 'item-1',
  name: 'Tent',
  description: null,
  typicalLocation: null,
  typicalPlacement: null,
  placementSlotId: null,
  placementSlot: null,
  categories: [{ name: 'camping' }, { name: 'garden' }],
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const SURFACES: readonly PlacementSurfaceDetail[] = [
  {
    id: 'surface-b',
    typicalLocationId: 'loc-1',
    name: 'Workshop wall',
    slotCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    slots: [
      {
        id: 'slot-b',
        surfaceId: 'surface-b',
        label: 'Bin 2',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    structuralDrawings: [],
  },
  {
    id: 'surface-a',
    typicalLocationId: 'loc-1',
    name: 'Garage wall',
    slotCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    slots: [
      {
        id: 'slot-a',
        surfaceId: 'surface-a',
        label: 'Bin 1',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    structuralDrawings: [],
  },
];

describe('owned Item editing', () => {
  it('creates editable text values from an Item', () => {
    expect(itemEditModel(ITEM)).toEqual({
      name: 'Tent',
      description: '',
      typicalLocationId: '',
      typicalPlacement: '',
      placementSlotId: '',
      categories: 'camping, garden',
    });
  });

  it('maps a linked Placement Slot into the edit model', () => {
    expect(
      itemEditModel({
        ...ITEM,
        typicalPlacement: 'behind paint',
        placementSlotId: 'slot-a',
        placementSlot: {
          id: 'slot-a',
          label: 'Bin 1',
          surfaceId: 'surface-a',
          surfaceName: 'Garage wall',
        },
      }),
    ).toEqual({
      name: 'Tent',
      description: '',
      typicalLocationId: '',
      typicalPlacement: 'behind paint',
      placementSlotId: 'slot-a',
      categories: 'camping, garden',
    });
  });

  it('normalizes an edited Item before updating it', () => {
    expect(
      itemUpdateInput({
        name: '  Ladder  ',
        description: '  ',
        typicalLocationId: '',
        typicalPlacement: '  Shelf A  ',
        placementSlotId: '',
        categories: ' Garden, DIY, garden ',
      }),
    ).toEqual({
      name: 'Ladder',
      description: null,
      typicalLocationId: null,
      typicalPlacement: 'Shelf A',
      placementSlotId: null,
      categories: ['garden', 'diy'],
    });
  });

  it('sends the Placement Slot id when linking', () => {
    expect(
      itemUpdateInput({
        name: 'Drill',
        description: '',
        typicalLocationId: 'loc-1',
        typicalPlacement: '  left side  ',
        placementSlotId: 'slot-a',
        categories: '',
      }),
    ).toMatchObject({
      typicalLocationId: 'loc-1',
      typicalPlacement: 'left side',
      placementSlotId: 'slot-a',
    });
  });

  it('clears the Slot link when Typical Location changes and keeps the note', () => {
    const result = applyTypicalLocationSelection(
      {
        name: 'Drill',
        description: '',
        typicalLocationId: 'loc-1',
        typicalPlacement: 'behind paint',
        placementSlotId: 'slot-a',
        categories: '',
      },
      'loc-2',
    );
    expect(result.model.typicalLocationId).toBe('loc-2');
    expect(result.model.placementSlotId).toBe('');
    expect(result.model.typicalPlacement).toBe('behind paint');
    expect(result.slotClearedNotice).toBe(
      'The Placement Slot link was cleared because the Typical Location changed.',
    );
  });

  it('clears the Slot when the form already wrote the next location id', () => {
    const result = applyTypicalLocationSelection(
      {
        name: 'Drill',
        description: '',
        typicalLocationId: 'loc-2',
        typicalPlacement: 'behind paint',
        placementSlotId: 'slot-a',
        categories: '',
      },
      'loc-2',
      'loc-1',
    );
    expect(result.model.placementSlotId).toBe('');
    expect(result.slotClearedNotice).not.toBeNull();
  });

  it('does not notice when Location change has no Slot to clear', () => {
    const result = applyTypicalLocationSelection(
      {
        name: 'Drill',
        description: '',
        typicalLocationId: 'loc-1',
        typicalPlacement: 'free text only',
        placementSlotId: '',
        categories: '',
      },
      'loc-2',
    );
    expect(result.model.placementSlotId).toBe('');
    expect(result.slotClearedNotice).toBeNull();
  });

  it('builds label-first Slot options with Surface as secondary', () => {
    expect(placementSlotOptions(SURFACES)).toEqual([
      { id: 'slot-a', label: 'Bin 1', surfaceName: 'Garage wall' },
      { id: 'slot-b', label: 'Bin 2', surfaceName: 'Workshop wall' },
    ]);
  });

  it('keeps a linked Slot option available while surfaces are empty', () => {
    expect(
      placementSlotOptions([], {
        id: 'slot-current',
        label: 'Shelf A',
        surfaceName: 'Garage wall',
      }),
    ).toEqual([{ id: 'slot-current', label: 'Shelf A', surfaceName: 'Garage wall' }]);
  });

  it('links a Slot and keeps free text as the note', () => {
    const model = applyPlacementSlotLink(
      {
        name: 'Drill',
        description: '',
        typicalLocationId: 'loc-1',
        typicalPlacement: 'behind paint',
        placementSlotId: '',
        categories: '',
      },
      'slot-a',
    );
    expect(model.placementSlotId).toBe('slot-a');
    expect(model.typicalPlacement).toBe('behind paint');
  });

  it('unlinks a Slot and keeps the note as free text', () => {
    const model = applyPlacementSlotUnlink({
      name: 'Drill',
      description: '',
      typicalLocationId: 'loc-1',
      typicalPlacement: 'behind paint',
      placementSlotId: 'slot-a',
      categories: '',
    });
    expect(model.placementSlotId).toBe('');
    expect(model.typicalPlacement).toBe('behind paint');
  });

  it('ranks soft suggestions by free-text match and excludes the linked Slot', () => {
    const options = placementSlotOptions(SURFACES);
    expect(rankPlacementSlotSuggestions(options, 'Bin 2')).toEqual([
      { id: 'slot-b', label: 'Bin 2', surfaceName: 'Workshop wall' },
    ]);
    expect(
      rankPlacementSlotSuggestions(options, '', 'slot-a').map((entry) => entry.id),
    ).toEqual(['slot-b']);
  });

  it('falls back to label order when free text matches nothing', () => {
    const options = placementSlotOptions(SURFACES);
    expect(rankPlacementSlotSuggestions(options, 'zzzz').map((entry) => entry.id)).toEqual([
      'slot-a',
      'slot-b',
    ]);
  });

  it('filters the picker by Slot label or Surface name', () => {
    const options = placementSlotOptions(SURFACES);
    expect(filterPlacementSlotOptions(options, 'workshop')).toEqual([
      { id: 'slot-b', label: 'Bin 2', surfaceName: 'Workshop wall' },
    ]);
    expect(filterPlacementSlotOptions(options, 'bin 1')).toEqual([
      { id: 'slot-a', label: 'Bin 1', surfaceName: 'Garage wall' },
    ]);
  });

  it('keeps the selected Slot visible when the picker filter excludes it', () => {
    const options = placementSlotOptions(SURFACES);
    expect(filteredPlacementSlotOptions(options, 'workshop', 'slot-a')).toEqual([
      { id: 'slot-a', label: 'Bin 1', surfaceName: 'Garage wall' },
      { id: 'slot-b', label: 'Bin 2', surfaceName: 'Workshop wall' },
    ]);
  });

  it('finds the parent Surface for a Slot preview', () => {
    expect(parentSurfaceForSlot(SURFACES, 'slot-b')?.id).toBe('surface-b');
    expect(parentSurfaceForSlot(SURFACES, '')).toBeNull();
    expect(parentSurfaceForSlot(SURFACES, 'missing')).toBeNull();
  });
});
