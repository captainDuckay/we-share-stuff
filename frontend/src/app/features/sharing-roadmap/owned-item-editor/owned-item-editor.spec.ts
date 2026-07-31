import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { ItemPhotosApi } from '../../../core/api/item-photos-api.service';
import { Item, TypicalLocation } from '../../../core/api/model';
import { PlacementSurfacesApi } from '../../../core/api/placement-surfaces-api.service';
import { TypicalLocationsApi } from '../../../core/api/typical-locations-api.service';
import { OwnedItemEditor } from './owned-item-editor';

const LOCATION: TypicalLocation = {
  id: 'loc-1',
  name: 'Home',
  details: null,
  timezone: 'Europe/Copenhagen',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const ITEM: Item = {
  id: 'item-1',
  name: 'Tent',
  description: 'Two person',
  typicalLocation: LOCATION,
  typicalPlacement: null,
  placementSlotId: null,
  placementSlot: null,
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('OwnedItemEditor', () => {
  let listSurfaces: ReturnType<typeof vi.fn>;
  let getSurface: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listSurfaces = vi.fn().mockResolvedValue({
      placementSurfaces: [
        {
          id: 'surface-1',
          typicalLocationId: LOCATION.id,
          name: 'Garage wall',
          slotCount: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    getSurface = vi.fn().mockResolvedValue({
      placementSurface: {
        id: 'surface-1',
        typicalLocationId: LOCATION.id,
        name: 'Garage wall',
        slotCount: 1,
        slots: [
          {
            id: 'slot-1',
            surfaceId: 'surface-1',
            label: 'Shelf A',
            x: 0,
            y: 0,
            width: 100,
            height: 80,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
        structuralDrawings: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: InventoryApi, useValue: { update: vi.fn() } },
        {
          provide: ItemPhotosApi,
          useValue: { list: vi.fn().mockResolvedValue({ itemPhotos: [] }) },
        },
        {
          provide: TypicalLocationsApi,
          useValue: {
            list: vi.fn().mockResolvedValue({ typicalLocations: [LOCATION] }),
          },
        },
        {
          provide: PlacementSurfacesApi,
          useValue: {
            list: listSurfaces,
            get: getSurface,
          },
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

  it('loads Placement Slots once when editing starts, not on every form model change', async () => {
    const fixture = TestBed.createComponent(OwnedItemEditor);
    fixture.componentRef.setInput('item', ITEM);
    await fixture.whenStable();

    const editButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Edit Item');
    editButton!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(listSurfaces).toHaveBeenCalledTimes(1);
    expect(listSurfaces).toHaveBeenCalledWith(LOCATION.id);
    expect(getSurface).toHaveBeenCalledTimes(1);

    // Simulate form typing: name/placement change must not re-fetch surfaces.
    fixture.componentInstance.editModel.update((model) => ({
      ...model,
      name: 'Updated Tent',
      typicalPlacement: 'near the door',
    }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.editModel.update((model) => ({
      ...model,
      description: 'Three person',
    }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(listSurfaces).toHaveBeenCalledTimes(1);
    expect(getSurface).toHaveBeenCalledTimes(1);
  });
});
