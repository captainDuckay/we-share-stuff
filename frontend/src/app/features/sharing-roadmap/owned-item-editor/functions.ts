import { Item, ItemInput, PlacementSurfaceDetail } from '../../../core/api/model';
import { normalizeCategoryInput } from '../functions';

/** Max soft-suggestion chips shown under free-text Typical Placement. */
export const SOFT_SUGGESTION_LIMIT = 5;

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

/**
 * Link a Placement Slot. Existing free text stays as the optional note
 * (Slot → Slot also keeps the note).
 */
export const applyPlacementSlotLink = (
  model: ItemEditModel,
  slotId: string,
): ItemEditModel => ({
  ...model,
  placementSlotId: slotId,
});

/**
 * Drop the Slot link. The note becomes free-text Typical Placement again
 * (no confirm).
 */
export const applyPlacementSlotUnlink = (model: ItemEditModel): ItemEditModel => ({
  ...model,
  placementSlotId: '',
});

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

/**
 * Soft chips for upgrading free text to a Slot link.
 * Prefers label/surface matches against free text; otherwise top label-sorted slots.
 * Never includes the currently linked Slot; never forces a link.
 */
export const rankPlacementSlotSuggestions = (
  options: readonly PlacementSlotOption[],
  freeText: string,
  selectedSlotId = '',
  limit = SOFT_SUGGESTION_LIMIT,
): readonly PlacementSlotOption[] => {
  const candidates = options.filter((option) => option.id !== selectedSlotId);
  if (candidates.length === 0 || limit <= 0) return [];

  const query = freeText.trim().toLowerCase();
  if (!query) return candidates.slice(0, limit);

  const scored = candidates.map((option) => ({
    option,
    score: suggestionMatchScore(option, query),
  }));
  const matches = scored
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.option.label.localeCompare(right.option.label) ||
        left.option.surfaceName.localeCompare(right.option.surfaceName),
    )
    .map((entry) => entry.option);

  if (matches.length > 0) return matches.slice(0, limit);
  return candidates.slice(0, limit);
};

/** Filter the label-first picker by Slot label or Surface name. */
export const filterPlacementSlotOptions = (
  options: readonly PlacementSlotOption[],
  query: string,
): readonly PlacementSlotOption[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) ||
      option.surfaceName.toLowerCase().includes(needle),
  );
};

/**
 * Keep a selected Slot visible in a filtered picker list even when the query
 * does not match it (so the control never loses its current value).
 */
export const filteredPlacementSlotOptions = (
  options: readonly PlacementSlotOption[],
  query: string,
  selectedSlotId = '',
): readonly PlacementSlotOption[] => {
  const filtered = filterPlacementSlotOptions(options, query);
  if (!selectedSlotId || filtered.some((option) => option.id === selectedSlotId)) {
    return filtered;
  }
  const selected = options.find((option) => option.id === selectedSlotId);
  return selected ? [selected, ...filtered] : filtered;
};

/** Parent Placement Surface that owns a Slot (for light preview). */
export const parentSurfaceForSlot = (
  surfaces: readonly PlacementSurfaceDetail[],
  slotId: string,
): PlacementSurfaceDetail | null => {
  if (!slotId) return null;
  return surfaces.find((surface) => surface.slots.some((slot) => slot.id === slotId)) ?? null;
};

const suggestionMatchScore = (option: PlacementSlotOption, query: string): number => {
  const label = option.label.toLowerCase();
  const surface = option.surfaceName.toLowerCase();
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (label.includes(query)) return 60;
  if (query.includes(label) && label.length >= 2) return 50;
  if (surface.startsWith(query)) return 40;
  if (surface.includes(query)) return 20;
  return 0;
};

