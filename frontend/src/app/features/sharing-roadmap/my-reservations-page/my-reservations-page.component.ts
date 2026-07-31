import { isDevMode, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
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
import { MyReservationsPrototypeHost } from './prototype/my-reservations-prototype-host';
import type { PrototypeVariantKey } from './prototype/prototype-switcher';

const isPrototypeVariant = (value: string | null | undefined): value is PrototypeVariantKey =>
  value === 'A' || value === 'B' || value === 'C';

@Component({
  selector: 'app-my-reservations-page',
  imports: [PageLayout, ReservationCardComponent, MyReservationsPrototypeHost],
  templateUrl: './my-reservations-page.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class MyReservationsPageComponent {
  readonly #api = inject(SharingApi);
  readonly #session = inject(SessionStore);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);

  /** PROTOTYPE gate (#22): ?variant=A|B|C shows throwaway UI; omit for production list. */
  readonly prototypeVariant = toSignal(
    this.#route.queryParamMap.pipe(
      map((params) => {
        const raw = params.get('variant');
        return isPrototypeVariant(raw) ? raw : null;
      }),
    ),
    { initialValue: null },
  );

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

  readonly showPrototypeEntry = isDevMode;

  setPrototypeVariant(variant: PrototypeVariantKey): void {
    void this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { variant },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  exitPrototype(): void {
    void this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { variant: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  enterPrototype(): void {
    this.setPrototypeVariant('A');
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
