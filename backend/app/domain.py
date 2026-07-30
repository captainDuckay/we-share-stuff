from datetime import UTC, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Category,
    Item,
    ItemCategory,
    ItemPhoto,
    ItemSharing,
    Reservation,
    ReservationChangeProposal,
    SharingGroup,
    SharingGroupMember,
    SharingGroupPhoto,
    TypicalLocation,
    User,
)
from app.problems import problem
from app.schemas import (
    CategoryResponse,
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
) -> None:
    await db.execute(
        update(Reservation)
        .where(
            Reservation.sharing_group_id == group_id,
            Reservation.requester_id == requester_id,
            Reservation.status == "pending",
        )
        .values(status="declined", decided_at=now_utc())
    )


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


async def typical_placement_visibility(
    db: AsyncSession, item: Item, viewer_id: UUID
) -> TypicalPlacementVisibility:
    if item.owner_id == viewer_id:
        return TypicalPlacementVisibility(visible=True, value=item.typical_placement)
    accepted = await db.scalar(
        select(Reservation.id).where(
            Reservation.item_id == item.id,
            Reservation.requester_id == viewer_id,
            Reservation.status == "accepted",
        )
    )
    if accepted is not None:
        return TypicalPlacementVisibility(visible=True, value=item.typical_placement)
    return TypicalPlacementVisibility(visible=False, value=None)


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
    placement_visible = item.owner_id == viewer_id or (
        reservation.requester_id == viewer_id and reservation.status == "accepted"
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
            typical_placement=TypicalPlacementVisibility(
                visible=placement_visible,
                value=item.typical_placement if placement_visible else None,
            ),
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
