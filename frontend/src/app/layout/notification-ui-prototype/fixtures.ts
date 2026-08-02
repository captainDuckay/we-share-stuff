/**
 * PROTOTYPE fixtures for Notification Center + toast UI placement (#34).
 * Not production models — throwaway only.
 */

export type PrototypeAttention = 'unread' | 'read';
export type PrototypeKind =
  | 'invitation'
  | 'reservation_request'
  | 'reservation_change_proposal';

export type PrototypeToastSeverity = 'success' | 'error';

export interface PrototypeNotification {
  id: string;
  kind: PrototypeKind;
  attention: PrototypeAttention;
  summary: string;
  meta: string;
  relativeTime: string;
  deepLinkLabel: string;
}

export interface PrototypeToast {
  id: string;
  severity: PrototypeToastSeverity;
  message: string;
}

export type PrototypeScenarioId = 'mixed' | 'empty' | 'many-unread';

export interface PrototypeFixtures {
  scenarioId: PrototypeScenarioId;
  notifications: readonly PrototypeNotification[];
}

const BASE_NOTIFICATIONS: readonly PrototypeNotification[] = [
  {
    id: 'n1',
    kind: 'invitation',
    attention: 'unread',
    summary: 'You’re invited to Backyard Tools',
    meta: 'Invitation · pending',
    relativeTime: '12m',
    deepLinkLabel: 'Open Sharing Group',
  },
  {
    id: 'n2',
    kind: 'reservation_request',
    attention: 'unread',
    summary: 'Alex requested the hedge trimmer',
    meta: 'Reservation request · pending · Sat–Sun',
    relativeTime: '1h',
    deepLinkLabel: 'Open My reservations',
  },
  {
    id: 'n3',
    kind: 'reservation_change_proposal',
    attention: 'unread',
    summary: 'Sam proposed new dates for the ladder',
    meta: 'Change proposal · pending',
    relativeTime: '3h',
    deepLinkLabel: 'Open My reservations',
  },
  {
    id: 'n4',
    kind: 'reservation_request',
    attention: 'read',
    summary: 'You declined the drill request',
    meta: 'Reservation request · declined',
    relativeTime: 'Yesterday',
    deepLinkLabel: 'Open My reservations',
  },
  {
    id: 'n5',
    kind: 'invitation',
    attention: 'read',
    summary: 'Invitation to Street Share was cancelled',
    meta: 'Invitation · cancelled',
    relativeTime: '2d',
    deepLinkLabel: 'Open Home',
  },
  {
    id: 'n6',
    kind: 'reservation_request',
    attention: 'read',
    summary: 'Jordan accepted your request for the mower',
    meta: 'Reservation request · accepted',
    relativeTime: '4d',
    deepLinkLabel: 'Open My reservations',
  },
];

const EXTRA_UNREAD: readonly PrototypeNotification[] = [
  {
    id: 'n7',
    kind: 'reservation_request',
    attention: 'unread',
    summary: 'Morgan requested the pressure washer',
    meta: 'Reservation request · pending · next Fri',
    relativeTime: '5m',
    deepLinkLabel: 'Open My reservations',
  },
  {
    id: 'n8',
    kind: 'reservation_change_proposal',
    attention: 'unread',
    summary: 'Your date change was approved',
    meta: 'Change proposal · approved',
    relativeTime: '20m',
    deepLinkLabel: 'Open My reservations',
  },
  {
    id: 'n9',
    kind: 'invitation',
    attention: 'unread',
    summary: 'You’re invited to Garage Collective',
    meta: 'Invitation · pending',
    relativeTime: '45m',
    deepLinkLabel: 'Open Sharing Group',
  },
  {
    id: 'n10',
    kind: 'reservation_request',
    attention: 'unread',
    summary: 'Riley withdrew a request for the saw',
    meta: 'Reservation request · withdrawn',
    relativeTime: '2h',
    deepLinkLabel: 'Open My reservations',
  },
  {
    id: 'n11',
    kind: 'reservation_request',
    attention: 'unread',
    summary: 'Casey cancelled the wheelbarrow trip',
    meta: 'Reservation request · cancelled',
    relativeTime: '6h',
    deepLinkLabel: 'Open My reservations',
  },
  {
    id: 'n12',
    kind: 'reservation_change_proposal',
    attention: 'unread',
    summary: 'Taylor rejected your proposed dates',
    meta: 'Change proposal · rejected',
    relativeTime: '1d',
    deepLinkLabel: 'Open My reservations',
  },
];

export const createFixtures = (scenarioId: PrototypeScenarioId): PrototypeFixtures => {
  switch (scenarioId) {
    case 'empty':
      return { scenarioId, notifications: [] };
    case 'many-unread':
      return {
        scenarioId,
        notifications: [...EXTRA_UNREAD, ...BASE_NOTIFICATIONS],
      };
    case 'mixed':
    default:
      return { scenarioId, notifications: [...BASE_NOTIFICATIONS] };
  }
};

export const unreadCount = (notifications: readonly PrototypeNotification[]): number =>
  notifications.filter((n) => n.attention === 'unread').length;

export const badgeLabel = (count: number): string => {
  if (count <= 0) return '';
  if (count > 9) return '9+';
  return String(count);
};

export const kindLabel = (kind: PrototypeKind): string => {
  switch (kind) {
    case 'invitation':
      return 'Invitation';
    case 'reservation_request':
      return 'Request';
    case 'reservation_change_proposal':
      return 'Change';
  }
};
