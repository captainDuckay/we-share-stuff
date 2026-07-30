import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { Item, SharedItem } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SharedItemDetailPageData } from './models';

const loadOwnedItem = async (inventoryApi: InventoryApi, itemId: string): Promise<Item | null> => {
  try {
    const inventory = await inventoryApi.list();
    return inventory.items.find(({ id }) => id === itemId) ?? null;
  } catch {
    return null;
  }
};

const loadSharedItem = async (
  sharingApi: SharingApi,
  itemId: string,
): Promise<SharedItem | null> => {
  try {
    const response = await sharingApi.getGlobalSharedItem(itemId);
    return response.sharedItem;
  } catch {
    return null;
  }
};

export const sharedItemDetailPageResolver: ResolveFn<SharedItemDetailPageData> = async (route) => {
  const itemId = route.paramMap.get('itemId');
  if (!itemId) {
    return { ownedItem: null, sharedItem: null, error: 'We could not load that Shared Item.' };
  }

  const inventoryApi = inject(InventoryApi);
  const sharingApi = inject(SharingApi);
  const [ownedItem, sharedItem] = await Promise.all([
    loadOwnedItem(inventoryApi, itemId),
    loadSharedItem(sharingApi, itemId),
  ]);

  return {
    ownedItem,
    sharedItem,
    error: ownedItem || sharedItem ? '' : 'We could not load that Shared Item.',
  };
};
