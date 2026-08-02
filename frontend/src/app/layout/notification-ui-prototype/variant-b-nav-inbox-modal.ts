import { Component, computed, input, output } from '@angular/core';
import { MaterialSymbolIconComponent } from '../../ui/material-symbol-icon/material-symbol-icon.component';
import {
  PrototypeNotification,
  PrototypeToast,
  badgeLabel,
  kindLabel,
  unreadCount,
} from './fixtures';

/**
 * Variant B — primary nav "Inbox" entry + modal sheet + top-center toasts.
 * Spacious cards; modal center takes focus; badge lives in nav.
 */
@Component({
  selector: 'app-notification-proto-variant-b',
  imports: [MaterialSymbolIconComponent],
  template: `
    <div class="vb-nav-slot">
      <button
        type="button"
        class="vb-nav-link"
        [class.vb-nav-link--open]="centerOpen()"
        [attr.aria-expanded]="centerOpen()"
        (click)="toggleCenter.emit()"
      >
        Inbox
        @if (badge(); as label) {
          <span class="vb-nav-badge" aria-label="{{ unread() }} unread">{{ label }}</span>
        }
      </button>
    </div>

    @if (centerOpen()) {
      <div class="vb-backdrop" (click)="closeCenter.emit()" aria-hidden="true"></div>
      <div
        class="vb-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vb-sheet-title"
      >
        <header class="vb-sheet__header">
          <div>
            <h2 id="vb-sheet-title">Notification Center</h2>
            <p class="vb-sheet__sub">
              {{ unread() }} unread · deep-link only (no inline actions)
            </p>
          </div>
          <button type="button" class="vb-close" (click)="closeCenter.emit()" aria-label="Close">
            <app-material-symbol-icon name="close" aria-hidden="true" />
          </button>
        </header>

        @if (notifications().length === 0) {
          <div class="vb-empty">
            <app-material-symbol-icon name="inbox" aria-hidden="true" />
            <p>No notifications yet</p>
            <p class="vb-muted">When someone invites you or needs a reservation decision, it lands here.</p>
          </div>
        } @else {
          <ul class="vb-cards">
            @for (n of notifications(); track n.id) {
              <li>
                <button
                  type="button"
                  class="vb-card"
                  [class.vb-card--unread]="n.attention === 'unread'"
                  (click)="openItem.emit(n)"
                >
                  <span class="vb-card__icon" aria-hidden="true">
                    @switch (n.kind) {
                      @case ('invitation') {
                        <app-material-symbol-icon name="groups" />
                      }
                      @case ('reservation_request') {
                        <app-material-symbol-icon name="event" />
                      }
                      @default {
                        <app-material-symbol-icon name="schedule" />
                      }
                    }
                  </span>
                  <span class="vb-card__body">
                    <span class="vb-card__kicker">
                      {{ kindLabel(n.kind) }}
                      @if (n.attention === 'unread') {
                        <span class="vb-pill">Unread</span>
                      }
                    </span>
                    <span class="vb-card__title">{{ n.summary }}</span>
                    <span class="vb-card__meta">{{ n.meta }} · {{ n.relativeTime }}</span>
                    <span class="vb-card__cta">{{ n.deepLinkLabel }} →</span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }

    <div class="vb-toasts" aria-live="polite" aria-relevant="additions">
      @for (t of toasts(); track t.id) {
        <div
          class="vb-toast"
          [class.vb-toast--error]="t.severity === 'error'"
          [class.vb-toast--success]="t.severity === 'success'"
          role="status"
        >
          <span class="vb-toast__icon" aria-hidden="true">
            @if (t.severity === 'success') {
              <app-material-symbol-icon name="check-circle" />
            } @else {
              <app-material-symbol-icon name="error" />
            }
          </span>
          <span class="vb-toast__msg">{{ t.message }}</span>
          <button
            type="button"
            class="vb-toast__dismiss"
            (click)="dismissToast.emit(t.id)"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .vb-nav-slot {
      position: fixed;
      /* Align roughly with primary nav row on desktop */
      top: calc(var(--space-4) + 0.35rem);
      left: 50%;
      transform: translateX(-50%);
      z-index: 30;
      pointer-events: none;
    }
    .vb-nav-link {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1-5) var(--space-3);
      border-radius: var(--radius-full);
      border: var(--border-width) solid var(--primary);
      background: color-mix(in oklch, var(--primary) 18%, var(--card));
      color: var(--foreground);
      font-weight: 600;
      box-shadow: 0 2px 10px oklch(0% 0 0 / 12%);
    }
    .vb-nav-link--open {
      background: var(--primary);
      color: var(--primary-foreground);
    }
    .vb-nav-badge {
      min-width: 1.25rem;
      padding: 0.1rem 0.35rem;
      border-radius: var(--radius-full);
      background: var(--destructive);
      color: var(--destructive-foreground);
      font-size: 0.7rem;
      font-weight: 700;
      text-align: center;
    }
    .vb-backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: oklch(15% 0.02 60 / 55%);
    }
    .vb-sheet {
      position: fixed;
      z-index: 50;
      top: 8vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(36rem, calc(100vw - 2rem));
      max-height: 80dvh;
      display: grid;
      grid-template-rows: auto 1fr;
      background: var(--card);
      color: var(--card-foreground);
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-popover);
      overflow: hidden;
    }
    .vb-sheet__header {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-5) var(--space-5) var(--space-4);
      border-bottom: var(--border-width) solid var(--border);
    }
    .vb-sheet__header h2 {
      margin: 0 0 var(--space-1);
      font-size: 1.35rem;
    }
    .vb-sheet__sub {
      margin: 0;
      color: var(--muted-foreground);
      font-size: 0.85rem;
    }
    .vb-close {
      display: inline-flex;
      width: 2.5rem;
      height: 2.5rem;
      align-items: center;
      justify-content: center;
      padding: 0;
      border-radius: var(--radius-full);
      border: var(--border-width) solid var(--border);
      background: var(--secondary);
    }
    .vb-empty {
      padding: var(--space-12) var(--space-6);
      display: grid;
      gap: var(--space-2);
      justify-items: center;
      text-align: center;
      color: var(--muted-foreground);
    }
    .vb-empty p {
      margin: 0;
    }
    .vb-empty > app-material-symbol-icon {
      font-size: 2.5rem;
      opacity: 0.5;
    }
    .vb-muted {
      font-size: 0.9rem;
      max-width: 22rem;
    }
    .vb-cards {
      list-style: none;
      margin: 0;
      padding: var(--space-4);
      display: grid;
      gap: var(--space-3);
      overflow: auto;
    }
    .vb-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-4);
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius-md);
      background: var(--background);
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .vb-card:hover {
      border-color: var(--primary);
      background: color-mix(in oklch, var(--primary) 6%, var(--background));
    }
    .vb-card--unread {
      border-color: color-mix(in oklch, var(--primary) 45%, var(--border));
      box-shadow: inset 3px 0 0 var(--primary);
    }
    .vb-card__icon {
      display: inline-flex;
      width: 2.5rem;
      height: 2.5rem;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background: var(--muted);
      color: var(--foreground);
    }
    .vb-card__body {
      display: grid;
      gap: 0.25rem;
      min-width: 0;
    }
    .vb-card__kicker {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted-foreground);
    }
    .vb-pill {
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-full);
      background: var(--primary);
      color: var(--primary-foreground);
      font-size: 0.65rem;
      letter-spacing: 0.04em;
    }
    .vb-card__title {
      font-weight: 650;
      font-size: 1rem;
      line-height: 1.35;
    }
    .vb-card__meta {
      color: var(--muted-foreground);
      font-size: 0.85rem;
    }
    .vb-card__cta {
      margin-top: var(--space-1);
      color: var(--primary);
      font-size: 0.85rem;
      font-weight: 600;
    }
    .vb-toasts {
      position: fixed;
      z-index: 70;
      top: var(--space-4);
      left: 50%;
      transform: translateX(-50%);
      display: grid;
      gap: var(--space-2);
      width: min(28rem, calc(100vw - 2rem));
      pointer-events: none;
    }
    .vb-toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-full);
      border: var(--border-width) solid var(--border);
      background: var(--popover);
      color: var(--popover-foreground);
      box-shadow: var(--shadow-popover);
      font-size: 0.9rem;
    }
    .vb-toast--success {
      background: color-mix(in oklch, var(--success) 18%, var(--popover));
    }
    .vb-toast--error {
      background: color-mix(in oklch, var(--destructive) 16%, var(--popover));
    }
    .vb-toast__icon {
      display: inline-flex;
      flex: 0 0 auto;
    }
    .vb-toast__msg {
      flex: 1;
      min-width: 0;
    }
    .vb-toast__dismiss {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 1.2rem;
      line-height: 1;
      padding: 0 var(--space-1);
    }
  `,
})
export class NotificationProtoVariantB {
  readonly notifications = input.required<readonly PrototypeNotification[]>();
  readonly toasts = input.required<readonly PrototypeToast[]>();
  readonly centerOpen = input.required<boolean>();

  readonly toggleCenter = output<void>();
  readonly closeCenter = output<void>();
  readonly openItem = output<PrototypeNotification>();
  readonly dismissToast = output<string>();

  readonly unread = computed(() => unreadCount(this.notifications()));
  readonly badge = computed(() => badgeLabel(this.unread()));

  readonly kindLabel = kindLabel;
}
