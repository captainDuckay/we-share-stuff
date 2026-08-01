import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { FormField, form, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Reservation, ReservationChangeProposal } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SessionStore } from '../../../core/session/session.store';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import {
  borrowerListPlacementPath,
  borrowerReservationStatusLabel,
  defaultReservationsTab,
  formatLocationLocalRange,
  isPastReservation,
  isUpcomingAcceptedReservation,
  pendingProposalForReservation,
  reservationCanProposeChange,
  reservationEndTimeError,
  reservationsNeedingBorrowerResponse,
  reservationStartTimeError,
  type ReservationsTab,
  visibleStructuredPlacement,
} from '../functions';
import { PlacementSnapshotDiagram } from '../placement-snapshot/placement-snapshot-diagram';

@Component({
  selector: 'app-my-reservations-page',
  imports: [FormField, PageLayout, PlacementSnapshotDiagram, RouterLink, UserAvatar],
  templateUrl: './my-reservations-page.component.html',
  styleUrl: './my-reservations-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyReservationsPageComponent {
  readonly #api = inject(SharingApi);
  readonly #session = inject(SessionStore);

  readonly reservations = signal<readonly Reservation[]>([]);
  readonly proposals = signal<readonly ReservationChangeProposal[]>([]);
  readonly hasSharingGroups = signal(true);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly proposalsError = signal('');
  readonly actionError = signal('');
  readonly actionBusy = signal(false);
  readonly tab = signal<ReservationsTab>('upcoming');
  readonly selectedId = signal<string | null>(null);
  readonly dialogTitleId = 'my-reservations-trip-detail-title';
  #landed = false;

  readonly proposeModel = signal({ startLocal: '', endLocal: '' });
  readonly proposeForm = form(this.proposeModel, (path) => {
    validate(path.startLocal, ({ value }) => {
      const startLocal = value().trim();
      if (!startLocal) return { kind: 'required', message: 'Choose a start time.' };
      const reservation = this.selected();
      if (!reservation) return undefined;
      const message = reservationStartTimeError(startLocal, reservation.timezone);
      return message ? { kind: 'start', message } : undefined;
    });
    validate(path.endLocal, ({ value }) => {
      const endLocal = value().trim();
      if (!endLocal) return { kind: 'required', message: 'Choose an end time.' };
      const startLocal = this.proposeModel().startLocal.trim();
      const message = reservationEndTimeError(startLocal, endLocal);
      return message ? { kind: 'end', message } : undefined;
    });
  });

  readonly pending = computed(() =>
    this.reservations().filter((reservation) => reservation.status === 'pending'),
  );
  readonly upcoming = computed(() =>
    this.reservations().filter((reservation) => isUpcomingAcceptedReservation(reservation)),
  );
  readonly past = computed(() =>
    this.reservations().filter((reservation) => isPastReservation(reservation)),
  );
  readonly activeReservations = computed(() => {
    switch (this.tab()) {
      case 'upcoming':
        return this.upcoming();
      case 'pending':
        return this.pending();
      case 'past':
        return this.past();
    }
  });
  readonly needsResponse = computed(() =>
    reservationsNeedingBorrowerResponse(
      this.reservations(),
      this.proposals(),
      this.#session.user()?.id,
    ),
  );
  readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.reservations().find((reservation) => reservation.id === id) ?? null;
  });

  constructor() {
    void this.load();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selectedId()) this.closeDetail();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.proposalsError.set('');
    this.actionError.set('');
    try {
      const [groups, response] = await Promise.all([
        this.#api.listGroups(),
        this.#api.listReservations('requested'),
      ]);
      this.hasSharingGroups.set(groups.sharingGroups.length > 0);
      this.reservations.set(response.reservations);
      await this.#loadProposals(response.reservations);
      if (!this.#landed) {
        this.tab.set(
          defaultReservationsTab(
            response.reservations.filter((r) => isUpcomingAcceptedReservation(r)).length,
            response.reservations.filter((r) => r.status === 'pending').length,
          ),
        );
        this.#landed = true;
      }
      const selectedId = this.selectedId();
      if (
        selectedId &&
        !response.reservations.some((reservation) => reservation.id === selectedId)
      ) {
        this.selectedId.set(null);
      }
    } catch {
      this.error.set('We could not load My reservations.');
      this.reservations.set([]);
      this.proposals.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async retryProposals(): Promise<void> {
    this.proposalsError.set('');
    await this.#loadProposals(this.reservations());
  }

  selectTab(tab: ReservationsTab): void {
    this.tab.set(tab);
  }

  openDetail(reservation: Reservation): void {
    this.selectedId.set(reservation.id);
    this.actionError.set('');
    this.proposeModel.set({
      startLocal: reservation.startLocal.slice(0, 16),
      endLocal: reservation.endLocal.slice(0, 16),
    });
  }

  closeDetail(): void {
    this.selectedId.set(null);
    this.actionError.set('');
  }

  ownerName(reservation: Reservation): string {
    return reservation.item.owner.displayName;
  }

  statusLabel(reservation: Reservation): string {
    const userId = this.#session.user()?.id;
    return borrowerReservationStatusLabel(reservation, {
      ownerDisplayName: this.ownerName(reservation),
      pendingFromOwner: this.pendingProposalFromOther(reservation) !== null,
      pendingByMe: this.pendingProposalByMe(reservation) !== null,
    });
  }

  rangeLabel(reservation: Reservation): string {
    return formatLocationLocalRange(
      reservation.startLocal,
      reservation.endLocal,
      reservation.timezone,
    );
  }

  proposalRangeLabel(proposal: ReservationChangeProposal): string {
    return formatLocationLocalRange(proposal.startLocal, proposal.endLocal, proposal.timezone);
  }

  locationName(reservation: Reservation): string {
    return reservation.item.typicalLocation.name;
  }

  listPlacementPath(reservation: Reservation): string | null {
    return borrowerListPlacementPath(reservation.item.typicalPlacement);
  }

  structuredPlacement(reservation: Reservation) {
    return visibleStructuredPlacement(reservation.item.typicalPlacement);
  }

  pendingProposalFromOther(reservation: Reservation): ReservationChangeProposal | null {
    return pendingProposalForReservation(
      this.proposals(),
      reservation.id,
      this.#session.user()?.id,
      'other',
    );
  }

  pendingProposalByMe(reservation: Reservation): ReservationChangeProposal | null {
    return pendingProposalForReservation(
      this.proposals(),
      reservation.id,
      this.#session.user()?.id,
      'me',
    );
  }

  canCancel(reservation: Reservation): boolean {
    return (
      isUpcomingAcceptedReservation(reservation) && !this.pendingProposalFromOther(reservation)
    );
  }

  canWithdraw(reservation: Reservation): boolean {
    return reservation.status === 'pending' && !this.pendingProposalFromOther(reservation);
  }

  canPropose(reservation: Reservation): boolean {
    return (
      !isPastReservation(reservation) &&
      reservationCanProposeChange(reservation, this.proposals()) &&
      this.pendingProposalFromOther(reservation) === null
    );
  }

  isHistoryOnly(reservation: Reservation): boolean {
    return isPastReservation(reservation);
  }

  softLinkTab(): ReservationsTab | null {
    if (this.activeReservations().length > 0) return null;
    if (this.tab() !== 'upcoming' && this.upcoming().length > 0) return 'upcoming';
    if (this.tab() !== 'pending' && this.pending().length > 0) return 'pending';
    if (this.tab() !== 'past' && this.past().length > 0) return 'past';
    return null;
  }

  tabLabel(tab: ReservationsTab): string {
    switch (tab) {
      case 'upcoming':
        return 'Upcoming';
      case 'pending':
        return 'Pending';
      case 'past':
        return 'Past';
    }
  }

  async withdraw(reservation: Reservation, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(async () => {
      await this.#api.withdrawReservation(reservation.id);
    });
    if (ok && closeDetail) this.closeDetail();
  }

  async cancel(reservation: Reservation, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(async () => {
      await this.#api.cancelReservation(reservation.id);
    });
    if (ok && closeDetail) this.closeDetail();
  }

  submitPropose(): void {
    void submit(this.proposeForm, async () => {
      const reservation = this.selected();
      if (!reservation) return;
      const { startLocal, endLocal } = this.proposeModel();
      const ok = await this.#runAction(async () => {
        await this.#api.createChangeProposal(reservation.id, {
          startLocal: startLocal.trim(),
          endLocal: endLocal.trim(),
        });
      });
      if (ok) this.closeDetail();
    });
  }

  async withdrawProposal(proposal: ReservationChangeProposal, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(async () => {
      await this.#api.withdrawChangeProposal(proposal.id);
    });
    if (ok && closeDetail) this.closeDetail();
  }

  async approve(proposal: ReservationChangeProposal, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(async () => {
      await this.#api.approveChangeProposal(proposal.id);
    });
    if (ok && closeDetail) this.closeDetail();
  }

  async reject(proposal: ReservationChangeProposal, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(async () => {
      await this.#api.rejectChangeProposal(proposal.id);
    });
    if (ok && closeDetail) this.closeDetail();
  }

  async #loadProposals(reservations: readonly Reservation[]): Promise<void> {
    if (reservations.length === 0) {
      this.proposals.set([]);
      this.proposalsError.set('');
      return;
    }
    const results = await Promise.allSettled(
      reservations.map((reservation) => this.#api.listChangeProposals(reservation.id)),
    );
    const loaded = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value.changeProposals : [],
    );
    this.proposals.set(loaded);
    if (results.some((result) => result.status === 'rejected')) {
      this.proposalsError.set(
        'We could not load all change proposals. Your trips still appear below.',
      );
    } else {
      this.proposalsError.set('');
    }
  }

  async #runAction(action: () => Promise<void>): Promise<boolean> {
    if (this.actionBusy()) return false;
    this.actionBusy.set(true);
    this.actionError.set('');
    try {
      await action();
      await this.#refreshQuietly();
      return true;
    } catch {
      this.actionError.set('That action could not be completed. Try again.');
      return false;
    } finally {
      this.actionBusy.set(false);
    }
  }

  /** Reload list data without the full-page loading flash (used after mutations). */
  async #refreshQuietly(): Promise<void> {
    try {
      const [groups, response] = await Promise.all([
        this.#api.listGroups(),
        this.#api.listReservations('requested'),
      ]);
      this.hasSharingGroups.set(groups.sharingGroups.length > 0);
      this.reservations.set(response.reservations);
      await this.#loadProposals(response.reservations);
      const selectedId = this.selectedId();
      if (
        selectedId &&
        !response.reservations.some((reservation) => reservation.id === selectedId)
      ) {
        this.selectedId.set(null);
      }
    } catch {
      this.error.set('We could not load My reservations.');
    }
  }
}
