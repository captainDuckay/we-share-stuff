from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError

from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.domain import managed_typical_location_response
from app.models import Item, TypicalLocation
from app.problems import problem
from app.schemas import (
    TypicalLocationEnvelope,
    TypicalLocationInput,
    TypicalLocationPatch,
    TypicalLocationsEnvelope,
)

router = APIRouter(prefix="/api/typical-locations", tags=["typical-locations"])
AuthenticatedMutation = Annotated[CurrentSession, Depends(require_session_csrf)]


async def owned_typical_location(
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


@router.get("", response_model=TypicalLocationsEnvelope)
async def list_typical_locations(
    db: DatabaseSession, current: CurrentSessionDependency
) -> TypicalLocationsEnvelope:
    result = await db.execute(
        select(TypicalLocation, func.count(Item.id))
        .outerjoin(
            Item,
            and_(
                Item.typical_location_id == TypicalLocation.id,
                Item.owner_id == current.user.id,
            ),
        )
        .where(TypicalLocation.owner_id == current.user.id)
        .group_by(TypicalLocation.id)
        .order_by(TypicalLocation.created_at.desc())
    )
    return TypicalLocationsEnvelope(
        typical_locations=[
            managed_typical_location_response(location, assigned_item_count)
            for location, assigned_item_count in result
        ]
    )


@router.post(
    "", response_model=TypicalLocationEnvelope, status_code=status.HTTP_201_CREATED
)
async def create_typical_location(
    payload: TypicalLocationInput,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> TypicalLocationEnvelope:
    typical_location = TypicalLocation(
        owner_id=current.user.id,
        name=payload.name,
        details=payload.details,
        timezone=payload.timezone,
    )
    db.add(typical_location)
    await db.commit()
    await db.refresh(typical_location)
    return TypicalLocationEnvelope(
        typical_location=managed_typical_location_response(typical_location, 0)
    )


@router.patch("/{typical_location_id}", response_model=TypicalLocationEnvelope)
async def update_typical_location(
    typical_location_id: UUID,
    payload: TypicalLocationPatch,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> TypicalLocationEnvelope:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise problem(
            400,
            "validation_failed",
            "Validation failed",
            {"body": "must include an update"},
        )
    typical_location = await owned_typical_location(
        db, typical_location_id, current.user.id
    )
    for field, value in updates.items():
        setattr(typical_location, field, value)
    await db.commit()
    await db.refresh(typical_location)
    assigned_item_count = await db.scalar(
        select(func.count())
        .select_from(Item)
        .where(
            Item.typical_location_id == typical_location.id,
            Item.owner_id == current.user.id,
        )
    )
    return TypicalLocationEnvelope(
        typical_location=managed_typical_location_response(
            typical_location, assigned_item_count or 0
        )
    )


@router.delete("/{typical_location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_typical_location(
    typical_location_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> None:
    typical_location = await owned_typical_location(
        db, typical_location_id, current.user.id
    )
    in_use = await db.scalar(
        select(Item.id).where(Item.typical_location_id == typical_location.id)
    )
    if in_use is not None:
        raise problem(
            409,
            "typical_location_in_use",
            "Typical Location is assigned to an Item",
        )
    await db.delete(typical_location)
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise problem(
            409,
            "typical_location_in_use",
            "Typical Location is assigned to an Item",
        ) from error
