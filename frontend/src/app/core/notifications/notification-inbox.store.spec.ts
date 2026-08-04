import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsApi } from '../api/notifications-api.service';
import {
  Notification,
  NotificationsEnvelope,
  UnreadCountEnvelope,
} from '../api/model';
import { SessionStatus, SessionStore } from '../session/session.store';
import { NotificationInboxStore } from './notification-inbox.store';

const notification = (overrides: Partial<Notification> = {}): Notification => ({
  id: overrides.id ?? 'n1',
  kind: overrides.kind ?? 'invitation',
  subjectId: overrides.subjectId ?? 's1',
  subjectStatus: overrides.subjectStatus ?? 'pending',
  attention: overrides.attention ?? 'unread',
  summary: overrides.summary ?? 'You’re invited',
  deepLink: overrides.deepLink ?? { surface: 'home' },
  payload: overrides.payload ?? {},
  createdAt: overrides.createdAt ?? '2026-08-01T10:00:00Z',
  updatedAt: overrides.updatedAt ?? '2026-08-01T10:00:00Z',
});

const createFakeApi = () => {
  const list = vi.fn(
    async (): Promise<NotificationsEnvelope> => ({
      notifications: [notification()],
      unreadCount: 1,
      limit: 20,
      offset: 0,
      total: 1,
    }),
  );
  const unreadCount = vi.fn(
    async (): Promise<UnreadCountEnvelope> => ({ unreadCount: 3 }),
  );
  const markRead = vi.fn(async (id: string) => ({
    notification: notification({ id, attention: 'read' }),
  }));
  return { list, unreadCount, markRead };
};

const createStore = (
  api: ReturnType<typeof createFakeApi>,
  initialStatus: SessionStatus = 'anonymous',
) => {
  const status = signal<SessionStatus>(initialStatus);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      NotificationInboxStore,
      { provide: NotificationsApi, useValue: api },
      {
        provide: SessionStore,
        useValue: {
          status: status.asReadonly(),
          user: () => null,
          clear: vi.fn(),
        },
      },
    ],
  });
  const store = TestBed.inject(NotificationInboxStore);
  return { store, status };
};

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('NotificationInboxStore', () => {
  it('refresh loads unread count when center is closed', async () => {
    const api = createFakeApi();
    const { store } = createStore(api);

    await store.refresh();

    expect(api.unreadCount).toHaveBeenCalledTimes(1);
    expect(api.list).not.toHaveBeenCalled();
    expect(store.unreadCount()).toBe(3);
    expect(store.list()).toEqual([]);
  });

  it('refresh loads list and count when center is open', async () => {
    const api = createFakeApi();
    const { store } = createStore(api);

    store.openCenter();
    await vi.waitFor(() => expect(api.list).toHaveBeenCalled());
    await store.refresh();

    expect(store.list()).toHaveLength(1);
    expect(store.unreadCount()).toBe(1);
    expect(store.centerOpen()).toBe(true);
  });

  it('coalesces in-flight refresh calls', async () => {
    const api = createFakeApi();
    let resolveCount!: (value: UnreadCountEnvelope) => void;
    api.unreadCount.mockReturnValueOnce(
      new Promise<UnreadCountEnvelope>((resolve) => {
        resolveCount = resolve;
      }),
    );
    const { store } = createStore(api);

    const first = store.refresh();
    const second = store.refresh();
    expect(second).toBe(first);
    expect(api.unreadCount).toHaveBeenCalledTimes(1);

    resolveCount({ unreadCount: 2 });
    await first;
    // Queued refresh runs after the first completes.
    await vi.waitFor(() => expect(api.unreadCount.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(store.unreadCount()).toBe(3);
  });

  it('open/close/toggle center chrome without marking read', async () => {
    const api = createFakeApi();
    const { store } = createStore(api);

    store.openCenter();
    expect(store.centerOpen()).toBe(true);
    expect(api.markRead).not.toHaveBeenCalled();

    store.closeCenter();
    expect(store.centerOpen()).toBe(false);

    store.toggleCenter();
    expect(store.centerOpen()).toBe(true);
    store.toggleCenter();
    expect(store.centerOpen()).toBe(false);
  });

  it('clear resets list, unread count, and closes center', async () => {
    const api = createFakeApi();
    const { store } = createStore(api);
    store.openCenter();
    await vi.waitFor(() => expect(api.list).toHaveBeenCalled());

    store.clear();

    expect(store.list()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.centerOpen()).toBe(false);
    expect(store.badgeLabel()).toBeNull();
  });

  it('badgeLabel hides at 0 and caps at 9+', async () => {
    const api = createFakeApi();
    api.unreadCount
      .mockResolvedValueOnce({ unreadCount: 0 })
      .mockResolvedValueOnce({ unreadCount: 4 })
      .mockResolvedValueOnce({ unreadCount: 12 });
    const { store } = createStore(api);

    await store.refresh();
    expect(store.badgeLabel()).toBeNull();

    await store.refresh();
    expect(store.badgeLabel()).toBe('4');

    await store.refresh();
    expect(store.badgeLabel()).toBe('9+');
  });

  it('markRead updates local list and silence API failures', async () => {
    const api = createFakeApi();
    const { store } = createStore(api);
    store.openCenter();
    await vi.waitFor(() => expect(store.list()).toHaveLength(1));

    await store.markRead('n1');
    expect(api.markRead).toHaveBeenCalledWith('n1');
    expect(store.list()[0]?.attention).toBe('read');

    api.markRead.mockRejectedValueOnce(new Error('network'));
    await expect(store.markRead('n1')).resolves.toBeUndefined();
  });

  it('activateNotification closes the Center without marking Read', async () => {
    const api = createFakeApi();
    const { store } = createStore(api);
    store.openCenter();
    await vi.waitFor(() => expect(store.centerOpen()).toBe(true));

    store.activateNotification();

    expect(api.markRead).not.toHaveBeenCalled();
    expect(store.centerOpen()).toBe(false);
  });

  it('openNotification navigates deep link without marking Read', async () => {
    const api = createFakeApi();
    const { store } = createStore(api);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const row = notification({
      id: 'n2',
      attention: 'unread',
      deepLink: { surface: 'sharing_group', sharingGroupId: 'g1' },
    });

    await store.openNotification(row);

    expect(api.markRead).not.toHaveBeenCalled();
    expect(store.centerOpen()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/sharing-groups', 'g1'], {
      queryParams: undefined,
    });
  });

  it('openNotification passes query params from deep link resolution', async () => {
    const api = createFakeApi();
    const { store } = createStore(api);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const row = notification({
      id: 'n-owner',
      attention: 'unread',
      deepLink: {
        surface: 'my_stuff',
        tab: 'approvals',
        reservationId: 'r1',
      },
    });

    await store.openNotification(row);

    expect(api.markRead).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/my-stuff'], {
      queryParams: { tab: 'approvals' },
    });
  });

  it('markSubjectsRead correlates kind and subject without requiring center open', async () => {
    const api = createFakeApi();
    api.list.mockResolvedValueOnce({
      notifications: [
        notification({
          id: 'inv-n1',
          kind: 'invitation',
          subjectId: 'inv-1',
          attention: 'unread',
        }),
        notification({
          id: 'inv-n2',
          kind: 'invitation',
          subjectId: 'inv-2',
          attention: 'read',
        }),
        notification({
          id: 'res-n1',
          kind: 'reservation_request',
          subjectId: 'inv-1',
          attention: 'unread',
        }),
      ],
      unreadCount: 2,
      limit: 50,
      offset: 0,
      total: 3,
    });
    const { store } = createStore(api);

    await store.markSubjectsRead('invitation', ['inv-1', 'inv-2', 'missing']);

    expect(api.list).toHaveBeenCalled();
    expect(api.markRead).toHaveBeenCalledTimes(1);
    expect(api.markRead).toHaveBeenCalledWith('inv-n1');
    expect(store.centerOpen()).toBe(false);
  });

  it('markSubjectsRead stays silent when list fails', async () => {
    const api = createFakeApi();
    api.list.mockRejectedValueOnce(new Error('offline'));
    const { store } = createStore(api);

    await expect(store.markSubjectsRead('invitation', ['inv-1'])).resolves.toBeUndefined();
    expect(api.markRead).not.toHaveBeenCalled();
  });

  it('markDeepLinkRead marks unread rows matching deep_link fields', async () => {
    const api = createFakeApi();
    const correlated: NotificationsEnvelope = {
      notifications: [
        notification({
          id: 'home-n1',
          kind: 'invitation',
          subjectId: 'inv-cancelled',
          subjectStatus: 'cancelled',
          attention: 'unread',
          deepLink: { surface: 'home' },
        }),
        notification({
          id: 'group-n1',
          kind: 'invitation',
          subjectId: 'inv-accepted',
          subjectStatus: 'accepted',
          attention: 'unread',
          deepLink: { surface: 'sharing_group', sharingGroupId: 'g1' },
        }),
        notification({
          id: 'group-n2',
          kind: 'invitation',
          subjectId: 'inv-other',
          subjectStatus: 'accepted',
          attention: 'unread',
          deepLink: { surface: 'sharing_group', sharingGroupId: 'g2' },
        }),
      ],
      unreadCount: 3,
      limit: 50,
      offset: 0,
      total: 3,
    };
    api.list.mockResolvedValue(correlated);
    const { store } = createStore(api);

    await store.markDeepLinkRead({ surface: 'home' });
    expect(api.markRead).toHaveBeenCalledTimes(1);
    expect(api.markRead).toHaveBeenCalledWith('home-n1');

    api.markRead.mockClear();
    await store.markDeepLinkRead({
      surface: 'sharing_group',
      sharingGroupId: 'g1',
    });
    expect(api.markRead).toHaveBeenCalledTimes(1);
    expect(api.markRead).toHaveBeenCalledWith('group-n1');
  });

  it('refresh failures stay silent and leave prior state', async () => {
    const api = createFakeApi();
    api.unreadCount.mockRejectedValueOnce(new Error('offline'));
    const { store } = createStore(api);

    await expect(store.refresh()).resolves.toBeUndefined();
    expect(store.unreadCount()).toBe(0);
  });

  it('clears inbox when session becomes anonymous after auth', async () => {
    const api = createFakeApi();
    const { store, status } = createStore(api, 'anonymous');
    status.set('authenticated');
    TestBed.tick();
    await vi.waitFor(() => expect(api.unreadCount).toHaveBeenCalled());
    store.openCenter();
    await vi.waitFor(() => expect(store.list().length).toBeGreaterThan(0));

    status.set('anonymous');
    TestBed.tick();

    expect(store.list()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.centerOpen()).toBe(false);
  });
});