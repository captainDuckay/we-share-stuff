import { Item, ItemInput } from '../../../core/api/model';
import { normalizeCategoryInput } from '../functions';

export interface ItemEditModel {
  readonly name: string;
  readonly description: string;
  readonly typicalLocationId: string;
  readonly typicalPlacement: string;
  readonly categories: string;
}

export const itemEditModel = (item: Item): ItemEditModel => ({
  name: item.name,
  description: item.description ?? '',
  typicalLocationId: item.typicalLocation?.id ?? '',
  typicalPlacement: item.typicalPlacement ?? '',
  categories: item.categories?.map(({ name }) => name).join(', ') ?? '',
});

export const itemUpdateInput = (model: ItemEditModel): ItemInput => ({
  name: model.name.trim(),
  description: model.description.trim() || null,
  typicalLocationId: model.typicalLocationId || null,
  typicalPlacement: model.typicalPlacement.trim() || null,
  categories: normalizeCategoryInput(model.categories),
});
