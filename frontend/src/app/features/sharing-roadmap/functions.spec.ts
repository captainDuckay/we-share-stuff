import { describe, expect, it } from 'vitest';
import {
  Reservation,
  ReservationChangeProposal,
  ShareReadiness,
  TypicalPlacementVisibility,
} from '../../core/api/model';
import {
  borrowerListPlacementPath,
  borrowerReservationStatusLabel,
  canShareItem,
  canonicalCategoryName,
  DEFAULT_ITEM_ICON,
  DEFAULT_SHARING_GROUP_ICON,
  compactCategoryLabels,
  defaultReservationsTab,
  displayCategoryName,
  filterSharedItems,
  formatLocationLocalRange,
  globalSharedItemEntries,
  isSharedWithGroup,
  itemPhotoUrl,
  memberInitials,
  minimumReservationStartLocal,
  normalizeInvitationInput,
  normalizeReservationRequest,
  normalizeTypicalLocationInput,
  parseMyStuffTab,
  parseReservationsTab,
  pendingProposalForReservation,
  photoInputError,
  remainingMemberCount,
  reservationEndTimeError,
  reservationsNeedingBorrowerResponse,
  reservationsTabContaining,
  reservationStartTimeError,
  shareReadinessLabel,
  sharingGroupPhotoInputError,
  structuredPlacementTextPath,
  typicalPlacementLabel,
} from './functions';

describe('Typical Location inputs', () => {
  it('trims names, details, and timezone while clearing blank details', () => {
    expect(normalizeTypicalLocationInput(' Home ', '   ', ' Europe/Copenhagen ')).toEqual({
      name: 'Home',
      details: null,
      timezone: 'Europe/Copenhagen',
    });
  });
});

describe('Item Photo validation', () => {
  it('accepts supported non-empty image files and rejects unsupported files', () => {
    expect(photoInputError({ name: 'tent.png', type: 'image/png', size: 12 })).toBe('');
    expect(photoInputError({ name: 'tent.gif', type: 'image/gif', size: 12 })).toBe(
      'Choose a JPEG, PNG, or WebP Item Photo.',
    );
    expect(photoInputError({ name: 'empty.png', type: 'image/png', size: 0 })).toBe(
      'Choose an Item Photo that is not empty.',
    );
  });
});

describe('Sharing Group Photo validation', () => {
  it('accepts supported photos and rejects invalid files', () => {
    expect(sharingGroupPhotoInputError({ name: 'group.png', type: 'image/png', size: 12 })).toBe(
      '',
    );
    expect(sharingGroupPhotoInputError({ name: 'group.gif', type: 'image/gif', size: 12 })).toBe(
      'Choose a JPEG, PNG, or WebP Sharing Group Photo.',
    );
    expect(sharingGroupPhotoInputError({ name: 'empty.png', type: 'image/png', size: 0 })).toBe(
      'Choose a Sharing Group Photo that is not empty.',
    );
  });
});

describe('share readiness rules', () => {
  const ready: ShareReadiness = { canShare: true, missing: [] };
  const missingLocation: ShareReadiness = {
    canShare: false,
    missing: ['typicalLocation'],
  };

  it('requires only a Typical Location before sharing', () => {
    expect(canShareItem(ready)).toBe(true);
    expect(canShareItem(missingLocation)).toBe(false);
    expect(shareReadinessLabel(missingLocation.missing)).toBe(
      'Add a Typical Location before sharing this Item.',
    );
  });

  it('treats Item sharing as a binary group relationship', () => {
    expect(
      isSharedWithGroup(
        [
          {
            itemId: 'item-1',
            sharingGroup: { id: 'group-1', name: 'Friends' },
            sharedAt: '2026-01-01T00:00:00Z',
          },
        ],
        'group-1',
      ),
    ).toBe(true);
    expect(isSharedWithGroup([], 'group-1')).toBe(false);
  });
});

describe('photo and placeholder display', () => {
  it('uses fixed frontend placeholders and explicit Item Photo URLs', () => {
    expect(DEFAULT_ITEM_ICON).toBe('tools-power-drill');
    expect(DEFAULT_SHARING_GROUP_ICON).toBe('group');
    expect(itemPhotoUrl({ photoUrl: '/first.jpg' })).toBe('/first.jpg');
    expect(itemPhotoUrl({ itemPhotos: [{ url: '/shared.jpg' }] })).toBe('/shared.jpg');
    expect(itemPhotoUrl({})).toBeNull();
  });
});

describe('Shared Item discovery helpers', () => {
  const groupA = {
    id: 'group-a',
    name: 'Friends',
    createdBy: { id: 'user-1', displayName: 'Owner', profilePhotoUrl: null },
    currentUserCanManage: true,
    memberCount: 2,
    photoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
  const groupB = { ...groupA, id: 'group-b', name: 'Neighbours' };
  const sharedItem = {
    id: 'item-1',
    owner: { id: 'user-2', displayName: 'Borrower', profilePhotoUrl: null },
    name: 'Tent',
    description: null,
    visibleThrough: [],
    itemPhotos: [],
    typicalLocation: {
      id: 'location-1',
      name: 'Shed',
      details: null,
      timezone: 'Europe/Copenhagen',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      assignedItemCount: 1,
    },
    typicalPlacement: { visible: false, value: null, structured: null },
    reservationState: { requestable: true, acceptedRanges: [] },
  };

  it('deduplicates global Browse shared items by Item and keeps visibility context', () => {
    expect(
      globalSharedItemEntries([groupA, groupB], {
        [groupA.id]: [sharedItem],
        [groupB.id]: [sharedItem],
      }),
    ).toEqual([{ item: sharedItem, visibleThrough: [groupA, groupB] }]);
  });

  it('shows five Member initials with a remaining overflow count for Sharing Group cards', () => {
    const members = ['Ada', 'Boris', 'Cy', 'Dee', 'Eli', 'Fay', 'Gia'].map(
      (displayName, index) => ({
        user: { id: `user-${index}`, displayName, profilePhotoUrl: null },
        joinedAt: '2026-01-01T00:00:00Z',
        isCreator: index === 0,
      }),
    );
    expect(memberInitials(members)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(remainingMemberCount(members)).toBe(2);
  });
});

describe('Category helpers', () => {
  it('canonicalizes lowercase persistence and display capitalization', () => {
    expect(canonicalCategoryName(' Garden ')).toBe('garden');
    expect(displayCategoryName('garden')).toBe('Garden');
  });

  it('compacts multiple categories and filters by group and category together', () => {
    const item = {
      id: 'item-1',
      owner: { id: 'user-2', displayName: 'Owner', profilePhotoUrl: null },
      name: 'Tent',
      description: null,
      visibleThrough: [{ id: 'group-1', name: 'Friends' }],
      itemPhotos: [],
      categories: [{ name: 'camping' }, { name: 'garden' }],
      typicalLocation: {
        id: 'location-1',
        name: 'Shed',
        details: null,
        timezone: 'Europe/Copenhagen',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        assignedItemCount: 1,
      },
      typicalPlacement: { visible: false, value: null, structured: null },
      reservationState: { requestable: true, acceptedRanges: [] },
    };
    expect(compactCategoryLabels(item.categories)).toEqual(['Camping', '+1']);
    expect(filterSharedItems([item], 'group-1', 'camping')).toEqual([item]);
    expect(filterSharedItems([item], 'group-2', 'camping')).toEqual([]);
  });
});

describe('Reservation display helpers', () => {
  const nowMs = Date.parse('2026-07-22T18:57:50Z');

  it('keeps Reservation request values location-local without adding timezone offsets', () => {
    expect(normalizeReservationRequest(' 2099-08-01T10:00 ', ' 2099-08-01T12:00 ')).toEqual({
      startLocal: '2099-08-01T10:00',
      endLocal: '2099-08-01T12:00',
    });
    expect(
      formatLocationLocalRange('2099-08-01T10:00:00', '2099-08-01T12:00:00', 'Europe/Copenhagen'),
    ).toBe('2099-08-01 10:00:00 to 2099-08-01 12:00:00 (Europe/Copenhagen)');
  });

  it('requires a start minute that is still in the future at the Typical Location', () => {
    expect(minimumReservationStartLocal('Europe/Copenhagen', nowMs)).toBe('2026-07-22T20:59');
    expect(minimumReservationStartLocal('UTC', Date.parse('2026-07-22T18:57:59.999Z'))).toBe(
      '2026-07-22T18:59',
    );
    expect(reservationStartTimeError('2026-07-22T20:55', 'Europe/Copenhagen', nowMs)).toBe(
      'Choose a start time in the future.',
    );
    expect(reservationStartTimeError('2026-07-22T20:59', 'Europe/Copenhagen', nowMs)).toBe('');
    expect(reservationEndTimeError('2026-07-22T20:59', '2026-07-22T20:59')).toBe(
      'Choose an end time after the start time.',
    );
    expect(reservationEndTimeError('2026-07-22T20:59', '2026-07-22T21:59')).toBe('');
  });

  it('hides Typical Placement before acceptance and reveals the no-placement state after acceptance', () => {
    const hidden: TypicalPlacementVisibility = {
      visible: false,
      value: null,
      structured: null,
    };
    const visibleEmpty: TypicalPlacementVisibility = {
      visible: true,
      value: null,
      structured: null,
    };
    const visible: TypicalPlacementVisibility = {
      visible: true,
      value: 'Blue bin',
      structured: null,
    };
    expect(typicalPlacementLabel(hidden)).toBe(
      'Typical Placement is hidden until your Reservation is accepted.',
    );
    expect(typicalPlacementLabel(visibleEmpty)).toBe('No Typical Placement has been noted.');
    expect(typicalPlacementLabel(visible)).toBe('Typical Placement: Blue bin');
  });

  it('formats structured text path as Surface → Slot with optional note', () => {
    expect(
      structuredPlacementTextPath({
        surfaceName: 'Garage wall',
        slotLabel: 'Shelf A',
        note: null,
      }),
    ).toBe('Garage wall → Shelf A');
    expect(
      structuredPlacementTextPath({
        surfaceName: 'Garage wall',
        slotLabel: 'Shelf A',
        note: 'behind paint',
      }),
    ).toBe('Garage wall → Shelf A (behind paint)');
    expect(
      typicalPlacementLabel({
        visible: true,
        value: 'behind paint',
        structured: {
          surfaceName: 'Garage wall',
          slotLabel: 'Shelf A',
          note: 'behind paint',
          targetSlot: {
            id: 's1',
            label: 'Shelf A',
            x: 0,
            y: 0,
            width: 100,
            height: 80,
          },
          otherSlots: [],
          structuralDrawings: [],
        },
      }),
    ).toBe('Typical Placement: Garage wall → Shelf A (behind paint)');
  });

  it('lands on Upcoming, else Pending, else Past', () => {
    expect(defaultReservationsTab(2, 1)).toBe('upcoming');
    expect(defaultReservationsTab(0, 3)).toBe('pending');
    expect(defaultReservationsTab(0, 0)).toBe('past');
  });

  it('derives the My reservations tab that contains a Reservation', () => {
    const now = new Date('2026-07-22T12:00:00Z');
    expect(
      reservationsTabContaining(
        sampleReservation({
          status: 'accepted',
          endAt: '2026-08-10T10:00:00Z',
        }),
        now,
      ),
    ).toBe('upcoming');
    expect(reservationsTabContaining(sampleReservation({ status: 'pending' }), now)).toBe(
      'pending',
    );
    expect(reservationsTabContaining(sampleReservation({ status: 'declined' }), now)).toBe(
      'past',
    );
    expect(
      reservationsTabContaining(
        sampleReservation({
          status: 'accepted',
          endAt: '2026-07-01T10:00:00Z',
        }),
        now,
      ),
    ).toBe('past');
  });

  it('parses URL tab query values for My reservations and My stuff', () => {
    expect(parseReservationsTab('upcoming')).toBe('upcoming');
    expect(parseReservationsTab('pending')).toBe('pending');
    expect(parseReservationsTab('past')).toBe('past');
    expect(parseReservationsTab('nope')).toBeNull();
    expect(parseReservationsTab(null)).toBeNull();
    expect(parseMyStuffTab('approvals')).toBe('approvals');
    expect(parseMyStuffTab('tools')).toBe('tools');
    expect(parseMyStuffTab(null)).toBe('tools');
    expect(parseMyStuffTab('nope')).toBe('tools');
  });

  it('shows list placement path only when revealed', () => {
    expect(
      borrowerListPlacementPath({ visible: false, value: 'secret', structured: null }),
    ).toBeNull();
    expect(borrowerListPlacementPath({ visible: true, value: null, structured: null })).toBe(
      'No Typical Placement has been noted.',
    );
    expect(borrowerListPlacementPath({ visible: true, value: 'Blue bin', structured: null })).toBe(
      'Blue bin',
    );
    expect(
      borrowerListPlacementPath({
        visible: true,
        value: 'note',
        structured: {
          surfaceName: 'Garage wall',
          slotLabel: 'Shelf A',
          note: 'note',
          targetSlot: {
            id: 's1',
            label: 'Shelf A',
            x: 0,
            y: 0,
            width: 100,
            height: 80,
          },
          otherSlots: [],
          structuralDrawings: [],
        },
      }),
    ).toBe('Garage wall → Shelf A (note)');
  });

  it('labels borrower trip statuses in plain language', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    const base = sampleReservation({
      status: 'pending',
      startAt: '2026-08-10T08:00:00Z',
      endAt: '2026-08-10T12:00:00Z',
    });
    expect(
      borrowerReservationStatusLabel(base, {
        ownerDisplayName: 'Mira',
        now,
      }),
    ).toBe('Pending — waiting on Mira');
    expect(
      borrowerReservationStatusLabel(base, {
        ownerDisplayName: 'Mira',
        pendingByMe: true,
        now,
      }),
    ).toBe('Pending — you proposed new dates');
    expect(
      borrowerReservationStatusLabel(
        { ...base, status: 'accepted' },
        { ownerDisplayName: 'Mira', pendingFromOwner: true, now },
      ),
    ).toBe('Accepted — owner proposed new dates');
    expect(
      borrowerReservationStatusLabel(
        {
          ...base,
          status: 'accepted',
          startAt: '2026-08-01T10:00:00Z',
          endAt: '2026-08-01T18:00:00Z',
        },
        { ownerDisplayName: 'Mira', now },
      ),
    ).toBe('Accepted — borrow window open');
    expect(
      borrowerReservationStatusLabel(
        {
          ...base,
          status: 'accepted',
          startAt: '2026-07-01T10:00:00Z',
          endAt: '2026-07-01T18:00:00Z',
        },
        { ownerDisplayName: 'Mira', now },
      ),
    ).toBe('Past — completed');
    expect(
      borrowerReservationStatusLabel(
        { ...base, status: 'declined' },
        { ownerDisplayName: 'Mira', now },
      ),
    ).toBe('Declined');
  });

  it('finds pending proposals and needs-response rows for the borrower', () => {
    const reservation = sampleReservation({ id: 'r1', status: 'accepted' });
    const fromOwner = sampleProposal({
      id: 'p1',
      reservationId: 'r1',
      proposedById: 'owner-1',
    });
    const byMe = sampleProposal({
      id: 'p2',
      reservationId: 'r1',
      proposedById: 'borrower-1',
    });
    expect(pendingProposalForReservation([fromOwner], 'r1', 'borrower-1', 'other')).toEqual(
      fromOwner,
    );
    expect(pendingProposalForReservation([byMe], 'r1', 'borrower-1', 'me')).toEqual(byMe);
    expect(reservationsNeedingBorrowerResponse([reservation], [fromOwner], 'borrower-1')).toEqual([
      reservation,
    ]);
    expect(reservationsNeedingBorrowerResponse([reservation], [byMe], 'borrower-1')).toEqual([]);
  });
});

const sampleReservation = (
  overrides: Partial<Reservation> & Pick<Reservation, 'status'>,
): Reservation => ({
  id: 'r1',
  sharingGroup: { id: 'g1', name: 'Friends' },
  item: {
    id: 'i1',
    name: 'Ladder',
    owner: {
      id: 'owner-1',
      displayName: 'Mira',
      profilePhotoUrl: null,
    },
    photoUrl: null,
    typicalLocation: {
      id: 'loc1',
      name: 'Garage',
      details: null,
      timezone: 'Europe/Copenhagen',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    typicalPlacement: { visible: false, value: null, structured: null },
  },
  requester: {
    id: 'borrower-1',
    displayName: 'Skipper',
    profilePhotoUrl: null,
  },
  startLocal: '2026-08-10T10:00',
  endLocal: '2026-08-10T12:00',
  startAt: '2026-08-10T08:00:00Z',
  endAt: '2026-08-10T10:00:00Z',
  timezone: 'Europe/Copenhagen',
  createdAt: '2026-07-01T00:00:00Z',
  decidedAt: null,
  conflictsWithAcceptedReservation: false,
  ...overrides,
});

const sampleProposal = (input: {
  id: string;
  reservationId: string;
  proposedById: string;
}): ReservationChangeProposal => ({
  id: input.id,
  reservation: sampleReservation({ id: input.reservationId, status: 'accepted' }),
  proposedBy: {
    id: input.proposedById,
    displayName: 'Someone',
    profilePhotoUrl: null,
  },
  status: 'pending',
  startLocal: '2026-08-11T10:00',
  endLocal: '2026-08-11T12:00',
  startAt: '2026-08-11T08:00:00Z',
  endAt: '2026-08-11T10:00:00Z',
  timezone: 'Europe/Copenhagen',
  createdAt: '2026-07-02T00:00:00Z',
  decidedAt: null,
});

describe('Invitation inputs', () => {
  it('trims invited User email text', () => {
    expect(normalizeInvitationInput(' member@example.com ')).toEqual({
      email: 'member@example.com',
    });
  });
});
