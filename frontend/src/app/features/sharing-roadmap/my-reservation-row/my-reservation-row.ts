import { Component, input, output } from '@angular/core';
import { ObserveVisible } from '../../../core/dom/observe-visible';
import { Reservation, ReservationChangeProposal } from '../../../core/api/model';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';

/**
 * My reservations list row — host for scroll targeting and intersection mark-read.
 * Not a redesign onto app-reservation-card; keeps the table-row layout.
 */
@Component({
  selector: 'div[app-my-reservation-row]',
  imports: [UserAvatar],
  host: {
    role: 'row',
    class: 'my-res__row',
    '[class.my-res__row--alert]': 'needsResponse()',
    '[attr.data-reservation-id]': 'reservation().id',
  },
  hostDirectives: [
    {
      directive: ObserveVisible,
      inputs: ['app-observe-visible'],
      outputs: ['visible: rowVisible'],
    },
  ],
  templateUrl: './my-reservation-row.html',
  styleUrl: './my-reservation-row.css',
})
export class MyReservationRow {
  readonly reservation = input.required<Reservation>();
  readonly ownerName = input.required<string>();
  readonly ownerPhotoUrl = input<string | null>(null);
  readonly rangeLabel = input.required<string>();
  readonly statusLabel = input.required<string>();
  readonly locationName = input.required<string>();
  readonly listPlacementPath = input<string | null>(null);
  readonly ownerProposal = input<ReservationChangeProposal | null>(null);
  readonly myProposal = input<ReservationChangeProposal | null>(null);
  readonly ownerProposalRangeLabel = input<string | null>(null);
  readonly myProposalRangeLabel = input<string | null>(null);
  readonly needsResponse = input(false);
  readonly actionBusy = input(false);
  readonly canWithdraw = input(false);
  readonly canCancel = input(false);
  readonly showConflict = input(false);

  readonly openDetail = output<Reservation>();
  readonly withdraw = output<Reservation>();
  readonly cancel = output<Reservation>();
  readonly approveProposal = output<ReservationChangeProposal>();
  readonly rejectProposal = output<ReservationChangeProposal>();
  readonly withdrawProposal = output<ReservationChangeProposal>();
}
