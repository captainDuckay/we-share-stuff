from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.config import Settings, get_settings
from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.domain import (
    active_item_sharing_exists,
    category_responses,
    is_group_member,
    item_has_future_accepted_reservation,
    item_sharing_response,
    share_readiness,
    typical_location_response,
)
from app.models import (
    Category,
    Item,
    ItemCategory,
    ItemPhoto,
    ItemSharing,
    PlacementSlot,
    TypicalLocation,
)
from app.problems import problem
from app.schemas import (
    ItemCreate,
    ItemEnvelope,
    ItemPlacementSlotResponse,
    ItemResponse,
    ItemsEnvelope,
    ItemSharingEnvelope,
    ItemSharingStatusEnvelope,
    ItemUpdate,
)

router = APIRouter(prefix="/api/items", tags=["items"])
AuthenticatedMutation = Annotated[CurrentSession, Depends(require_session_csrf)]
AppSettings = Annotated[Settings, Depends(get_settings)]

_ITEM_LOAD_OPTIONS = (
    selectinload(Item.typical_location),
    selectinload(Item.placement_slot).selectinload(PlacementSlot.surface),
)


def item_placement_slot_response(
    slot: PlacementSlot | None,
) -> ItemPlacementSlotResponse | None:
    if slot is None:
        return None
    surface = slot.surface
    surface_name = surface.name if surface is not None else ""
    return ItemPlacementSlotResponse(
        id=slot.id,
        label=slot.label,
        surface_id=slot.surface_id,
        surface_name=surface_name,
    )


async def item_response(db: DatabaseSession, item: Item) -> ItemResponse:
    primary_photo = await db.scalar(
        select(ItemPhoto)
        .where(ItemPhoto.item_id == item.id)
        .order_by(ItemPhoto.created_at, ItemPhoto.id)
        .limit(1)
    )
    return ItemResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        typical_location=(
            typical_location_response(item.typical_location)
            if item.typical_location is not None
            else None
        ),
        typical_placement=item.typical_placement,
        placement_slot_id=item.placement_slot_id,
        placement_slot=item_placement_slot_response(item.placement_slot),
        categories=await category_responses(db, item.id),
        photo_url=(
            f"/api/item-photos/{primary_photo.id}/content" if primary_photo else None
        ),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def item_envelope(db: DatabaseSession, item: Item) -> ItemEnvelope:
    return ItemEnvelope(item=await item_response(db, item))


async def owned_item(db: DatabaseSession, item_id: UUID, owner_id: UUID) -> Item:
    item = await db.scalar(
        select(Item)
        .options(*_ITEM_LOAD_OPTIONS)
        .where(Item.id == item_id, Item.owner_id == owner_id)
    )
    if item is None:
        raise problem(404, "item_not_found", "Item was not found")
    return item


async def require_owned_typical_location(
    db: DatabaseSession, typical_location_id: UUID, owner_id: UUID
) -> TypicalLocation:
    typical_location = await db.scalar(
        select(TypicalLocation).where(
            TypicalLocation.id == typical_location_id,
            TypicalLocation.owner_id == owner_id,
        )
    )
    if typical_location is None:
        raise problem(
            404, "typical_location_not_found", "Typical Location was not found"
        )
    return typical_location


async def require_placement_slot_for_location(
    db: DatabaseSession,
    placement_slot_id: UUID,
    typical_location_id: UUID | None,
) -> PlacementSlot:
    if typical_location_id is None:
        raise problem(
            400,
            "placement_slot_requires_typical_location",
            "Linking a Placement Slot requires a Typical Location",
        )
    slot = await db.scalar(
        select(PlacementSlot)
        .options(selectinload(PlacementSlot.surface))
        .where(PlacementSlot.id == placement_slot_id)
    )
    if slot is None:
        raise problem(404, "placement_slot_not_found", "Placement Slot was not found")
    if slot.typical_location_id != typical_location_id:
        raise problem(
            400,
            "placement_slot_location_mismatch",
            "Placement Slot must belong to the Item's Typical Location",
        )
    return slot


@router.get("", response_model=ItemsEnvelope)
async def list_items(
    db: DatabaseSession,
    current: CurrentSessionDependency,
    typical_location_id: UUID | None = Query(default=None, alias="typicalLocationId"),
) -> ItemsEnvelope:
    query = (
        select(Item)
        .options(*_ITEM_LOAD_OPTIONS)
        .where(Item.owner_id == current.user.id)
        .order_by(Item.created_at.desc())
    )
    if typical_location_id is not None:
        query = query.where(Item.typical_location_id == typical_location_id)
    result = await db.scalars(query)
    return ItemsEnvelope(items=[await item_response(db, item) for item in result])


@router.post("", response_model=ItemEnvelope, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate, db: DatabaseSession, current: AuthenticatedMutation
) -> ItemEnvelope:
    typical_location = None
    if payload.typical_location_id is not None:
        typical_location = await require_owned_typical_location(
            db, payload.typical_location_id, current.user.id
        )
    placement_slot = None
    if payload.placement_slot_id is not None:
        placement_slot = await require_placement_slot_for_location(
            db, payload.placement_slot_id, payload.typical_location_id
        )
    item = Item(
        owner_id=current.user.id,
        name=payload.name,
        description=payload.description,
        typical_location_id=payload.typical_location_id,
        typical_placement=payload.typical_placement,
        placement_slot_id=payload.placement_slot_id,
    )
    if typical_location is not None:
        item.typical_location = typical_location
    if placement_slot is not None:
        item.placement_slot = placement_slot
    db.add(item)
    await db.flush()
    for category_name in payload.categories:
        category = await db.scalar(
            select(Category).where(Category.name == category_name)
        )
        if category is None:
            category = Category(name=category_name)
            db.add(category)
            await db.flush()
        db.add(ItemCategory(item_id=item.id, category_id=category.id))
    await db.commit()
    item = await owned_item(db, item.id, current.user.id)
    return await item_envelope(db, item)


@router.patch("/{item_id}", response_model=ItemEnvelope)
async def update_item(
    item_id: UUID,
    payload: ItemUpdate,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ItemEnvelope:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise problem(
            400,
            "validation_failed",
            "Validation failed",
            {"body": "must include an update"},
        )
    item = await owned_item(db, item_id, current.user.id)
    previous_location_id = item.typical_location_id
    location_changed = False

    if "typical_location_id" in updates:
        typical_location_id = updates["typical_location_id"]
        if (
            typical_location_id != item.typical_location_id
            and await item_has_future_accepted_reservation(db, item.id)
        ):
            raise problem(
                409,
                "item_typical_location_locked_by_reservations",
                "Item Typical Location cannot be changed while future accepted Reservations exist",
            )
        if typical_location_id is None and await active_item_sharing_exists(
            db, item.id
        ):
            raise problem(
                409,
                "shared_item_requires_typical_location",
                "Shared Item requires a Typical Location",
            )
        if typical_location_id is not None:
            item.typical_location = await require_owned_typical_location(
                db, typical_location_id, current.user.id
            )
            item.typical_location_id = typical_location_id
        else:
            item.typical_location = None
            item.typical_location_id = None
        location_changed = typical_location_id != previous_location_id
        del updates["typical_location_id"]

    # Changing or clearing Typical Location auto-clears the Slot link unless this
    # request explicitly sets a (possibly new) placement_slot_id. Keep the note.
    if location_changed and "placement_slot_id" not in updates:
        item.placement_slot_id = None
        item.placement_slot = None

    if "placement_slot_id" in updates:
        placement_slot_id = updates.pop("placement_slot_id")
        if placement_slot_id is None:
            item.placement_slot_id = None
            item.placement_slot = None
        else:
            slot = await require_placement_slot_for_location(
                db, placement_slot_id, item.typical_location_id
            )
            item.placement_slot = slot
            item.placement_slot_id = slot.id

    for field, value in updates.items():
        setattr(item, field, value)
    await db.commit()
    item = await owned_item(db, item.id, current.user.id)
    return await item_envelope(db, item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
    settings: AppSettings,
) -> None:
    item = await owned_item(db, item_id, current.user.id)
    if await item_has_future_accepted_reservation(db, item.id):
        raise problem(
            409,
            "item_has_future_accepted_reservations",
            "Item has future accepted Reservations",
        )
    photos = list(
        await db.scalars(select(ItemPhoto).where(ItemPhoto.item_id == item.id))
    )
    await db.delete(item)
    await db.commit()
    root = Path(settings.item_photo_storage_dir)
    for photo in photos:
        path = root / photo.storage_path
        if path.exists():
            path.unlink()


@router.get("/{item_id}/sharing", response_model=ItemSharingStatusEnvelope)
async def get_item_sharing(
    item_id: UUID, db: DatabaseSession, current: CurrentSessionDependency
) -> ItemSharingStatusEnvelope:
    item = await owned_item(db, item_id, current.user.id)
    result = await db.scalars(
        select(ItemSharing)
        .where(ItemSharing.item_id == item.id)
        .order_by(ItemSharing.shared_at.desc())
    )
    return ItemSharingStatusEnvelope(
        share_readiness=await share_readiness(db, item),
        item_sharing=[await item_sharing_response(db, sharing) for sharing in result],
    )


@router.post(
    "/{item_id}/sharing-groups/{sharing_group_id}",
    response_model=ItemSharingEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def share_item_with_group(
    item_id: UUID,
    sharing_group_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> ItemSharingEnvelope:
    item = await owned_item(db, item_id, current.user.id)
    if not await is_group_member(db, sharing_group_id, current.user.id):
        raise problem(404, "sharing_group_not_found", "Sharing Group was not found")
    readiness = await share_readiness(db, item)
    if not readiness.can_share:
        errors = {field: "required before sharing" for field in readiness.missing}
        raise problem(409, "item_not_share_ready", "Item is not ready to share", errors)
    existing = await db.get(ItemSharing, (item.id, sharing_group_id))
    if existing is not None:
        return ItemSharingEnvelope(
            item_sharing=await item_sharing_response(db, existing)
        )
    sharing = ItemSharing(item_id=item.id, sharing_group_id=sharing_group_id)
    db.add(sharing)
    await db.commit()
    await db.refresh(sharing)
    return ItemSharingEnvelope(item_sharing=await item_sharing_response(db, sharing))


@router.delete(
    "/{item_id}/sharing-groups/{sharing_group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unshare_item_from_group(
    item_id: UUID,
    sharing_group_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> None:
    item = await owned_item(db, item_id, current.user.id)
    await db.execute(
        delete(ItemSharing).where(
            ItemSharing.item_id == item.id,
            ItemSharing.sharing_group_id == sharing_group_id,
        )
    )
    await db.commit()
