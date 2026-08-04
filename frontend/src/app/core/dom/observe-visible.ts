import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

/** Fraction of the host that must be visible before emitting. */
const VISIBILITY_THRESHOLD = 0.2;

/**
 * Emits once when the host first intersects the viewport.
 * Used for destination mark-read when a work unit becomes visible.
 */
@Directive({
  selector: '[app-observe-visible]',
})
export class ObserveVisible {
  readonly #host = inject(ElementRef<HTMLElement>);
  readonly #destroyRef = inject(DestroyRef);

  /** When false, observation is skipped (e.g. tools tab). Default true. */
  readonly appObserveVisible = input(true, { alias: 'app-observe-visible' });
  readonly visible = output<void>();

  constructor() {
    afterNextRender(() => {
      if (!this.appObserveVisible()) return;
      if (typeof IntersectionObserver === 'undefined') {
        // jsdom / environments without IO: treat as immediately visible.
        this.visible.emit();
        return;
      }
      const el = this.#host.nativeElement;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            this.visible.emit();
            observer.disconnect();
          }
        },
        { threshold: VISIBILITY_THRESHOLD, rootMargin: '0px' },
      );
      observer.observe(el);
      this.#destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
