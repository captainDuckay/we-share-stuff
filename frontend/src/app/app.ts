import { isDevMode, Component, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { DialogInertRoot } from './core/dialog/dialog-inert-root';
import { SessionStore } from './core/session/session.store';
import { UserAvatar } from './features/user-avatar/user-avatar/user-avatar';
import { NotificationUiPrototypeHost } from './layout/notification-ui-prototype/notification-ui-prototype-host';
import type { PrototypeVariantKey } from './layout/notification-ui-prototype/prototype-switcher';
import { MaterialSymbolIconComponent } from './ui/material-symbol-icon/material-symbol-icon.component';

const DEFAULT_PROTECTED_ROUTE = '/home';
const PROTECTED_ROUTES = ['/sharing'] as const;

const isPrototypeVariant = (value: string | null | undefined): value is PrototypeVariantKey =>
  value === 'A' || value === 'B' || value === 'C';

@Component({
  selector: 'app-root',
  imports: [
    DialogInertRoot,
    RouterOutlet,
    RouterLink,
    UserAvatar,
    NotificationUiPrototypeHost,
    MaterialSymbolIconComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly session = inject(SessionStore);
  readonly accountMenuOpen = signal(false);
  readonly protoHost = viewChild('notificationProtoHost', { read: NotificationUiPrototypeHost });
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

  /**
   * PROTOTYPE gate (#34): ?variant=A|B|C mounts throwaway Notification Center + toast chrome.
   * Development only; omit query param for production shell.
   */
  readonly notificationPrototypeVariant = toSignal(
    this.#router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.#readVariantParam()),
    ),
    { initialValue: null },
  );

  readonly showNotificationPrototypeEntry = isDevMode;

  protoInboxAriaLabel(): string {
    const host = this.protoHost();
    const unread = host?.unread() ?? 0;
    return unread > 0
      ? `Open Notification Center, ${unread} unread`
      : 'Open Notification Center';
  }

  accountMenuToggled(event: Event): void {
    const menu = event.currentTarget;
    this.accountMenuOpen.set(menu instanceof HTMLElement && menu.matches(':popover-open'));
  }

  enterNotificationPrototype(): void {
    this.#setVariantParam('A');
  }

  setNotificationPrototypeVariant(variant: PrototypeVariantKey): void {
    this.#setVariantParam(variant);
  }

  exitNotificationPrototype(): void {
    this.#setVariantParam(null);
  }

  async signOut(): Promise<void> {
    await this.session.signOut();
    await this.#router.navigate(['/sign-in']);
  }

  #readVariantParam(): PrototypeVariantKey | null {
    const tree = this.#router.parseUrl(this.#router.url);
    const raw = tree.queryParams['variant'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return isPrototypeVariant(value) ? value : null;
  }

  #setVariantParam(variant: PrototypeVariantKey | null): void {
    const tree = this.#router.parseUrl(this.#router.url);
    if (variant) {
      tree.queryParams = { ...tree.queryParams, variant };
    } else {
      const { variant: _removed, ...rest } = tree.queryParams;
      tree.queryParams = rest;
    }
    void this.#router.navigateByUrl(tree, { replaceUrl: true });
  }
}
