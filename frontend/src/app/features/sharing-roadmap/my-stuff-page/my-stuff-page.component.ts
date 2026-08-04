import { afterNextRender, Component, computed, effect, inject, Injector, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { InventoryApi } from '../../../core/api/inventory-api.service';
import { Item, Reservation, ReservationChangeProposal } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { NotificationInboxStore } from '../../../core/notifications/notification-inbox.store';
import { ToastStore } from '../../../core/toast/toast.store';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { friendlyApiError, parseMyStuffTab, reservationCanProposeChange, type MyStuffTab } from '../functions';
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
  readonly #inbox = inject(NotificationInboxStore);
  readonly #toast = inject(ToastStore);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #injector = inject(Injector);
  #loadGeneration = 0;
  #scrolledFocusId: string | null = null;
  readonly typicalLocationId = toSignal(
    this.#route.queryParamMap.pipe(map((params) => params.get('typicalLocationId') ?? '')),
    { initialValue: this.#route.snapshot.queryParamMap.get('typicalLocationId') ?? '' },
  );
  readonly placementSlotId = toSignal(
    this.#route.queryParamMap.pipe(map((params) => params.get('placementSlotId') ?? '')),
    { initialValue: this.#route.snapshot.queryParamMap.get('placementSlotId') ?? '' },
  );
  readonly tab = toSignal(
    this.#route.queryParamMap.pipe(map((params) => parseMyStuffTab(params.get('tab')))),
    {
      initialValue: parseMyStuffTab(this.#route.snapshot.queryParamMap.get('tab')),
    },
  );
  readonly focusReservationId = toSignal(
    this.#route.queryParamMap.pipe(map((params) => params.get('reservationId') ?? '')),
    { initialValue: this.#route.snapshot.queryParamMap.get('reservationId') ?? '' },
  );
  readonly items = signal<readonly Item[]>([]);
  readonly approvals = signal<readonly Reservation[]>([]);
  readonly proposals = signal<readonly ReservationChangeProposal[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    effect(() => {
      this.typicalLocationId();
      this.placementSlotId();
      void this.load();
    });
  }

  selectTab(next: MyStuffTab): void {
    void this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { tab: next === 'tools' ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  async load(): Promise<void> {
    const generation = ++this.#loadGeneration;
    this.loading.set(true);
    this.error.set('');
    try {
      const [items, received] = await Promise.all([
        this.#inventoryApi.list({
          typicalLocationId: this.typicalLocationId() || undefined,
          placementSlotId: this.placementSlotId() || undefined,
        }),
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
      // Mark-read is intersection-driven on Approvals cards — not tools load batch.
      this.#scrollFocusReservationIntoView(generation);
    } catch {
      if (generation === this.#loadGeneration) this.error.set('We could not load My stuff.');
    } finally {
      if (generation === this.#loadGeneration) this.loading.set(false);
    }
  }

  onApprovalCardVisible(reservationId: string): void {
    void this.#inbox.markDeepLinkRead({ reservationId });
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
    try {
      await this.#sharingApi.acceptReservation(reservation.id);
      this.#toast.success('Reservation accepted.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      this.#toast.error(friendlyApiError(error, 'We could not accept that Reservation.'));
    }
  }

  async decline(reservation: Reservation): Promise<void> {
    try {
      await this.#sharingApi.declineReservation(reservation.id);
      this.#toast.success('Reservation declined.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      this.#toast.error(friendlyApiError(error, 'We could not decline that Reservation.'));
    }
  }

  async cancel(reservation: Reservation): Promise<void> {
    try {
      await this.#sharingApi.cancelReservation(reservation.id);
      this.#toast.success('Reservation cancelled.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      this.#toast.error(friendlyApiError(error, 'We could not cancel that Reservation.'));
    }
  }

  async propose(reservation: Reservation, startLocal: string, endLocal: string): Promise<void> {
    if (!startLocal || !endLocal) return;
    try {
      await this.#sharingApi.createChangeProposal(reservation.id, { startLocal, endLocal });
      this.#toast.success('Reservation Change Proposal created.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      this.#toast.error(
        friendlyApiError(error, 'We could not propose those Reservation dates.'),
      );
    }
  }

  async approveProposal(proposal: ReservationChangeProposal): Promise<void> {
    try {
      await this.#sharingApi.approveChangeProposal(proposal.id);
      this.#toast.success('Reservation Change Proposal approved.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      this.#toast.error(
        friendlyApiError(error, 'We could not update that Reservation Change Proposal.'),
      );
    }
  }

  async rejectProposal(proposal: ReservationChangeProposal): Promise<void> {
    try {
      await this.#sharingApi.rejectChangeProposal(proposal.id);
      this.#toast.success('Reservation Change Proposal rejected.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      this.#toast.error(
        friendlyApiError(error, 'We could not update that Reservation Change Proposal.'),
      );
    }
  }

  async withdrawProposal(proposal: ReservationChangeProposal): Promise<void> {
    try {
      await this.#sharingApi.withdrawChangeProposal(proposal.id);
      this.#toast.success('Reservation Change Proposal withdrawn.');
      void this.#inbox.refresh();
      await this.load();
    } catch (error) {
      this.#toast.error(
        friendlyApiError(error, 'We could not withdraw that Reservation Change Proposal.'),
      );
    }
  }

  #scrollFocusReservationIntoView(generation: number): void {
    const focusId = this.focusReservationId();
    if (!focusId || this.tab() !== 'approvals') return;
    if (this.#scrolledFocusId === focusId) return;
    if (!this.approvals().some((reservation) => reservation.id === focusId)) return;
    afterNextRender(
      () => {
        if (generation !== this.#loadGeneration) return;
        const el = document.querySelector(
          `app-reservation-card[data-reservation-id="${CSS.escape(focusId)}"]`,
        );
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          this.#scrolledFocusId = focusId;
        }
      },
      { injector: this.#injector },
    );
  }
}
