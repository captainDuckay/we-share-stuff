import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  InvitationAcceptEnvelope,
  InvitationEnvelope,
  InvitationInput,
  InvitationStatus,
  InvitationsEnvelope,
  ItemSharingEnvelope,
  ItemSharingStatusEnvelope,
  ReservationChangeProposalEnvelope,
  ReservationChangeProposalInput,
  ReservationChangeProposalsEnvelope,
  ReservationEnvelope,
  ReservationRequestInput,
  ReservationsEnvelope,
  ReservationStatus,
  SharedItemEnvelope,
  SharedItemsEnvelope,
  SharingGroupEnvelope,
  SharingGroupInput,
  SharingGroupMembersEnvelope,
  SharingGroupsEnvelope,
} from './model';

@Injectable({ providedIn: 'root' })
export class SharingApi {
  readonly #http = inject(HttpClient);

  listGroups = (): Promise<SharingGroupsEnvelope> =>
    firstValueFrom(this.#http.get<SharingGroupsEnvelope>('/api/sharing-groups'));

  createGroup = (input: SharingGroupInput): Promise<SharingGroupEnvelope> =>
    firstValueFrom(this.#http.post<SharingGroupEnvelope>('/api/sharing-groups', input));

  getGroup = (groupId: string): Promise<SharingGroupEnvelope> =>
    firstValueFrom(
      this.#http.get<SharingGroupEnvelope>(`/api/sharing-groups/${encodeURIComponent(groupId)}`),
    );

  uploadGroupPhoto = (groupId: string, file: File): Promise<SharingGroupEnvelope> => {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(
      this.#http.post<SharingGroupEnvelope>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/photo`,
        body,
      ),
    );
  };

  removeGroupPhoto = (groupId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(`/api/sharing-groups/${encodeURIComponent(groupId)}/photo`),
    );

  listMembers = (groupId: string): Promise<SharingGroupMembersEnvelope> =>
    firstValueFrom(
      this.#http.get<SharingGroupMembersEnvelope>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/members`,
      ),
    );

  leaveGroup = (groupId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(`/api/sharing-groups/${encodeURIComponent(groupId)}/members/me`),
    );

  removeMember = (groupId: string, userId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      ),
    );

  createInvitation = (groupId: string, input: InvitationInput): Promise<InvitationEnvelope> =>
    firstValueFrom(
      this.#http.post<InvitationEnvelope>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/invitations`,
        input,
      ),
    );

  listGroupInvitations = (
    groupId: string,
    status?: InvitationStatus,
  ): Promise<InvitationsEnvelope> =>
    firstValueFrom(
      this.#http.get<InvitationsEnvelope>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/invitations`,
        { params: status ? new HttpParams().set('status', status) : undefined },
      ),
    );

  cancelInvitation = (groupId: string, invitationId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/invitations/${encodeURIComponent(invitationId)}`,
      ),
    );

  listMyInvitations = (status?: InvitationStatus): Promise<InvitationsEnvelope> =>
    firstValueFrom(
      this.#http.get<InvitationsEnvelope>('/api/invitations', {
        params: status ? new HttpParams().set('status', status) : undefined,
      }),
    );

  acceptInvitation = (invitationId: string): Promise<InvitationAcceptEnvelope> =>
    firstValueFrom(
      this.#http.post<InvitationAcceptEnvelope>(
        `/api/invitations/${encodeURIComponent(invitationId)}/accept`,
        {},
      ),
    );

  declineInvitation = (invitationId: string): Promise<InvitationEnvelope> =>
    firstValueFrom(
      this.#http.post<InvitationEnvelope>(
        `/api/invitations/${encodeURIComponent(invitationId)}/decline`,
        {},
      ),
    );

  getItemSharing = (itemId: string): Promise<ItemSharingStatusEnvelope> =>
    firstValueFrom(
      this.#http.get<ItemSharingStatusEnvelope>(`/api/items/${encodeURIComponent(itemId)}/sharing`),
    );

  shareItem = (itemId: string, groupId: string): Promise<ItemSharingEnvelope> =>
    firstValueFrom(
      this.#http.post<ItemSharingEnvelope>(
        `/api/items/${encodeURIComponent(itemId)}/sharing-groups/${encodeURIComponent(groupId)}`,
        {},
      ),
    );

  unshareItem = (itemId: string, groupId: string): Promise<void> =>
    firstValueFrom(
      this.#http.delete<void>(
        `/api/items/${encodeURIComponent(itemId)}/sharing-groups/${encodeURIComponent(groupId)}`,
      ),
    );

  listGlobalSharedItems = (): Promise<SharedItemsEnvelope> =>
    firstValueFrom(this.#http.get<SharedItemsEnvelope>('/api/shared-items'));

  getGlobalSharedItem = (itemId: string): Promise<SharedItemEnvelope> =>
    firstValueFrom(
      this.#http.get<SharedItemEnvelope>(`/api/shared-items/${encodeURIComponent(itemId)}`),
    );

  listSharedItems = (groupId: string): Promise<SharedItemsEnvelope> =>
    firstValueFrom(
      this.#http.get<SharedItemsEnvelope>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/shared-items`,
      ),
    );

  getSharedItem = (groupId: string, itemId: string): Promise<SharedItemEnvelope> =>
    firstValueFrom(
      this.#http.get<SharedItemEnvelope>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/shared-items/${encodeURIComponent(itemId)}`,
      ),
    );

  requestGlobalReservation = (
    itemId: string,
    input: ReservationRequestInput,
  ): Promise<ReservationEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationEnvelope>(
        `/api/shared-items/${encodeURIComponent(itemId)}/reservations`,
        input,
      ),
    );

  requestReservation = (
    groupId: string,
    itemId: string,
    input: ReservationRequestInput,
  ): Promise<ReservationEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationEnvelope>(
        `/api/sharing-groups/${encodeURIComponent(groupId)}/shared-items/${encodeURIComponent(itemId)}/reservations`,
        input,
      ),
    );

  listReservations = (
    scope: 'requested' | 'received',
    statuses?: readonly ReservationStatus[],
  ): Promise<ReservationsEnvelope> => {
    let params = new HttpParams().set('scope', scope);
    if (statuses?.length) params = params.set('status', statuses.join(','));
    return firstValueFrom(this.#http.get<ReservationsEnvelope>('/api/reservations', { params }));
  };

  acceptReservation = (reservationId: string): Promise<ReservationEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationEnvelope>(
        `/api/reservations/${encodeURIComponent(reservationId)}/accept`,
        {},
      ),
    );

  declineReservation = (reservationId: string): Promise<ReservationEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationEnvelope>(
        `/api/reservations/${encodeURIComponent(reservationId)}/decline`,
        {},
      ),
    );

  withdrawReservation = (reservationId: string): Promise<ReservationEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationEnvelope>(
        `/api/reservations/${encodeURIComponent(reservationId)}/withdraw`,
        {},
      ),
    );

  cancelReservation = (reservationId: string): Promise<ReservationEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationEnvelope>(
        `/api/reservations/${encodeURIComponent(reservationId)}/cancel`,
        {},
      ),
    );

  listChangeProposals = (reservationId: string): Promise<ReservationChangeProposalsEnvelope> =>
    firstValueFrom(
      this.#http.get<ReservationChangeProposalsEnvelope>(
        `/api/reservations/${encodeURIComponent(reservationId)}/change-proposals`,
      ),
    );

  createChangeProposal = (
    reservationId: string,
    input: ReservationChangeProposalInput,
  ): Promise<ReservationChangeProposalEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationChangeProposalEnvelope>(
        `/api/reservations/${encodeURIComponent(reservationId)}/change-proposals`,
        input,
      ),
    );

  approveChangeProposal = (proposalId: string): Promise<ReservationChangeProposalEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationChangeProposalEnvelope>(
        `/api/reservation-change-proposals/${encodeURIComponent(proposalId)}/approve`,
        {},
      ),
    );

  rejectChangeProposal = (proposalId: string): Promise<ReservationChangeProposalEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationChangeProposalEnvelope>(
        `/api/reservation-change-proposals/${encodeURIComponent(proposalId)}/reject`,
        {},
      ),
    );

  withdrawChangeProposal = (proposalId: string): Promise<ReservationChangeProposalEnvelope> =>
    firstValueFrom(
      this.#http.post<ReservationChangeProposalEnvelope>(
        `/api/reservation-change-proposals/${encodeURIComponent(proposalId)}/withdraw`,
        {},
      ),
    );
}
