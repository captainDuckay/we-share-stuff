import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, InjectionToken, signal } from '@angular/core';
import {
  persistThemePreference,
  readThemePreference,
  ThemePreference,
  ThemePreferenceStorage,
} from './functions';

export const THEME_PREFERENCE_STORAGE = new InjectionToken<ThemePreferenceStorage | null>(
  'Theme preference storage',
  {
    providedIn: 'root',
    factory: () => {
      try {
        return inject(DOCUMENT).defaultView?.localStorage ?? null;
      } catch {
        return null;
      }
    },
  },
);

@Injectable({ providedIn: 'root' })
export class ThemePreferenceStore {
  readonly #document = inject(DOCUMENT);
  readonly #storage = inject(THEME_PREFERENCE_STORAGE);
  readonly #preference = signal<ThemePreference>(readThemePreference(this.#storage));
  readonly preference = this.#preference.asReadonly();
  readonly #syncPreference = effect(() => {
    const preference = this.#preference();
    const documentElement = this.#document.documentElement;

    if (preference === 'browser') {
      documentElement.removeAttribute('data-theme');
    } else {
      documentElement.setAttribute('data-theme', preference);
    }

    persistThemePreference(this.#storage, preference);
  });

  setPreference(preference: ThemePreference): void {
    this.#preference.set(preference);
  }
}
