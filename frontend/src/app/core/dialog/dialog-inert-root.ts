import { Directive, ElementRef, inject, OnDestroy } from '@angular/core';
import { DialogState } from './dialog-state';

/**
 * Marks the host as background UI that becomes `inert` while any modal dialog is open.
 * Place on the app shell that wraps header + routed content — not on the dialogs themselves.
 */
@Directive({
  selector: '[appDialogInertRoot]',
})
export class DialogInertRoot implements OnDestroy {
  readonly #element = inject(ElementRef<HTMLElement>).nativeElement;
  readonly #dialogState = inject(DialogState);

  constructor() {
    this.#dialogState.registerInertRoot(this.#element);
  }

  ngOnDestroy(): void {
    this.#dialogState.unregisterInertRoot(this.#element);
  }
}
