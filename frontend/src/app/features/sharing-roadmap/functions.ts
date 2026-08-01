import {
  ApiProblem,
  isApiProblem,
  ItemSharing,
  Reservation,
  ReservationChangeProposal,
  ReservationRequestInput,
  ShareReadiness,
  SharedItem,
  SharingGroup,
  SharingGroupMember,
  ShareReadinessRequirement,
  TypicalLocationInput,
  TypicalPlacementVisibility,
} from '../../core/api/model';
import { displayNameInitials } from '../user-avatar/user-avatar/functions';

interface HttpStatusError {
  readonly status: number;
  readonly error?: unknown;
}

export interface FileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export const LOCATION_NAME_MAX_LENGTH = 200;
export const LOCATION_DETAILS_MAX_LENGTH = 2_000;
export const TIMEZONE_MAX_LENGTH = 100;
export const GROUP_NAME_MAX_LENGTH = 200;
export const ITEM_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const ITEM_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const SHARING_GROUP_PHOTO_ACCEPT = ITEM_PHOTO_ACCEPT;
export const SUPPORTED_ITEM_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const DEFAULT_ITEM_ICON = 'tools-power-drill';
export const DEFAULT_SHARING_GROUP_ICON = 'group';
export const GROUP_MEMBER_INITIAL_LIMIT = 5;
export const BROWSE_GRID_MAX_COLUMNS = 3;

export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Try again.';
export const LOCATION_LOAD_ERROR_MESSAGE = 'We could not load your Typical Locations.';
export const SHARING_LOAD_ERROR_MESSAGE = 'We could not load your sharing details.';

export const defaultTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const normalizeTypicalLocationInput = (
  name: string,
  details: string,
  timezone: string,
): TypicalLocationInput => {
  const normalizedDetails = details.trim();
  return {
    name: name.trim(),
    details: normalizedDetails || null,
    timezone: timezone.trim(),
  };
};

export const normalizeNameInput = (name: string): { readonly name: string } => ({
  name: name.trim(),
});

export const canonicalCategoryName = (name: string): string => name.trim().toLowerCase();

export const displayCategoryName = (name: string): string => {
  const canonical = canonicalCategoryName(name);
  return canonical ? `${canonical[0].toUpperCase()}${canonical.slice(1)}` : '';
};

export const normalizeCategoryInput = (raw: string): readonly string[] =>
  Array.from(new Set(raw.split(',').map(canonicalCategoryName).filter(Boolean)));

export const compactCategoryLabels = (
  categories: readonly { readonly name: string }[] | undefined,
): readonly string[] => {
  const names = (categories ?? []).map((category) => displayCategoryName(category.name));
  return names.length > 1 ? [names[0], `+${names.length - 1}`] : names;
};

export const normalizeInvitationInput = (email: string): { readonly email: string } => ({
  email: email.trim(),
});

export const normalizeReservationRequest = (
  startLocal: string,
  endLocal: string,
): ReservationRequestInput => ({
  startLocal: startLocal.trim(),
  endLocal: endLocal.trim(),
});

const MILLISECONDS_PER_MINUTE = 60_000;
const RESERVATION_START_SAFETY_MS = MILLISECONDS_PER_MINUTE;

const formatInstantAsLocalMinute = (instantMs: number, timezone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
};

export const minimumReservationStartLocal = (timezone: string, nowMs = Date.now()): string => {
  const minimumStartMs =
    Math.ceil((nowMs + RESERVATION_START_SAFETY_MS) / MILLISECONDS_PER_MINUTE) *
    MILLISECONDS_PER_MINUTE;
  return formatInstantAsLocalMinute(minimumStartMs, timezone);
};

export const reservationStartTimeError = (
  startLocal: string,
  timezone: string,
  nowMs = Date.now(),
): string =>
  startLocal < minimumReservationStartLocal(timezone, nowMs)
    ? 'Choose a start time in the future.'
    : '';

export const reservationEndTimeError = (startLocal: string, endLocal: string): string =>
  endLocal <= startLocal ? 'Choose an end time after the start time.' : '';

export const photoInputError = (file: FileLike | null): string => {
  if (!file) return 'Choose an Item Photo to upload.';
  if (
    !SUPPORTED_ITEM_PHOTO_TYPES.includes(file.type as (typeof SUPPORTED_ITEM_PHOTO_TYPES)[number])
  ) {
    return 'Choose a JPEG, PNG, or WebP Item Photo.';
  }
  if (file.size <= 0) return 'Choose an Item Photo that is not empty.';
  if (file.size > ITEM_PHOTO_MAX_BYTES) return 'Choose an Item Photo smaller than 10 MB.';
  return '';
};

export const sharingGroupPhotoInputError = (file: FileLike | null): string => {
  if (!file) return 'Choose a Sharing Group Photo to upload.';
  if (
    !SUPPORTED_ITEM_PHOTO_TYPES.includes(file.type as (typeof SUPPORTED_ITEM_PHOTO_TYPES)[number])
  ) {
    return 'Choose a JPEG, PNG, or WebP Sharing Group Photo.';
  }
  if (file.size <= 0) return 'Choose a Sharing Group Photo that is not empty.';
  if (file.size > ITEM_PHOTO_MAX_BYTES) {
    return 'Choose a Sharing Group Photo smaller than 10 MB.';
  }
  return '';
};

export const shareReadinessLabel = (missing: readonly ShareReadinessRequirement[]): string =>
  missing.length === 0 ? 'Ready to share.' : 'Add a Typical Location before sharing this Item.';

export const canShareItem = (readiness: ShareReadiness | null | undefined): boolean =>
  readiness?.canShare ?? false;

export const sharedGroupIds = (sharing: readonly ItemSharing[]): ReadonlySet<string> =>
  new Set(sharing.map((entry) => entry.sharingGroup.id));

export const isSharedWithGroup = (
  sharing: readonly ItemSharing[],
  sharingGroupId: string,
): boolean => sharedGroupIds(sharing).has(sharingGroupId);

export interface SharedItemDiscoveryEntry {
  readonly item: SharedItem;
  readonly visibleThrough: readonly SharingGroup[];
}

export const globalSharedItemEntries = (
  groups: readonly SharingGroup[],
  sharedItemsByGroup: Readonly<Record<string, readonly SharedItem[]>>,
): readonly SharedItemDiscoveryEntry[] => {
  const entries = new Map<string, { item: SharedItem; visibleThrough: SharingGroup[] }>();
  for (const group of groups) {
    for (const item of sharedItemsByGroup[group.id] ?? []) {
      const existing = entries.get(item.id);
      if (existing) existing.visibleThrough.push(group);
      else entries.set(item.id, { item, visibleThrough: [group] });
    }
  }
  return Array.from(entries.values()).map((entry) => ({
    item: entry.item,
    visibleThrough: entry.visibleThrough,
  }));
};

export const memberInitials = (
  members: readonly SharingGroupMember[],
  limit = GROUP_MEMBER_INITIAL_LIMIT,
): readonly string[] =>
  members.slice(0, limit).map((member) => displayNameInitials(member.user.displayName));

export const remainingMemberCount = (
  members: readonly SharingGroupMember[],
  limit = GROUP_MEMBER_INITIAL_LIMIT,
): number => Math.max(0, members.length - limit);

export const userInitials = (displayName: string): string => displayNameInitials(displayName);

export const itemPhotoUrl = (item: {
  readonly photoUrl?: string | null;
  readonly itemPhotos?: readonly { readonly url: string }[];
}): string | null => item.photoUrl ?? item.itemPhotos?.[0]?.url ?? null;

export const groupFilterOptions = (
  groups: readonly SharingGroup[],
): readonly { readonly id: string; readonly label: string }[] => [
  { id: '', label: 'All' },
  ...groups.map((group) => ({ id: group.id, label: group.name })),
];

export const categoryFilterOptions = (
  items: readonly { readonly categories?: readonly { readonly name: string }[] }[],
): readonly { readonly id: string; readonly label: string }[] => [
  { id: '', label: 'All' },
  ...Array.from(new Set(items.flatMap((item) => item.categories?.map((c) => c.name) ?? [])))
    .sort()
    .map((name) => ({ id: canonicalCategoryName(name), label: displayCategoryName(name) })),
];

export const filterSharedItems = (
  items: readonly SharedItem[],
  groupId: string,
  category: string,
): readonly SharedItem[] =>
  items.filter(
    (item) =>
      (!groupId || item.visibleThrough.some((group) => group.id === groupId)) &&
      (!category ||
        (item.categories ?? []).some((entry) => canonicalCategoryName(entry.name) === category)),
  );

export const hasPendingProposal = (
  proposals: readonly ReservationChangeProposal[],
  reservationId: string,
): boolean =>
  proposals.some(
    (proposal) => proposal.reservation.id === reservationId && proposal.status === 'pending',
  );

export type ReservationsTab = 'upcoming' | 'pending' | 'past';

export const isUpcomingAcceptedReservation = (
  reservation: Reservation,
  now = new Date(),
): boolean => reservation.status === 'accepted' && new Date(reservation.endAt) >= now;

export const isPastReservation = (reservation: Reservation, now = new Date()): boolean =>
  ['declined', 'withdrawn', 'cancelled'].includes(reservation.status) ||
  (reservation.status === 'accepted' && new Date(reservation.endAt) < now);

export const isBorrowWindowOpen = (reservation: Reservation, now = new Date()): boolean =>
  reservation.status === 'accepted' &&
  new Date(reservation.startAt) <= now &&
  new Date(reservation.endAt) >= now;

export const reservationCanProposeChange = (
  reservation: Reservation,
  proposals: readonly ReservationChangeProposal[],
  now = new Date(),
): boolean =>
  (reservation.status === 'pending' || isUpcomingAcceptedReservation(reservation, now)) &&
  !hasPendingProposal(proposals, reservation.id);

/** Default My reservations landing: Upcoming → Pending → Past/empty. */
export const defaultReservationsTab = (
  upcomingCount: number,
  pendingCount: number,
): ReservationsTab => {
  if (upcomingCount > 0) return 'upcoming';
  if (pendingCount > 0) return 'pending';
  return 'past';
};

export const pendingProposalForReservation = (
  proposals: readonly ReservationChangeProposal[],
  reservationId: string,
  proposedByUserId: string | null | undefined,
  role: 'other' | 'me',
): ReservationChangeProposal | null =>
  proposals.find((proposal) => {
    if (proposal.reservation.id !== reservationId || proposal.status !== 'pending') return false;
    if (!proposedByUserId) return false;
    return role === 'me'
      ? proposal.proposedBy.id === proposedByUserId
      : proposal.proposedBy.id !== proposedByUserId;
  }) ?? null;

/** Owner-proposed pending change the borrower must accept or reject. */
export const reservationsNeedingBorrowerResponse = (
  reservations: readonly Reservation[],
  proposals: readonly ReservationChangeProposal[],
  borrowerUserId: string | null | undefined,
): readonly Reservation[] => {
  if (!borrowerUserId) return [];
  return reservations.filter(
    (reservation) =>
      pendingProposalForReservation(proposals, reservation.id, borrowerUserId, 'other') !== null,
  );
};

/**
 * Plain-language status for the borrower trip list.
 * Proposal context is optional; omit when proposals failed to load.
 */
export const borrowerReservationStatusLabel = (
  reservation: Reservation,
  options: {
    readonly ownerDisplayName: string;
    readonly pendingFromOwner?: boolean;
    readonly pendingByMe?: boolean;
    readonly now?: Date;
  },
): string => {
  const now = options.now ?? new Date();
  if (options.pendingFromOwner) return 'Accepted — owner proposed new dates';
  if (reservation.status === 'pending') {
    return options.pendingByMe
      ? 'Pending — you proposed new dates'
      : `Pending — waiting on ${options.ownerDisplayName}`;
  }
  if (reservation.status === 'accepted') {
    if (isPastReservation(reservation, now)) return 'Past — completed';
    if (isBorrowWindowOpen(reservation, now)) return 'Accepted — borrow window open';
    return 'Accepted — upcoming';
  }
  if (reservation.status === 'declined') return 'Declined';
  if (reservation.status === 'withdrawn') return 'Withdrawn';
  return 'Cancelled';
};

/**
 * List/detail text path for revealed placement only.
 * Hidden (pre-accept or cancelled) returns null so we never re-reveal on Past.
 */
export const borrowerListPlacementPath = (placement: TypicalPlacementVisibility): string | null => {
  if (!placement.visible) return null;
  if (placement.structured) return structuredPlacementTextPath(placement.structured);
  return placement.value?.trim() || 'No Typical Placement has been noted.';
};

export const sharedItemAvailabilityLabel = (item: SharedItem, nowMs: number): string => {
  const ranges = item.reservationState.acceptedRanges;
  if (ranges.some((range) => Date.parse(range.startAt) <= nowMs && Date.parse(range.endAt) > nowMs))
    return 'Currently borrowed';
  if (ranges.length > 0) return 'Reserved later';
  return 'Available now';
};

/**
 * Required text path for a structured placement snapshot: Surface → Slot (+ note).
 * Always available without relying only on the diagram.
 */
export const structuredPlacementTextPath = (
  structured: Pick<
    NonNullable<TypicalPlacementVisibility['structured']>,
    'surfaceName' | 'slotLabel' | 'note'
  >,
): string => {
  const path = `${structured.surfaceName} → ${structured.slotLabel}`;
  const note = structured.note?.trim();
  return note ? `${path} (${note})` : path;
};

/** Structured snapshot when revealed to the borrower; otherwise null (no diagram chrome). */
export const visibleStructuredPlacement = (
  placement: TypicalPlacementVisibility,
): NonNullable<TypicalPlacementVisibility['structured']> | null =>
  placement.visible ? placement.structured : null;

/** Empty / free-text / structured borrower placement copy (no diagram chrome). */
export const typicalPlacementLabel = (placement: TypicalPlacementVisibility): string => {
  if (!placement.visible) return 'Typical Placement is hidden until your Reservation is accepted.';
  if (placement.structured) {
    return `Typical Placement: ${structuredPlacementTextPath(placement.structured)}`;
  }
  return placement.value
    ? `Typical Placement: ${placement.value}`
    : 'No Typical Placement has been noted.';
};

export const formatLocationLocalRange = (
  startLocal: string,
  endLocal: string,
  timezone: string,
): string => `${startLocal.replace('T', ' ')} to ${endLocal.replace('T', ' ')} (${timezone})`;

export const formatUtcRangeInTimezone = (
  startAt: string,
  endAt: string,
  timezone: string,
): string => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  });
  return `${formatter.format(new Date(startAt))} to ${formatter.format(new Date(endAt))} (${timezone})`;
};

const isHttpStatusError = (error: unknown): error is HttpStatusError =>
  typeof error === 'object' && error !== null && 'status' in error;

export const apiProblemFrom = (error: unknown): ApiProblem | null =>
  isHttpStatusError(error) && isApiProblem(error.error) ? error.error : null;

export const fieldError = (error: unknown, field: string): string =>
  apiProblemFrom(error)?.errors?.[field] ?? '';

export const friendlyApiError = (error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string => {
  const problem = apiProblemFrom(error);
  if (!problem) return fallback;
  switch (problem.code) {
    case 'typical_location_in_use':
      return 'That Typical Location is assigned to an Item.';
    case 'item_not_share_ready':
      return 'Add a Typical Location before sharing this Item.';
    case 'shared_item_requires_typical_location':
      return 'A Shared Item needs a Typical Location.';
    case 'invitation_already_pending':
      return 'That Invitation is already pending.';
    case 'sharing_group_already_member':
      return 'That User is already a Member.';
    case 'sharing_group_creator_cannot_leave':
      return 'The Sharing Group creator cannot leave or be removed.';
    case 'reservation_conflict':
      return 'That time conflicts with an accepted Reservation.';
    case 'reservation_own_item_not_allowed':
      return 'You cannot request a Reservation for your own Item.';
    case 'reservation_time_invalid':
      return (
        problem.errors?.['startLocal'] ??
        problem.errors?.['endLocal'] ??
        'Reservation time is invalid.'
      );
    case 'item_has_future_accepted_reservations':
      return 'This Item has a future accepted Reservation.';
    case 'item_photo_unsupported_type':
      return 'Choose a JPEG, PNG, or WebP Item Photo.';
    case 'item_photo_too_large':
      return 'Choose an Item Photo smaller than 10 MB.';
    default:
      return fallback;
  }
};
