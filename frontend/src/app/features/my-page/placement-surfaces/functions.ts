import type { Item } from '../../../core/api/model';

/** Items already linked to the given Placement Slot (same relationship as Item editor). */
export const itemsLinkedToSlot = (
  items: readonly Item[],
  slotId: string,
): readonly Item[] => {
  if (!slotId) return [];
  return items
    .filter((item) => item.placementSlotId === slotId)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
};

/**
 * Items at the loaded Typical Location that can be assigned to this Slot
 * (not already linked to it). Other Slot links and free-text-only are fine.
 */
export const itemsAssignableToSlot = (
  items: readonly Item[],
  slotId: string,
): readonly Item[] => {
  if (!slotId) return [];
  return items
    .filter((item) => item.placementSlotId !== slotId)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
};

/** Secondary label for an assignable Item in the canvas picker. */
export const itemSlotAssignHint = (item: Item): string => {
  if (item.placementSlot) {
    return `${item.placementSlot.label} · ${item.placementSlot.surfaceName}`;
  }
  const freeText = item.typicalPlacement?.trim();
  if (freeText) return freeText;
  return 'No Placement Slot';
};
