import { Component, computed, inject, signal } from '@angular/core';
import { Reservation, ReservationChangeProposal } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SessionStore } from '../../../core/session/session.store';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import {
  isPastReservation,
  isUpcomingAcceptedReservation,
  reservationCanProposeChange,
} from '../functions';
import { ReservationCardComponent } from '../reservation-card/reservation-card.component';

@Component({
  selector: 'app-my-reservations-page',
  imports: [PageLayout, ReservationCardComponent],
  templateUrl: './my-reservations-page.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class MyReservationsPageComponent {
  readonly #api = inject(SharingApi);
  readonly #session = inject(SessionStore);
  readonly reservations = signal<readonly Reservation[]>([]);
  readonly proposals = signal<readonly ReservationChangeProposal[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tab = signal<'upcoming' | 'pending' | 'past'>('upcoming');
  readonly pending = computed(() =>
    this.reservations().filter((reservation) => reservation.status === 'pending'),
  );
  readonly upcoming = computed(() =>
    this.reservations().filter((reservation) => isUpcomingAcceptedReservation(reservation)),
  );
  readonly past = computed(() =>
    this.reservations().filter((reservation) => isPastReservation(reservation)),
  );
  readonly activeReservations = computed(() =>
    this.tab() === 'upcoming'
      ? this.upcoming()
      : this.tab() === 'pending'
        ? this.pending()
        : this.past(),
  );
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.#api.listReservations('requested');
      this.reservations.set(response.reservations);
      const lists = await Promise.all(
        response.reservations.map((reservation) => this.#api.listChangeProposals(reservation.id)),
      );
      this.proposals.set(lists.flatMap((list) => list.changeProposals));
    } catch {
      this.error.set('We could not load My reservations.');
    } finally {
      this.loading.set(false);
    }
  }
  ownerName(reservation: Reservation): string {
    return reservation.item.owner.displayName;
  }
  pendingProposalFromOther(reservation: Reservation): ReservationChangeProposal | null {
    return (
      this.proposals().find(
        (proposal) =>
          proposal.reservation.id === reservation.id &&
          proposal.status === 'pending' &&
          proposal.proposedBy.id !== this.#session.user()?.id,
      ) ?? null
    );
  }
  pendingProposalByMe(reservation: Reservation): ReservationChangeProposal | null {
    return (
      this.proposals().find(
        (proposal) =>
          proposal.reservation.id === reservation.id &&
          proposal.status === 'pending' &&
          proposal.proposedBy.id === this.#session.user()?.id,
      ) ?? null
    );
  }
  canCancelOrPropose(reservation: Reservation): boolean {
    return reservationCanProposeChange(reservation, this.proposals());
  }
  async withdraw(reservation: Reservation): Promise<void> {
    await this.#api.withdrawReservation(reservation.id);
    await this.load();
  }
  async cancel(reservation: Reservation): Promise<void> {
    await this.#api.cancelReservation(reservation.id);
    await this.load();
  }
  async propose(reservation: Reservation, startLocal: string, endLocal: string): Promise<void> {
    if (!startLocal || !endLocal) return;
    await this.#api.createChangeProposal(reservation.id, { startLocal, endLocal });
    await this.load();
  }
  async withdrawProposal(proposal: ReservationChangeProposal): Promise<void> {
    await this.#api.withdrawChangeProposal(proposal.id);
    await this.load();
  }
  async approve(proposal: ReservationChangeProposal): Promise<void> {
    await this.#api.approveChangeProposal(proposal.id);
    await this.load();
  }
  async reject(proposal: ReservationChangeProposal): Promise<void> {
    await this.#api.rejectChangeProposal(proposal.id);
    await this.load();
  }
}
