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
 * Variant C — account-adjacent popover (minimal chrome) + bottom-center toasts.
 * Ultra-dense list; no full-height drawer; badge on small icon by avatar.
 */
@Component({
  selector: 'app-notification-proto-variant-c',
  imports: [MaterialSymbolIconComponent],
  template: `
    <div class="vc-trigger-slot">
      <button
        type="button"
        class="vc-trigger"
        [attr.aria-expanded]="centerOpen()"
        [attr.aria-label]="
          unread() > 0
            ? 'Notifications, ' + unread() + ' unread'
            : 'Notifications'
        "
        (click)="toggleCenter.emit()"
      >
        <app-material-symbol-icon
          [name]="unread() > 0 ? 'notifications-unread' : 'notifications'"
          aria-hidden="true"
        />
        @if (badge(); as label) {
          <span class="vc-badge" aria-hidden="true">{{ label }}</span>
        }
      </button>

      @if (centerOpen()) {
        <div
          class="vc-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby="vc-title"
        >
          <header class="vc-popover__header">
            <h2 id="vc-title">Notifications</h2>
            <span class="vc-count">{{ unread() }} unread</span>
          </header>

          @if (notifications().length === 0) {
            <p class="vc-empty">Nothing waiting. Check back after you share or borrow.</p>
          } @else {
            <ul class="vc-list">
              @for (n of notifications(); track n.id) {
                <li>
                  <button
                    type="button"
                    class="vc-row"
                    [class.vc-row--unread]="n.attention === 'unread'"
                    (click)="openItem.emit(n)"
                  >
                    <span class="vc-row__text">
                      <span class="vc-row__summary">{{ n.summary }}</span>
                      <span class="vc-row__meta"
                        >{{ kindLabel(n.kind) }} · {{ n.relativeTime }}</span
                      >
                    </span>
                    <span class="vc-row__chev" aria-hidden="true">›</span>
                  </button>
                </li>
              }
            </ul>
          }

          <footer class="vc-popover__footer">
            <button type="button" class="vc-footer-btn" (click)="closeCenter.emit()">
              Close
            </button>
          </footer>
        </div>
      }
    </div>

    @if (centerOpen()) {
      <button
        type="button"
        class="vc-scrim"
        aria-label="Dismiss Notification Center"
        (click)="closeCenter.emit()"
      ></button>
    }

    <div class="vc-toasts" aria-live="polite" aria-relevant="additions">
      @for (t of toasts(); track t.id) {
        <div
          class="vc-toast"
          [class.vc-toast--error]="t.severity === 'error'"
          [class.vc-toast--success]="t.severity === 'success'"
          role="status"
        >
          {{ t.message }}
          <button
            type="button"
            class="vc-toast__x"
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
    .vc-trigger-slot {
      position: fixed;
      top: var(--space-4);
      right: calc(var(--space-4) + var(--size-avatar) + var(--space-2));
      z-index: 55;
    }
    .vc-trigger {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      padding: 0;
      border-radius: var(--radius-full);
      border: 0;
      background: transparent;
      color: var(--foreground);
    }
    .vc-trigger:hover {
      background: var(--accent);
    }
    .vc-trigger app-material-symbol-icon {
      display: inline-flex;
      font-size: 1.4rem;
    }
    .vc-badge {
      position: absolute;
      top: 0;
      right: 0;
      min-width: 0.95rem;
      height: 0.95rem;
      padding: 0 0.2rem;
      border-radius: var(--radius-full);
      background: var(--destructive);
      color: var(--destructive-foreground);
      font-size: 0.55rem;
      font-weight: 700;
      line-height: 0.95rem;
      text-align: center;
    }
    .vc-scrim {
      position: fixed;
      inset: 0;
      z-index: 50;
      border: 0;
      padding: 0;
      margin: 0;
      background: transparent;
      cursor: default;
    }
    .vc-popover {
      position: absolute;
      top: calc(100% + var(--space-2));
      right: 0;
      z-index: 60;
      width: min(18.5rem, calc(100vw - 1.5rem));
      max-height: min(28rem, 70dvh);
      display: grid;
      grid-template-rows: auto 1fr auto;
      background: var(--popover);
      color: var(--popover-foreground);
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-popover);
      overflow: hidden;
    }
    .vc-popover__header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      padding: var(--space-2-5) var(--space-3);
      border-bottom: var(--border-width) solid var(--border);
    }
    .vc-popover__header h2 {
      margin: 0;
      font-size: 0.95rem;
    }
    .vc-count {
      font-size: 0.7rem;
      color: var(--muted-foreground);
    }
    .vc-empty {
      margin: 0;
      padding: var(--space-5) var(--space-3);
      color: var(--muted-foreground);
      font-size: 0.85rem;
      text-align: center;
    }
    .vc-list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow: auto;
    }
    .vc-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-bottom: var(--border-width) solid var(--border);
      border-radius: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .vc-row:hover {
      background: var(--accent);
      color: var(--accent-foreground);
    }
    .vc-row--unread {
      background: color-mix(in oklch, var(--primary) 7%, transparent);
    }
    .vc-row--unread .vc-row__summary {
      font-weight: 700;
    }
    .vc-row__text {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 0.1rem;
    }
    .vc-row__summary {
      font-size: 0.8rem;
      line-height: 1.25;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .vc-row__meta {
      font-size: 0.68rem;
      color: var(--muted-foreground);
    }
    .vc-row__chev {
      color: var(--muted-foreground);
      font-size: 1.1rem;
      line-height: 1;
    }
    .vc-popover__footer {
      border-top: var(--border-width) solid var(--border);
      padding: var(--space-1-5);
    }
    .vc-footer-btn {
      width: 100%;
      border: 0;
      background: transparent;
      color: var(--muted-foreground);
      font-size: 0.8rem;
      padding: var(--space-2);
      cursor: pointer;
      border-radius: var(--radius-xs);
    }
    .vc-footer-btn:hover {
      background: var(--accent);
      color: var(--accent-foreground);
    }
    .vc-toasts {
      position: fixed;
      z-index: 70;
      left: 50%;
      bottom: 5.5rem;
      transform: translateX(-50%);
      display: grid;
      gap: var(--space-1-5);
      width: min(22rem, calc(100vw - 2rem));
      pointer-events: none;
    }
    .vc-toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-xs);
      border: var(--border-width) solid var(--border);
      background: oklch(22% 0.02 60);
      color: oklch(96% 0.01 80);
      font-size: 0.8rem;
      box-shadow: 0 6px 18px oklch(0% 0 0 / 25%);
    }
    .vc-toast--success {
      border-color: color-mix(in oklch, var(--success) 40%, transparent);
    }
    .vc-toast--error {
      border-color: color-mix(in oklch, var(--destructive) 50%, transparent);
    }
    .vc-toast__x {
      margin-left: auto;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      opacity: 0.75;
      padding: 0;
    }
  `,
})
export class NotificationProtoVariantC {
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
