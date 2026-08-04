import { NotificationDeepLink, NotificationKind } from '../api/model';
import { NotificationRouteTarget } from './types';

const UNREAD_BADGE_DISPLAY_CAP = 9;

export const notificationBadgeLabel = (unreadCount: number): string | null => {
  if (unreadCount <= 0) return null;
  if (unreadCount > UNREAD_BADGE_DISPLAY_CAP) return '9+';
  return String(unreadCount);
};

export const notificationKindLabel = (kind: NotificationKind): string => {
  switch (kind) {
    case 'invitation':
      return 'Invitation';
    case 'reservation_request':
      return 'Reservation request';
    case 'reservation_change_proposal':
      return 'Change proposal';
  }
};

/**
 * Route commands and optional query params for a Notification deep link.
 * Returns null when the surface is unknown so callers can omit the link.
 */
export const resolveDeepLink = (
  deepLink: NotificationDeepLink,
): NotificationRouteTarget | null => {
  switch (deepLink.surface) {
    case 'home':
      return { commands: ['/home'] };
    case 'sharing_group': {
      const groupId = deepLink.sharingGroupId;
      return typeof groupId === 'string' && groupId
        ? { commands: ['/sharing-groups', groupId] }
        : { commands: ['/sharing-groups'] };
    }
    case 'reservations': {
      const reservationId = deepLink.reservationId;
      const queryParams =
        typeof reservationId === 'string' && reservationId.length > 0
          ? { reservationId }
          : undefined;
      return queryParams
        ? { commands: ['/reservations'], queryParams }
        : { commands: ['/reservations'] };
    }
    case 'my_stuff': {
      const queryParams: Record<string, string> = {};
      const tab = deepLink.tab;
      if (typeof tab === 'string' && tab.length > 0) {
        queryParams['tab'] = tab;
      }
      const reservationId = deepLink.reservationId;
      if (typeof reservationId === 'string' && reservationId.length > 0) {
        queryParams['reservationId'] = reservationId;
      }
      return Object.keys(queryParams).length > 0
        ? { commands: ['/my-stuff'], queryParams }
        : { commands: ['/my-stuff'] };
    }
    default:
      return null;
  }
};
