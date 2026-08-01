/** Pure helpers for Placement Surfaces page (assign + delete / re-parent messaging). */

import type { Item } from '../../../core/api/model';
import { ApiProblem, isApiProblem } from '../../../core/api/model';

// --- Canvas slot item assign (#16) ---

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

// --- Delete / re-parent messaging (#17) ---

export interface BlockedDeleteInfo {
  readonly kind: 'slot' | 'surface';
  readonly linkedItemCount: number;
}

interface HttpStatusError {
  readonly status: number;
  readonly error: unknown;
}

const isHttpStatusError = (error: unknown): error is HttpStatusError =>
  typeof error === 'object' && error !== null && 'status' in error;

export const problemFromHttpError = (error: unknown): ApiProblem | null =>
  isHttpStatusError(error) && isApiProblem(error.error) ? error.error : null;

export const blockedDeleteFromError = (error: unknown): BlockedDeleteInfo | null => {
  const problem = problemFromHttpError(error);
  if (!problem) return null;
  const raw = problem.errors?.['linkedItemCount'];
  const linkedItemCount = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(linkedItemCount) || linkedItemCount < 1) return null;
  if (problem.code === 'placement_slot_in_use') {
    return { kind: 'slot', linkedItemCount };
  }
  if (problem.code === 'placement_surface_in_use') {
    return { kind: 'surface', linkedItemCount };
  }
  return null;
};

export const blockedDeleteMessage = (info: BlockedDeleteInfo): string => {
  const noun = info.linkedItemCount === 1 ? 'Item' : 'Items';
  if (info.kind === 'slot') {
    return `This Placement Slot is linked to ${info.linkedItemCount} ${noun}. Reassign or unlink them one-by-one before deleting.`;
  }
  return `This Placement Surface has Slots linked to ${info.linkedItemCount} ${noun}. Reassign or unlink them one-by-one before deleting.`;
};

export const viewItemsQueryParams = (options: {
  readonly locationId: string;
  readonly placementSlotId?: string;
}): Record<string, string> => {
  const params: Record<string, string> = {
    typicalLocationId: options.locationId,
  };
  if (options.placementSlotId) {
    params['placementSlotId'] = options.placementSlotId;
  }
  return params;
};
