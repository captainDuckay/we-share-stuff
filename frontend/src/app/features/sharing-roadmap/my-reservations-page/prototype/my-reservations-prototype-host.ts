import { JsonPipe } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { PageLayout } from '../../../../layout/page-layout/page-layout';
import {
  PrototypeFixtures,
  PrototypeReservation,
  PrototypeScenarioId,
  createFixtures,
} from './fixtures';
import {
  MyReservationsPrototypeSwitcher,
  PrototypeVariantKey,
} from './prototype-switcher';
import { PrototypeVariantADenseBoard } from './variant-a-dense-board';
import { PrototypeVariantBTripCards } from './variant-b-trip-cards';
import { PrototypeVariantCInbox } from './variant-c-inbox';

/**
 * PROTOTYPE host for My reservations UI variants (#22).
 * Question: what should the overhauled page look and feel like at low fidelity?
 * Three variants via ?variant=A|B|C — fixture data only.
 *
 * Preferred (review): A dense list + B-style popup detail + production placement diagram.
 */
@Component({
  selector: 'app-my-reservations-prototype-host',
  imports: [
    JsonPipe,
    PageLayout,
    MyReservationsPrototypeSwitcher,
    PrototypeVariantADenseBoard,
    PrototypeVariantBTripCards,
    PrototypeVariantCInbox,
  ],
  template: `
    <app-page-layout
      pageTitle="My reservations"
      description="PROTOTYPE — throwaway UI variants (#22). Fixture data only; not production."
    >
      <div class="proto-host">
        <div class="proto-host__controls">
          <label>
            Scenario
            <select
              [value]="scenarioId()"
              (change)="onScenario(($any($event.target)).value)"
            >
              <option value="full">Full sample states</option>
              <option value="empty-upcoming">Empty Upcoming tab</option>
              <option value="zero-trips">Groups, zero trips</option>
              <option value="no-groups">No Sharing Groups</option>
            </select>
          </label>
          <p class="proto-host__state" role="status">
            Variant <strong>{{ variant() }}</strong> · scenario
            <strong>{{ scenarioId() }}</strong> ·
            {{ reservations().length }} fixtures · last action:
            <strong>{{ lastAction() }}</strong>
          </p>
        </div>

        @if (!fixtures().hasSharingGroups) {
          <div class="proto-host__empty">
            <p>You’re not in any Sharing Groups yet.</p>
            <p class="proto-host__muted">
              Borrowing starts when someone shares Items with you in a Sharing Group.
            </p>
            <button type="button" class="proto-host__btn" disabled>Browse Sharing Groups</button>
          </div>
        } @else if (reservations().length === 0) {
          <div class="proto-host__empty">
            <p>No borrow trips yet.</p>
            <p class="proto-host__muted">
              Find something shared with you and request a time.
            </p>
            <button type="button" class="proto-host__btn" disabled>Browse shared items</button>
          </div>
        } @else {
          @switch (variant()) {
            @case ('A') {
              <app-prototype-variant-a-dense-board
                [reservations]="reservations()"
                (approve)="onApprove($event)"
                (reject)="onReject($event)"
                (withdraw)="onWithdraw($event)"
                (cancel)="onCancel($event)"
                (withdrawProposal)="onWithdrawProposal($event)"
                (openDetail)="onOpenDetail($event)"
              />
            }
            @case ('B') {
              <app-prototype-variant-b-trip-cards
                [reservations]="reservations()"
                (approve)="onApprove($event)"
                (reject)="onReject($event)"
                (withdraw)="onWithdraw($event)"
                (cancel)="onCancel($event)"
                (withdrawProposal)="onWithdrawProposal($event)"
                (openDetail)="onOpenDetail($event)"
              />
            }
            @case ('C') {
              <app-prototype-variant-c-inbox
                [reservations]="reservations()"
                (approve)="onApprove($event)"
                (reject)="onReject($event)"
                (withdraw)="onWithdraw($event)"
                (cancel)="onCancel($event)"
                (withdrawProposal)="onWithdrawProposal($event)"
                (openDetail)="onOpenDetail($event)"
              />
            }
          }
        }

        <details class="proto-host__dump">
          <summary>Surface full fixture state (prototype debug)</summary>
          <pre>{{ dump() | json }}</pre>
        </details>
      </div>
    </app-page-layout>

    <app-my-reservations-prototype-switcher
      [current]="variant()"
      (variantChange)="variantChange.emit($event)"
      (exit)="exit.emit()"
    />
  `,
  styles: `
    .proto-host {
      display: grid;
      gap: var(--space-5);
      padding-bottom: 6rem;
    }
    .proto-host__controls {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-3);
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
      background: color-mix(in oklch, var(--warning) 10%, var(--card));
    }
    .proto-host__controls label {
      display: grid;
      gap: var(--space-1);
      font-size: 0.85rem;
      max-width: 16rem;
    }
    .proto-host__controls select {
      padding: var(--space-2);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--input);
      background: var(--card);
      color: inherit;
    }
    .proto-host__state {
      margin: 0;
      font-size: 0.85rem;
    }
    .proto-host__empty {
      padding: var(--space-6);
      border-radius: var(--radius-md);
      border: var(--border-width) solid var(--border);
      background: var(--card);
      display: grid;
      gap: var(--space-2);
    }
    .proto-host__empty p {
      margin: 0;
    }
    .proto-host__muted {
      color: var(--muted-foreground);
    }
    .proto-host__btn {
      justify-self: start;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--border);
      background: var(--secondary);
      color: var(--secondary-foreground);
    }
    .proto-host__dump {
      font-size: 0.75rem;
      color: var(--muted-foreground);
    }
    .proto-host__dump pre {
      overflow: auto;
      max-height: 16rem;
      padding: var(--space-3);
      background: var(--muted);
      border-radius: var(--radius-sm);
    }
  `,
})
export class MyReservationsPrototypeHost {
  readonly variant = input.required<PrototypeVariantKey>();
  readonly variantChange = output<PrototypeVariantKey>();
  readonly exit = output<void>();

  readonly scenarioId = signal<PrototypeScenarioId>('full');
  readonly fixtures = signal<PrototypeFixtures>(createFixtures('full'));
  readonly lastAction = signal('none');

  readonly reservations = computed(() => this.fixtures().reservations);
  readonly dump = computed(() => ({
    variant: this.variant(),
    scenarioId: this.scenarioId(),
    hasSharingGroups: this.fixtures().hasSharingGroups,
    reservations: this.reservations(),
    lastAction: this.lastAction(),
  }));

  constructor() {
    effect(() => {
      // Re-surface state whenever the variant key changes (skill: surface state on switch).
      const v = this.variant();
      this.lastAction.set(`switched to variant ${v}`);
    });
  }

  onScenario(value: string): void {
    const id = value as PrototypeScenarioId;
    this.scenarioId.set(id);
    this.fixtures.set(createFixtures(id));
    this.lastAction.set(`scenario → ${id}`);
  }

  onApprove(r: PrototypeReservation): void {
    this.patch(r.id, (row) => ({
      ...row,
      needsResponse: false,
      proposal: null,
      statusLabel: 'Accepted — upcoming',
      rangeLabel: row.proposal?.proposedRangeLabel ?? row.rangeLabel,
    }));
    this.lastAction.set(`accepted change on ${r.id}`);
  }

  onReject(r: PrototypeReservation): void {
    this.patch(r.id, (row) => ({
      ...row,
      needsResponse: false,
      proposal: null,
      statusLabel: 'Accepted — upcoming',
    }));
    this.lastAction.set(`rejected change on ${r.id}`);
  }

  onWithdraw(r: PrototypeReservation): void {
    this.remove(r.id);
    this.lastAction.set(`withdrew ${r.id}`);
  }

  onCancel(r: PrototypeReservation): void {
    this.patch(r.id, (row) => ({
      ...row,
      status: 'cancelled',
      statusLabel: 'Cancelled',
      tab: 'past',
      placement: { kind: 'hidden' },
      needsResponse: false,
      proposal: null,
    }));
    this.lastAction.set(`cancelled ${r.id}`);
  }

  onWithdrawProposal(r: PrototypeReservation): void {
    this.patch(r.id, (row) => ({
      ...row,
      proposal: null,
      statusLabel: row.status === 'pending' ? 'Pending — waiting on owner' : row.statusLabel,
    }));
    this.lastAction.set(`withdrew proposal on ${r.id}`);
  }

  onOpenDetail(r: PrototypeReservation): void {
    this.lastAction.set(`opened detail ${r.id}`);
  }

  private patch(
    id: string,
    fn: (row: PrototypeReservation) => PrototypeReservation,
  ): void {
    this.fixtures.update((f) => ({
      ...f,
      reservations: f.reservations.map((r) => (r.id === id ? fn(r) : r)),
    }));
  }

  private remove(id: string): void {
    this.fixtures.update((f) => ({
      ...f,
      reservations: f.reservations.filter((r) => r.id !== id),
    }));
  }
}
