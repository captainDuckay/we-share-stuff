import { Item, SharedItem } from '../../../core/api/model';

export interface SharedItemDetailPageData {
  readonly ownedItem: Item | null;
  readonly sharedItem: SharedItem | null;
  readonly error: string;
}
