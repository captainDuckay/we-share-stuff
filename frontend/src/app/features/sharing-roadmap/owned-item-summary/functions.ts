import {
  Item,
  ItemPhoto,
  ItemPlacementSlot,
  SharedItem,
} from '../../../core/api/model';

/** Owner inventory label for free-text or Slot-linked Typical Placement. */
export const typicalPlacementOwnerLabel = (
  placement: string | null,
  slot: ItemPlacementSlot | null,
): string => {
  if (slot) {
    const address = `${slot.surfaceName} → ${slot.label}`;
    const note = placement?.trim();
    return note ? `${address} (${note})` : address;
  }
  const freeText = placement?.trim();
  return freeText || 'Not noted';
};

export const ownedSharedItemView = (
  item: Item,
  sharedItem: SharedItem,
  photos: readonly ItemPhoto[],
): SharedItem => {
  const placementValue = item.placementSlot
    ? typicalPlacementOwnerLabel(item.typicalPlacement, item.placementSlot)
    : item.typicalPlacement;
  return {
    ...sharedItem,
    name: item.name,
    description: item.description,
    itemPhotos: photos,
    categories: item.categories,
    typicalLocation: item.typicalLocation ?? sharedItem.typicalLocation,
    typicalPlacement: { visible: true, value: placementValue },
  };
};
