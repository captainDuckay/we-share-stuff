import { describe, expect, it } from 'vitest';
import { Item } from '../../../core/api/model';
import { itemEditModel, itemUpdateInput } from './functions';

const ITEM: Item = {
  id: 'item-1',
  name: 'Tent',
  description: null,
  typicalLocation: null,
  typicalPlacement: null,
  categories: [{ name: 'camping' }, { name: 'garden' }],
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('owned Item editing', () => {
  it('creates editable text values from an Item', () => {
    expect(itemEditModel(ITEM)).toEqual({
      name: 'Tent',
      description: '',
      typicalLocationId: '',
      typicalPlacement: '',
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
        categories: ' Garden, DIY, garden ',
      }),
    ).toEqual({
      name: 'Ladder',
      description: null,
      typicalLocationId: null,
      typicalPlacement: 'Shelf A',
      categories: ['garden', 'diy'],
    });
  });
});
