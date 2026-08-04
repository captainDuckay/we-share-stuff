import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormField, form, submit, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AppDialog } from '../../../core/dialog/app-dialog';
import { Reservation, ReservationChangeProposal } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { NotificationInboxStore } from '../../../core/notifications/notification-inbox.store';
import { SessionStore } from '../../../core/session/session.store';
import { ToastStore } from '../../../core/toast/toast.store';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import {
  borrowerListPlacementPath,
  borrowerReservationStatusLabel,
  defaultReservationsTab,
  formatLocationLocalRange,
  isPastReservation,
  isUpcomingAcceptedReservation,
  parseReservationsTab,
  pendingProposalForReservation,
  reservationCanProposeChange,
  reservationEndTimeError,
  reservationsNeedingBorrowerResponse,
  reservationsTabContaining,
  reservationStartTimeError,
  type ReservationsTab,
  visibleStructuredPlacement,
} from '../functions';
import { MyReservationRow } from '../my-reservation-row/my-reservation-row';
import { PlacementSnapshotDiagram } from '../placement-snapshot/placement-snapshot-diagram';

@Component({
  selector: 'app-my-reservations-page',
  imports: [
    AppDialog,
    FormField,
    MyReservationRow,
    PageLayout,
    PlacementSnapshotDiagram,
    RouterLink,
    UserAvatar,
  ],
  templateUrl: './my-reservations-page.component.html',
  styleUrl: './my-reservations-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyReservationsPageComponent {
  readonly #api = inject(SharingApi);
  readonly #session = inject(SessionStore);
  readonly #inbox = inject(NotificationInboxStore);
  readonly #toast = inject(ToastStore);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #injector = inject(Injector);
  // viewChild requires a TypeScript-accessible field (not # private).
  private readonly tripDialog = viewChild(AppDialog);

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
  #scrolledFocusId: string | null = null;

  readonly urlTab = toSignal(
    this.#route.queryParamMap.pipe(map((params) => parseReservationsTab(params.get('tab')))),
    {
      initialValue: parseReservationsTab(this.#route.snapshot.queryParamMap.get('tab')),
    },
  );
  readonly focusReservationId = toSignal(
    this.#route.queryParamMap.pipe(map((params) => params.get('reservationId') ?? '')),
    { initialValue: this.#route.snapshot.queryParamMap.get('reservationId') ?? '' },
  );

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
      this.#applyLandingTab(response.reservations);
      const selectedId = this.selectedId();
      if (
        selectedId &&
        !response.reservations.some((reservation) => reservation.id === selectedId)
      ) {
        this.selectedId.set(null);
      }
      // Mark-read is intersection-driven on list rows — not full-surface batch on load.
      this.#scrollFocusReservationIntoView();
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
    void this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  onRowVisible(reservationId: string): void {
    void this.#inbox.markDeepLinkRead({ reservationId });
  }

  openDetail(reservation: Reservation): void {
    this.actionError.set('');
    this.proposeModel.set({
      startLocal: reservation.startLocal.slice(0, 16),
      endLocal: reservation.endLocal.slice(0, 16),
    });
    this.selectedId.set(reservation.id);
  }

  /** Close button: ask the native dialog to close; state clears on `appDialogClosed`. */
  requestCloseDetail(): void {
    const dialog = this.tripDialog();
    if (dialog) {
      dialog.close();
      return;
    }
    this.onDetailClosed();
  }

  /** Sync after native close (Escape, light dismiss, or programmatic close). */
  onDetailClosed(): void {
    this.selectedId.set(null);
    this.actionError.set('');
  }

  closeDetail(): void {
    this.requestCloseDetail();
  }

  ownerName(reservation: Reservation): string {
    return reservation.item.owner.displayName;
  }

  statusLabel(reservation: Reservation): string {
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
    const ok = await this.#runAction(
      async () => {
        await this.#api.withdrawReservation(reservation.id);
      },
      {
        success: 'Reservation withdrawn.',
        error: 'We could not withdraw that Reservation Request.',
      },
    );
    if (ok && closeDetail) this.closeDetail();
  }

  async cancel(reservation: Reservation, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(
      async () => {
        await this.#api.cancelReservation(reservation.id);
      },
      {
        success: 'Reservation cancelled.',
        error: 'We could not cancel that Reservation.',
      },
    );
    if (ok && closeDetail) this.closeDetail();
  }

  submitPropose(): void {
    void submit(this.proposeForm, async () => {
      const reservation = this.selected();
      if (!reservation) return;
      const { startLocal, endLocal } = this.proposeModel();
      const ok = await this.#runAction(
        async () => {
          await this.#api.createChangeProposal(reservation.id, {
            startLocal: startLocal.trim(),
            endLocal: endLocal.trim(),
          });
        },
        {
          success: 'Reservation Change Proposal created.',
          error: 'We could not propose those Reservation dates.',
        },
      );
      if (ok) this.closeDetail();
    });
  }

  async withdrawProposal(proposal: ReservationChangeProposal, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(
      async () => {
        await this.#api.withdrawChangeProposal(proposal.id);
      },
      {
        success: 'Reservation Change Proposal withdrawn.',
        error: 'We could not withdraw that Reservation Change Proposal.',
      },
    );
    if (ok && closeDetail) this.closeDetail();
  }

  async approve(proposal: ReservationChangeProposal, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(
      async () => {
        await this.#api.approveChangeProposal(proposal.id);
      },
      {
        success: 'Reservation Change Proposal approved.',
        error: 'We could not update that Reservation Change Proposal.',
      },
    );
    if (ok && closeDetail) this.closeDetail();
  }

  async reject(proposal: ReservationChangeProposal, closeDetail = false): Promise<void> {
    const ok = await this.#runAction(
      async () => {
        await this.#api.rejectChangeProposal(proposal.id);
      },
      {
        success: 'Reservation Change Proposal rejected.',
        error: 'We could not update that Reservation Change Proposal.',
      },
    );
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

  #applyLandingTab(reservations: readonly Reservation[]): void {
    const focusId = this.focusReservationId();
    const focused = focusId
      ? (reservations.find((reservation) => reservation.id === focusId) ?? null)
      : null;
    if (focused) {
      const nextTab = reservationsTabContaining(focused);
      this.tab.set(nextTab);
      void this.#router.navigate([], {
        relativeTo: this.#route,
        queryParams: { tab: nextTab, reservationId: focusId },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      this.#landed = true;
      return;
    }
    if (!this.#landed) {
      const fromUrl = this.urlTab();
      this.tab.set(
        fromUrl ??
          defaultReservationsTab(
            reservations.filter((r) => isUpcomingAcceptedReservation(r)).length,
            reservations.filter((r) => r.status === 'pending').length,
          ),
      );
      if (!fromUrl) {
        void this.#router.navigate([], {
          relativeTo: this.#route,
          queryParams: { tab: this.tab() },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
      this.#landed = true;
    }
  }

  #scrollFocusReservationIntoView(): void {
    const focusId = this.focusReservationId();
    if (!focusId || this.#scrolledFocusId === focusId) return;
    if (!this.reservations().some((reservation) => reservation.id === focusId)) return;
    afterNextRender(
      () => {
        const el = document.querySelector(
          `[data-reservation-id="${CSS.escape(focusId)}"]`,
        );
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          this.#scrolledFocusId = focusId;
        }
      },
      { injector: this.#injector },
    );
  }

  async #runAction(
    action: () => Promise<void>,
    messages?: { success: string; error: string },
  ): Promise<boolean> {
    if (this.actionBusy()) return false;
    this.actionBusy.set(true);
    this.actionError.set('');
    try {
      await action();
      if (messages?.success) this.#toast.success(messages.success);
      void this.#inbox.refresh();
      await this.#refreshQuietly();
      return true;
    } catch {
      const errorMessage = messages?.error ?? 'That action could not be completed. Try again.';
      this.actionError.set(errorMessage);
      this.#toast.error(errorMessage);
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
