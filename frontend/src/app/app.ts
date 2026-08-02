import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { DialogInertRoot } from './core/dialog/dialog-inert-root';
import { SessionStore } from './core/session/session.store';
import { UserAvatar } from './features/user-avatar/user-avatar/user-avatar';
import { ToastHost } from './layout/toast-host/toast-host';

const DEFAULT_PROTECTED_ROUTE = '/home';
const PROTECTED_ROUTES = ['/sharing'] as const;

@Component({
  selector: 'app-root',
  imports: [DialogInertRoot, RouterOutlet, RouterLink, ToastHost, UserAvatar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly session = inject(SessionStore);
  readonly accountMenuOpen = signal(false);
  readonly #router = inject(Router);
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
    await this.#router.navigate(['/sign-in']);
  }
}
