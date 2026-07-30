import { inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApi } from '../api/auth-api.service';
import { User } from '../api/model';

export type SessionStatus = 'checking' | 'anonymous' | 'authenticated' | 'error';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly #api = inject(AuthApi);
  readonly #status = signal<SessionStatus>('checking');
  readonly #user = signal<User | null>(null);
  readonly #error = signal<string | null>(null);
  #restoreInFlight: Promise<void> | null = null;

  readonly status = this.#status.asReadonly();
  readonly user = this.#user.asReadonly();
  readonly error = this.#error.asReadonly();

  restore = (): Promise<void> => {
    if (this.#restoreInFlight) return this.#restoreInFlight;
    this.#status.set('checking');
    this.#restoreInFlight = this.#api
      .session()
      .then(({ user }) => this.#authenticate(user))
      .catch((error: unknown) => this.#handleRestoreFailure(error))
      .finally(() => {
        this.#restoreInFlight = null;
      });
    return this.#restoreInFlight;
  };

  retry = (): Promise<void> => this.restore();
  ensureCsrf = async (): Promise<void> => {
    try {
      await this.restore();
    } catch {
      // Restore handles its own error state; callers only need the cookie side effect.
    }
  };
  authenticate = (user: User): void => this.#authenticate(user);
  updateUser = (user: User): void => this.#authenticate(user);
  clear = (): void => {
    this.#user.set(null);
    this.#error.set(null);
    this.#status.set('anonymous');
  };

  async signOut(): Promise<void> {
    await this.#api.signOut();
    this.clear();
  }

  #authenticate(user: User): void {
    this.#user.set(user);
    this.#error.set(null);
    this.#status.set('authenticated');
  }

  #handleRestoreFailure(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.clear();
      return;
    }
    this.#error.set('We could not check your session. Try again.');
    this.#status.set('error');
  }
}
