import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { DialogInertRoot } from './core/dialog/dialog-inert-root';
import { NotificationInboxStore } from './core/notifications/notification-inbox.store';
import { SessionStore } from './core/session/session.store';
import { UserAvatar } from './features/user-avatar/user-avatar/user-avatar';
import { NotificationCenter } from './layout/notification-center/notification-center';
import { ToastHost } from './layout/toast-host/toast-host';
import { MaterialSymbolIconComponent } from './ui/material-symbol-icon/material-symbol-icon.component';

const DEFAULT_PROTECTED_ROUTE = '/home';
const PROTECTED_ROUTES = ['/sharing'] as const;

@Component({
  selector: 'app-root',
  imports: [
    DialogInertRoot,
    RouterOutlet,
    RouterLink,
    ToastHost,
    UserAvatar,
    NotificationCenter,
    MaterialSymbolIconComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly session = inject(SessionStore);
  readonly inbox = inject(NotificationInboxStore);
  readonly accountMenuOpen = signal(false);
  readonly #router = inject(Router);
  readonly inboxAriaLabel = computed(() => {
    const count = this.inbox.unreadCount();
    if (count <= 0) return 'Open Notification Center';
    if (count === 1) return 'Open Notification Center, 1 unread';
    return `Open Notification Center, ${count} unread`;
  });
  readonly #protectedRouteRedirect = effect(() => {
    if (
      this.session.status() === 'anonymous' &&
      PROTECTED_ROUTES.some((route) => this.#router.url.startsWith(route))
    ) {
      void this.#router.navigate(['/sign-in'], {
        queryParams: { returnUrl: DEFAULT_PROTECTED_ROUTE },
      });
    }
  });

  accountMenuToggled(event: Event): void {
    const menu = event.currentTarget;
    this.accountMenuOpen.set(menu instanceof HTMLElement && menu.matches(':popover-open'));
  }

  async signOut(): Promise<void> {
    await this.session.signOut();
    this.inbox.clear();
    await this.#router.navigate(['/sign-in']);
  }
}
