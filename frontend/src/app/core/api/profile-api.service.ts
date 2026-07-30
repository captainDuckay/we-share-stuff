import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileUpdate, UserEnvelope } from './model';

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  readonly #http = inject(HttpClient);

  update = (input: ProfileUpdate): Promise<UserEnvelope> =>
    firstValueFrom(this.#http.patch<UserEnvelope>('/api/profile', input));

  uploadPhoto = (file: File): Promise<UserEnvelope> => {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.#http.post<UserEnvelope>('/api/profile/photo', body));
  };

  removePhoto = (): Promise<void> => firstValueFrom(this.#http.delete<void>('/api/profile/photo'));
}
