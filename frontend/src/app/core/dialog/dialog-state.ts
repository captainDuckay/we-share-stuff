import { computed, Injectable, signal } from '@angular/core';

/**
 * Tracks modal dialogs so the app shell can become inert while any are open.
 * Pair with `dialog[app-dialog]` and mark the page shell with `appDialogInertRoot`.
 */
@Injectable({ providedIn: 'root' })
export class DialogState {
  readonly #openIds = signal<readonly string[]>([]);
  readonly #inertRoots = new Set<HTMLElement>();

  readonly openIds = this.#openIds.asReadonly();
  readonly anyOpen = computed(() => this.#openIds().length > 0);

  /** Register a page shell (or other background UI) that should be inert while dialogs are open. */
  registerInertRoot(element: HTMLElement): void {
    this.#inertRoots.add(element);
    this.#syncInert();
  }

  unregisterInertRoot(element: HTMLElement): void {
    this.#inertRoots.delete(element);
    element.inert = false;
  }

  /** Mark a modal dialog as open (idempotent per id). */
  open(id: string): void {
    if (this.#openIds().includes(id)) return;
    this.#openIds.update((ids) => [...ids, id]);
    this.#syncInert();
  }

  /** Mark a modal dialog as closed (idempotent per id). */
  close(id: string): void {
    if (!this.#openIds().includes(id)) return;
    this.#openIds.update((ids) => ids.filter((openId) => openId !== id));
    this.#syncInert();
  }

  #syncInert(): void {
    const inert = this.#openIds().length > 0;
    for (const root of this.#inertRoots) {
      root.inert = inert;
    }
  }
}
