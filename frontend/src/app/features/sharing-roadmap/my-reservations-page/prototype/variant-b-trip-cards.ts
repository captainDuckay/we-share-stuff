import { Component, computed, input, output, signal } from '@angular/core';
import {
  PrototypeReservation,
  PrototypeTab,
  countByTab,
  placementTextPath,
} from './fixtures';
import { PrototypeQuietPlacementDiagram } from './quiet-placement-diagram';

/**
 * PROTOTYPE Variant B — Trip-oriented cards
 * Closest to grilling #21: next pickup hero, elevated time/place, diagram on expand.
 */
@Component({
  selector: 'app-prototype-variant-b-trip-cards',
  imports: [PrototypeQuietPlacementDiagram],
  template: `
    <header class="b-header">
      <p class="b-kicker">Variant B — Trip-oriented cards</p>
      <p class="b-lede">
        Borrow-trip surface: when and where first. Needs-your-response is a strip, not a primary tab.
      </p>
    </header>

    @if (needsResponse().length) {
      <section class="b-needs" aria-label="Needs your response">
        <h2 class="b-needs__title">Needs your response</h2>
        @for (r of needsResponse(); track r.id) {
          <article class="b-needs__card">
            <div>
              <strong>{{ r.itemName }}</strong>
              <p class="b-muted">{{ r.ownerName }} proposed new dates</p>
              <p>
                Current: <span class="b-strike">{{ r.rangeLabel }}</span>
              </p>
              <p>
                Proposed: <strong>{{ r.proposal?.proposedRangeLabel }}</strong>
                <span class="b-muted"> ({{ r.timezoneLabel }})</span>
              </p>
            </div>
            <div class="b-actions">
              <button type="button" class="b-btn b-btn--primary" (click)="approve.emit(r)">
                Accept change
              </button>
              <button type="button" class="b-btn" (click)="reject.emit(r)">Reject change</button>
            </div>
          </article>
        }
      </section>
    }

    @if (hero(); as h) {
      <section class="b-hero" aria-label="Next trip">
        <p class="b-hero__label">Next trip</p>
        <h2 class="b-hero__title">{{ h.itemName }}</h2>
        <p class="b-hero__when">{{ h.rangeLabel }} · {{ h.timezoneLabel }}</p>
        <p class="b-hero__where">{{ h.locationName }} · with {{ h.ownerName }}</p>
        @if (path(h); as p) {
          <p class="b-hero__place"><span class="b-place-label">Typical Placement</span> {{ p }}</p>
        }
        <div class="b-actions">
          <button type="button" class="b-btn b-btn--primary" (click)="select(h)">
            Trip details
          </button>
          @if (h.status === 'accepted' && h.tab === 'upcoming' && !h.needsResponse) {
            <button type="button" class="b-btn" (click)="cancel.emit(h)">Cancel Reservation</button>
          }
        </div>
      </section>
    }

    <nav class="b-tabs" aria-label="Reservation tabs">
      @for (t of tabs; track t.id) {
        <button
          type="button"
          class="b-tab"
          [class.b-tab--on]="tab() === t.id"
          (click)="tab.set(t.id)"
        >
          {{ t.label }}
          <span class="b-tab__count">{{ counts()[t.id] }}</span>
        </button>
      }
    </nav>

    @if (visible().length === 0) {
      <p class="b-empty">
        @switch (tab()) {
          @case ('upcoming') {
            No upcoming trips.
          }
          @case ('pending') {
            No pending Reservation Requests.
          }
          @default {
            No past Reservations.
          }
        }
      </p>
    } @else {
      <ul class="b-list">
        @for (r of visible(); track r.id) {
          <li>
            <article class="b-card" [class.b-card--selected]="selectedId() === r.id">
              <button type="button" class="b-card__main" (click)="select(r)">
                <div class="b-card__top">
                  <strong>{{ r.itemName }}</strong>
                  <span class="b-avatar" aria-hidden="true">{{ r.ownerInitials }}</span>
                </div>
                <p class="b-card__meta">{{ r.ownerName }} · {{ r.locationName }}</p>
                <p class="b-card__when">{{ r.rangeLabel }}</p>
                <p class="b-status">{{ r.statusLabel }}</p>
                @if (path(r); as p) {
                  <p class="b-place">{{ p }}</p>
                }
                @if (r.proposal?.from === 'me') {
                  <p class="b-muted">Waiting on {{ r.ownerName }} · proposed {{ r.proposal?.proposedRangeLabel }}</p>
                }
                @if (r.conflictNote) {
                  <p class="b-warn">{{ r.conflictNote }}</p>
                }
              </button>
              <div class="b-card__actions">
                @if (r.status === 'pending' && !r.proposal) {
                  <button type="button" class="b-btn" (click)="withdraw.emit(r)">Withdraw</button>
                }
                @if (r.proposal?.from === 'me') {
                  <button type="button" class="b-btn" (click)="withdrawProposal.emit(r)">
                    Withdraw proposal
                  </button>
                }
                @if (r.status === 'accepted' && r.tab === 'upcoming' && !r.needsResponse) {
                  <button type="button" class="b-btn" (click)="cancel.emit(r)">Cancel</button>
                }
              </div>
            </article>
          </li>
        }
      </ul>
    }

    @if (selected(); as s) {
      <aside class="b-detail" aria-label="Trip detail">
        <header class="b-detail__head">
          <div>
            <p class="b-kicker">Trip detail</p>
            <h2>{{ s.itemName }}</h2>
          </div>
          <button type="button" class="b-btn" (click)="selectedId.set(null)">Close</button>
        </header>
        <dl class="b-dl">
          <div>
            <dt>Owner</dt>
            <dd>{{ s.ownerName }}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{{ s.statusLabel }}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{{ s.rangeLabel }} ({{ s.timezoneLabel }})</dd>
          </div>
          <div>
            <dt>Typical Location</dt>
            <dd>{{ s.locationName }}</dd>
          </div>
          @if (path(s); as p) {
            <div>
              <dt>Typical Placement</dt>
              <dd>{{ p }}</dd>
            </div>
          }
        </dl>
        @if (s.placement.kind === 'structured') {
          <app-prototype-quiet-placement-diagram [placement]="s.placement" />
        }
        @if (s.tab !== 'past' && !s.needsResponse) {
          <form class="b-propose" (submit)="$event.preventDefault(); openDetail.emit(s)">
            <p class="b-muted">Propose change (fixture form — no network)</p>
            <label>
              Proposed start
              <input type="datetime-local" [value]="s.startLocalLabel" disabled />
            </label>
            <label>
              Proposed end
              <input type="datetime-local" disabled />
            </label>
            <button type="submit" class="b-btn b-btn--primary">Propose change</button>
          </form>
        }
      </aside>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }
    .b-kicker {
      margin: 0;
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted-foreground);
    }
    .b-lede,
    .b-muted {
      color: var(--muted-foreground);
    }
    .b-lede {
      margin: var(--space-1) 0 0;
    }
    .b-needs {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      border-radius: var(--radius-md);
      border: var(--border-width) solid color-mix(in oklch, var(--warning) 50%, var(--border));
      background: color-mix(in oklch, var(--warning) 14%, var(--card));
    }
    .b-needs__title {
      margin: 0;
      font-size: 1rem;
    }
    .b-needs__card {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--space-3);
      background: var(--card);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--border);
    }
    .b-strike {
      text-decoration: line-through;
      color: var(--muted-foreground);
    }
    .b-hero {
      padding: var(--space-6);
      border-radius: var(--radius-md);
      background: linear-gradient(
        145deg,
        color-mix(in oklch, var(--primary) 18%, var(--card)),
        var(--card)
      );
      border: var(--border-width) solid var(--border);
      display: grid;
      gap: var(--space-2);
    }
    .b-hero__label {
      margin: 0;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted-foreground);
    }
    .b-hero__title {
      margin: 0;
      font-size: 1.75rem;
    }
    .b-hero__when {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .b-hero__where,
    .b-hero__place {
      margin: 0;
    }
    .b-place-label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted-foreground);
      margin-bottom: var(--space-1);
    }
    .b-tabs {
      display: flex;
      gap: var(--space-1);
      border-bottom: var(--border-width) solid var(--border);
    }
    .b-tab {
      border: none;
      background: none;
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      color: var(--muted-foreground);
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    .b-tab--on {
      color: var(--foreground);
      border-bottom-color: var(--primary);
      font-weight: 600;
    }
    .b-tab__count {
      margin-left: var(--space-1);
      font-size: 0.8rem;
      opacity: 0.7;
    }
    .b-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--space-3);
    }
    .b-card {
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card);
      overflow: hidden;
    }
    .b-card--selected {
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary);
    }
    .b-card__main {
      display: grid;
      gap: var(--space-1);
      width: 100%;
      text-align: left;
      border: none;
      background: none;
      color: inherit;
      padding: var(--space-4);
      cursor: pointer;
    }
    .b-card__top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
    }
    .b-avatar {
      width: 2rem;
      height: 2rem;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: var(--secondary);
      font-size: 0.7rem;
      font-weight: 700;
    }
    .b-card__meta,
    .b-card__when,
    .b-status,
    .b-place {
      margin: 0;
    }
    .b-card__when {
      font-weight: 600;
    }
    .b-status {
      font-size: 0.85rem;
      color: var(--muted-foreground);
    }
    .b-place {
      font-size: 0.9rem;
      padding: var(--space-2);
      background: var(--muted);
      border-radius: var(--radius-sm);
    }
    .b-warn {
      margin: 0;
      font-size: 0.8rem;
      color: var(--destructive-text);
    }
    .b-card__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: 0 var(--space-4) var(--space-4);
    }
    .b-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
    .b-btn {
      border: var(--border-width) solid var(--border);
      background: var(--secondary);
      color: var(--secondary-foreground);
      border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
    }
    .b-btn--primary {
      background: var(--primary);
      color: var(--primary-foreground);
      border-color: var(--primary);
    }
    .b-empty {
      color: var(--muted-foreground);
    }
    .b-detail {
      position: sticky;
      bottom: 5rem;
      padding: var(--space-4);
      border-radius: var(--radius-md);
      border: var(--border-width) solid var(--border);
      background: var(--card);
      display: grid;
      gap: var(--space-3);
      box-shadow: 0 8px 32px var(--shadow-color);
    }
    .b-detail__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-3);
    }
    .b-detail__head h2 {
      margin: var(--space-1) 0 0;
    }
    .b-dl {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }
    .b-dl div {
      display: grid;
      gap: 0.15rem;
    }
    .b-dl dt {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted-foreground);
    }
    .b-dl dd {
      margin: 0;
    }
    .b-propose {
      display: grid;
      gap: var(--space-2);
      padding-top: var(--space-3);
      border-top: var(--border-width) solid var(--border);
    }
    .b-propose label {
      display: grid;
      gap: var(--space-1);
      font-size: 0.85rem;
    }
    .b-propose input {
      padding: var(--space-2);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--input);
      background: var(--muted);
    }
  `,
})
export class PrototypeVariantBTripCards {
  readonly reservations = input.required<readonly PrototypeReservation[]>();
  readonly approve = output<PrototypeReservation>();
  readonly reject = output<PrototypeReservation>();
  readonly withdraw = output<PrototypeReservation>();
  readonly cancel = output<PrototypeReservation>();
  readonly withdrawProposal = output<PrototypeReservation>();
  readonly openDetail = output<PrototypeReservation>();

  readonly tab = signal<PrototypeTab>('upcoming');
  readonly selectedId = signal<string | null>(null);

  readonly tabs = [
    { id: 'upcoming' as const, label: 'Upcoming' },
    { id: 'pending' as const, label: 'Pending' },
    { id: 'past' as const, label: 'Past' },
  ];

  readonly counts = computed(() => countByTab(this.reservations()));
  readonly needsResponse = computed(() => this.reservations().filter((r) => r.needsResponse));
  readonly visible = computed(() => this.reservations().filter((r) => r.tab === this.tab()));
  readonly hero = computed(() => {
    const upcoming = this.reservations().filter((r) => r.tab === 'upcoming' && !r.needsResponse);
    return upcoming[0] ?? this.reservations().find((r) => r.tab === 'upcoming') ?? null;
  });
  readonly selected = computed(
    () => this.reservations().find((r) => r.id === this.selectedId()) ?? null,
  );

  path(r: PrototypeReservation): string | null {
    return placementTextPath(r.placement);
  }

  select(r: PrototypeReservation): void {
    this.selectedId.set(r.id);
    this.openDetail.emit(r);
  }
}
