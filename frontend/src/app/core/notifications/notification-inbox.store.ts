import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { NotificationsApi } from '../api/notifications-api.service';
import { Notification } from '../api/model';
import { SessionStore } from '../session/session.store';
import { deepLinkCommands, notificationBadgeLabel } from './functions';

const LIST_PAGE_LIMIT = 20;

@Injectable({ providedIn: 'root' })
export class NotificationInboxStore {
  readonly #api = inject(NotificationsApi);
  readonly #session = inject(SessionStore);
  readonly #router = inject(Router);
  readonly #document = inject(DOCUMENT);
  readonly #destroyRef = inject(DestroyRef);

  readonly #list = signal<readonly Notification[]>([]);
  readonly #unreadCount = signal(0);
  readonly #centerOpen = signal(false);
  readonly #loading = signal(false);
  #refreshInFlight: Promise<void> | null = null;
  #queuedRefresh = false;
  #sessionWasAuthenticated = false;

  readonly list = this.#list.asReadonly();
  readonly unreadCount = this.#unreadCount.asReadonly();
  readonly centerOpen = this.#centerOpen.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly badgeLabel = computed(() => notificationBadgeLabel(this.#unreadCount()));

  constructor() {
    effect(() => {
      const status = this.#session.status();
      if (status === 'authenticated') {
        if (!this.#sessionWasAuthenticated) {
          this.#sessionWasAuthenticated = true;
          void this.refresh();
        }
        return;
      }
      if (status === 'anonymous' && this.#sessionWasAuthenticated) {
        this.#sessionWasAuthenticated = false;
        this.clear();
      }
    });

    this.#router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe(() => {
        if (this.#session.status() === 'authenticated') {
          void this.refresh();
        }
      });

    const onVisibility = (): void => {
      if (
        this.#document.visibilityState === 'visible' &&
        this.#session.status() === 'authenticated'
      ) {
        void this.refresh();
      }
    };
    this.#document.addEventListener('visibilitychange', onVisibility);
    this.#destroyRef.onDestroy(() => {
      this.#document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  refresh = (): Promise<void> => {
    if (this.#refreshInFlight) {
      this.#queuedRefresh = true;
      return this.#refreshInFlight;
    }
    this.#loading.set(true);
    this.#refreshInFlight = (async () => {
      try {
        do {
          this.#queuedRefresh = false;
          await this.#runRefresh(this.#centerOpen());
        } while (this.#queuedRefresh);
      } finally {
        this.#refreshInFlight = null;
        this.#loading.set(false);
      }
    })();
    return this.#refreshInFlight;
  };

  openCenter = (): void => {
    if (this.#centerOpen()) return;
    this.#centerOpen.set(true);
    void this.refresh();
  };

  closeCenter = (): void => {
    this.#centerOpen.set(false);
  };

  toggleCenter = (): void => {
    if (this.#centerOpen()) {
      this.closeCenter();
      return;
    }
    this.openCenter();
  };

  clear = (): void => {
    this.#list.set([]);
    this.#unreadCount.set(0);
    this.#centerOpen.set(false);
    this.#loading.set(false);
  };

  markRead = async (id: string): Promise<void> => {
    try {
      const { notification } = await this.#api.markRead(id);
      this.#list.update((rows) =>
        rows.map((row) => (row.id === id ? notification : row)),
      );
      this.#unreadCount.set(
        this.#list().filter((row) => row.attention === 'unread').length,
      );
      // Prefer server count when list is only the first page.
      void this.#api
        .unreadCount()
        .then(({ unreadCount }) => this.#unreadCount.set(unreadCount))
        .catch(() => {
          /* silent */
        });
    } catch {
      /* silent — no toast */
    }
  };

  openNotification = async (notification: Notification): Promise<void> => {
    const commands = deepLinkCommands(notification.deepLink);
    if (notification.attention === 'unread') {
      void this.markRead(notification.id);
    }
    this.closeCenter();
    if (commands) {
      await this.#router.navigate([...commands]);
    }
  };

  async #runRefresh(includeList: boolean): Promise<void> {
    try {
      if (includeList) {
        const envelope = await this.#api.list({ limit: LIST_PAGE_LIMIT, offset: 0 });
        this.#list.set(envelope.notifications);
        this.#unreadCount.set(envelope.unreadCount);
        return;
      }
      const { unreadCount } = await this.#api.unreadCount();
      this.#unreadCount.set(unreadCount);
    } catch {
      /* silent — no toast */
    }
  }
}
