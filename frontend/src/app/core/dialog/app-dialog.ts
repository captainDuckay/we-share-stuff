import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  untracked,
} from '@angular/core';
import { DialogState } from './dialog-state';

let nextDialogId = 0;

/**
 * Native modal `<dialog>` wiring: `showModal()` / `close()`, DialogState registration,
 * and light dismiss. Host must be a `dialog` element.
 *
 * Dialogs are moved under `document.body` so the app shell can use `inert` without
 * disabling the dialog itself.
 */
@Directive({
  selector: 'dialog[app-dialog]',
  host: {
    '(close)': 'onNativeClose()',
    '(click)': 'onHostClick($event)',
  },
})
export class AppDialog implements OnDestroy {
  readonly #el = inject(ElementRef<HTMLDialogElement>).nativeElement;
  readonly #dialogState = inject(DialogState);
  readonly #id = `app-dialog-${++nextDialogId}`;
  readonly #homeParent: Node | null;
  readonly #homeNextSibling: Node | null;
  #registeredOpen = false;

  /** When true, opens the dialog as a modal via `showModal()`. */
  readonly open = input(false, { alias: 'appDialogOpen' });
  /** Emits after the dialog fully closes (Escape, light dismiss, or programmatic close). */
  readonly closed = output<void>({ alias: 'appDialogClosed' });

  constructor() {
    this.#homeParent = this.#el.parentNode;
    this.#homeNextSibling = this.#el.nextSibling;
    document.body.appendChild(this.#el);

    effect(() => {
      const shouldOpen = this.open();
      untracked(() => this.#syncOpen(shouldOpen));
    });
  }

  /** Programmatic close for Close buttons — prefer this over only clearing parent state. */
  close(returnValue?: string): void {
    if (this.#el.open) this.#el.close(returnValue);
  }

  onNativeClose(): void {
    this.#unregister();
    this.closed.emit();
  }

  /** Light dismiss: click on the dialog box outside its laid-out content box. */
  onHostClick(event: MouseEvent): void {
    if (event.target !== this.#el) return;
    this.#el.close();
  }

  ngOnDestroy(): void {
    this.#unregister();
    if (this.#el.open) this.#el.close();
    this.#restoreHome();
  }

  #syncOpen(shouldOpen: boolean): void {
    if (shouldOpen) {
      if (!this.#el.open) {
        this.#el.showModal();
      }
      this.#register();
      return;
    }
    if (this.#el.open) {
      this.#el.close();
    } else {
      this.#unregister();
    }
  }

  #register(): void {
    if (this.#registeredOpen) return;
    this.#dialogState.open(this.#id);
    this.#registeredOpen = true;
  }

  #unregister(): void {
    if (!this.#registeredOpen) return;
    this.#dialogState.close(this.#id);
    this.#registeredOpen = false;
  }

  #restoreHome(): void {
    if (!this.#homeParent || this.#el.parentNode === this.#homeParent) return;
    this.#homeParent.insertBefore(this.#el, this.#homeNextSibling);
  }
}
