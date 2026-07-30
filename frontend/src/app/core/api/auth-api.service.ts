import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Credentials, RegistrationInput, UserEnvelope } from './model';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  readonly #http = inject(HttpClient);

  register = (credentials: RegistrationInput): Promise<UserEnvelope> =>
    firstValueFrom(this.#http.post<UserEnvelope>('/api/auth/register', credentials));
  signIn = (credentials: Credentials): Promise<UserEnvelope> =>
    firstValueFrom(this.#http.post<UserEnvelope>('/api/auth/sign-in', credentials));
  session = (): Promise<UserEnvelope> =>
    firstValueFrom(this.#http.get<UserEnvelope>('/api/auth/session'));
  signOut = (): Promise<void> => firstValueFrom(this.#http.post<void>('/api/auth/sign-out', {}));
}
