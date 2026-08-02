import { NotificationDeepLink, NotificationKind } from '../api/model';

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

/** Route commands for a Notification deep link; null when surface is unknown. */
export const deepLinkCommands = (deepLink: NotificationDeepLink): readonly string[] | null => {
  switch (deepLink.surface) {
    case 'home':
      return ['/home'];
    case 'sharing_group': {
      const groupId = deepLink.sharingGroupId;
      return typeof groupId === 'string' && groupId
        ? ['/sharing-groups', groupId]
        : ['/sharing-groups'];
    }
    case 'reservations':
      return ['/reservations'];
    default:
      return null;
  }
};
