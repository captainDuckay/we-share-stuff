import { Item, ItemInput, PlacementSurfaceDetail } from '../../../core/api/model';
import { normalizeCategoryInput } from '../functions';

export interface ItemEditModel {
  readonly name: string;
  readonly description: string;
  readonly typicalLocationId: string;
  /** Free-text Typical Placement, or optional note when a Slot is linked. */
  readonly typicalPlacement: string;
  readonly placementSlotId: string;
  readonly categories: string;
}

export interface PlacementSlotOption {
  readonly id: string;
  readonly label: string;
  readonly surfaceName: string;
}

export const itemEditModel = (item: Item): ItemEditModel => ({
  name: item.name,
  description: item.description ?? '',
  typicalLocationId: item.typicalLocation?.id ?? '',
  typicalPlacement: item.typicalPlacement ?? '',
  placementSlotId: item.placementSlotId ?? '',
  categories: item.categories?.map(({ name }) => name).join(', ') ?? '',
});

export const itemUpdateInput = (model: ItemEditModel): ItemInput => ({
  name: model.name.trim(),
  description: model.description.trim() || null,
  typicalLocationId: model.typicalLocationId || null,
  typicalPlacement: model.typicalPlacement.trim() || null,
  placementSlotId: model.placementSlotId || null,
  categories: normalizeCategoryInput(model.categories),
});

/**
 * Changing or clearing Typical Location drops any Slot link and keeps the note
 * as free text. Does not re-link by matching labels on the new Location.
 *
 * Pass `previousLocationId` from before the location control wrote the next value
 * (signal forms may update the model before the change handler runs).
 */
export const applyTypicalLocationSelection = (
  model: ItemEditModel,
  nextLocationId: string,
  previousLocationId: string = model.typicalLocationId,
): { readonly model: ItemEditModel; readonly slotClearedNotice: string | null } => {
  if (previousLocationId === nextLocationId) {
    return {
      model: { ...model, typicalLocationId: nextLocationId },
      slotClearedNotice: null,
    };
  }
  const hadSlot = Boolean(model.placementSlotId);
  return {
    model: {
      ...model,
      typicalLocationId: nextLocationId,
      placementSlotId: '',
    },
    slotClearedNotice: hadSlot
      ? 'The Placement Slot link was cleared because the Typical Location changed.'
      : null,
  };
};

/** Label-first options for optional Slot linking, scoped to loaded Surfaces. */
export const placementSlotOptions = (
  surfaces: readonly PlacementSurfaceDetail[],
  /** Keep a currently linked Slot visible while surfaces are still loading. */
  ensureSlot?: PlacementSlotOption | null,
): readonly PlacementSlotOption[] => {
  const options = surfaces.flatMap((surface) =>
    surface.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      surfaceName: surface.name,
    })),
  );
  if (ensureSlot && !options.some((option) => option.id === ensureSlot.id)) {
    options.push(ensureSlot);
  }
  return [...options].sort(
    (left, right) =>
      left.label.localeCompare(right.label) ||
      left.surfaceName.localeCompare(right.surfaceName),
  );
};

