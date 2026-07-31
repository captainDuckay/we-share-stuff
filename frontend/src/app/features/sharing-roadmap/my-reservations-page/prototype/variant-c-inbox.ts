import { Component, computed, input, output, signal } from '@angular/core';
import {
  PrototypeReservation,
  countByTab,
  placementTextPath,
} from './fixtures';
import { PrototypeQuietPlacementDiagram } from './quiet-placement-diagram';

/**
 * PROTOTYPE Variant C — Inbox / needs-action first
 * Action queue leads; history collapsed. Contrasts with #21 (trip-first).
 */
@Component({
  selector: 'app-prototype-variant-c-inbox',
  imports: [PrototypeQuietPlacementDiagram],
  template: `
    <header class="c-header">
      <p class="c-kicker">Variant C — Inbox / needs-action</p>
      <p class="c-lede">
        Action queue first. Trips and history are secondary sections. Useful contrast against trip-first.
      </p>
    </header>

    <section class="c-inbox" aria-label="Action queue">
      <h2>Do next</h2>
      @if (actionable().length === 0) {
        <p class="c-empty">Nothing needs your response right now.</p>
      } @else {
        <ul class="c-queue">
          @for (r of actionable(); track r.id) {
            <li class="c-queue__item">
              <div>
                <strong>{{ r.itemName }}</strong>
                <p class="c-muted">{{ actionLabel(r) }}</p>
                @if (r.proposal?.from === 'owner') {
                  <p>
                    {{ r.rangeLabel }} → <strong>{{ r.proposal?.proposedRangeLabel }}</strong>
                  </p>
                }
              </div>
              <div class="c-actions">
                @if (r.needsResponse) {
                  <button type="button" class="c-btn c-btn--primary" (click)="approve.emit(r)">
                    Accept change
                  </button>
                  <button type="button" class="c-btn" (click)="reject.emit(r)">Reject</button>
                } @else if (r.proposal?.from === 'me') {
                  <button type="button" class="c-btn" (click)="withdrawProposal.emit(r)">
                    Withdraw proposal
                  </button>
                } @else if (r.status === 'pending') {
                  <button type="button" class="c-btn" (click)="withdraw.emit(r)">Withdraw</button>
                }
              </div>
            </li>
          }
        </ul>
      }
    </section>

    <section class="c-section" aria-label="Active trips">
      <button type="button" class="c-section__toggle" (click)="showTrips.set(!showTrips())">
        <span>Active trips</span>
        <span class="c-muted">{{ trips().length }} · {{ showTrips() ? 'Hide' : 'Show' }}</span>
      </button>
      @if (showTrips()) {
        <ul class="c-trips">
          @for (r of trips(); track r.id) {
            <li class="c-trip">
              <button type="button" class="c-trip__btn" (click)="pick(r)">
                <div class="c-trip__when">{{ r.rangeLabel }}</div>
                <div>
                  <strong>{{ r.itemName }}</strong>
                  <div class="c-muted">{{ r.locationName }} · {{ r.ownerName }}</div>
                  @if (path(r); as p) {
                    <div class="c-place">{{ p }}</div>
                  }
                </div>
              </button>
              @if (!r.needsResponse) {
                <button type="button" class="c-btn" (click)="cancel.emit(r)">Cancel</button>
              }
            </li>
          }
        </ul>
      }
    </section>

    <section class="c-section" aria-label="Waiting">
      <button type="button" class="c-section__toggle" (click)="showWaiting.set(!showWaiting())">
        <span>Waiting on others</span>
        <span class="c-muted">{{ waiting().length }} · {{ showWaiting() ? 'Hide' : 'Show' }}</span>
      </button>
      @if (showWaiting()) {
        <ul class="c-simple">
          @for (r of waiting(); track r.id) {
            <li>
              <strong>{{ r.itemName }}</strong>
              <span class="c-muted"> — {{ r.statusLabel }} · {{ r.rangeLabel }}</span>
              @if (r.conflictNote) {
                <p class="c-warn">{{ r.conflictNote }}</p>
              }
            </li>
          }
        </ul>
      }
    </section>

    <section class="c-section" aria-label="History">
      <button type="button" class="c-section__toggle" (click)="showHistory.set(!showHistory())">
        <span>History</span>
        <span class="c-muted">
          {{ counts().past }} past · {{ showHistory() ? 'Hide' : 'Show' }}
        </span>
      </button>
      @if (showHistory()) {
        <ul class="c-simple">
          @for (r of history(); track r.id) {
            <li class="c-muted">
              <strong>{{ r.itemName }}</strong> — {{ r.statusLabel }} · {{ r.rangeLabel }}
            </li>
          }
        </ul>
      }
    </section>

    @if (selected(); as s) {
      <aside class="c-detail" aria-label="Selected Reservation">
        <header class="c-detail__head">
          <h2>{{ s.itemName }}</h2>
          <button type="button" class="c-btn" (click)="selectedId.set(null)">Close</button>
        </header>
        <p>{{ s.statusLabel }}</p>
        <p>{{ s.rangeLabel }} ({{ s.timezoneLabel }})</p>
        <p>{{ s.locationName }} · {{ s.ownerName }}</p>
        @if (path(s); as p) {
          <p class="c-place">{{ p }}</p>
        }
        @if (s.placement.kind === 'structured') {
          <app-prototype-quiet-placement-diagram [placement]="s.placement" />
        }
        <button type="button" class="c-btn c-btn--primary" (click)="openDetail.emit(s)">
          Propose change…
        </button>
      </aside>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
      max-width: 40rem;
    }
    .c-kicker {
      margin: 0;
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted-foreground);
    }
    .c-lede,
    .c-muted {
      color: var(--muted-foreground);
    }
    .c-lede {
      margin: var(--space-1) 0 0;
    }
    .c-inbox {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      border-radius: var(--radius-md);
      background: var(--card);
      border: 2px solid var(--primary);
    }
    .c-inbox h2 {
      margin: 0;
    }
    .c-queue {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--space-3);
    }
    .c-queue__item {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      justify-content: space-between;
      padding: var(--space-3);
      background: var(--muted);
      border-radius: var(--radius-sm);
    }
    .c-section {
      border-top: var(--border-width) solid var(--border);
      padding-top: var(--space-3);
    }
    .c-section__toggle {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: var(--space-2) 0;
    }
    .c-trips,
    .c-simple {
      list-style: none;
      margin: var(--space-2) 0 0;
      padding: 0;
      display: grid;
      gap: var(--space-2);
    }
    .c-trip {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--card);
      padding: var(--space-2);
    }
    .c-trip__btn {
      flex: 1;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-3);
      text-align: left;
      border: none;
      background: none;
      color: inherit;
      cursor: pointer;
      padding: var(--space-2);
    }
    .c-trip__when {
      font-weight: 700;
      font-size: 0.85rem;
      min-width: 7rem;
    }
    .c-place {
      margin-top: var(--space-1);
      font-size: 0.85rem;
      padding: var(--space-1) var(--space-2);
      background: var(--muted);
      border-radius: var(--radius-sm);
    }
    .c-warn {
      color: var(--destructive-text);
      font-size: 0.8rem;
    }
    .c-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
    .c-btn {
      border: var(--border-width) solid var(--border);
      background: var(--secondary);
      color: var(--secondary-foreground);
      border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      font-size: 0.85rem;
    }
    .c-btn--primary {
      background: var(--primary);
      color: var(--primary-foreground);
      border-color: var(--primary);
    }
    .c-empty {
      margin: 0;
      color: var(--muted-foreground);
    }
    .c-detail {
      position: sticky;
      bottom: 5rem;
      padding: var(--space-4);
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card);
      display: grid;
      gap: var(--space-2);
      box-shadow: 0 8px 32px var(--shadow-color);
    }
    .c-detail__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
    }
    .c-detail__head h2 {
      margin: 0;
      font-size: 1.1rem;
    }
  `,
})
export class PrototypeVariantCInbox {
  readonly reservations = input.required<readonly PrototypeReservation[]>();
  readonly approve = output<PrototypeReservation>();
  readonly reject = output<PrototypeReservation>();
  readonly withdraw = output<PrototypeReservation>();
  readonly cancel = output<PrototypeReservation>();
  readonly withdrawProposal = output<PrototypeReservation>();
  readonly openDetail = output<PrototypeReservation>();

  readonly showTrips = signal(true);
  readonly showWaiting = signal(true);
  readonly showHistory = signal(false);
  readonly selectedId = signal<string | null>(null);

  readonly counts = computed(() => countByTab(this.reservations()));
  readonly actionable = computed(() =>
    this.reservations().filter(
      (r) => r.needsResponse || r.proposal?.from === 'me' || r.status === 'pending',
    ),
  );
  readonly trips = computed(() =>
    this.reservations().filter((r) => r.tab === 'upcoming' && r.status === 'accepted'),
  );
  readonly waiting = computed(() =>
    this.reservations().filter((r) => r.tab === 'pending' || r.proposal?.from === 'me'),
  );
  readonly history = computed(() => this.reservations().filter((r) => r.tab === 'past'));
  readonly selected = computed(
    () => this.reservations().find((r) => r.id === this.selectedId()) ?? null,
  );

  path(r: PrototypeReservation): string | null {
    return placementTextPath(r.placement);
  }

  actionLabel(r: PrototypeReservation): string {
    if (r.needsResponse) return `${r.ownerName} proposed new dates`;
    if (r.proposal?.from === 'me') return `Waiting on ${r.ownerName}`;
    if (r.status === 'pending') return 'Reservation Request pending';
    return r.statusLabel;
  }

  pick(r: PrototypeReservation): void {
    this.selectedId.set(r.id);
    this.openDetail.emit(r);
  }
}
