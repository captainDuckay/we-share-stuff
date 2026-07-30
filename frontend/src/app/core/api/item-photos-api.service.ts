import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ItemPhotoEnvelope, ItemPhotosEnvelope } from './model';

@Injectable({ providedIn: 'root' })
export class ItemPhotosApi {
  readonly #http = inject(HttpClient);

  list = (itemId: string): Promise<ItemPhotosEnvelope> =>
    firstValueFrom(
      this.#http.get<ItemPhotosEnvelope>(`/api/items/${encodeURIComponent(itemId)}/photos`),
    );

  upload = (itemId: string, file: File): Promise<ItemPhotoEnvelope> => {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(
      this.#http.post<ItemPhotoEnvelope>(`/api/items/${encodeURIComponent(itemId)}/photos`, body),
    );
  };

  remove = (itemId: string, photoId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(
        `/api/items/${encodeURIComponent(itemId)}/photos/${encodeURIComponent(photoId)}`,
      ),
    );
}
