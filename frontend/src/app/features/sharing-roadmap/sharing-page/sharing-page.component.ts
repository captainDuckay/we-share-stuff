import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import {
  Invitation,
  Item,
  Reservation,
  ReservationChangeProposal,
  SharedItem,
  SharingGroup,
  SharingGroupMember,
} from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { NotificationInboxStore } from '../../../core/notifications/notification-inbox.store';
import { SessionStore } from '../../../core/session/session.store';
import { ToastStore } from '../../../core/toast/toast.store';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import {
  SharingPageSharedItemComponent,
  SharingPageSharedItemReservationRequest,
} from '../sharing-page-shared-item/sharing-page-shared-item.component';
import { PlacementSnapshotDiagram } from '../placement-snapshot/placement-snapshot-diagram';
import {
  fieldError,
  formatLocationLocalRange,
  friendlyApiError,
  globalSharedItemEntries,
  GROUP_MEMBER_INITIAL_LIMIT,
  GROUP_NAME_MAX_LENGTH,
  normalizeInvitationInput,
  normalizeNameInput,
  normalizeReservationRequest,
  remainingMemberCount,
  typicalPlacementLabel,
  visibleStructuredPlacement,
} from '../functions';

@Component({
  selector: 'app-sharing-page',
  imports: [
    PageLayout,
    PlacementSnapshotDiagram,
    ReactiveFormsModule,
    RouterLink,
    SharingPageSharedItemComponent,
    UserAvatar,
  ],
  templateUrl: './sharing-page.component.html',
  styleUrl: './sharing-page.component.css',
})
export class SharingPageComponent {
  readonly #api = inject(SharingApi);
  readonly #inventoryApi = inject(InventoryApi);
  readonly #inbox = inject(NotificationInboxStore);
  readonly #toast = inject(ToastStore);
  readonly session = inject(SessionStore);
  readonly groupNameMaxLength = GROUP_NAME_MAX_LENGTH;
  readonly groups = signal<readonly SharingGroup[]>([]);
  readonly myInvitations = signal<readonly Invitation[]>([]);
  readonly membersByGroup = signal<Readonly<Record<string, readonly SharingGroupMember[]>>>({});
  readonly invitationsByGroup = signal<Readonly<Record<string, readonly Invitation[]>>>({});
  readonly sharedItemsByGroup = signal<Readonly<Record<string, readonly SharedItem[]>>>({});
  readonly requestedReservations = signal<readonly Reservation[]>([]);
  readonly receivedReservations = signal<readonly Reservation[]>([]);
  readonly inventoryItems = signal<readonly Item[]>([]);
  readonly changeProposalsByReservation = signal<
    Readonly<Record<string, readonly ReservationChangeProposal[]>>
  >({});
  readonly globalSharedItems = computed(() =>
    globalSharedItemEntries(this.groups(), this.sharedItemsByGroup()),
  );
  readonly loading = signal(true);
  readonly error = signal('');
  readonly formError = signal('');
  readonly busyKey = signal<string | null>(null);
  readonly dismissedAttentionIds = signal<ReadonlySet<string>>(new Set());
  readonly announcement = signal('');
  readonly groupForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(GROUP_NAME_MAX_LENGTH)],
    }),
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [groups, invitations, requested, received, inventory] = await Promise.all([
        this.#api.listGroups(),
        this.#api.listMyInvitations('pending'),
        this.#api.listReservations('requested'),
        this.#api.listReservations('received'),
        this.#inventoryApi.list(),
      ]);
      this.groups.set(groups.sharingGroups);
      this.myInvitations.set(invitations.invitations);
      this.requestedReservations.set(requested.reservations);
      this.receivedReservations.set(received.reservations);
      this.inventoryItems.set(inventory.items);
      await this.#loadGroupDetails(groups.sharingGroups);
      await this.#loadChangeProposals([...requested.reservations, ...received.reservations]);
      // Destination open: invitation deep links use surface "home" (pending/cancelled/declined).
      void this.#inbox.markDeepLinkRead({ surface: 'home' });
    } catch {
      this.error.set('We could not load your sharing details.');
    } finally {
      this.loading.set(false);
    }
  }

  async createGroup(): Promise<void> {
    if (this.groupForm.invalid || this.busyKey()) {
      this.groupForm.markAllAsTouched();
      return;
    }
    this.busyKey.set('create-group');
    this.formError.set('');
    try {
      await this.#api.createGroup(normalizeNameInput(this.groupForm.controls.name.value));
      this.groupForm.reset({ name: '' });
      this.announcement.set('Sharing Group created.');
      await this.load();
    } catch (error) {
      this.formError.set(
        fieldError(error, 'name') ||
          friendlyApiError(error, 'We could not create that Sharing Group.'),
      );
    } finally {
      this.busyKey.set(null);
    }
  }

  membersFor(group: SharingGroup): readonly SharingGroupMember[] {
    return this.membersByGroup()[group.id] ?? [];
  }

  invitationsFor(group: SharingGroup): readonly Invitation[] {
    return this.invitationsByGroup()[group.id] ?? [];
  }

  sharedItemsFor(group: SharingGroup): readonly SharedItem[] {
    return this.sharedItemsByGroup()[group.id] ?? [];
  }

  placementLabel = typicalPlacementLabel;
  placementStructured = visibleStructuredPlacement;
  remainingMemberCount = remainingMemberCount;

  visibleMembers(group: SharingGroup): readonly SharingGroupMember[] {
    return this.membersFor(group).slice(0, GROUP_MEMBER_INITIAL_LIMIT);
  }

  sharedItemCountFor(group: SharingGroup): number {
    return this.sharedItemsFor(group).length;
  }

  reservationRange(reservation: Reservation): string {
    return formatLocationLocalRange(
      reservation.startLocal,
      reservation.endLocal,
      reservation.timezone,
    );
  }

  changeProposalsFor(reservation: Reservation): readonly ReservationChangeProposal[] {
    return this.changeProposalsByReservation()[reservation.id] ?? [];
  }

  proposalRange(proposal: ReservationChangeProposal): string {
    return formatLocationLocalRange(proposal.startLocal, proposal.endLocal, proposal.timezone);
  }

  canActOnProposal(proposal: ReservationChangeProposal): boolean {
    return proposal.status === 'pending' && proposal.proposedBy.id !== this.session.user()?.id;
  }

  allChangeProposals(): readonly ReservationChangeProposal[] {
    return Object.values(this.changeProposalsByReservation()).flat();
  }

  attentionChangeProposals(): readonly ReservationChangeProposal[] {
    return this.allChangeProposals().filter(
      (proposal) =>
        proposal.status === 'pending' && !this.isAttentionDismissed(`proposal:${proposal.id}`),
    );
  }

  isAttentionDismissed(id: string): boolean {
    return this.dismissedAttentionIds().has(id);
  }

  dismissAttention(id: string): void {
    this.dismissedAttentionIds.update((dismissed) => new Set([...dismissed, id]));
  }

  canRemoveMember(member: SharingGroupMember): boolean {
    return !member.isCreator && member.user.id !== this.session.user()?.id;
  }

  async invite(group: SharingGroup, email: string): Promise<void> {
    const input = normalizeInvitationInput(email);
    if (!input.email || this.busyKey()) return;
    this.busyKey.set(`invite:${group.id}`);
    this.formError.set('');
    try {
      await this.#api.createInvitation(group.id, input);
      this.announcement.set('Invitation sent.');
      this.#toast.success('Invitation sent.');
      await this.#loadInvitationsForGroup(group);
    } catch (error) {
      const message =
        fieldError(error, 'email') || friendlyApiError(error, 'We could not send that Invitation.');
      this.formError.set(message);
      this.#toast.error(message);
    } finally {
      this.busyKey.set(null);
    }
  }

  async cancelInvitation(group: SharingGroup, invitation: Invitation): Promise<void> {
    if (this.busyKey()) return;
    this.busyKey.set(`cancel-invitation:${invitation.id}`);
    this.formError.set('');
    try {
      await this.#api.cancelInvitation(group.id, invitation.id);
      this.announcement.set('Invitation cancelled.');
      this.#toast.success('Invitation cancelled.');
      await this.#loadInvitationsForGroup(group);
    } catch (error) {
      const message = friendlyApiError(error, 'We could not cancel that Invitation.');
      this.formError.set(message);
      this.#toast.error(message);
    } finally {
      this.busyKey.set(null);
    }
  }

  async acceptInvitation(invitation: Invitation): Promise<void> {
    if (this.busyKey()) return;
    this.busyKey.set(`accept-invitation:${invitation.id}`);
    this.formError.set('');
    try {
      await this.#api.acceptInvitation(invitation.id);
      this.announcement.set('Invitation accepted.');
      this.#toast.success('Invitation accepted.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      const message = friendlyApiError(error, 'We could not accept that Invitation.');
      this.formError.set(message);
      this.#toast.error(message);
    } finally {
      this.busyKey.set(null);
    }
  }

  async declineInvitation(invitation: Invitation): Promise<void> {
    if (this.busyKey()) return;
    this.busyKey.set(`decline-invitation:${invitation.id}`);
    this.formError.set('');
    try {
      await this.#api.declineInvitation(invitation.id);
      this.announcement.set('Invitation declined.');
      this.#toast.success('Invitation declined.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      const message = friendlyApiError(error, 'We could not decline that Invitation.');
      this.formError.set(message);
      this.#toast.error(message);
    } finally {
      this.busyKey.set(null);
    }
  }

  async removeMember(group: SharingGroup, member: SharingGroupMember): Promise<void> {
    if (this.busyKey() || !this.canRemoveMember(member)) return;
    this.busyKey.set(`remove-member:${group.id}:${member.user.id}`);
    this.formError.set('');
    try {
      await this.#api.removeMember(group.id, member.user.id);
      this.announcement.set('Member removed.');
      await this.#loadGroupDetails([group]);
    } catch (error) {
      this.formError.set(friendlyApiError(error, 'We could not remove that Member.'));
    } finally {
      this.busyKey.set(null);
    }
  }

  async leaveGroup(group: SharingGroup): Promise<void> {
    if (this.busyKey() || group.currentUserCanManage) return;
    this.busyKey.set(`leave:${group.id}`);
    this.formError.set('');
    try {
      await this.#api.leaveGroup(group.id);
      this.announcement.set('You left the Sharing Group.');
      await this.load();
    } catch (error) {
      this.formError.set(friendlyApiError(error, 'We could not leave that Sharing Group.'));
    } finally {
      this.busyKey.set(null);
    }
  }

  async requestReservation(request: SharingPageSharedItemReservationRequest): Promise<void> {
    const input = normalizeReservationRequest(request.startLocal, request.endLocal);
    if (!input.startLocal || !input.endLocal || this.busyKey()) return;
    this.busyKey.set(`request-reservation:${request.group.id}:${request.item.id}`);
    this.formError.set('');
    try {
      await this.#api.requestReservation(request.group.id, request.item.id, input);
      this.announcement.set('Reservation requested.');
      this.#toast.success('Reservation requested.');
      void this.#inbox.refresh();
      await this.#refreshReservationsAndSharedItems();
    } catch (error) {
      const message = friendlyApiError(error, 'We could not request that Reservation.');
      this.formError.set(message);
      this.#toast.error(message);
    } finally {
      this.busyKey.set(null);
    }
  }

  async acceptReservation(reservation: Reservation): Promise<void> {
    await this.#decideReservation(reservation, 'accept');
  }

  async declineReservation(reservation: Reservation): Promise<void> {
    await this.#decideReservation(reservation, 'decline');
  }

  async withdrawReservation(reservation: Reservation): Promise<void> {
    await this.#decideReservation(reservation, 'withdraw');
  }

  async cancelReservation(reservation: Reservation): Promise<void> {
    await this.#decideReservation(reservation, 'cancel');
  }

  async approveChangeProposal(proposal: ReservationChangeProposal): Promise<void> {
    await this.#decideChangeProposal(proposal, 'approve');
  }

  async rejectChangeProposal(proposal: ReservationChangeProposal): Promise<void> {
    await this.#decideChangeProposal(proposal, 'reject');
  }

  async proposeReservationChange(
    reservation: Reservation,
    startLocal: string,
    endLocal: string,
  ): Promise<void> {
    const input = normalizeReservationRequest(startLocal, endLocal);
    if (!input.startLocal || !input.endLocal || this.busyKey()) return;
    this.busyKey.set(`change-proposal:${reservation.id}`);
    this.formError.set('');
    try {
      await this.#api.createChangeProposal(reservation.id, input);
      this.announcement.set('Reservation Change Proposal created.');
      await this.#refreshReservationsAndSharedItems();
    } catch (error) {
      this.formError.set(friendlyApiError(error, 'We could not propose those Reservation dates.'));
    } finally {
      this.busyKey.set(null);
    }
  }

  async #decideChangeProposal(
    proposal: ReservationChangeProposal,
    decision: 'approve' | 'reject',
  ): Promise<void> {
    if (this.busyKey()) return;
    this.busyKey.set(`${decision}-change-proposal:${proposal.id}`);
    this.formError.set('');
    try {
      if (decision === 'approve') await this.#api.approveChangeProposal(proposal.id);
      else await this.#api.rejectChangeProposal(proposal.id);
      this.announcement.set(
        decision === 'approve'
          ? 'Reservation Change Proposal approved.'
          : 'Reservation Change Proposal rejected.',
      );
      await this.#refreshReservationsAndSharedItems();
    } catch (error) {
      this.formError.set(
        friendlyApiError(error, 'We could not update that Reservation Change Proposal.'),
      );
    } finally {
      this.busyKey.set(null);
    }
  }

  async #decideReservation(
    reservation: Reservation,
    decision: 'accept' | 'decline' | 'withdraw' | 'cancel',
  ): Promise<void> {
    if (this.busyKey()) return;
    this.busyKey.set(`${decision}-reservation:${reservation.id}`);
    this.formError.set('');
    const successMessage =
      decision === 'accept'
        ? 'Reservation accepted.'
        : decision === 'decline'
          ? 'Reservation declined.'
          : decision === 'withdraw'
            ? 'Reservation withdrawn.'
            : 'Reservation cancelled.';
    try {
      if (decision === 'accept') await this.#api.acceptReservation(reservation.id);
      else if (decision === 'decline') await this.#api.declineReservation(reservation.id);
      else if (decision === 'withdraw') await this.#api.withdrawReservation(reservation.id);
      else await this.#api.cancelReservation(reservation.id);
      this.announcement.set(successMessage);
      this.#toast.success(successMessage);
      void this.#inbox.refresh();
      await this.#refreshReservationsAndSharedItems();
    } catch (error) {
      const message = friendlyApiError(error, 'We could not update that Reservation.');
      this.formError.set(message);
      this.#toast.error(message);
    } finally {
      this.busyKey.set(null);
    }
  }

  async #refreshReservationsAndSharedItems(): Promise<void> {
    const [requested, received] = await Promise.all([
      this.#api.listReservations('requested'),
      this.#api.listReservations('received'),
    ]);
    this.requestedReservations.set(requested.reservations);
    this.receivedReservations.set(received.reservations);
    await this.#loadChangeProposals([...requested.reservations, ...received.reservations]);
    await Promise.all(this.groups().map((group) => this.#loadSharedItemsForGroup(group)));
  }

  async #loadChangeProposals(reservations: readonly Reservation[]): Promise<void> {
    const entries = await Promise.all(
      reservations.map(async (reservation) => {
        const response = await this.#api.listChangeProposals(reservation.id);
        return [reservation.id, response.changeProposals] as const;
      }),
    );
    this.changeProposalsByReservation.set(Object.fromEntries(entries));
  }

  async #loadGroupDetails(groups: readonly SharingGroup[]): Promise<void> {
    await Promise.all(
      groups.map(async (group) => {
        const [members] = await Promise.all([
          this.#api.listMembers(group.id),
          this.#loadInvitationsForGroup(group),
          this.#loadSharedItemsForGroup(group),
        ]);
        this.membersByGroup.update((record) => ({ ...record, [group.id]: members.members }));
      }),
    );
  }

  async #loadInvitationsForGroup(group: SharingGroup): Promise<void> {
    if (!group.currentUserCanManage) {
      this.invitationsByGroup.update((record) => ({ ...record, [group.id]: [] }));
      return;
    }
    const invitations = await this.#api.listGroupInvitations(group.id, 'pending');
    this.invitationsByGroup.update((record) => ({
      ...record,
      [group.id]: invitations.invitations,
    }));
  }

  async #loadSharedItemsForGroup(group: SharingGroup): Promise<void> {
    const sharedItems = await this.#api.listSharedItems(group.id);
    this.sharedItemsByGroup.update((record) => ({
      ...record,
      [group.id]: sharedItems.sharedItems,
    }));
  }
}
