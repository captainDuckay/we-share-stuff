from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select

from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.models import (
    Item,
    PlacementSlot,
    PlacementSurface,
    StructuralDrawing,
    TypicalLocation,
)
from app.problems import problem
from app.schemas import (
    MAX_PLACEMENT_SLOTS_PER_LOCATION,
    MAX_PLACEMENT_SURFACES_PER_LOCATION,
    MAX_STRUCTURAL_DRAWINGS_PER_SURFACE,
    POLYLINE_POINTS_MAX,
    POLYLINE_POINTS_MIN,
    PlacementSlotEnvelope,
    PlacementSlotInput,
    PlacementSlotPatch,
    PlacementSlotResponse,
    PlacementSurfaceDetailResponse,
    PlacementSurfaceEnvelope,
    PlacementSurfaceInput,
    PlacementSurfacePatch,
    PlacementSurfacesEnvelope,
    PlacementSurfaceSummaryEnvelope,
    PlacementSurfaceSummaryResponse,
    PointResponse,
    StructuralDrawingEnvelope,
    StructuralDrawingInput,
    StructuralDrawingPatch,
    StructuralDrawingResponse,
)

router = APIRouter(
    prefix="/api/typical-locations/{typical_location_id}/placement-surfaces",
    tags=["placement-surfaces"],
)
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


async def owned_surface(
    db: DatabaseSession,
    typical_location_id: UUID,
    surface_id: UUID,
    owner_id: UUID,
) -> PlacementSurface:
    await owned_typical_location(db, typical_location_id, owner_id)
    surface = await db.scalar(
        select(PlacementSurface).where(
            PlacementSurface.id == surface_id,
            PlacementSurface.typical_location_id == typical_location_id,
        )
    )
    if surface is None:
        raise problem(
            404, "placement_surface_not_found", "Placement Surface was not found"
        )
    return surface


def slot_response(slot: PlacementSlot) -> PlacementSlotResponse:
    return PlacementSlotResponse.model_validate(slot)


def drawing_response(drawing: StructuralDrawing) -> StructuralDrawingResponse:
    points = None
    if drawing.points is not None:
        points = [PointResponse(x=point["x"], y=point["y"]) for point in drawing.points]
    return StructuralDrawingResponse(
        id=drawing.id,
        surface_id=drawing.surface_id,
        kind=drawing.kind,  # type: ignore[arg-type]
        x=drawing.x,
        y=drawing.y,
        width=drawing.width,
        height=drawing.height,
        points=points,
        created_at=drawing.created_at,
        updated_at=drawing.updated_at,
    )


def surface_summary(
    surface: PlacementSurface, slot_count: int | None = None
) -> PlacementSurfaceSummaryResponse:
    count = slot_count if slot_count is not None else len(surface.slots)
    return PlacementSurfaceSummaryResponse(
        id=surface.id,
        typical_location_id=surface.typical_location_id,
        name=surface.name,
        slot_count=count,
        created_at=surface.created_at,
        updated_at=surface.updated_at,
    )


def surface_detail(surface: PlacementSurface) -> PlacementSurfaceDetailResponse:
    slots = sorted(surface.slots, key=lambda slot: (slot.created_at, slot.id))
    drawings = sorted(
        surface.structural_drawings, key=lambda drawing: (drawing.created_at, drawing.id)
    )
    return PlacementSurfaceDetailResponse(
        id=surface.id,
        typical_location_id=surface.typical_location_id,
        name=surface.name,
        slot_count=len(slots),
        created_at=surface.created_at,
        updated_at=surface.updated_at,
        slots=[slot_response(slot) for slot in slots],
        structural_drawings=[drawing_response(drawing) for drawing in drawings],
    )


async def require_unique_slot_label(
    db: DatabaseSession,
    typical_location_id: UUID,
    label: str,
    except_slot_id: UUID | None = None,
) -> None:
    query = select(PlacementSlot.id).where(
        PlacementSlot.typical_location_id == typical_location_id,
        func.lower(PlacementSlot.label) == label.lower(),
    )
    if except_slot_id is not None:
        query = query.where(PlacementSlot.id != except_slot_id)
    existing = await db.scalar(query)
    if existing is not None:
        raise problem(
            409,
            "placement_slot_label_conflict",
            "Placement Slot label is already used on this Typical Location",
        )


async def require_surface_capacity(
    db: DatabaseSession, typical_location_id: UUID
) -> None:
    count = await db.scalar(
        select(func.count())
        .select_from(PlacementSurface)
        .where(PlacementSurface.typical_location_id == typical_location_id)
    )
    if count is not None and count >= MAX_PLACEMENT_SURFACES_PER_LOCATION:
        raise problem(
            409,
            "placement_surface_limit_exceeded",
            "Typical Location has the maximum number of Placement Surfaces",
        )


async def require_slot_capacity(
    db: DatabaseSession, typical_location_id: UUID
) -> None:
    count = await db.scalar(
        select(func.count())
        .select_from(PlacementSlot)
        .where(PlacementSlot.typical_location_id == typical_location_id)
    )
    if count is not None and count >= MAX_PLACEMENT_SLOTS_PER_LOCATION:
        raise problem(
            409,
            "placement_slot_limit_exceeded",
            "Typical Location has the maximum number of Placement Slots",
        )


async def require_drawing_capacity(db: DatabaseSession, surface_id: UUID) -> None:
    count = await db.scalar(
        select(func.count())
        .select_from(StructuralDrawing)
        .where(StructuralDrawing.surface_id == surface_id)
    )
    if count is not None and count >= MAX_STRUCTURAL_DRAWINGS_PER_SURFACE:
        raise problem(
            409,
            "structural_drawing_limit_exceeded",
            "Placement Surface has the maximum number of structural drawings",
        )


async def linked_item_count_for_slot(db: DatabaseSession, slot_id: UUID) -> int:
    count = await db.scalar(
        select(func.count()).select_from(Item).where(Item.placement_slot_id == slot_id)
    )
    return int(count or 0)


async def linked_item_count_for_surface(
    db: DatabaseSession, surface_id: UUID
) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(Item)
        .join(PlacementSlot, Item.placement_slot_id == PlacementSlot.id)
        .where(PlacementSlot.surface_id == surface_id)
    )
    return int(count or 0)


@router.get("", response_model=PlacementSurfacesEnvelope)
async def list_placement_surfaces(
    typical_location_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
) -> PlacementSurfacesEnvelope:
    await owned_typical_location(db, typical_location_id, current.user.id)
    result = await db.execute(
        select(PlacementSurface, func.count(PlacementSlot.id))
        .outerjoin(PlacementSlot, PlacementSlot.surface_id == PlacementSurface.id)
        .where(PlacementSurface.typical_location_id == typical_location_id)
        .group_by(PlacementSurface.id)
        .order_by(PlacementSurface.created_at.asc(), PlacementSurface.id.asc())
    )
    return PlacementSurfacesEnvelope(
        placement_surfaces=[
            surface_summary(surface, slot_count)
            for surface, slot_count in result
        ]
    )


@router.post(
    "",
    response_model=PlacementSurfaceSummaryEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def create_placement_surface(
    typical_location_id: UUID,
    payload: PlacementSurfaceInput,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> PlacementSurfaceSummaryEnvelope:
    await owned_typical_location(db, typical_location_id, current.user.id)
    await require_surface_capacity(db, typical_location_id)
    surface = PlacementSurface(
        typical_location_id=typical_location_id,
        name=payload.name,
    )
    db.add(surface)
    await db.commit()
    await db.refresh(surface)
    return PlacementSurfaceSummaryEnvelope(placement_surface=surface_summary(surface))


@router.get("/{surface_id}", response_model=PlacementSurfaceEnvelope)
async def get_placement_surface(
    typical_location_id: UUID,
    surface_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
) -> PlacementSurfaceEnvelope:
    surface = await owned_surface(
        db, typical_location_id, surface_id, current.user.id
    )
    return PlacementSurfaceEnvelope(placement_surface=surface_detail(surface))


@router.patch("/{surface_id}", response_model=PlacementSurfaceSummaryEnvelope)
async def update_placement_surface(
    typical_location_id: UUID,
    surface_id: UUID,
    payload: PlacementSurfacePatch,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> PlacementSurfaceSummaryEnvelope:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise problem(
            400,
            "validation_failed",
            "Validation failed",
            {"body": "must include an update"},
        )
    surface = await owned_surface(
        db, typical_location_id, surface_id, current.user.id
    )
    for field, value in updates.items():
        setattr(surface, field, value)
    await db.commit()
    await db.refresh(surface)
    return PlacementSurfaceSummaryEnvelope(placement_surface=surface_summary(surface))


@router.delete("/{surface_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_placement_surface(
    typical_location_id: UUID,
    surface_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> None:
    surface = await owned_surface(
        db, typical_location_id, surface_id, current.user.id
    )
    linked_count = await linked_item_count_for_surface(db, surface.id)
    if linked_count > 0:
        raise problem(
            409,
            "placement_surface_in_use",
            "Placement Surface has Slots linked to Items",
            {"linkedItemCount": str(linked_count)},
        )
    await db.delete(surface)
    await db.commit()


@router.post(
    "/{surface_id}/slots",
    response_model=PlacementSlotEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def create_placement_slot(
    typical_location_id: UUID,
    surface_id: UUID,
    payload: PlacementSlotInput,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> PlacementSlotEnvelope:
    surface = await owned_surface(
        db, typical_location_id, surface_id, current.user.id
    )
    await require_slot_capacity(db, typical_location_id)
    await require_unique_slot_label(db, typical_location_id, payload.label)
    slot = PlacementSlot(
        surface_id=surface.id,
        typical_location_id=typical_location_id,
        label=payload.label,
        x=payload.x,
        y=payload.y,
        width=payload.width,
        height=payload.height,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return PlacementSlotEnvelope(placement_slot=slot_response(slot))


@router.patch(
    "/{surface_id}/slots/{slot_id}",
    response_model=PlacementSlotEnvelope,
)
async def update_placement_slot(
    typical_location_id: UUID,
    surface_id: UUID,
    slot_id: UUID,
    payload: PlacementSlotPatch,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> PlacementSlotEnvelope:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise problem(
            400,
            "validation_failed",
            "Validation failed",
            {"body": "must include an update"},
        )
    await owned_surface(db, typical_location_id, surface_id, current.user.id)
    slot = await db.scalar(
        select(PlacementSlot).where(
            PlacementSlot.id == slot_id,
            PlacementSlot.surface_id == surface_id,
        )
    )
    if slot is None:
        raise problem(404, "placement_slot_not_found", "Placement Slot was not found")
    if "label" in updates:
        await require_unique_slot_label(
            db, typical_location_id, updates["label"], except_slot_id=slot.id
        )
    if "surface_id" in updates:
        target_surface_id = updates["surface_id"]
        if target_surface_id is None:
            raise problem(
                400,
                "validation_failed",
                "Validation failed",
                {"surfaceId": "cannot be null"},
            )
        if target_surface_id != slot.surface_id:
            target = await db.scalar(
                select(PlacementSurface).where(PlacementSurface.id == target_surface_id)
            )
            if target is None:
                raise problem(
                    404,
                    "placement_surface_not_found",
                    "Placement Surface was not found",
                )
            if target.typical_location_id != typical_location_id:
                raise problem(
                    400,
                    "placement_slot_reparent_location_mismatch",
                    "Placement Slot can only be re-parented within the same Typical Location",
                )
            # Ensure the target surface is owned (same location already implies ownership
            # via owned_surface on the source path, but reject cross-owner IDs cleanly).
            await owned_surface(
                db, typical_location_id, target_surface_id, current.user.id
            )
    for field, value in updates.items():
        setattr(slot, field, value)
    await db.commit()
    await db.refresh(slot)
    return PlacementSlotEnvelope(placement_slot=slot_response(slot))


@router.delete(
    "/{surface_id}/slots/{slot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_placement_slot(
    typical_location_id: UUID,
    surface_id: UUID,
    slot_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> None:
    await owned_surface(db, typical_location_id, surface_id, current.user.id)
    slot = await db.scalar(
        select(PlacementSlot).where(
            PlacementSlot.id == slot_id,
            PlacementSlot.surface_id == surface_id,
        )
    )
    if slot is None:
        raise problem(404, "placement_slot_not_found", "Placement Slot was not found")
    linked_count = await linked_item_count_for_slot(db, slot.id)
    if linked_count > 0:
        raise problem(
            409,
            "placement_slot_in_use",
            "Placement Slot is linked to Items",
            {"linkedItemCount": str(linked_count)},
        )
    await db.delete(slot)
    await db.commit()


@router.post(
    "/{surface_id}/structural-drawings",
    response_model=StructuralDrawingEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def create_structural_drawing(
    typical_location_id: UUID,
    surface_id: UUID,
    payload: StructuralDrawingInput,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> StructuralDrawingEnvelope:
    surface = await owned_surface(
        db, typical_location_id, surface_id, current.user.id
    )
    await require_drawing_capacity(db, surface.id)
    points = (
        [{"x": point.x, "y": point.y} for point in payload.points]
        if payload.points is not None
        else None
    )
    drawing = StructuralDrawing(
        surface_id=surface.id,
        kind=payload.kind,
        x=payload.x,
        y=payload.y,
        width=payload.width,
        height=payload.height,
        points=points,
    )
    db.add(drawing)
    await db.commit()
    await db.refresh(drawing)
    return StructuralDrawingEnvelope(structural_drawing=drawing_response(drawing))


@router.patch(
    "/{surface_id}/structural-drawings/{drawing_id}",
    response_model=StructuralDrawingEnvelope,
)
async def update_structural_drawing(
    typical_location_id: UUID,
    surface_id: UUID,
    drawing_id: UUID,
    payload: StructuralDrawingPatch,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> StructuralDrawingEnvelope:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise problem(
            400,
            "validation_failed",
            "Validation failed",
            {"body": "must include an update"},
        )
    await owned_surface(db, typical_location_id, surface_id, current.user.id)
    drawing = await db.scalar(
        select(StructuralDrawing).where(
            StructuralDrawing.id == drawing_id,
            StructuralDrawing.surface_id == surface_id,
        )
    )
    if drawing is None:
        raise problem(
            404,
            "structural_drawing_not_found",
            "Structural Drawing was not found",
        )
    if drawing.kind == "rect":
        if "points" in updates:
            raise problem(
                400,
                "validation_failed",
                "Validation failed",
                {"points": "rect must not include points"},
            )
        for field in ("x", "y", "width", "height"):
            if field in updates and updates[field] is None:
                raise problem(
                    400,
                    "validation_failed",
                    "Validation failed",
                    {field: "rect geometry cannot be null"},
                )
    else:
        if any(field in updates for field in ("x", "y", "width", "height")):
            raise problem(
                400,
                "validation_failed",
                "Validation failed",
                {"body": "polyline must not include rect geometry"},
            )
        if "points" in updates:
            points_value = updates["points"]
            if (
                points_value is None
                or len(points_value) < POLYLINE_POINTS_MIN
                or len(points_value) > POLYLINE_POINTS_MAX
            ):
                raise problem(
                    400,
                    "validation_failed",
                    "Validation failed",
                    {
                        "points": (
                            f"must include between {POLYLINE_POINTS_MIN} and "
                            f"{POLYLINE_POINTS_MAX} points"
                        )
                    },
                )
            updates["points"] = [
                {"x": point["x"], "y": point["y"]} for point in points_value
            ]
    for field, value in updates.items():
        setattr(drawing, field, value)
    await db.commit()
    await db.refresh(drawing)
    return StructuralDrawingEnvelope(structural_drawing=drawing_response(drawing))


@router.delete(
    "/{surface_id}/structural-drawings/{drawing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_structural_drawing(
    typical_location_id: UUID,
    surface_id: UUID,
    drawing_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> None:
    await owned_surface(db, typical_location_id, surface_id, current.user.id)
    drawing = await db.scalar(
        select(StructuralDrawing).where(
            StructuralDrawing.id == drawing_id,
            StructuralDrawing.surface_id == surface_id,
        )
    )
    if drawing is None:
        raise problem(
            404,
            "structural_drawing_not_found",
            "Structural Drawing was not found",
        )
    await db.delete(drawing)
    await db.commit()
