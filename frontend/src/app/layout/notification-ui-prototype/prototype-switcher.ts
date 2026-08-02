import { isDevMode, Component, input, output } from '@angular/core';

export type PrototypeVariantKey = 'A' | 'B' | 'C';

export const PROTOTYPE_VARIANTS: ReadonlyArray<{
  key: PrototypeVariantKey;
  name: string;
}> = [
  { key: 'A', name: 'Header bell · right drawer · BR toasts' },
  { key: 'B', name: 'Nav Inbox · modal sheet · top toasts' },
  { key: 'C', name: 'Account popover · dense · BC toasts' },
];

/** PROTOTYPE-only floating switcher — hidden outside development builds. */
@Component({
  selector: 'app-notification-ui-prototype-switcher',
  template: `
    @if (show()) {
      <div
        class="proto-switcher"
        role="toolbar"
        aria-label="Notification UI prototype variants"
      >
        <button
          type="button"
          class="proto-switcher__btn"
          (click)="step(-1)"
          aria-label="Previous variant"
        >
          ←
        </button>
        <div class="proto-switcher__label">
          <span class="proto-switcher__badge">PROTOTYPE · #34</span>
          <strong>{{ current() }} — {{ currentName() }}</strong>
        </div>
        <button
          type="button"
          class="proto-switcher__btn"
          (click)="step(1)"
          aria-label="Next variant"
        >
          →
        </button>
        <button type="button" class="proto-switcher__exit" (click)="exit.emit()">
          Exit prototype
        </button>
      </div>
    }
  `,
  styles: `
    .proto-switcher {
      position: fixed;
      z-index: 2000;
      left: 50%;
      bottom: 1rem;
      transform: translateX(-50%);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      max-width: calc(100vw - 2rem);
      padding: 0.5rem 0.75rem;
      border-radius: 999px;
      background: oklch(18% 0.02 60);
      color: oklch(96% 0.01 80);
      box-shadow: 0 8px 28px oklch(0% 0 0 / 35%);
      border: 1px solid oklch(40% 0.03 60);
      font-size: 0.85rem;
    }
    .proto-switcher__btn {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 999px;
      border: 1px solid oklch(50% 0.03 60);
      background: oklch(28% 0.02 60);
      color: inherit;
      cursor: pointer;
      font-size: 1rem;
    }
    .proto-switcher__label {
      display: grid;
      gap: 0.1rem;
      min-width: 12rem;
      text-align: center;
    }
    .proto-switcher__badge {
      font-size: 0.65rem;
      letter-spacing: 0.08em;
      color: oklch(80% 0.14 80);
    }
    .proto-switcher__exit {
      border: 1px solid oklch(50% 0.03 60);
      background: transparent;
      color: inherit;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      cursor: pointer;
      font-size: 0.75rem;
    }
  `,
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class NotificationUiPrototypeSwitcher {
  readonly current = input.required<PrototypeVariantKey>();
  readonly variantChange = output<PrototypeVariantKey>();
  readonly exit = output<void>();

  show(): boolean {
    return isDevMode();
  }

  currentName(): string {
    return PROTOTYPE_VARIANTS.find((v) => v.key === this.current())?.name ?? this.current();
  }

  step(delta: number): void {
    const keys = PROTOTYPE_VARIANTS.map((v) => v.key);
    const i = keys.indexOf(this.current());
    const next = keys[(i + delta + keys.length) % keys.length]!;
    this.variantChange.emit(next);
  }

  onKey(event: KeyboardEvent): void {
    if (!isDevMode()) return;
    const t = event.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.step(1);
    }
  }
}
