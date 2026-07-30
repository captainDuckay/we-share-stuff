import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { Item, SharedItem } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SharedItemDetailPageData } from './models';
import { sharedItemDetailPageResolver } from './shared-item-detail-page.resolver';

const ITEM_ID = 'item-1';
const OWNED_ITEM = { id: ITEM_ID } as Item;
const SHARED_ITEM = { id: ITEM_ID } as SharedItem;

const resolveDetail = (): Promise<SharedItemDetailPageData> =>
  TestBed.runInInjectionContext(
    () =>
      sharedItemDetailPageResolver(
        { paramMap: convertToParamMap({ itemId: ITEM_ID }) } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ) as Promise<SharedItemDetailPageData>,
  );

describe('sharedItemDetailPageResolver', () => {
  const inventoryApi = { list: vi.fn() };
  const sharingApi = { getGlobalSharedItem: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: InventoryApi, useValue: inventoryApi },
        { provide: SharingApi, useValue: sharingApi },
      ],
    });
  });

  it('resolves owned and shared views of the Item', async () => {
    inventoryApi.list.mockResolvedValue({ items: [OWNED_ITEM] });
    sharingApi.getGlobalSharedItem.mockResolvedValue({ sharedItem: SHARED_ITEM });

    await expect(resolveDetail()).resolves.toEqual({
      ownedItem: OWNED_ITEM,
      sharedItem: SHARED_ITEM,
      error: '',
    });
  });

  it('resolves a visible Shared Item when inventory loading fails', async () => {
    inventoryApi.list.mockRejectedValue(new Error('inventory unavailable'));
    sharingApi.getGlobalSharedItem.mockResolvedValue({ sharedItem: SHARED_ITEM });

    await expect(resolveDetail()).resolves.toEqual({
      ownedItem: null,
      sharedItem: SHARED_ITEM,
      error: '',
    });
  });

  it('provides a display error when the Item cannot be resolved', async () => {
    inventoryApi.list.mockResolvedValue({ items: [] });
    sharingApi.getGlobalSharedItem.mockRejectedValue(new Error('not found'));

    await expect(resolveDetail()).resolves.toEqual({
      ownedItem: null,
      sharedItem: null,
      error: 'We could not load that Shared Item.',
    });
  });
});
