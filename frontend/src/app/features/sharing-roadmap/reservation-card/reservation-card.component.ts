import { Component, input, output } from '@angular/core';
import { ObserveVisible } from '../../../core/dom/observe-visible';
import { Reservation, ReservationChangeProposal } from '../../../core/api/model';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import {
  formatLocationLocalRange,
  typicalPlacementLabel,
  visibleStructuredPlacement,
} from '../functions';
import { PlacementSnapshotDiagram } from '../placement-snapshot/placement-snapshot-diagram';

export type ReservationActionMode = 'requester' | 'owner';

@Component({
  selector: 'app-reservation-card',
  imports: [PlacementSnapshotDiagram, UserAvatar],
  host: {
    '[attr.data-reservation-id]': 'reservation().id',
  },
  hostDirectives: [
    {
      directive: ObserveVisible,
      inputs: ['app-observe-visible'],
      outputs: ['visible: cardVisible'],
    },
  ],
  templateUrl: './reservation-card.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class ReservationCardComponent {
  readonly reservation = input.required<Reservation>();
  readonly personName = input.required<string>();
  readonly personPhotoUrl = input<string | null>(null);
  readonly mode = input.required<ReservationActionMode>();
  readonly pendingProposalFromOther = input<ReservationChangeProposal | null>(null);
  readonly pendingProposalByMe = input<ReservationChangeProposal | null>(null);
  readonly canPrimaryAct = input(false);
  readonly canCancelOrPropose = input(false);

  readonly accept = output<Reservation>();
  readonly decline = output<Reservation>();
  readonly withdraw = output<Reservation>();
  readonly cancel = output<Reservation>();
  readonly propose = output<{ reservation: Reservation; startLocal: string; endLocal: string }>();
  readonly approveProposal = output<ReservationChangeProposal>();
  readonly rejectProposal = output<ReservationChangeProposal>();
  readonly withdrawProposal = output<ReservationChangeProposal>();

  placementLabel = typicalPlacementLabel;
  placementStructured = visibleStructuredPlacement;

  range(reservation: Reservation): string {
    return formatLocationLocalRange(
      reservation.startLocal,
      reservation.endLocal,
      reservation.timezone,
    );
  }

  submitProposal(reservation: Reservation, startLocal: string, endLocal: string): void {
    this.propose.emit({ reservation, startLocal, endLocal });
  }
}
