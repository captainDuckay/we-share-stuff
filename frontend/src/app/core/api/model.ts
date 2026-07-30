export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly profilePhotoUrl: string | null;
}

export interface UserSummary {
  readonly id: string;
  readonly displayName: string;
  readonly profilePhotoUrl: string | null;
}

export interface TypicalLocation {
  readonly id: string;
  readonly name: string;
  readonly details: string | null;
  readonly timezone: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly assignedItemCount?: number;
}

export interface ManagedTypicalLocation extends TypicalLocation {
  readonly assignedItemCount: number;
}

export interface Category {
  readonly id?: string;
  readonly name: string;
}

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly typicalLocation: TypicalLocation | null;
  readonly typicalPlacement: string | null;
  readonly categories?: readonly Category[];
  readonly photoUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ItemPhoto {
  readonly id: string;
  readonly itemId: string;
  readonly url: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export interface SharingGroupSummary {
  readonly id: string;
  readonly name: string;
}

export interface SharingGroup {
  readonly id: string;
  readonly name: string;
  readonly createdBy: UserSummary;
  readonly currentUserCanManage: boolean;
  readonly memberCount: number;
  readonly photoUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SharingGroupMember {
  readonly user: UserSummary;
  readonly joinedAt: string;
  readonly isCreator: boolean;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface Invitation {
  readonly id: string;
  readonly sharingGroup: SharingGroupSummary;
  readonly invitedEmail: string;
  readonly status: InvitationStatus;
  readonly createdAt: string;
  readonly respondedAt: string | null;
}

export interface ShareReadiness {
  readonly canShare: boolean;
  readonly missing: readonly ShareReadinessRequirement[];
}

export type ShareReadinessRequirement = 'typicalLocation';

export interface ItemSharing {
  readonly itemId: string;
  readonly sharingGroup: SharingGroupSummary;
  readonly sharedAt: string;
}

export interface ReservationRange {
  readonly startAt: string;
  readonly endAt: string;
  readonly timezone: string;
}

export interface TypicalPlacementVisibility {
  readonly visible: boolean;
  readonly value: string | null;
}

export interface SharedItemReservationState {
  readonly requestable: boolean;
  readonly acceptedRanges: readonly ReservationRange[];
}

export interface SharedItem {
  readonly id: string;
  readonly owner: UserSummary;
  readonly name: string;
  readonly description: string | null;
  readonly visibleThrough: readonly SharingGroupSummary[];
  readonly itemPhotos: readonly ItemPhoto[];
  readonly categories?: readonly Category[];
  readonly typicalLocation: TypicalLocation;
  readonly typicalPlacement: TypicalPlacementVisibility;
  readonly reservationState: SharedItemReservationState;
}

export type ReservationStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'cancelled';

export type ReservationChangeProposalStatus = 'pending' | 'approved' | 'rejected' | 'void';

export interface ReservationItem {
  readonly id: string;
  readonly name: string;
  readonly owner: UserSummary;
  readonly photoUrl: string | null;
  readonly typicalLocation: TypicalLocation;
  readonly typicalPlacement: TypicalPlacementVisibility;
}

export interface Reservation {
  readonly id: string;
  readonly sharingGroup: SharingGroupSummary;
  readonly item: ReservationItem;
  readonly requester: UserSummary;
  readonly status: ReservationStatus;
  readonly startLocal: string;
  readonly endLocal: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly timezone: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly conflictsWithAcceptedReservation: boolean;
}

export interface ReservationChangeProposal {
  readonly id: string;
  readonly reservation: Reservation;
  readonly proposedBy: UserSummary;
  readonly status: ReservationChangeProposalStatus;
  readonly startLocal: string;
  readonly endLocal: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly timezone: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

export interface UserEnvelope {
  readonly user: User;
}

export interface ItemEnvelope {
  readonly item: Item;
}

export interface ItemsEnvelope {
  readonly items: readonly Item[];
}

export interface TypicalLocationEnvelope {
  readonly typicalLocation: ManagedTypicalLocation;
}

export interface TypicalLocationsEnvelope {
  readonly typicalLocations: readonly ManagedTypicalLocation[];
}

export interface ItemPhotoEnvelope {
  readonly itemPhoto: ItemPhoto;
}

export interface ItemPhotosEnvelope {
  readonly itemPhotos: readonly ItemPhoto[];
}

export interface SharingGroupEnvelope {
  readonly sharingGroup: SharingGroup;
}

export interface SharingGroupsEnvelope {
  readonly sharingGroups: readonly SharingGroup[];
}

export interface SharingGroupMembersEnvelope {
  readonly members: readonly SharingGroupMember[];
}

export interface InvitationEnvelope {
  readonly invitation: Invitation;
}

export interface InvitationsEnvelope {
  readonly invitations: readonly Invitation[];
}

export interface InvitationAcceptEnvelope {
  readonly invitation: Invitation;
  readonly sharingGroup: SharingGroup;
}

export interface ItemSharingEnvelope {
  readonly itemSharing: ItemSharing;
}

export interface ItemSharingStatusEnvelope {
  readonly shareReadiness: ShareReadiness;
  readonly itemSharing: readonly ItemSharing[];
}

export interface SharedItemEnvelope {
  readonly sharedItem: SharedItem;
}

export interface SharedItemsEnvelope {
  readonly sharedItems: readonly SharedItem[];
}

export interface ReservationEnvelope {
  readonly reservation: Reservation;
}

export interface ReservationsEnvelope {
  readonly reservations: readonly Reservation[];
}

export interface ReservationChangeProposalEnvelope {
  readonly changeProposal: ReservationChangeProposal;
}

export interface ReservationChangeProposalsEnvelope {
  readonly changeProposals: readonly ReservationChangeProposal[];
}

export interface ApiProblem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly errors?: Readonly<Record<string, string>>;
}

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface RegistrationInput extends Credentials {
  readonly displayName: string;
}

export interface ProfileUpdate {
  readonly displayName: string;
}

export interface ItemInput {
  readonly name: string;
  readonly description: string | null;
  readonly typicalLocationId?: string | null;
  readonly typicalPlacement?: string | null;
  readonly categories?: readonly string[];
}

export interface TypicalLocationInput {
  readonly name: string;
  readonly details: string | null;
  readonly timezone: string;
}

export interface SharingGroupInput {
  readonly name: string;
}

export interface InvitationInput {
  readonly email: string;
}

export interface ReservationRequestInput {
  readonly startLocal: string;
  readonly endLocal: string;
}

export type ReservationChangeProposalInput = ReservationRequestInput;

export const isApiProblem = (value: unknown): value is ApiProblem =>
  typeof value === 'object' && value !== null && 'code' in value && 'status' in value;
