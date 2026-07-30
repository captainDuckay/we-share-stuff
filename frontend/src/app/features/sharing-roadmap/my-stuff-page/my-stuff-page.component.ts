import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { Item, Reservation, ReservationChangeProposal } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { reservationCanProposeChange } from '../functions';
import { ReservationCardComponent } from '../reservation-card/reservation-card.component';
import { SharedItemCardComponent } from '../shared-item-card/shared-item-card.component';

@Component({
  selector: 'app-my-stuff-page',
  imports: [PageLayout, ReservationCardComponent, RouterLink, SharedItemCardComponent],
  templateUrl: './my-stuff-page.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class MyStuffPageComponent {
  readonly #inventoryApi = inject(InventoryApi);
  readonly #sharingApi = inject(SharingApi);
  readonly #route = inject(ActivatedRoute);
  #loadGeneration = 0;
  readonly typicalLocationId = toSignal(
    this.#route.queryParamMap.pipe(map((params) => params.get('typicalLocationId') ?? '')),
    { initialValue: this.#route.snapshot.queryParamMap.get('typicalLocationId') ?? '' },
  );
  readonly items = signal<readonly Item[]>([]);
  readonly approvals = signal<readonly Reservation[]>([]);
  readonly proposals = signal<readonly ReservationChangeProposal[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tab = signal<'tools' | 'approvals'>('tools');
  constructor() {
    effect(() => {
      this.typicalLocationId();
      void this.load();
    });
  }
  async load(): Promise<void> {
    const generation = ++this.#loadGeneration;
    this.loading.set(true);
    this.error.set('');
    try {
      const [items, received] = await Promise.all([
        this.#inventoryApi.list(this.typicalLocationId()),
        this.#sharingApi.listReservations('received'),
      ]);
      if (generation !== this.#loadGeneration) return;
      this.items.set(items.items);
      this.approvals.set(received.reservations);
      const lists = await Promise.all(
        received.reservations.map((reservation) =>
          this.#sharingApi.listChangeProposals(reservation.id),
        ),
      );
      if (generation !== this.#loadGeneration) return;
      this.proposals.set(lists.flatMap((list) => list.changeProposals));
    } catch {
      if (generation === this.#loadGeneration) this.error.set('We could not load My stuff.');
    } finally {
      if (generation === this.#loadGeneration) this.loading.set(false);
    }
  }
  readonly activeProposals = computed(() =>
    this.proposals().filter((proposal) => proposal.status === 'pending'),
  );
  otherName(reservation: Reservation): string {
    return reservation.requester.displayName;
  }
  ownerCanAct(reservation: Reservation): boolean {
    return (
      reservation.status === 'pending' &&
      !reservation.conflictsWithAcceptedReservation &&
      !this.pendingProposalFromOther(reservation) &&
      !this.pendingProposalByMe(reservation)
    );
  }
  pendingProposalFromOther(reservation: Reservation): ReservationChangeProposal | null {
    return (
      this.activeProposals().find(
        (proposal) =>
          proposal.reservation.id === reservation.id &&
          proposal.proposedBy.id !== proposal.reservation.item.owner.id,
      ) ?? null
    );
  }
  pendingProposalByMe(reservation: Reservation): ReservationChangeProposal | null {
    return (
      this.activeProposals().find(
        (proposal) =>
          proposal.reservation.id === reservation.id &&
          proposal.proposedBy.id === proposal.reservation.item.owner.id,
      ) ?? null
    );
  }
  canCancelOrPropose(reservation: Reservation): boolean {
    return reservationCanProposeChange(reservation, this.activeProposals());
  }
  async accept(reservation: Reservation): Promise<void> {
    await this.#sharingApi.acceptReservation(reservation.id);
    await this.load();
  }
  async decline(reservation: Reservation): Promise<void> {
    await this.#sharingApi.declineReservation(reservation.id);
    await this.load();
  }
  async cancel(reservation: Reservation): Promise<void> {
    await this.#sharingApi.cancelReservation(reservation.id);
    await this.load();
  }
  async propose(reservation: Reservation, startLocal: string, endLocal: string): Promise<void> {
    if (!startLocal || !endLocal) return;
    await this.#sharingApi.createChangeProposal(reservation.id, { startLocal, endLocal });
    await this.load();
  }
  async approveProposal(proposal: ReservationChangeProposal): Promise<void> {
    await this.#sharingApi.approveChangeProposal(proposal.id);
    await this.load();
  }
  async rejectProposal(proposal: ReservationChangeProposal): Promise<void> {
    await this.#sharingApi.rejectChangeProposal(proposal.id);
    await this.load();
  }
  async withdrawProposal(proposal: ReservationChangeProposal): Promise<void> {
    await this.#sharingApi.withdrawChangeProposal(proposal.id);
    await this.load();
  }
}
