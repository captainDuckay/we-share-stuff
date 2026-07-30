import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TypicalLocationEnvelope, TypicalLocationInput, TypicalLocationsEnvelope } from './model';

@Injectable({ providedIn: 'root' })
export class TypicalLocationsApi {
  readonly #http = inject(HttpClient);

  list = (): Promise<TypicalLocationsEnvelope> =>
    firstValueFrom(this.#http.get<TypicalLocationsEnvelope>('/api/typical-locations'));

  create = (input: TypicalLocationInput): Promise<TypicalLocationEnvelope> =>
    firstValueFrom(this.#http.post<TypicalLocationEnvelope>('/api/typical-locations', input));

  update = (id: string, input: Partial<TypicalLocationInput>): Promise<TypicalLocationEnvelope> =>
    firstValueFrom(
      this.#http.patch<TypicalLocationEnvelope>(
        `/api/typical-locations/${encodeURIComponent(id)}`,
        input,
      ),
    );

  remove = (id: string): Promise<void> =>
    firstValueFrom(this.#http.delete<void>(`/api/typical-locations/${encodeURIComponent(id)}`));
}
