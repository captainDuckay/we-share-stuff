import { Component, computed, input, output, signal } from '@angular/core';
import {
  PrototypeReservation,
  PrototypeTab,
  countByTab,
  placementTextPath,
} from './fixtures';

/**
 * PROTOTYPE Variant A — Dense status board
 * Tabs first, compact rows, placement secondary after accept.
 */
@Component({
  selector: 'app-prototype-variant-a-dense-board',
  template: `
    <header class="a-header">
      <p class="a-kicker">Variant A — Dense status board</p>
      <p class="a-lede">Compact rows. Status and time first. Placement is a quiet secondary line.</p>
    </header>

    @if (needsResponse().length) {
      <div class="a-strip" role="status">
        <strong>{{ needsResponse().length }} need your response</strong>
        <span class="a-muted">Owner proposed new dates</span>
      </div>
    }

    <nav class="a-tabs" aria-label="Reservation tabs">
      @for (t of tabs; track t.id) {
        <button
          type="button"
          class="a-tab"
          [class.a-tab--on]="tab() === t.id"
          (click)="tab.set(t.id)"
        >
          {{ t.label }} ({{ counts()[t.id] }})
        </button>
      }
    </nav>

    @if (visible().length === 0) {
      <p class="a-empty">No Reservations in this tab.</p>
    } @else {
      <div class="a-table" role="table" aria-label="Reservations">
        <div class="a-row a-row--head" role="row">
          <span role="columnheader">Item</span>
          <span role="columnheader">Owner</span>
          <span role="columnheader">When</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Actions</span>
        </div>
        @for (r of visible(); track r.id) {
          <div class="a-row" role="row" [class.a-row--alert]="r.needsResponse">
            <div role="cell">
              <strong>{{ r.itemName }}</strong>
              <div class="a-muted">{{ r.locationName }} · {{ r.timezoneLabel }}</div>
              @if (path(r); as p) {
                <div class="a-place">{{ p }}</div>
              }
              @if (expanded() === r.id && r.placement.kind === 'structured') {
                <button type="button" class="a-linkish" (click)="openDetail.emit(r)">
                  Open trip detail (map)
                </button>
              }
            </div>
            <div role="cell">{{ r.ownerName }}</div>
            <div role="cell">
              <div>{{ r.rangeLabel }}</div>
              @if (r.proposal; as prop) {
                <div class="a-prop">
                  Proposed: {{ prop.proposedRangeLabel }}
                  <span class="a-muted">({{ prop.from === 'owner' ? 'from owner' : 'by you' }})</span>
                </div>
              }
            </div>
            <div role="cell">
              <span class="a-pill" [class.a-pill--alert]="r.needsResponse">{{ r.statusLabel }}</span>
              @if (r.conflictNote) {
                <div class="a-warn">{{ r.conflictNote }}</div>
              }
            </div>
            <div class="a-actions" role="cell">
              @if (r.needsResponse && r.proposal?.from === 'owner') {
                <button type="button" class="a-btn a-btn--primary" (click)="approve.emit(r)">
                  Accept change
                </button>
                <button type="button" class="a-btn" (click)="reject.emit(r)">Reject</button>
              } @else if (r.proposal?.from === 'me') {
                <button type="button" class="a-btn" (click)="withdrawProposal.emit(r)">
                  Withdraw proposal
                </button>
              } @else if (r.status === 'pending') {
                <button type="button" class="a-btn" (click)="withdraw.emit(r)">Withdraw</button>
                <button type="button" class="a-btn" (click)="openDetail.emit(r)">Change dates…</button>
              } @else if (r.status === 'accepted' && r.tab === 'upcoming') {
                <button type="button" class="a-btn" (click)="cancel.emit(r)">Cancel</button>
                <button type="button" class="a-btn" (click)="openDetail.emit(r)">Change dates…</button>
              } @else {
                <span class="a-muted">—</span>
              }
              <button type="button" class="a-linkish" (click)="toggle(r.id)">
                {{ expanded() === r.id ? 'Less' : 'More' }}
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
    }
    .a-kicker {
      margin: 0;
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted-foreground);
    }
    .a-lede {
      margin: var(--space-1) 0 0;
      color: var(--muted-foreground);
    }
    .a-header {
      margin: 0;
    }
    .a-strip {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: baseline;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: color-mix(in oklch, var(--warning) 22%, var(--card));
      border: var(--border-width) solid color-mix(in oklch, var(--warning) 45%, var(--border));
    }
    .a-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .a-tab {
      border: var(--border-width) solid var(--border);
      background: var(--card);
      color: var(--foreground);
      border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
    }
    .a-tab--on {
      background: var(--primary);
      color: var(--primary-foreground);
      border-color: var(--primary);
    }
    .a-table {
      border: var(--border-width) solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--card);
    }
    .a-row {
      display: grid;
      grid-template-columns: 1.4fr 0.8fr 1.2fr 1.2fr 1fr;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-top: var(--border-width) solid var(--border);
      font-size: 0.9rem;
      align-items: start;
    }
    .a-row--head {
      border-top: none;
      background: var(--muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--muted-foreground);
    }
    .a-row--alert {
      background: color-mix(in oklch, var(--warning) 8%, var(--card));
    }
    .a-muted {
      color: var(--muted-foreground);
      font-size: 0.8rem;
    }
    .a-place {
      margin-top: var(--space-1);
      font-size: 0.8rem;
      color: var(--foreground);
    }
    .a-prop {
      margin-top: var(--space-1);
      font-size: 0.8rem;
      color: var(--accent-foreground);
    }
    .a-pill {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 999px;
      background: var(--muted);
      font-size: 0.75rem;
    }
    .a-pill--alert {
      background: color-mix(in oklch, var(--warning) 40%, var(--muted));
    }
    .a-warn {
      margin-top: var(--space-1);
      font-size: 0.75rem;
      color: var(--destructive-text);
    }
    .a-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
    .a-btn {
      border: var(--border-width) solid var(--border);
      background: var(--secondary);
      color: var(--secondary-foreground);
      border-radius: var(--radius-sm);
      padding: var(--space-1) var(--space-2);
      font-size: 0.8rem;
      cursor: pointer;
    }
    .a-btn--primary {
      background: var(--primary);
      color: var(--primary-foreground);
      border-color: var(--primary);
    }
    .a-linkish {
      border: none;
      background: none;
      color: var(--primary);
      text-decoration: underline;
      cursor: pointer;
      font-size: 0.8rem;
      padding: 0;
    }
    .a-empty {
      color: var(--muted-foreground);
    }
    @media (max-width: 50rem) {
      .a-row {
        grid-template-columns: 1fr;
      }
      .a-row--head {
        display: none;
      }
    }
  `,
})
export class PrototypeVariantADenseBoard {
  readonly reservations = input.required<readonly PrototypeReservation[]>();
  readonly approve = output<PrototypeReservation>();
  readonly reject = output<PrototypeReservation>();
  readonly withdraw = output<PrototypeReservation>();
  readonly cancel = output<PrototypeReservation>();
  readonly withdrawProposal = output<PrototypeReservation>();
  readonly openDetail = output<PrototypeReservation>();

  readonly tab = signal<PrototypeTab>('upcoming');
  readonly expanded = signal<string | null>(null);

  readonly tabs = [
    { id: 'upcoming' as const, label: 'Upcoming' },
    { id: 'pending' as const, label: 'Pending' },
    { id: 'past' as const, label: 'Past' },
  ];

  readonly counts = computed(() => countByTab(this.reservations()));
  readonly needsResponse = computed(() => this.reservations().filter((r) => r.needsResponse));
  readonly visible = computed(() => this.reservations().filter((r) => r.tab === this.tab()));

  path(r: PrototypeReservation): string | null {
    return placementTextPath(r.placement);
  }

  toggle(id: string): void {
    this.expanded.update((cur) => (cur === id ? null : id));
  }
}
