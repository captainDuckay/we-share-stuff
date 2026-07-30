import { describe, expect, it } from 'vitest';
import { ShareReadiness, TypicalPlacementVisibility } from '../../core/api/model';
import {
  canShareItem,
  canonicalCategoryName,
  DEFAULT_ITEM_ICON,
  DEFAULT_SHARING_GROUP_ICON,
  compactCategoryLabels,
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
  photoInputError,
  remainingMemberCount,
  reservationEndTimeError,
  reservationStartTimeError,
  shareReadinessLabel,
  sharingGroupPhotoInputError,
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
    typicalPlacement: { visible: false, value: null },
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
      typicalPlacement: { visible: false, value: null },
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
    const hidden: TypicalPlacementVisibility = { visible: false, value: null };
    const visibleEmpty: TypicalPlacementVisibility = { visible: true, value: null };
    const visible: TypicalPlacementVisibility = { visible: true, value: 'Blue bin' };
    expect(typicalPlacementLabel(hidden)).toBe(
      'Typical Placement is hidden until your Reservation is accepted.',
    );
    expect(typicalPlacementLabel(visibleEmpty)).toBe('No Typical Placement has been noted.');
    expect(typicalPlacementLabel(visible)).toBe('Typical Placement: Blue bin');
  });
});

describe('Invitation inputs', () => {
  it('trims invited User email text', () => {
    expect(normalizeInvitationInput(' member@example.com ')).toEqual({
      email: 'member@example.com',
    });
  });
});
