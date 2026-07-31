import { Component, computed, input, output, signal } from '@angular/core';
import { PlacementSnapshotDiagram } from '../../placement-snapshot/placement-snapshot-diagram';
import {
  PrototypeReservation,
  PrototypeTab,
  countByTab,
  placementTextPath,
  toStructuredSnapshot,
} from './fixtures';

/**
 * PROTOTYPE Variant A — Dense status board (+ preferred hybrid: B-style popup detail,
 * production placement diagram). Preferred visual direction from review of #22.
 */
@Component({
  selector: 'app-prototype-variant-a-dense-board',
  imports: [PlacementSnapshotDiagram],
  template: `
    <header class="a-header">
      <p class="a-kicker">Variant A — Dense status board (preferred hybrid)</p>
      <p class="a-lede">
        Compact rows for scanning. Trip detail opens as a popup. Structured Typical Placement uses
        the production diagram (pan/zoom/fit).
      </p>
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
              <button type="button" class="a-item-btn" (click)="open(r)">
                <strong>{{ r.itemName }}</strong>
              </button>
              <div class="a-muted">{{ r.locationName }} · {{ r.timezoneLabel }}</div>
              @if (path(r); as p) {
                <div class="a-place">{{ p }}</div>
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
                <button type="button" class="a-btn" (click)="open(r)">Change dates…</button>
              } @else if (r.status === 'accepted' && r.tab === 'upcoming') {
                <button type="button" class="a-btn" (click)="cancel.emit(r)">Cancel</button>
                <button type="button" class="a-btn" (click)="open(r)">Trip detail</button>
              } @else {
                <button type="button" class="a-linkish" (click)="open(r)">View</button>
              }
            </div>
          </div>
        }
      </div>
    }

    @if (selected(); as s) {
      <div class="a-modal-root" role="presentation">
        <button type="button" class="a-modal-backdrop" aria-label="Close trip detail" (click)="close()"></button>
        <aside
          class="a-modal"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="dialogTitleId"
        >
          <header class="a-modal__head">
            <div>
              <p class="a-kicker">Trip detail</p>
              <h2 [id]="dialogTitleId">{{ s.itemName }}</h2>
            </div>
            <button type="button" class="a-btn" (click)="close()">Close</button>
          </header>

          <dl class="a-dl">
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

          @if (structured(s); as snapshot) {
            <div class="a-modal__diagram">
              <app-placement-snapshot-diagram [snapshot]="snapshot" />
            </div>
          }

          @if (s.needsResponse && s.proposal?.from === 'owner') {
            <div class="a-modal__proposal">
              <p>
                Current: <span class="a-strike">{{ s.rangeLabel }}</span>
              </p>
              <p>
                Proposed: <strong>{{ s.proposal?.proposedRangeLabel }}</strong>
              </p>
              <div class="a-actions">
                <button type="button" class="a-btn a-btn--primary" (click)="approve.emit(s); close()">
                  Accept change
                </button>
                <button type="button" class="a-btn" (click)="reject.emit(s); close()">
                  Reject change
                </button>
              </div>
            </div>
          }

          @if (s.tab !== 'past' && !s.needsResponse) {
            <form class="a-propose" (submit)="$event.preventDefault(); openDetail.emit(s)">
              <p class="a-muted">Propose change (fixture form — no network)</p>
              <label>
                Proposed start
                <input type="datetime-local" disabled />
              </label>
              <label>
                Proposed end
                <input type="datetime-local" disabled />
              </label>
              <button type="submit" class="a-btn a-btn--primary">Propose change</button>
            </form>
          }

          @if (s.status === 'pending' && !s.proposal) {
            <button type="button" class="a-btn" (click)="withdraw.emit(s); close()">Withdraw</button>
          }
          @if (s.status === 'accepted' && s.tab === 'upcoming' && !s.needsResponse) {
            <button type="button" class="a-btn" (click)="cancel.emit(s); close()">
              Cancel Reservation
            </button>
          }
          @if (s.proposal?.from === 'me') {
            <button type="button" class="a-btn" (click)="withdrawProposal.emit(s); close()">
              Withdraw proposal
            </button>
          }
        </aside>
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
    .a-item-btn {
      border: none;
      background: none;
      padding: 0;
      color: inherit;
      cursor: pointer;
      text-align: left;
    }
    .a-item-btn:hover strong {
      text-decoration: underline;
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
    .a-modal-root {
      position: fixed;
      inset: 0;
      z-index: 900;
      display: grid;
      place-items: center;
      padding: var(--space-4);
    }
    .a-modal-backdrop {
      position: absolute;
      inset: 0;
      border: none;
      background: oklch(0% 0 0 / 45%);
      cursor: pointer;
    }
    .a-modal {
      position: relative;
      z-index: 1;
      width: min(36rem, 100%);
      max-height: min(90vh, 48rem);
      overflow: auto;
      padding: var(--space-4);
      border-radius: var(--radius-md);
      border: var(--border-width) solid var(--border);
      background: var(--card);
      color: var(--card-foreground);
      display: grid;
      gap: var(--space-3);
      box-shadow: 0 16px 48px var(--shadow-color);
    }
    .a-modal__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-3);
    }
    .a-modal__head h2 {
      margin: var(--space-1) 0 0;
      font-size: 1.25rem;
    }
    .a-dl {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }
    .a-dl div {
      display: grid;
      gap: 0.15rem;
    }
    .a-dl dt {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted-foreground);
    }
    .a-dl dd {
      margin: 0;
    }
    .a-modal__diagram {
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .a-modal__proposal {
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background: color-mix(in oklch, var(--warning) 14%, var(--card));
      border: var(--border-width) solid color-mix(in oklch, var(--warning) 40%, var(--border));
      display: grid;
      gap: var(--space-2);
    }
    .a-modal__proposal p {
      margin: 0;
    }
    .a-strike {
      text-decoration: line-through;
      color: var(--muted-foreground);
    }
    .a-propose {
      display: grid;
      gap: var(--space-2);
      padding-top: var(--space-3);
      border-top: var(--border-width) solid var(--border);
    }
    .a-propose label {
      display: grid;
      gap: var(--space-1);
      font-size: 0.85rem;
    }
    .a-propose input {
      padding: var(--space-2);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--input);
      background: var(--muted);
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
  readonly selectedId = signal<string | null>(null);
  readonly dialogTitleId = 'proto-a-trip-detail-title';

  readonly tabs = [
    { id: 'upcoming' as const, label: 'Upcoming' },
    { id: 'pending' as const, label: 'Pending' },
    { id: 'past' as const, label: 'Past' },
  ];

  readonly counts = computed(() => countByTab(this.reservations()));
  readonly needsResponse = computed(() => this.reservations().filter((r) => r.needsResponse));
  readonly visible = computed(() => this.reservations().filter((r) => r.tab === this.tab()));
  readonly selected = computed(
    () => this.reservations().find((r) => r.id === this.selectedId()) ?? null,
  );

  path(r: PrototypeReservation): string | null {
    return placementTextPath(r.placement);
  }

  structured(r: PrototypeReservation) {
    return toStructuredSnapshot(r.placement);
  }

  open(r: PrototypeReservation): void {
    this.selectedId.set(r.id);
    this.openDetail.emit(r);
  }

  close(): void {
    this.selectedId.set(null);
  }
}
