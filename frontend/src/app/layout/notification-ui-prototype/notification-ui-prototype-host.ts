import { JsonPipe } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import {
  PrototypeFixtures,
  PrototypeNotification,
  PrototypeScenarioId,
  PrototypeToast,
  createFixtures,
  unreadCount,
} from './fixtures';
import {
  NotificationUiPrototypeSwitcher,
  PrototypeVariantKey,
} from './prototype-switcher';
import { NotificationProtoVariantA } from './variant-a-header-bell-drawer';
import { NotificationProtoVariantB } from './variant-b-nav-inbox-modal';
import { NotificationProtoVariantC } from './variant-c-account-popover';

/**
 * PROTOTYPE host for Notification Center + toast shell placement (#34).
 *
 * Question: how should toast region + Notification Center chrome sit in the app shell
 * (placement, open/close, badge entry point, density)?
 *
 * Three variants via ?variant=A|B|C on any authenticated route — fixture data only.
 */
@Component({
  selector: 'app-notification-ui-prototype-host',
  imports: [
    JsonPipe,
    NotificationUiPrototypeSwitcher,
    NotificationProtoVariantA,
    NotificationProtoVariantB,
    NotificationProtoVariantC,
  ],
  template: `
    <div class="proto-panel" role="region" aria-label="Notification UI prototype controls">
      <p class="proto-panel__title">
        <strong>PROTOTYPE · #34</strong>
        Notification Center + toast placement (throwaway)
      </p>
      <p class="proto-panel__question">
        Compare entry point, open/close chrome, toast stack position, and list density.
        Real app shell + routes stay underneath.
      </p>
      <div class="proto-panel__row">
        <label>
          Scenario
          <select [value]="scenarioId()" (change)="onScenario(($any($event.target)).value)">
            <option value="mixed">Mixed unread + read</option>
            <option value="empty">Empty inbox</option>
            <option value="many-unread">Many unread (badge 9+)</option>
          </select>
        </label>
        <div class="proto-panel__actions">
          <button type="button" (click)="pushToast('success')">Toast success</button>
          <button type="button" (click)="pushToast('error')">Toast error</button>
          <button type="button" (click)="centerOpen.set(!centerOpen())">
            {{ centerOpen() ? 'Close center' : 'Open center' }}
          </button>
        </div>
      </div>
      <p class="proto-panel__state" role="status">
        Variant <strong>{{ variant() }}</strong> · scenario
        <strong>{{ scenarioId() }}</strong> · unread
        <strong>{{ unread() }}</strong> · toasts
        <strong>{{ toasts().length }}</strong> · last:
        <strong>{{ lastAction() }}</strong>
      </p>
      <details class="proto-panel__dump">
        <summary>Surface full prototype state</summary>
        <pre>{{ dump() | json }}</pre>
      </details>
    </div>

    @switch (variant()) {
      @case ('A') {
        <app-notification-proto-variant-a
          [notifications]="notifications()"
          [toasts]="toasts()"
          [centerOpen]="centerOpen()"
          (toggleCenter)="onToggleCenter()"
          (closeCenter)="onCloseCenter()"
          (openItem)="onOpenItem($event)"
          (dismissToast)="onDismissToast($event)"
        />
      }
      @case ('B') {
        <app-notification-proto-variant-b
          [notifications]="notifications()"
          [toasts]="toasts()"
          [centerOpen]="centerOpen()"
          (toggleCenter)="onToggleCenter()"
          (closeCenter)="onCloseCenter()"
          (openItem)="onOpenItem($event)"
          (dismissToast)="onDismissToast($event)"
        />
      }
      @case ('C') {
        <app-notification-proto-variant-c
          [notifications]="notifications()"
          [toasts]="toasts()"
          [centerOpen]="centerOpen()"
          (toggleCenter)="onToggleCenter()"
          (closeCenter)="onCloseCenter()"
          (openItem)="onOpenItem($event)"
          (dismissToast)="onDismissToast($event)"
        />
      }
    }

    <app-notification-ui-prototype-switcher
      [current]="variant()"
      (variantChange)="variantChange.emit($event)"
      (exit)="exit.emit()"
    />
  `,
  styles: `
    .proto-panel {
      position: sticky;
      top: 0;
      z-index: 25;
      margin: 0 auto;
      max-width: var(--container-5xl);
      padding: var(--space-3) var(--space-4);
      border-bottom: 2px dashed color-mix(in oklch, var(--warning) 55%, var(--border));
      background: color-mix(in oklch, var(--warning) 12%, var(--background));
      display: grid;
      gap: var(--space-2);
    }
    .proto-panel__title,
    .proto-panel__question,
    .proto-panel__state {
      margin: 0;
      font-size: 0.9rem;
    }
    .proto-panel__question {
      color: var(--muted-foreground);
    }
    .proto-panel__row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: end;
    }
    .proto-panel__row label {
      display: grid;
      gap: var(--space-1);
      font-size: 0.8rem;
    }
    .proto-panel__row select {
      padding: var(--space-2);
      min-width: 12rem;
    }
    .proto-panel__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .proto-panel__actions button {
      padding: var(--space-2) var(--space-3);
      font-size: 0.85rem;
    }
    .proto-panel__dump {
      font-size: 0.75rem;
      color: var(--muted-foreground);
    }
    .proto-panel__dump pre {
      overflow: auto;
      max-height: 12rem;
      padding: var(--space-3);
      background: var(--muted);
      border-radius: var(--radius-sm);
    }
  `,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class NotificationUiPrototypeHost {
  readonly variant = input.required<PrototypeVariantKey>();
  readonly variantChange = output<PrototypeVariantKey>();
  readonly exit = output<void>();

  readonly scenarioId = signal<PrototypeScenarioId>('mixed');
  readonly fixtures = signal<PrototypeFixtures>(createFixtures('mixed'));
  readonly centerOpen = signal(false);
  readonly toasts = signal<readonly PrototypeToast[]>([]);
  readonly lastAction = signal('entered prototype');
  #toastSeq = 0;

  readonly notifications = computed(() => this.fixtures().notifications);
  readonly unread = computed(() => unreadCount(this.notifications()));
  /** Public for shell header trigger (variant A) — empty string when none. */
  readonly badgeLabel = computed(() => {
    const count = this.unread();
    if (count <= 0) return '';
    if (count > 9) return '9+';
    return String(count);
  });
  readonly dump = computed(() => ({
    variant: this.variant(),
    scenarioId: this.scenarioId(),
    centerOpen: this.centerOpen(),
    unread: this.unread(),
    notifications: this.notifications(),
    toasts: this.toasts(),
    lastAction: this.lastAction(),
  }));

  constructor() {
    effect(() => {
      const v = this.variant();
      this.centerOpen.set(false);
      this.lastAction.set(`switched to variant ${v}`);
    });
  }

  onScenario(value: string): void {
    const id = value as PrototypeScenarioId;
    this.scenarioId.set(id);
    this.fixtures.set(createFixtures(id));
    this.lastAction.set(`scenario → ${id}`);
  }

  onToggleCenter(): void {
    this.centerOpen.update((open) => !open);
    this.lastAction.set(this.centerOpen() ? 'opened center' : 'closed center');
  }

  onCloseCenter(): void {
    this.centerOpen.set(false);
    this.lastAction.set('closed center');
  }

  onOpenItem(n: PrototypeNotification): void {
    // Destination open marks Read (inbox lifecycle) — simulate locally.
    this.fixtures.update((f) => ({
      ...f,
      notifications: f.notifications.map((row) =>
        row.id === n.id ? { ...row, attention: 'read' as const } : row,
      ),
    }));
    this.centerOpen.set(false);
    this.lastAction.set(`deep-link ${n.id} → ${n.deepLinkLabel} (marked read)`);
  }

  pushToast(severity: 'success' | 'error'): void {
    this.#toastSeq += 1;
    const id = `t${this.#toastSeq}`;
    const message =
      severity === 'success'
        ? 'Saved. Your changes are live.'
        : 'Couldn’t save. Check your connection and try again.';
    this.toasts.update((list) => {
      const next = [{ id, severity, message }, ...list].slice(0, 3);
      return next;
    });
    this.lastAction.set(`toast ${severity} ${id}`);
    const ms = severity === 'success' ? 4000 : 8000;
    window.setTimeout(() => this.onDismissToast(id), ms);
  }

  onDismissToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
    this.lastAction.set(`dismissed toast ${id}`);
  }

  onEscape(): void {
    if (this.centerOpen()) {
      this.onCloseCenter();
    }
  }
}
