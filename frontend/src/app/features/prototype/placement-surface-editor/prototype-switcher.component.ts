import { isDevMode, ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export interface PrototypeVariantMeta {
  key: string;
  name: string;
}

/**
 * PROTOTYPE ONLY — floating variant switcher. Hidden outside dev builds.
 */
@Component({
  selector: 'app-prototype-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="proto-switcher" role="navigation" aria-label="Prototype variants">
        <button type="button" (click)="cycle(-1)" aria-label="Previous variant">←</button>
        <span class="proto-switcher__label">{{ currentKey() }} — {{ currentName() }}</span>
        <button type="button" (click)="cycle(1)" aria-label="Next variant">→</button>
      </div>
    }
  `,
  styles: `
    .proto-switcher {
      position: fixed;
      z-index: 9999;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.85rem;
      background: oklch(15% 0.02 60);
      color: oklch(96% 0.01 80);
      border-radius: 999px;
      box-shadow: 0 8px 24px oklch(0% 0 0 / 35%);
      font-size: 0.9rem;
    }
    .proto-switcher button {
      background: oklch(30% 0.03 60);
      color: inherit;
      border: 0;
      border-radius: 999px;
      width: 2rem;
      height: 2rem;
      padding: 0;
    }
    .proto-switcher__label {
      min-width: 12rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  `,
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class PrototypeSwitcherComponent {
  readonly variants = input.required<PrototypeVariantMeta[]>();
  readonly visible = isDevMode();

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly queryVariant = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('variant') ?? 'A')),
    { initialValue: 'A' },
  );

  readonly currentKey = computed(() => {
    const key = (this.queryVariant() ?? 'A').toUpperCase();
    const keys = this.variants().map((v) => v.key);
    return keys.includes(key) ? key : (keys[0] ?? 'A');
  });

  readonly currentName = computed(() => {
    const key = this.currentKey();
    return this.variants().find((v) => v.key === key)?.name ?? key;
  });

  cycle(delta: number): void {
    const list = this.variants();
    if (!list.length) return;
    const idx = list.findIndex((v) => v.key === this.currentKey());
    const next = list[(idx + delta + list.length) % list.length]!;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { variant: next.key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onKey(event: KeyboardEvent): void {
    if (!this.visible) return;
    const t = event.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.cycle(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.cycle(1);
    }
  }
}
