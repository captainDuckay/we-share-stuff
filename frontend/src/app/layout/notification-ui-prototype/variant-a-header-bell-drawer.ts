import { Component, input, output } from '@angular/core';
import { MaterialSymbolIconComponent } from '../../ui/material-symbol-icon/material-symbol-icon.component';
import { PrototypeNotification, PrototypeToast, kindLabel } from './fixtures';

/**
 * Variant A — classic shell: header inbox trigger (in real app header) + right drawer + bottom-right toasts.
 * Dense list; non-modal drawer with scrim; badge on inbox control.
 * Trigger lives in app.html (left of account avatar) so it participates in real header flex.
 */
@Component({
  selector: 'app-notification-proto-variant-a',
  imports: [MaterialSymbolIconComponent],
  template: `
    @if (centerOpen()) {
      <div class="va-scrim" (click)="closeCenter.emit()" aria-hidden="true"></div>
      <aside
        class="va-drawer"
        role="dialog"
        aria-modal="false"
        aria-labelledby="va-drawer-title"
      >
        <header class="va-drawer__header">
          <h2 id="va-drawer-title">Notifications</h2>
          <button type="button" class="va-icon-btn" (click)="closeCenter.emit()" aria-label="Close">
            <app-material-symbol-icon name="close" aria-hidden="true" />
          </button>
        </header>

        @if (notifications().length === 0) {
          <div class="va-empty">
            <p>You’re all caught up</p>
            <p class="va-muted">Invitations and reservation activity will show up here.</p>
          </div>
        } @else {
          <ul class="va-list">
            @for (n of notifications(); track n.id) {
              <li [class.va-item--unread]="n.attention === 'unread'">
                <button type="button" class="va-item" (click)="openItem.emit(n)">
                  <span class="va-dot" aria-hidden="true"></span>
                  <span class="va-item__body">
                    <span class="va-item__summary">{{ n.summary }}</span>
                    <span class="va-item__meta">
                      <span class="va-chip">{{ kindLabel(n.kind) }}</span>
                      {{ n.meta }}
                    </span>
                  </span>
                  <span class="va-item__time">{{ n.relativeTime }}</span>
                </button>
              </li>
            }
          </ul>
        }
      </aside>
    }

    <div class="va-toasts" aria-live="polite" aria-relevant="additions">
      @for (t of toasts(); track t.id) {
        <div
          class="va-toast"
          [class.va-toast--error]="t.severity === 'error'"
          [class.va-toast--success]="t.severity === 'success'"
          role="status"
        >
          <span class="va-toast__msg">{{ t.message }}</span>
          <button
            type="button"
            class="va-toast__dismiss"
            (click)="dismissToast.emit(t.id)"
            aria-label="Dismiss"
          >
            <app-material-symbol-icon name="close" aria-hidden="true" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .va-scrim {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: oklch(20% 0.02 60 / 35%);
    }
    .va-drawer {
      position: fixed;
      top: 0;
      right: 0;
      z-index: 50;
      display: grid;
      grid-template-rows: auto 1fr;
      width: min(22rem, 100vw);
      height: 100dvh;
      background: var(--card);
      color: var(--card-foreground);
      border-left: var(--border-width) solid var(--border);
      box-shadow: var(--shadow-popover);
    }
    .va-drawer__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4);
      border-bottom: var(--border-width) solid var(--border);
    }
    .va-drawer__header h2 {
      margin: 0;
      font-size: var(--text-lg, 1.125rem);
    }
    .va-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      padding: 0;
      border-radius: var(--radius-full);
      border: var(--border-width) solid var(--border);
      background: var(--secondary);
    }
    .va-empty {
      padding: var(--space-8) var(--space-4);
      display: grid;
      gap: var(--space-2);
      text-align: center;
    }
    .va-empty p {
      margin: 0;
    }
    .va-muted {
      color: var(--muted-foreground);
      font-size: 0.9rem;
    }
    .va-list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow: auto;
    }
    .va-item {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: var(--space-2);
      width: 100%;
      padding: var(--space-3) var(--space-4);
      border: 0;
      border-bottom: var(--border-width) solid var(--border);
      border-radius: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .va-item:hover {
      background: var(--accent);
      color: var(--accent-foreground);
    }
    .va-item--unread .va-item {
      background: color-mix(in oklch, var(--primary) 8%, var(--card));
    }
    .va-item--unread .va-dot {
      background: var(--primary);
    }
    .va-dot {
      width: 0.5rem;
      height: 0.5rem;
      margin-top: 0.45rem;
      border-radius: var(--radius-full);
      background: transparent;
    }
    .va-item__body {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }
    .va-item__summary {
      font-weight: 600;
      font-size: 0.9rem;
      line-height: 1.3;
    }
    .va-item__meta {
      color: var(--muted-foreground);
      font-size: 0.75rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      align-items: center;
    }
    .va-chip {
      display: inline-block;
      padding: 0.05rem 0.35rem;
      border-radius: var(--radius-xs);
      background: var(--muted);
      color: var(--muted-foreground);
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .va-item__time {
      color: var(--muted-foreground);
      font-size: 0.7rem;
      white-space: nowrap;
      padding-top: 0.15rem;
    }
    .va-toasts {
      position: fixed;
      z-index: 60;
      right: var(--space-4);
      bottom: var(--space-4);
      display: grid;
      gap: var(--space-2);
      width: min(20rem, calc(100vw - 2rem));
      pointer-events: none;
    }
    .va-toast {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--border);
      background: var(--popover);
      color: var(--popover-foreground);
      box-shadow: var(--shadow-popover);
      font-size: 0.9rem;
    }
    .va-toast--success {
      border-color: color-mix(in oklch, var(--success) 50%, var(--border));
      background: color-mix(in oklch, var(--success) 12%, var(--popover));
    }
    .va-toast--error {
      border-color: color-mix(in oklch, var(--destructive) 50%, var(--border));
      background: color-mix(in oklch, var(--destructive) 12%, var(--popover));
    }
    .va-toast__msg {
      flex: 1;
      min-width: 0;
    }
    .va-toast__dismiss {
      display: inline-flex;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      opacity: 0.7;
    }
  `,
})
export class NotificationProtoVariantA {
  readonly notifications = input.required<readonly PrototypeNotification[]>();
  readonly toasts = input.required<readonly PrototypeToast[]>();
  readonly centerOpen = input.required<boolean>();

  readonly toggleCenter = output<void>();
  readonly closeCenter = output<void>();
  readonly openItem = output<PrototypeNotification>();
  readonly dismissToast = output<string>();

  readonly kindLabel = kindLabel;
}
