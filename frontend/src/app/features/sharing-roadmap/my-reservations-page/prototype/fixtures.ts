/**
 * PROTOTYPE — throwaway fixture data for My reservations UI variants (#22).
 * In-memory only; not production models. Wipe with the branch.
 */

import type { StructuredPlacementSnapshot } from '../../../../core/api/model';

export type PrototypeTab = 'upcoming' | 'pending' | 'past';

export type PrototypeStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'cancelled';

export type PrototypePlacement =
  | { kind: 'hidden' }
  | { kind: 'empty' }
  | { kind: 'freeText'; text: string }
  | {
      kind: 'structured';
      surfaceName: string;
      slotLabel: string;
      note: string | null;
      /** mm-ish sketch rect for a quiet list diagram */
      slot: { x: number; y: number; w: number; h: number };
      structure: ReadonlyArray<{ x: number; y: number; w: number; h: number }>;
      otherSlots: ReadonlyArray<{ label: string; x: number; y: number; w: number; h: number }>;
    };

export type PrototypeProposal =
  | null
  | {
      from: 'owner' | 'me';
      proposedStartLocal: string;
      proposedEndLocal: string;
      proposedRangeLabel: string;
    };

export type PrototypeReservation = {
  id: string;
  itemName: string;
  ownerName: string;
  ownerInitials: string;
  status: PrototypeStatus;
  statusLabel: string;
  startLocalLabel: string;
  endLocalLabel: string;
  rangeLabel: string;
  timezoneLabel: string;
  locationName: string;
  tab: PrototypeTab;
  /** Needs borrower response (owner change proposal). */
  needsResponse: boolean;
  proposal: PrototypeProposal;
  placement: PrototypePlacement;
  /** Quiet note for requester about a conflicting accepted claim (informational). */
  conflictNote: string | null;
};

export type PrototypeScenarioId = 'full' | 'empty-upcoming' | 'no-groups' | 'zero-trips';

export type PrototypeFixtures = {
  scenarioId: PrototypeScenarioId;
  hasSharingGroups: boolean;
  reservations: PrototypeReservation[];
};

const garageStructure = [
  { x: 20, y: 20, w: 360, h: 20 },
  { x: 20, y: 20, w: 20, h: 240 },
  { x: 360, y: 20, w: 20, h: 240 },
  { x: 20, y: 240, w: 360, h: 20 },
] as const;

const baseReservations = (): PrototypeReservation[] => [
  {
    id: 'r-needs-response',
    itemName: 'Pressure washer',
    ownerName: 'Mira Chen',
    ownerInitials: 'MC',
    status: 'accepted',
    statusLabel: 'Accepted — owner proposed new dates',
    startLocalLabel: 'Sat 9 Aug, 10:00',
    endLocalLabel: 'Sat 9 Aug, 18:00',
    rangeLabel: 'Sat 9 Aug, 10:00 – 18:00',
    timezoneLabel: 'Europe/Copenhagen',
    locationName: 'Mira’s garage',
    tab: 'upcoming',
    needsResponse: true,
    proposal: {
      from: 'owner',
      proposedStartLocal: '2026-08-10T10:00',
      proposedEndLocal: '2026-08-10T18:00',
      proposedRangeLabel: 'Sun 10 Aug, 10:00 – 18:00',
    },
    placement: {
      kind: 'structured',
      surfaceName: 'Garage wall A',
      slotLabel: 'Bay 2',
      note: 'Hose on the right hook',
      slot: { x: 120, y: 80, w: 100, h: 120 },
      structure: [...garageStructure],
      otherSlots: [
        { label: 'Bay 1', x: 40, y: 80, w: 70, h: 100 },
        { label: 'Bay 3', x: 240, y: 80, w: 70, h: 100 },
      ],
    },
    conflictNote: null,
  },
  {
    id: 'r-trip-soon',
    itemName: 'Ladder (3 m)',
    ownerName: 'Jonas Berg',
    ownerInitials: 'JB',
    status: 'accepted',
    statusLabel: 'Accepted — upcoming',
    startLocalLabel: 'Tue 12 Aug, 08:00',
    endLocalLabel: 'Tue 12 Aug, 12:00',
    rangeLabel: 'Tue 12 Aug, 08:00 – 12:00',
    timezoneLabel: 'Europe/Copenhagen',
    locationName: 'Jonas’s workshop',
    tab: 'upcoming',
    needsResponse: false,
    proposal: null,
    placement: {
      kind: 'structured',
      surfaceName: 'Workshop north wall',
      slotLabel: 'Rack L',
      note: null,
      slot: { x: 200, y: 40, w: 60, h: 200 },
      structure: [
        { x: 10, y: 10, w: 380, h: 16 },
        { x: 10, y: 250, w: 380, h: 16 },
      ],
      otherSlots: [{ label: 'Rack R', x: 280, y: 40, w: 60, h: 200 }],
    },
    conflictNote: null,
  },
  {
    id: 'r-in-window',
    itemName: 'Hedge trimmer',
    ownerName: 'Sofia Lind',
    ownerInitials: 'SL',
    status: 'accepted',
    statusLabel: 'Accepted — borrow window open',
    startLocalLabel: 'Today, 09:00',
    endLocalLabel: 'Today, 17:00',
    rangeLabel: 'Today, 09:00 – 17:00',
    timezoneLabel: 'Europe/Copenhagen',
    locationName: 'Sofia’s shed',
    tab: 'upcoming',
    needsResponse: false,
    proposal: null,
    placement: {
      kind: 'freeText',
      text: 'Left shelf under the window, red case',
    },
    conflictNote: null,
  },
  {
    id: 'r-pending-me',
    itemName: 'Tile cutter',
    ownerName: 'Erik N.',
    ownerInitials: 'EN',
    status: 'pending',
    statusLabel: 'Pending — waiting on owner',
    startLocalLabel: 'Fri 15 Aug, 14:00',
    endLocalLabel: 'Fri 15 Aug, 18:00',
    rangeLabel: 'Fri 15 Aug, 14:00 – 18:00',
    timezoneLabel: 'Europe/Copenhagen',
    locationName: 'Erik’s basement',
    tab: 'pending',
    needsResponse: false,
    proposal: null,
    placement: { kind: 'hidden' },
    conflictNote: null,
  },
  {
    id: 'r-pending-my-proposal',
    itemName: 'Belt sander',
    ownerName: 'Mira Chen',
    ownerInitials: 'MC',
    status: 'pending',
    statusLabel: 'Pending — you proposed new dates',
    startLocalLabel: 'Mon 18 Aug, 10:00',
    endLocalLabel: 'Mon 18 Aug, 16:00',
    rangeLabel: 'Mon 18 Aug, 10:00 – 16:00',
    timezoneLabel: 'Europe/Copenhagen',
    locationName: 'Mira’s garage',
    tab: 'pending',
    needsResponse: false,
    proposal: {
      from: 'me',
      proposedStartLocal: '2026-08-19T10:00',
      proposedEndLocal: '2026-08-19T16:00',
      proposedRangeLabel: 'Tue 19 Aug, 10:00 – 16:00',
    },
    placement: { kind: 'hidden' },
    conflictNote:
      'Another Accepted Reservation already covers part of your requested window; the owner may need different dates.',
  },
  {
    id: 'r-past-done',
    itemName: 'Drill kit',
    ownerName: 'Jonas Berg',
    ownerInitials: 'JB',
    status: 'accepted',
    statusLabel: 'Past — completed',
    startLocalLabel: 'Sun 20 Jul, 10:00',
    endLocalLabel: 'Sun 20 Jul, 14:00',
    rangeLabel: 'Sun 20 Jul, 10:00 – 14:00',
    timezoneLabel: 'Europe/Copenhagen',
    locationName: 'Jonas’s workshop',
    tab: 'past',
    needsResponse: false,
    proposal: null,
    placement: { kind: 'empty' },
    conflictNote: null,
  },
  {
    id: 'r-past-declined',
    itemName: 'Circular saw',
    ownerName: 'Sofia Lind',
    ownerInitials: 'SL',
    status: 'declined',
    statusLabel: 'Declined',
    startLocalLabel: 'Wed 2 Jul, 09:00',
    endLocalLabel: 'Wed 2 Jul, 12:00',
    rangeLabel: 'Wed 2 Jul, 09:00 – 12:00',
    timezoneLabel: 'Europe/Copenhagen',
    locationName: 'Sofia’s shed',
    tab: 'past',
    needsResponse: false,
    proposal: null,
    placement: { kind: 'hidden' },
    conflictNote: null,
  },
];

export const createFixtures = (scenarioId: PrototypeScenarioId = 'full'): PrototypeFixtures => {
  switch (scenarioId) {
    case 'no-groups':
      return { scenarioId, hasSharingGroups: false, reservations: [] };
    case 'zero-trips':
      return { scenarioId, hasSharingGroups: true, reservations: [] };
    case 'empty-upcoming':
      return {
        scenarioId,
        hasSharingGroups: true,
        reservations: baseReservations().filter((r) => r.tab !== 'upcoming'),
      };
    case 'full':
    default:
      return { scenarioId: 'full', hasSharingGroups: true, reservations: baseReservations() };
  }
};

export const placementTextPath = (placement: PrototypePlacement): string | null => {
  switch (placement.kind) {
    case 'hidden':
      return null;
    case 'empty':
      return 'No Typical Placement has been noted.';
    case 'freeText':
      return placement.text;
    case 'structured': {
      const base = `${placement.surfaceName} → ${placement.slotLabel}`;
      return placement.note ? `${base} · ${placement.note}` : base;
    }
  }
};

/** Map fixture structured placement into the production diagram model. */
export const toStructuredSnapshot = (
  placement: PrototypePlacement,
): StructuredPlacementSnapshot | null => {
  if (placement.kind !== 'structured') return null;
  return {
    surfaceName: placement.surfaceName,
    slotLabel: placement.slotLabel,
    note: placement.note,
    targetSlot: {
      id: 'proto-target',
      label: placement.slotLabel,
      x: placement.slot.x,
      y: placement.slot.y,
      width: placement.slot.w,
      height: placement.slot.h,
    },
    otherSlots: placement.otherSlots.map((slot, index) => ({
      id: `proto-other-${index}`,
      label: slot.label,
      x: slot.x,
      y: slot.y,
      width: slot.w,
      height: slot.h,
    })),
    structuralDrawings: placement.structure.map((block, index) => ({
      id: `proto-struct-${index}`,
      kind: 'rect' as const,
      x: block.x,
      y: block.y,
      width: block.w,
      height: block.h,
      points: null,
    })),
  };
};

export const countByTab = (
  reservations: readonly PrototypeReservation[],
): Record<PrototypeTab, number> => ({
  upcoming: reservations.filter((r) => r.tab === 'upcoming').length,
  pending: reservations.filter((r) => r.tab === 'pending').length,
  past: reservations.filter((r) => r.tab === 'past').length,
});
