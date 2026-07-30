import { Component, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  Invitation,
  Reservation,
  ReservationChangeProposal,
  SharedItem,
  SharingGroup,
  SharingGroupMember,
} from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SessionStore } from '../../../core/session/session.store';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import {
  DEFAULT_SHARING_GROUP_ICON,
  SHARING_GROUP_PHOTO_ACCEPT,
  sharingGroupPhotoInputError,
} from '../functions';
import { SharingPageSharedItemComponent } from '../sharing-page-shared-item/sharing-page-shared-item.component';

@Component({
  selector: 'app-sharing-group-page',
  imports: [MaterialSymbolIconComponent, PageLayout, SharingPageSharedItemComponent, UserAvatar],
  templateUrl: './sharing-group-page.component.html',
  styleUrls: ['../sharing-page/sharing-page.component.css', './sharing-group-page.component.css'],
})
export class SharingGroupPageComponent implements OnDestroy {
  readonly #api = inject(SharingApi);
  readonly #route = inject(ActivatedRoute);
  readonly session = inject(SessionStore);
  readonly defaultSharingGroupIcon = DEFAULT_SHARING_GROUP_ICON;
  readonly sharingGroupPhotoAccept = SHARING_GROUP_PHOTO_ACCEPT;
  readonly group = signal<SharingGroup | null>(null);
  readonly members = signal<readonly SharingGroupMember[]>([]);
  readonly invitations = signal<readonly Invitation[]>([]);
  readonly sharedItems = signal<readonly SharedItem[]>([]);
  readonly reservations = signal<readonly Reservation[]>([]);
  readonly changeProposals = signal<readonly ReservationChangeProposal[]>([]);
  readonly dismissedAttentionIds = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedPhoto = signal<File | null>(null);
  readonly selectedPhotoPreviewUrl = signal('');
  readonly photoBusy = signal(false);
  readonly photoError = signal('');
  readonly announcement = signal('');

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.#revokePhotoPreview();
  }

  async load(): Promise<void> {
    const groupId = this.#route.snapshot.paramMap.get('groupId');
    if (!groupId) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const group = await this.#api.getGroup(groupId);
      this.group.set(group.sharingGroup);
      const [members, sharedItems, invitations, requested, received] = await Promise.all([
        this.#api.listMembers(groupId),
        this.#api.listSharedItems(groupId),
        group.sharingGroup.currentUserCanManage
          ? this.#api.listGroupInvitations(groupId, 'pending')
          : Promise.resolve({ invitations: [] }),
        this.#api.listReservations('requested'),
        this.#api.listReservations('received'),
      ]);
      const scopedReservations = [...requested.reservations, ...received.reservations].filter(
        (reservation) =>
          reservation.sharingGroup.id === groupId && reservation.status === 'pending',
      );
      const proposalResponses = await Promise.all(
        scopedReservations.map((reservation) => this.#api.listChangeProposals(reservation.id)),
      );
      this.members.set(members.members);
      this.sharedItems.set(sharedItems.sharedItems);
      this.invitations.set(invitations.invitations);
      this.reservations.set(scopedReservations);
      this.changeProposals.set(
        proposalResponses.flatMap((response) =>
          response.changeProposals.filter((proposal) => proposal.status === 'pending'),
        ),
      );
    } catch {
      this.error.set('We could not load that Sharing Group.');
    } finally {
      this.loading.set(false);
    }
  }

  attentionInvitations(): readonly Invitation[] {
    return this.invitations().filter(
      (invitation) => !this.isAttentionDismissed(`invitation:${invitation.id}`),
    );
  }

  attentionReservations(): readonly Reservation[] {
    return this.reservations().filter(
      (reservation) => !this.isAttentionDismissed(`reservation:${reservation.id}`),
    );
  }

  attentionChangeProposals(): readonly ReservationChangeProposal[] {
    return this.changeProposals().filter(
      (proposal) => !this.isAttentionDismissed(`proposal:${proposal.id}`),
    );
  }

  scopedAttentionCount(): number {
    return (
      this.attentionInvitations().length +
      this.attentionReservations().length +
      this.attentionChangeProposals().length
    );
  }

  canActOnProposal(proposal: ReservationChangeProposal): boolean {
    return proposal.status === 'pending' && proposal.proposedBy.id !== this.session.user()?.id;
  }

  isAttentionDismissed(id: string): boolean {
    return this.dismissedAttentionIds().has(id);
  }

  dismissAttention(id: string): void {
    this.dismissedAttentionIds.update((dismissed) => new Set([...dismissed, id]));
  }

  selectPhoto(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.item(0) ?? null;
    const validationError = sharingGroupPhotoInputError(file);
    this.photoError.set(validationError);
    this.#revokePhotoPreview();
    this.selectedPhoto.set(validationError ? null : file);
    if (file && !validationError) {
      this.selectedPhotoPreviewUrl.set(URL.createObjectURL(file));
    }
  }

  cancelPhotoSelection(): void {
    this.#revokePhotoPreview();
    this.selectedPhoto.set(null);
    this.photoError.set('');
  }

  async uploadPhoto(): Promise<void> {
    const group = this.group();
    const file = this.selectedPhoto();
    if (!group?.currentUserCanManage || !file || this.photoBusy()) return;
    this.photoBusy.set(true);
    this.photoError.set('');
    try {
      const response = await this.#api.uploadGroupPhoto(group.id, file);
      this.group.set(response.sharingGroup);
      this.cancelPhotoSelection();
      this.announcement.set('Sharing Group Photo updated.');
    } catch {
      this.photoError.set('We could not upload that Sharing Group Photo.');
    } finally {
      this.photoBusy.set(false);
    }
  }

  async removePhoto(): Promise<void> {
    const group = this.group();
    if (!group?.currentUserCanManage || !group.photoUrl || this.photoBusy()) return;
    this.photoBusy.set(true);
    this.photoError.set('');
    try {
      await this.#api.removeGroupPhoto(group.id);
      this.group.set({ ...group, photoUrl: null });
      this.announcement.set('Sharing Group Photo removed.');
    } catch {
      this.photoError.set('We could not remove that Sharing Group Photo.');
    } finally {
      this.photoBusy.set(false);
    }
  }

  async acceptReservation(reservation: Reservation): Promise<void> {
    await this.#api.acceptReservation(reservation.id);
    await this.load();
  }

  async declineReservation(reservation: Reservation): Promise<void> {
    await this.#api.declineReservation(reservation.id);
    await this.load();
  }

  async approveChangeProposal(proposal: ReservationChangeProposal): Promise<void> {
    await this.#api.approveChangeProposal(proposal.id);
    await this.load();
  }

  async rejectChangeProposal(proposal: ReservationChangeProposal): Promise<void> {
    await this.#api.rejectChangeProposal(proposal.id);
    await this.load();
  }

  #revokePhotoPreview(): void {
    const url = this.selectedPhotoPreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.selectedPhotoPreviewUrl.set('');
  }
}
