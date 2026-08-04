import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { NotificationsApi } from '../api/notifications-api.service';
import {
  Notification,
  NotificationDeepLink,
  NotificationKind,
} from '../api/model';
import { SessionStore } from '../session/session.store';
import { notificationBadgeLabel, resolveDeepLink } from './functions';

const LIST_PAGE_LIMIT = 20;
/** Page size when correlating kind + subject for destination mark-read. */
const SUBJECT_CORRELATION_LIMIT = 50;

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

  /**
   * Close the Center after a row is chosen for navigation.
   * Does not mark Read — destination surfaces own the attention lifecycle.
   * Navigation is owned by routerLink on the Notification Center row.
   */
  activateNotification = (): void => {
    this.closeCenter();
  };

  /**
   * Programmatic open: close Center chrome and navigate via deep_link
   * without marking Read (for tests / non-link callers).
   */
  openNotification = async (notification: Notification): Promise<void> => {
    this.activateNotification();
    const target = resolveDeepLink(notification.deepLink);
    if (target) {
      await this.#router.navigate([...target.commands], {
        queryParams: target.queryParams,
      });
    }
  };

  /**
   * Mark Unread Notifications Read by kind + subject when the User opens the
   * destination surface for those subjects (not when only opening the Center).
   */
  markSubjectsRead = async (
    kind: NotificationKind,
    subjectIds: readonly string[],
  ): Promise<void> => {
    const ids = [...new Set(subjectIds.filter(Boolean))];
    if (ids.length === 0) return;
    try {
      const rows = await this.#rowsForCorrelation();
      const targets = rows.filter(
        (row) =>
          row.kind === kind &&
          row.attention === 'unread' &&
          ids.includes(row.subjectId),
      );
      await Promise.all(targets.map((row) => this.markRead(row.id)));
    } catch {
      /* silent — no toast */
    }
  };

  /**
   * Mark Unread Notifications Read when the User opens a destination that
   * matches a structured deep_link (partial field equality).
   */
  markDeepLinkRead = async (
    match: Readonly<Partial<NotificationDeepLink>>,
  ): Promise<void> => {
    const entries = Object.entries(match).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    );
    if (entries.length === 0) return;
    try {
      const rows = await this.#rowsForCorrelation();
      const targets = rows.filter(
        (row) =>
          row.attention === 'unread' &&
          entries.every(([key, value]) => row.deepLink[key] === value),
      );
      await Promise.all(targets.map((row) => this.markRead(row.id)));
    } catch {
      /* silent — no toast */
    }
  };

  async #rowsForCorrelation(): Promise<readonly Notification[]> {
    // Always refresh a page for correlation so destination mark-read sees
    // current Unread rows even when the Center list is empty/closed.
    const envelope = await this.#api.list({
      limit: SUBJECT_CORRELATION_LIMIT,
      offset: 0,
    });
    if (this.#centerOpen()) {
      this.#list.set(envelope.notifications);
    }
    this.#unreadCount.set(envelope.unreadCount);
    return envelope.notifications;
  }

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
