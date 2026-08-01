import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ItemEnvelope, ItemInput, ItemsEnvelope } from './model';

export interface InventoryListFilters {
  readonly typicalLocationId?: string;
  readonly placementSlotId?: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  readonly #http = inject(HttpClient);
  list = (filters: string | InventoryListFilters = ''): Promise<ItemsEnvelope> => {
    const normalized =
      typeof filters === 'string' ? { typicalLocationId: filters } : filters;
    let params = new HttpParams();
    if (normalized.typicalLocationId) {
      params = params.set('typicalLocationId', normalized.typicalLocationId);
    }
    if (normalized.placementSlotId) {
      params = params.set('placementSlotId', normalized.placementSlotId);
    }
    return firstValueFrom(this.#http.get<ItemsEnvelope>('/api/items', { params }));
  };
  create = (input: ItemInput): Promise<ItemEnvelope> =>
    firstValueFrom(this.#http.post<ItemEnvelope>('/api/items', input));
  update = (id: string, input: Partial<ItemInput>): Promise<ItemEnvelope> =>
    firstValueFrom(this.#http.patch<ItemEnvelope>(`/api/items/${encodeURIComponent(id)}`, input));
  remove = (id: string): Promise<void> =>
    firstValueFrom(this.#http.delete<void>(`/api/items/${encodeURIComponent(id)}`));
}
