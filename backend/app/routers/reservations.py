from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.domain import (
    accepted_reservation_conflicts,
    as_utc,
    change_proposal_response,
    freeze_placement_for_accept,
    require_group_member,
    reservation_response,
)
from app.models import (
    Item,
    ItemSharing,
    Reservation,
    ReservationChangeProposal,
    SharingGroupMember,
)
from app.problems import problem
from app.schemas import (
    ReservationChangeProposalEnvelope,
    ReservationChangeProposalInput,
    ReservationChangeProposalsEnvelope,
    ReservationEnvelope,
    ReservationRequestInput,
    ReservationsEnvelope,
)
from app.security import now_utc

router = APIRouter(prefix="/api", tags=["reservations"])
AuthenticatedMutation = Annotated[CurrentSession, Depends(require_session_csrf)]
ReservationScope = Literal["requested", "received"]
VALID_RESERVATION_STATUSES = {
    "pending",
    "accepted",
    "declined",
    "withdrawn",
    "cancelled",
}


def parse_local_datetime(value: str, field: str) -> datetime:
    if "T" not in value:
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {field: "must be a local date-time"},
        )
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as error:
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {field: "must be an ISO-8601 local date-time"},
        ) from error
    if parsed.tzinfo is not None:
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {field: "must not include a timezone offset"},
        )
    return parsed.replace(microsecond=0)


def local_to_utc(value: datetime, timezone: str, field: str) -> datetime:
    zone = ZoneInfo(timezone)
    valid_instants: set[datetime] = set()
    for fold in (0, 1):
        candidate = value.replace(tzinfo=zone, fold=fold)
        instant = candidate.astimezone(UTC)
        round_trip = instant.astimezone(zone)
        if round_trip.replace(tzinfo=None, microsecond=0) == value:
            valid_instants.add(instant)
    if not valid_instants:
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {field: "does not exist in the Typical Location timezone"},
        )
    if len(valid_instants) > 1:
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {field: "is ambiguous in the Typical Location timezone"},
        )
    return valid_instants.pop()


def requested_statuses(status_filter: str | None) -> list[str]:
    if status_filter is None:
        return []
    statuses = [status.strip() for status in status_filter.split(",") if status.strip()]
    invalid = [
        status for status in statuses if status not in VALID_RESERVATION_STATUSES
    ]
    if invalid:
        raise problem(
            400,
            "validation_failed",
            "Validation failed",
            {"status": "contains an unsupported Reservation status"},
        )
    return statuses


async def visible_reservation(
    db: DatabaseSession, reservation_id: UUID, user_id: UUID
) -> Reservation:
    reservation = await db.get(Reservation, reservation_id)
    if reservation is None:
        raise problem(404, "reservation_not_found", "Reservation was not found")
    item = await db.get(Item, reservation.item_id)
    if item is None or (
        item.owner_id != user_id and reservation.requester_id != user_id
    ):
        raise problem(404, "reservation_not_found", "Reservation was not found")
    return reservation


async def owner_reservation(
    db: DatabaseSession, reservation_id: UUID, owner_id: UUID
) -> Reservation:
    reservation = await db.get(Reservation, reservation_id)
    if reservation is None:
        raise problem(404, "reservation_not_found", "Reservation was not found")
    item = await db.get(Item, reservation.item_id)
    if item is None or item.owner_id != owner_id:
        raise problem(404, "reservation_not_found", "Reservation was not found")
    return reservation


async def void_pending_change_proposals(
    db: DatabaseSession, reservation_id: UUID
) -> None:
    proposals = await db.scalars(
        select(ReservationChangeProposal).where(
            ReservationChangeProposal.reservation_id == reservation_id,
            ReservationChangeProposal.status == "pending",
        )
    )
    for proposal in proposals:
        proposal.status = "void"
        proposal.decided_at = now_utc()


async def pending_change_proposal_exists(
    db: DatabaseSession, reservation_id: UUID
) -> bool:
    existing = await db.scalar(
        select(ReservationChangeProposal.id).where(
            ReservationChangeProposal.reservation_id == reservation_id,
            ReservationChangeProposal.status == "pending",
        )
    )
    return existing is not None


async def create_reservation_for_visible_item(
    db: DatabaseSession,
    current: AuthenticatedMutation,
    item_id: UUID,
    sharing_group_id: UUID,
    payload: ReservationRequestInput,
) -> ReservationEnvelope:
    group = await require_group_member(db, sharing_group_id, current.user.id)
    item = await db.scalar(
        select(Item)
        .join(ItemSharing, ItemSharing.item_id == Item.id)
        .options(selectinload(Item.typical_location))
        .where(ItemSharing.sharing_group_id == group.id, Item.id == item_id)
    )
    if item is None or item.typical_location is None:
        raise problem(404, "shared_item_not_found", "Shared Item was not found")
    if item.owner_id == current.user.id:
        raise problem(
            409,
            "reservation_own_item_not_allowed",
            "Cannot request a Reservation for your own Item",
        )
    start_local = parse_local_datetime(payload.start_local, "startLocal")
    end_local = parse_local_datetime(payload.end_local, "endLocal")
    timezone = item.typical_location.timezone
    start_at = local_to_utc(start_local, timezone, "startLocal")
    end_at = local_to_utc(end_local, timezone, "endLocal")
    if end_at <= start_at:
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {"endLocal": "must be after startLocal"},
        )
    if start_at <= now_utc():
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {"startLocal": "must be in the future"},
        )
    if await accepted_reservation_conflicts(db, item.id, start_at, end_at):
        raise problem(
            409,
            "reservation_conflict",
            "Reservation conflicts with an accepted Reservation",
        )
    reservation = Reservation(
        sharing_group_id=group.id,
        item_id=item.id,
        requester_id=current.user.id,
        status="pending",
        start_at=start_at,
        end_at=end_at,
        timezone=timezone,
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return ReservationEnvelope(
        reservation=await reservation_response(db, reservation, current.user.id)
    )


@router.post(
    "/shared-items/{item_id}/reservations",
    response_model=ReservationEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def request_global_reservation(
    item_id: UUID,
    payload: ReservationRequestInput,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationEnvelope:
    sharing_group_id = await db.scalar(
        select(ItemSharing.sharing_group_id)
        .join(
            SharingGroupMember,
            SharingGroupMember.sharing_group_id == ItemSharing.sharing_group_id,
        )
        .where(
            ItemSharing.item_id == item_id,
            SharingGroupMember.user_id == current.user.id,
        )
        .order_by(ItemSharing.shared_at)
    )
    if sharing_group_id is None:
        raise problem(404, "shared_item_not_found", "Shared Item was not found")
    return await create_reservation_for_visible_item(
        db, current, item_id, sharing_group_id, payload
    )


@router.post(
    "/sharing-groups/{sharing_group_id}/shared-items/{item_id}/reservations",
    response_model=ReservationEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def request_reservation(
    sharing_group_id: UUID,
    item_id: UUID,
    payload: ReservationRequestInput,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationEnvelope:
    return await create_reservation_for_visible_item(
        db, current, item_id, sharing_group_id, payload
    )


@router.get("/reservations", response_model=ReservationsEnvelope)
async def list_reservations(
    db: DatabaseSession,
    current: CurrentSessionDependency,
    scope: ReservationScope = Query(default="requested"),
    status_filter: str | None = Query(default=None, alias="status"),
) -> ReservationsEnvelope:
    statuses = requested_statuses(status_filter)
    if scope == "requested":
        query = select(Reservation).where(Reservation.requester_id == current.user.id)
    else:
        query = select(Reservation).join(Item).where(Item.owner_id == current.user.id)
    if statuses:
        query = query.where(Reservation.status.in_(statuses))
    result = await db.scalars(query.order_by(Reservation.created_at.desc()))
    return ReservationsEnvelope(
        reservations=[
            await reservation_response(db, reservation, current.user.id)
            for reservation in result
        ]
    )


@router.get("/reservations/{reservation_id}", response_model=ReservationEnvelope)
async def get_reservation(
    reservation_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
) -> ReservationEnvelope:
    reservation = await visible_reservation(db, reservation_id, current.user.id)
    return ReservationEnvelope(
        reservation=await reservation_response(db, reservation, current.user.id)
    )


@router.post(
    "/reservations/{reservation_id}/accept", response_model=ReservationEnvelope
)
async def accept_reservation(
    reservation_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationEnvelope:
    reservation = await owner_reservation(db, reservation_id, current.user.id)
    if reservation.status != "pending":
        raise problem(409, "reservation_not_pending", "Reservation is not pending")
    if await pending_change_proposal_exists(db, reservation.id):
        raise problem(
            409,
            "reservation_change_proposal_pending",
            "Reservation has a pending Change Proposal",
        )
    if await accepted_reservation_conflicts(
        db,
        reservation.item_id,
        as_utc(reservation.start_at),
        as_utc(reservation.end_at),
        reservation.id,
    ):
        raise problem(
            409,
            "reservation_conflict",
            "Reservation conflicts with an accepted Reservation",
        )
    item = await db.get(Item, reservation.item_id)
    if item is None:
        raise problem(404, "reservation_not_found", "Reservation was not found")
    # Freeze Typical Placement for the life of this Accepted Reservation.
    # Structured when Slot-linked; free-text/empty otherwise. Do not clear on cancel
    # (hide by status). Change-proposal approve must not re-snapshot.
    free_text, structured = await freeze_placement_for_accept(db, item)
    reservation.typical_placement_snapshot = free_text
    reservation.typical_placement_structured_snapshot = structured
    reservation.status = "accepted"
    reservation.decided_at = now_utc()
    await db.commit()
    await db.refresh(reservation)
    return ReservationEnvelope(
        reservation=await reservation_response(db, reservation, current.user.id)
    )


@router.post(
    "/reservations/{reservation_id}/decline", response_model=ReservationEnvelope
)
async def decline_reservation(
    reservation_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationEnvelope:
    reservation = await owner_reservation(db, reservation_id, current.user.id)
    if reservation.status != "pending":
        raise problem(409, "reservation_not_pending", "Reservation is not pending")
    reservation.status = "declined"
    reservation.decided_at = now_utc()
    await void_pending_change_proposals(db, reservation.id)
    await db.commit()
    await db.refresh(reservation)
    return ReservationEnvelope(
        reservation=await reservation_response(db, reservation, current.user.id)
    )


@router.post(
    "/reservations/{reservation_id}/withdraw", response_model=ReservationEnvelope
)
async def withdraw_reservation(
    reservation_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationEnvelope:
    reservation = await visible_reservation(db, reservation_id, current.user.id)
    if reservation.requester_id != current.user.id:
        raise problem(404, "reservation_not_found", "Reservation was not found")
    if reservation.status != "pending":
        raise problem(409, "reservation_not_pending", "Reservation is not pending")
    reservation.status = "withdrawn"
    reservation.decided_at = now_utc()
    await void_pending_change_proposals(db, reservation.id)
    await db.commit()
    await db.refresh(reservation)
    return ReservationEnvelope(
        reservation=await reservation_response(db, reservation, current.user.id)
    )


@router.post(
    "/reservations/{reservation_id}/cancel", response_model=ReservationEnvelope
)
async def cancel_reservation(
    reservation_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationEnvelope:
    reservation = await visible_reservation(db, reservation_id, current.user.id)
    if reservation.status != "accepted":
        raise problem(409, "reservation_not_accepted", "Reservation is not accepted")
    reservation.status = "cancelled"
    reservation.decided_at = now_utc()
    await void_pending_change_proposals(db, reservation.id)
    await db.commit()
    await db.refresh(reservation)
    return ReservationEnvelope(
        reservation=await reservation_response(db, reservation, current.user.id)
    )


@router.get(
    "/reservations/{reservation_id}/change-proposals",
    response_model=ReservationChangeProposalsEnvelope,
)
async def list_change_proposals(
    reservation_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
) -> ReservationChangeProposalsEnvelope:
    reservation = await visible_reservation(db, reservation_id, current.user.id)
    result = await db.scalars(
        select(ReservationChangeProposal)
        .where(ReservationChangeProposal.reservation_id == reservation.id)
        .order_by(ReservationChangeProposal.created_at.desc())
    )
    return ReservationChangeProposalsEnvelope(
        change_proposals=[
            await change_proposal_response(db, proposal, current.user.id)
            for proposal in result
        ]
    )


@router.post(
    "/reservations/{reservation_id}/change-proposals",
    response_model=ReservationChangeProposalEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def create_change_proposal(
    reservation_id: UUID,
    payload: ReservationChangeProposalInput,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationChangeProposalEnvelope:
    reservation = await visible_reservation(db, reservation_id, current.user.id)
    if reservation.status not in {"pending", "accepted"}:
        raise problem(
            409, "reservation_not_changeable", "Reservation cannot be changed"
        )
    if await pending_change_proposal_exists(db, reservation.id):
        raise problem(
            409,
            "reservation_change_proposal_pending",
            "Reservation has a pending Change Proposal",
        )
    start_local = parse_local_datetime(payload.start_local, "startLocal")
    end_local = parse_local_datetime(payload.end_local, "endLocal")
    start_at = local_to_utc(start_local, reservation.timezone, "startLocal")
    end_at = local_to_utc(end_local, reservation.timezone, "endLocal")
    if end_at <= start_at:
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {"endLocal": "must be after startLocal"},
        )
    if start_at <= now_utc():
        raise problem(
            400,
            "reservation_time_invalid",
            "Reservation time is invalid",
            {"startLocal": "must be in the future"},
        )
    if await accepted_reservation_conflicts(
        db, reservation.item_id, start_at, end_at, reservation.id
    ):
        raise problem(
            409,
            "reservation_conflict",
            "Reservation conflicts with an accepted Reservation",
        )
    proposal = ReservationChangeProposal(
        reservation_id=reservation.id,
        proposed_by_id=current.user.id,
        status="pending",
        proposed_start_at=start_at,
        proposed_end_at=end_at,
        timezone=reservation.timezone,
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return ReservationChangeProposalEnvelope(
        change_proposal=await change_proposal_response(db, proposal, current.user.id)
    )


async def visible_change_proposal(
    db: DatabaseSession, proposal_id: UUID, user_id: UUID
) -> ReservationChangeProposal:
    proposal = await db.get(ReservationChangeProposal, proposal_id)
    if proposal is None:
        raise problem(
            404,
            "change_proposal_not_found",
            "Reservation Change Proposal was not found",
        )
    await visible_reservation(db, proposal.reservation_id, user_id)
    return proposal


@router.post(
    "/reservation-change-proposals/{proposal_id}/approve",
    response_model=ReservationChangeProposalEnvelope,
)
async def approve_change_proposal(
    proposal_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationChangeProposalEnvelope:
    proposal = await visible_change_proposal(db, proposal_id, current.user.id)
    reservation = await visible_reservation(
        db, proposal.reservation_id, current.user.id
    )
    if proposal.status != "pending":
        raise problem(
            409,
            "change_proposal_not_pending",
            "Reservation Change Proposal is not pending",
        )
    if proposal.proposed_by_id == current.user.id:
        raise problem(
            409,
            "change_proposal_own_approval_not_allowed",
            "The other party must approve the Change Proposal",
        )
    if reservation.status not in {"pending", "accepted"}:
        proposal.status = "void"
        proposal.decided_at = now_utc()
        await db.commit()
        raise problem(
            409, "reservation_not_changeable", "Reservation cannot be changed"
        )
    if await accepted_reservation_conflicts(
        db,
        reservation.item_id,
        proposal.proposed_start_at,
        proposal.proposed_end_at,
        reservation.id,
    ):
        raise problem(
            409,
            "reservation_conflict",
            "Reservation conflicts with an accepted Reservation",
        )
    reservation.start_at = proposal.proposed_start_at
    reservation.end_at = proposal.proposed_end_at
    reservation.timezone = proposal.timezone
    proposal.status = "approved"
    proposal.decided_at = now_utc()
    await db.commit()
    await db.refresh(proposal)
    return ReservationChangeProposalEnvelope(
        change_proposal=await change_proposal_response(db, proposal, current.user.id)
    )


@router.post(
    "/reservation-change-proposals/{proposal_id}/withdraw",
    response_model=ReservationChangeProposalEnvelope,
)
async def withdraw_change_proposal(
    proposal_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationChangeProposalEnvelope:
    proposal = await visible_change_proposal(db, proposal_id, current.user.id)
    if proposal.status != "pending":
        raise problem(
            409,
            "change_proposal_not_pending",
            "Reservation Change Proposal is not pending",
        )
    if proposal.proposed_by_id != current.user.id:
        raise problem(
            409,
            "change_proposal_withdraw_not_allowed",
            "Only the proposing User can withdraw the Change Proposal",
        )
    proposal.status = "void"
    proposal.decided_at = now_utc()
    await db.commit()
    await db.refresh(proposal)
    return ReservationChangeProposalEnvelope(
        change_proposal=await change_proposal_response(db, proposal, current.user.id)
    )


@router.post(
    "/reservation-change-proposals/{proposal_id}/reject",
    response_model=ReservationChangeProposalEnvelope,
)
async def reject_change_proposal(
    proposal_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ReservationChangeProposalEnvelope:
    proposal = await visible_change_proposal(db, proposal_id, current.user.id)
    if proposal.status != "pending":
        raise problem(
            409,
            "change_proposal_not_pending",
            "Reservation Change Proposal is not pending",
        )
    if proposal.proposed_by_id == current.user.id:
        raise problem(
            409,
            "change_proposal_own_rejection_not_allowed",
            "The other party must reject the Change Proposal",
        )
    proposal.status = "rejected"
    proposal.decided_at = now_utc()
    await db.commit()
    await db.refresh(proposal)
    return ReservationChangeProposalEnvelope(
        change_proposal=await change_proposal_response(db, proposal, current.user.id)
    )
