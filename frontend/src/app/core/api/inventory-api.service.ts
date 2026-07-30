import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ItemEnvelope, ItemInput, ItemsEnvelope } from './model';

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  readonly #http = inject(HttpClient);
  list = (typicalLocationId = ''): Promise<ItemsEnvelope> =>
    firstValueFrom(
      this.#http.get<ItemsEnvelope>('/api/items', {
        params: typicalLocationId ? { typicalLocationId } : {},
      }),
    );
  create = (input: ItemInput): Promise<ItemEnvelope> =>
    firstValueFrom(this.#http.post<ItemEnvelope>('/api/items', input));
  update = (id: string, input: Partial<ItemInput>): Promise<ItemEnvelope> =>
    firstValueFrom(this.#http.patch<ItemEnvelope>(`/api/items/${encodeURIComponent(id)}`, input));
  remove = (id: string): Promise<void> =>
    firstValueFrom(this.#http.delete<void>(`/api/items/${encodeURIComponent(id)}`));
}
