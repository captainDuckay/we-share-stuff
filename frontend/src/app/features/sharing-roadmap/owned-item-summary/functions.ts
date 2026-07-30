import { Item, ItemPhoto, SharedItem } from '../../../core/api/model';

export const ownedSharedItemView = (
  item: Item,
  sharedItem: SharedItem,
  photos: readonly ItemPhoto[],
): SharedItem => {
  return {
    ...sharedItem,
    name: item.name,
    description: item.description,
    itemPhotos: photos,
    categories: item.categories,
    typicalLocation: item.typicalLocation ?? sharedItem.typicalLocation,
    typicalPlacement: { visible: true, value: item.typicalPlacement },
  };
};
