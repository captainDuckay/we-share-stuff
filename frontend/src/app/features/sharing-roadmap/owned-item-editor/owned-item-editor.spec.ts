import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { ItemPhotosApi } from '../../../core/api/item-photos-api.service';
import { Item } from '../../../core/api/model';
import { TypicalLocationsApi } from '../../../core/api/typical-locations-api.service';
import { OwnedItemEditor } from './owned-item-editor';

const ITEM: Item = {
  id: 'item-1',
  name: 'Tent',
  description: 'Two person',
  typicalLocation: null,
  typicalPlacement: null,
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('OwnedItemEditor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: InventoryApi, useValue: { update: vi.fn() } },
        {
          provide: ItemPhotosApi,
          useValue: { list: vi.fn().mockResolvedValue({ itemPhotos: [] }) },
        },
        {
          provide: TypicalLocationsApi,
          useValue: { list: vi.fn().mockResolvedValue({ typicalLocations: [] }) },
        },
      ],
    });
  });

  it('shows the normal detail view until Edit Item is selected', async () => {
    const fixture = TestBed.createComponent(OwnedItemEditor);
    fixture.componentRef.setInput('item', ITEM);
    await fixture.whenStable();

    const initialText = fixture.nativeElement.textContent as string;
    expect(initialText).toContain('Tent');
    expect(initialText).toContain('Edit Item');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();

    const editButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Edit Item');
    expect(editButton).toBeDefined();
    editButton!.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain('Edit item');

    const cancelButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Cancel');
    expect(cancelButton).toBeDefined();
    cancelButton!.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Edit Item');
  });
});
