from datetime import UTC, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Category,
    Item,
    ItemCategory,
    ItemPhoto,
    ItemSharing,
    PlacementSlot,
    PlacementSurface,
    Reservation,
    ReservationChangeProposal,
    SharingGroup,
    SharingGroupMember,
    SharingGroupPhoto,
    StructuralDrawing,
    TypicalLocation,
    User,
)
from app.problems import problem
from app.schemas import (
    CategoryResponse,
    FrozenPlacementSlotGeometry,
    FrozenSketchPoint,
    FrozenStructuralDrawing,
    ItemPhotoResponse,
    ItemSharingResponse,
    ManagedTypicalLocationResponse,
    ReservationChangeProposalResponse,
    ReservationItemResponse,
    ReservationRange,
    ReservationResponse,
    SharedItemReservationState,
    SharedItemResponse,
    ShareReadiness,
    SharingGroupResponse,
    SharingGroupSummary,
    StructuredPlacementSnapshot,
    TypicalLocationResponse,
    TypicalPlacementVisibility,
    UserSummary,
)
from app.security import now_utc


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def local_text(value: datetime, timezone: str) -> str:
    local = as_utc(value).astimezone(ZoneInfo(timezone))
    return local.replace(tzinfo=None).isoformat(timespec="seconds")


def typical_location_response(
    typical_location: TypicalLocation,
) -> TypicalLocationResponse:
    return TypicalLocationResponse.model_validate(typical_location)


def managed_typical_location_response(
    typical_location: TypicalLocation, assigned_item_count: int
) -> ManagedTypicalLocationResponse:
    response = ManagedTypicalLocationResponse.model_validate(
        typical_location, from_attributes=True
    )
    return response.model_copy(update={"assigned_item_count": assigned_item_count})


async def category_responses(db: AsyncSession, item_id: UUID) -> list[CategoryResponse]:
    categories = await db.scalars(
        select(Category)
        .join(ItemCategory, ItemCategory.category_id == Category.id)
        .where(ItemCategory.item_id == item_id)
        .order_by(Category.name)
    )
    return [
        CategoryResponse(id=category.id, name=category.name) for category in categories
    ]


def item_photo_response(photo: ItemPhoto) -> ItemPhotoResponse:
    return ItemPhotoResponse(
        id=photo.id,
        item_id=photo.item_id,
        url=f"/api/item-photos/{photo.id}/content",
        content_type=photo.content_type,
        size_bytes=photo.size_bytes,
        created_at=photo.created_at,
    )


def user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        display_name=user.display_name,
        profile_photo_url=(
            f"/api/profile-photos/{user.id}/content"
            if user.profile_photo is not None
            else None
        ),
    )


async def get_user_summary(db: AsyncSession, user_id: UUID) -> UserSummary:
    user = await db.get(User, user_id)
    if user is None:
        raise problem(404, "user_not_found", "User was not found")
    return user_summary(user)


async def group_summary(db: AsyncSession, group_id: UUID) -> SharingGroupSummary:
    group = await db.get(SharingGroup, group_id)
    if group is None:
        raise problem(404, "sharing_group_not_found", "Sharing Group was not found")
    return SharingGroupSummary(id=group.id, name=group.name)


async def sharing_group_response(
    db: AsyncSession, group: SharingGroup, current_user_id: UUID
) -> SharingGroupResponse:
    creator = await db.get(User, group.created_by_id)
    if creator is None:
        raise problem(404, "sharing_group_not_found", "Sharing Group was not found")
    member_count = await db.scalar(
        select(func.count())
        .select_from(SharingGroupMember)
        .where(SharingGroupMember.sharing_group_id == group.id)
    )
    photo = await db.get(SharingGroupPhoto, group.id)
    return SharingGroupResponse(
        id=group.id,
        name=group.name,
        created_by=user_summary(creator),
        current_user_can_manage=group.created_by_id == current_user_id,
        member_count=member_count or 0,
        photo_url=(
            f"/api/sharing-groups/{group.id}/photo/content"
            if photo is not None
            else None
        ),
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


async def is_group_member(db: AsyncSession, group_id: UUID, user_id: UUID) -> bool:
    membership = await db.get(SharingGroupMember, (group_id, user_id))
    return membership is not None


async def require_group_member(
    db: AsyncSession, group_id: UUID, user_id: UUID
) -> SharingGroup:
    membership = await db.scalar(
        select(SharingGroupMember)
        .options(selectinload(SharingGroupMember.sharing_group))
        .where(
            SharingGroupMember.sharing_group_id == group_id,
            SharingGroupMember.user_id == user_id,
        )
    )
    if membership is None:
        raise problem(404, "sharing_group_not_found", "Sharing Group was not found")
    return membership.sharing_group


async def require_group_creator(
    db: AsyncSession, group_id: UUID, user_id: UUID
) -> SharingGroup:
    group = await db.get(SharingGroup, group_id)
    if group is None:
        raise problem(404, "sharing_group_not_found", "Sharing Group was not found")
    if group.created_by_id != user_id:
        raise problem(
            403,
            "sharing_group_manager_required",
            "Sharing Group manager permission is required",
        )
    return group


async def remove_member_item_sharing(
    db: AsyncSession, group_id: UUID, user_id: UUID
) -> None:
    item_ids = select(Item.id).where(Item.owner_id == user_id)
    await db.execute(
        delete(ItemSharing).where(
            ItemSharing.sharing_group_id == group_id,
            ItemSharing.item_id.in_(item_ids),
        )
    )


async def decline_pending_reservations_for_requester_in_group(
    db: AsyncSession, group_id: UUID, requester_id: UUID
) -> list[Reservation]:
    """Decline pending Reservation Requests for a requester in a group.

    Returns the Reservation rows that were transitioned (for Notification emission).
    """
    result = await db.scalars(
        select(Reservation).where(
            Reservation.sharing_group_id == group_id,
            Reservation.requester_id == requester_id,
            Reservation.status == "pending",
        )
    )
    declined = list(result)
    decided_at = now_utc()
    for reservation in declined:
        reservation.status = "declined"
        reservation.decided_at = decided_at
    if declined:
        await db.flush()
    return declined


async def active_item_sharing_exists(db: AsyncSession, item_id: UUID) -> bool:
    sharing = await db.scalar(select(ItemSharing).where(ItemSharing.item_id == item_id))
    return sharing is not None


async def share_readiness(db: AsyncSession, item: Item) -> ShareReadiness:
    missing = ["typicalLocation"] if item.typical_location_id is None else []
    return ShareReadiness(can_share=not missing, missing=missing)


async def item_sharing_response(
    db: AsyncSession, sharing: ItemSharing
) -> ItemSharingResponse:
    group = await db.get(SharingGroup, sharing.sharing_group_id)
    if group is None:
        raise problem(404, "sharing_group_not_found", "Sharing Group was not found")
    return ItemSharingResponse(
        item_id=sharing.item_id,
        sharing_group=SharingGroupSummary(id=group.id, name=group.name),
        shared_at=sharing.shared_at,
    )


async def item_has_future_accepted_reservation(db: AsyncSession, item_id: UUID) -> bool:
    existing = await db.scalar(
        select(Reservation.id).where(
            Reservation.item_id == item_id,
            Reservation.status == "accepted",
            Reservation.end_at > now_utc(),
        )
    )
    return existing is not None


async def accepted_reservation_conflicts(
    db: AsyncSession,
    item_id: UUID,
    start_at: datetime,
    end_at: datetime,
    exclude_reservation_id: UUID | None = None,
) -> bool:
    query = select(Reservation.id).where(
        Reservation.item_id == item_id,
        Reservation.status == "accepted",
        Reservation.start_at < end_at,
        Reservation.end_at > start_at,
    )
    if exclude_reservation_id is not None:
        query = query.where(Reservation.id != exclude_reservation_id)
    existing = await db.scalar(query)
    return existing is not None


async def accepted_ranges(db: AsyncSession, item_id: UUID) -> list[ReservationRange]:
    result = await db.scalars(
        select(Reservation)
        .where(
            Reservation.item_id == item_id,
            Reservation.status == "accepted",
            Reservation.end_at > now_utc(),
        )
        .order_by(Reservation.start_at)
    )
    return [
        ReservationRange(
            start_at=as_utc(reservation.start_at),
            end_at=as_utc(reservation.end_at),
            timezone=reservation.timezone,
        )
        for reservation in result
    ]


def freeze_typical_placement_snapshot(live_placement: str | None) -> str | None:
    """Capture free-text Typical Placement for an Accepted Reservation.

    Trims and treats blank as empty (None). Does not invent structure.
    """
    if live_placement is None:
        return None
    trimmed = live_placement.strip()
    return trimmed or None


def _frozen_slot_geometry(slot: PlacementSlot) -> FrozenPlacementSlotGeometry:
    return FrozenPlacementSlotGeometry(
        id=slot.id,
        label=slot.label,
        x=slot.x,
        y=slot.y,
        width=slot.width,
        height=slot.height,
    )


def _frozen_structural_drawing(
    drawing: StructuralDrawing,
) -> FrozenStructuralDrawing:
    points = None
    if drawing.points is not None:
        points = [
            FrozenSketchPoint(x=point["x"], y=point["y"])
            if isinstance(point, dict)
            else FrozenSketchPoint(x=point.x, y=point.y)
            for point in drawing.points
        ]
    return FrozenStructuralDrawing(
        id=drawing.id,
        kind=drawing.kind,  # type: ignore[arg-type]
        x=drawing.x,
        y=drawing.y,
        width=drawing.width,
        height=drawing.height,
        points=points,
    )


def build_structured_placement_snapshot(
    surface: PlacementSurface,
    target_slot: PlacementSlot,
    note: str | None,
) -> StructuredPlacementSnapshot:
    """Freeze parent-Surface-only structure for a Slot-linked Item.

    Includes target Slot geometry, other slots on that Surface (orientation),
    and Structural Drawings. Excludes co-located Items and other Surfaces.
    """
    other_slots = sorted(
        (
            slot
            for slot in surface.slots
            if slot.id != target_slot.id
        ),
        key=lambda slot: (slot.label.lower(), str(slot.id)),
    )
    drawings = sorted(
        surface.structural_drawings,
        key=lambda drawing: (drawing.created_at, str(drawing.id)),
    )
    return StructuredPlacementSnapshot(
        surface_name=surface.name,
        slot_label=target_slot.label,
        note=note,
        target_slot=_frozen_slot_geometry(target_slot),
        other_slots=[_frozen_slot_geometry(slot) for slot in other_slots],
        structural_drawings=[
            _frozen_structural_drawing(drawing) for drawing in drawings
        ],
    )


async def freeze_placement_for_accept(
    db: AsyncSession, item: Item
) -> tuple[str | None, dict | None]:
    """Freeze free-text and optional structured placement at accept.

    Returns (free_text_or_note, structured_json_or_none). Structured is only
    produced when the Item is linked to a Placement Slot.
    """
    free_text = freeze_typical_placement_snapshot(item.typical_placement)
    if item.placement_slot_id is None:
        return free_text, None

    slot = await db.scalar(
        select(PlacementSlot)
        .options(
            selectinload(PlacementSlot.surface).selectinload(PlacementSurface.slots),
            selectinload(PlacementSlot.surface).selectinload(
                PlacementSurface.structural_drawings
            ),
        )
        .where(PlacementSlot.id == item.placement_slot_id)
    )
    if slot is None or slot.surface is None:
        # Link is restricted from dangling deletes; treat as free-text only.
        return free_text, None

    structured = build_structured_placement_snapshot(slot.surface, slot, free_text)
    return free_text, structured.model_dump(mode="json", by_alias=False)


def structured_snapshot_from_storage(
    raw: dict | None,
) -> StructuredPlacementSnapshot | None:
    if raw is None:
        return None
    return StructuredPlacementSnapshot.model_validate(raw)


def placement_visibility_from_snapshot(
    *,
    visible: bool,
    free_text: str | None = None,
    structured_raw: dict | None = None,
) -> TypicalPlacementVisibility:
    if not visible:
        return TypicalPlacementVisibility(
            visible=False, value=None, structured=None
        )
    return TypicalPlacementVisibility(
        visible=True,
        value=free_text,
        structured=structured_snapshot_from_storage(structured_raw),
    )


async def typical_placement_visibility(
    db: AsyncSession, item: Item, viewer_id: UUID
) -> TypicalPlacementVisibility:
    if item.owner_id == viewer_id:
        return TypicalPlacementVisibility(
            visible=True, value=item.typical_placement, structured=None
        )
    accepted = await db.scalar(
        select(Reservation)
        .where(
            Reservation.item_id == item.id,
            Reservation.requester_id == viewer_id,
            Reservation.status == "accepted",
        )
        .order_by(
            Reservation.decided_at.desc().nullslast(),
            Reservation.created_at.desc(),
        )
        .limit(1)
    )
    if accepted is not None:
        return placement_visibility_from_snapshot(
            visible=True,
            free_text=accepted.typical_placement_snapshot,
            structured_raw=accepted.typical_placement_structured_snapshot,
        )
    return TypicalPlacementVisibility(
        visible=False, value=None, structured=None
    )


async def shared_item_response(
    db: AsyncSession, item: Item, viewer_id: UUID
) -> SharedItemResponse:
    if item.typical_location is None:
        raise problem(404, "shared_item_not_found", "Shared Item was not found")
    owner = await db.get(User, item.owner_id)
    if owner is None:
        raise problem(404, "shared_item_not_found", "Shared Item was not found")
    photos = list(
        await db.scalars(
            select(ItemPhoto)
            .where(ItemPhoto.item_id == item.id)
            .order_by(ItemPhoto.created_at, ItemPhoto.id)
        )
    )
    visible_groups = await db.scalars(
        select(SharingGroup)
        .join(ItemSharing, ItemSharing.sharing_group_id == SharingGroup.id)
        .join(
            SharingGroupMember, SharingGroupMember.sharing_group_id == SharingGroup.id
        )
        .where(ItemSharing.item_id == item.id, SharingGroupMember.user_id == viewer_id)
        .order_by(SharingGroup.name)
    )
    return SharedItemResponse(
        id=item.id,
        owner=user_summary(owner),
        name=item.name,
        description=item.description,
        visible_through=[
            SharingGroupSummary(id=group.id, name=group.name)
            for group in visible_groups
        ],
        item_photos=[item_photo_response(photo) for photo in photos],
        categories=await category_responses(db, item.id),
        typical_location=typical_location_response(item.typical_location),
        typical_placement=await typical_placement_visibility(db, item, viewer_id),
        reservation_state=SharedItemReservationState(
            requestable=item.owner_id != viewer_id,
            accepted_ranges=await accepted_ranges(db, item.id),
        ),
    )


async def reservation_response(
    db: AsyncSession, reservation: Reservation, viewer_id: UUID
) -> ReservationResponse:
    group = await db.get(SharingGroup, reservation.sharing_group_id)
    item = await db.scalar(
        select(Item)
        .options(selectinload(Item.typical_location))
        .where(Item.id == reservation.item_id)
    )
    requester = await db.get(User, reservation.requester_id)
    if (
        group is None
        or item is None
        or item.typical_location is None
        or requester is None
    ):
        raise problem(404, "reservation_not_found", "Reservation was not found")
    owner = await db.get(User, item.owner_id)
    if owner is None:
        raise problem(404, "reservation_not_found", "Reservation was not found")
    earliest_photo = await db.scalar(
        select(ItemPhoto)
        .where(ItemPhoto.item_id == item.id)
        .order_by(ItemPhoto.created_at, ItemPhoto.id)
        .limit(1)
    )
    if item.owner_id == viewer_id:
        typical_placement = TypicalPlacementVisibility(
            visible=True, value=item.typical_placement, structured=None
        )
    elif reservation.requester_id == viewer_id and reservation.status == "accepted":
        typical_placement = placement_visibility_from_snapshot(
            visible=True,
            free_text=reservation.typical_placement_snapshot,
            structured_raw=reservation.typical_placement_structured_snapshot,
        )
    else:
        typical_placement = TypicalPlacementVisibility(
            visible=False, value=None, structured=None
        )
    conflicts_with_accepted = (
        reservation.status == "pending"
        and await accepted_reservation_conflicts(
            db,
            reservation.item_id,
            as_utc(reservation.start_at),
            as_utc(reservation.end_at),
            reservation.id,
        )
    )
    return ReservationResponse(
        id=reservation.id,
        sharing_group=SharingGroupSummary(id=group.id, name=group.name),
        item=ReservationItemResponse(
            id=item.id,
            name=item.name,
            owner=user_summary(owner),
            photo_url=item_photo_response(earliest_photo).url
            if earliest_photo
            else None,
            typical_location=typical_location_response(item.typical_location),
            typical_placement=typical_placement,
        ),
        requester=user_summary(requester),
        status=reservation.status,
        start_local=local_text(reservation.start_at, reservation.timezone),
        end_local=local_text(reservation.end_at, reservation.timezone),
        start_at=as_utc(reservation.start_at),
        end_at=as_utc(reservation.end_at),
        timezone=reservation.timezone,
        created_at=reservation.created_at,
        decided_at=reservation.decided_at,
        conflicts_with_accepted_reservation=conflicts_with_accepted,
    )


async def change_proposal_response(
    db: AsyncSession, proposal: ReservationChangeProposal, viewer_id: UUID
) -> ReservationChangeProposalResponse:
    proposed_by = await db.get(User, proposal.proposed_by_id)
    reservation = await db.get(Reservation, proposal.reservation_id)
    if proposed_by is None or reservation is None:
        raise problem(
            404,
            "change_proposal_not_found",
            "Reservation Change Proposal was not found",
        )
    return ReservationChangeProposalResponse(
        id=proposal.id,
        reservation=await reservation_response(db, reservation, viewer_id),
        proposed_by=user_summary(proposed_by),
        status=proposal.status,
        start_local=local_text(proposal.proposed_start_at, proposal.timezone),
        end_local=local_text(proposal.proposed_end_at, proposal.timezone),
        start_at=as_utc(proposal.proposed_start_at),
        end_at=as_utc(proposal.proposed_end_at),
        timezone=proposal.timezone,
        created_at=proposal.created_at,
        decided_at=proposal.decided_at,
    )
