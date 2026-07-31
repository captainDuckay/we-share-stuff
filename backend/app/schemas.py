import math
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

NAME_MAX_LENGTH = 200
DESCRIPTION_MAX_LENGTH = 2_000
PLACEMENT_MAX_LENGTH = 2_000
TIMEZONE_MAX_LENGTH = 100
CATEGORY_MAX_LENGTH = 100
PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 128
INVITATION_STATUSES = {"pending", "accepted", "declined", "cancelled"}
RESERVATION_STATUSES = {"pending", "accepted", "declined", "withdrawn", "cancelled"}
CHANGE_PROPOSAL_STATUSES = {"pending", "approved", "rejected", "void"}


def normalized_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("must not be blank")
    return normalized


def normalized_description(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def normalized_category(value: str) -> str:
    normalized = value.strip().lower()
    if not normalized:
        raise ValueError("must not be blank")
    return normalized


def normalized_timezone(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("must not be blank")
    try:
        ZoneInfo(normalized)
    except ZoneInfoNotFoundError as error:
        raise ValueError("must be an IANA timezone") from error
    return normalized


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AliasModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, serialize_by_alias=True, validate_by_name=True
    )


class Credentials(StrictModel):
    email: EmailStr
    password: Annotated[
        str, Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    ]

    @field_validator("email", mode="before")
    @classmethod
    def trim_email(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class RegistrationInput(Credentials):
    display_name: Annotated[
        str, Field(max_length=NAME_MAX_LENGTH, validation_alias="displayName")
    ]

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        return normalized_name(value)


class ProfileUpdate(StrictModel):
    display_name: Annotated[
        str, Field(max_length=NAME_MAX_LENGTH, validation_alias="displayName")
    ]

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        return normalized_name(value)


class ItemCreate(StrictModel):
    name: Annotated[str, Field(max_length=NAME_MAX_LENGTH)]
    description: Annotated[
        str | None, Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    ] = None
    typical_location_id: UUID | None = Field(
        default=None, validation_alias="typicalLocationId"
    )
    typical_placement: Annotated[
        str | None,
        Field(
            default=None,
            max_length=PLACEMENT_MAX_LENGTH,
            validation_alias="typicalPlacement",
        ),
    ] = None
    placement_slot_id: UUID | None = Field(
        default=None, validation_alias="placementSlotId"
    )
    categories: list[Annotated[str, Field(max_length=CATEGORY_MAX_LENGTH)]] = []

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalized_name(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return normalized_description(value)

    @field_validator("typical_placement")
    @classmethod
    def validate_typical_placement(cls, value: str | None) -> str | None:
        return normalized_description(value)

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(normalized_category(category) for category in value))


class ItemUpdate(StrictModel):
    name: Annotated[str | None, Field(default=None, max_length=NAME_MAX_LENGTH)] = None
    description: Annotated[
        str | None, Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    ] = None
    typical_location_id: UUID | None = Field(
        default=None, validation_alias="typicalLocationId"
    )
    typical_placement: Annotated[
        str | None,
        Field(
            default=None,
            max_length=PLACEMENT_MAX_LENGTH,
            validation_alias="typicalPlacement",
        ),
    ] = None
    placement_slot_id: UUID | None = Field(
        default=None, validation_alias="placementSlotId"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return normalized_name(value) if value is not None else None

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return normalized_description(value)

    @field_validator("typical_placement")
    @classmethod
    def validate_typical_placement(cls, value: str | None) -> str | None:
        return normalized_description(value)


class TypicalLocationInput(StrictModel):
    name: Annotated[str, Field(max_length=NAME_MAX_LENGTH)]
    details: Annotated[
        str | None, Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    ] = None
    timezone: Annotated[str, Field(max_length=TIMEZONE_MAX_LENGTH)]

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalized_name(value)

    @field_validator("details")
    @classmethod
    def validate_details(cls, value: str | None) -> str | None:
        return normalized_description(value)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        return normalized_timezone(value)


class TypicalLocationPatch(StrictModel):
    name: Annotated[str | None, Field(default=None, max_length=NAME_MAX_LENGTH)] = None
    details: Annotated[
        str | None, Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    ] = None
    timezone: Annotated[
        str | None, Field(default=None, max_length=TIMEZONE_MAX_LENGTH)
    ] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return normalized_name(value) if value is not None else None

    @field_validator("details")
    @classmethod
    def validate_details(cls, value: str | None) -> str | None:
        return normalized_description(value)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        return normalized_timezone(value) if value is not None else None


class SharingGroupInput(StrictModel):
    name: Annotated[str, Field(max_length=NAME_MAX_LENGTH)]

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalized_name(value)


class InvitationCreate(StrictModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def trim_email(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ReservationRequestInput(StrictModel):
    start_local: str = Field(validation_alias="startLocal")
    end_local: str = Field(validation_alias="endLocal")

    @field_validator("start_local", "end_local")
    @classmethod
    def validate_local_datetime_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("must not be blank")
        return normalized


class ReservationChangeProposalInput(ReservationRequestInput):
    pass


class UserResponse(AliasModel):
    id: UUID
    email: str
    display_name: str = Field(serialization_alias="displayName")
    profile_photo_url: str | None = Field(serialization_alias="profilePhotoUrl")


class UserEnvelope(BaseModel):
    user: UserResponse


class UserSummary(AliasModel):
    id: UUID
    display_name: str = Field(serialization_alias="displayName")
    profile_photo_url: str | None = Field(serialization_alias="profilePhotoUrl")


class TypicalLocationResponse(AliasModel):
    id: UUID
    name: str
    details: str | None
    timezone: str
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class ManagedTypicalLocationResponse(TypicalLocationResponse):
    assigned_item_count: int = Field(default=0, serialization_alias="assignedItemCount")


class TypicalLocationEnvelope(AliasModel):
    typical_location: ManagedTypicalLocationResponse = Field(
        serialization_alias="typicalLocation"
    )


class TypicalLocationsEnvelope(AliasModel):
    typical_locations: list[ManagedTypicalLocationResponse] = Field(
        serialization_alias="typicalLocations"
    )


class CategoryResponse(AliasModel):
    id: UUID | None = None
    name: str


class ItemPlacementSlotResponse(AliasModel):
    """Owner-facing summary of the Placement Slot linked as Typical Placement."""

    id: UUID
    label: str
    surface_id: UUID = Field(serialization_alias="surfaceId")
    surface_name: str = Field(serialization_alias="surfaceName")


class ItemResponse(AliasModel):
    id: UUID
    name: str
    description: str | None
    typical_location: TypicalLocationResponse | None = Field(
        serialization_alias="typicalLocation"
    )
    typical_placement: str | None = Field(serialization_alias="typicalPlacement")
    placement_slot_id: UUID | None = Field(
        default=None, serialization_alias="placementSlotId"
    )
    placement_slot: ItemPlacementSlotResponse | None = Field(
        default=None, serialization_alias="placementSlot"
    )
    categories: list[CategoryResponse] = []
    photo_url: str | None = Field(default=None, serialization_alias="photoUrl")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class ItemEnvelope(BaseModel):
    item: ItemResponse


class ItemsEnvelope(BaseModel):
    items: list[ItemResponse]


class ItemPhotoResponse(AliasModel):
    id: UUID
    item_id: UUID = Field(serialization_alias="itemId")
    url: str
    content_type: str = Field(serialization_alias="contentType")
    size_bytes: int = Field(serialization_alias="sizeBytes")
    created_at: datetime = Field(serialization_alias="createdAt")


class ItemPhotoEnvelope(AliasModel):
    item_photo: ItemPhotoResponse = Field(serialization_alias="itemPhoto")


class ItemPhotosEnvelope(AliasModel):
    item_photos: list[ItemPhotoResponse] = Field(serialization_alias="itemPhotos")


class SharingGroupSummary(AliasModel):
    id: UUID
    name: str


class SharingGroupResponse(AliasModel):
    id: UUID
    name: str
    created_by: UserSummary = Field(serialization_alias="createdBy")
    current_user_can_manage: bool = Field(serialization_alias="currentUserCanManage")
    member_count: int = Field(serialization_alias="memberCount")
    photo_url: str | None = Field(default=None, serialization_alias="photoUrl")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class SharingGroupEnvelope(AliasModel):
    sharing_group: SharingGroupResponse = Field(serialization_alias="sharingGroup")


class SharingGroupsEnvelope(AliasModel):
    sharing_groups: list[SharingGroupResponse] = Field(
        serialization_alias="sharingGroups"
    )


class SharingGroupMemberResponse(AliasModel):
    user: UserSummary
    joined_at: datetime = Field(serialization_alias="joinedAt")
    is_creator: bool = Field(serialization_alias="isCreator")


class SharingGroupMembersEnvelope(AliasModel):
    members: list[SharingGroupMemberResponse]


class InvitationResponse(AliasModel):
    id: UUID
    sharing_group: SharingGroupSummary = Field(serialization_alias="sharingGroup")
    invited_email: str = Field(serialization_alias="invitedEmail")
    status: Literal["pending", "accepted", "declined", "cancelled"]
    created_at: datetime = Field(serialization_alias="createdAt")
    responded_at: datetime | None = Field(serialization_alias="respondedAt")


class InvitationEnvelope(AliasModel):
    invitation: InvitationResponse


class InvitationsEnvelope(AliasModel):
    invitations: list[InvitationResponse]


class InvitationAcceptEnvelope(AliasModel):
    invitation: InvitationResponse
    sharing_group: SharingGroupResponse = Field(serialization_alias="sharingGroup")


class ShareReadiness(AliasModel):
    can_share: bool = Field(serialization_alias="canShare")
    missing: list[Literal["typicalLocation"]]


class ItemSharingResponse(AliasModel):
    item_id: UUID = Field(serialization_alias="itemId")
    sharing_group: SharingGroupSummary = Field(serialization_alias="sharingGroup")
    shared_at: datetime = Field(serialization_alias="sharedAt")


class ItemSharingEnvelope(AliasModel):
    item_sharing: ItemSharingResponse = Field(serialization_alias="itemSharing")


class ItemSharingStatusEnvelope(AliasModel):
    share_readiness: ShareReadiness = Field(serialization_alias="shareReadiness")
    item_sharing: list[ItemSharingResponse] = Field(serialization_alias="itemSharing")


class ReservationRange(AliasModel):
    start_at: datetime = Field(serialization_alias="startAt")
    end_at: datetime = Field(serialization_alias="endAt")
    timezone: str


class TypicalPlacementVisibility(AliasModel):
    visible: bool
    value: str | None


class SharedItemReservationState(AliasModel):
    requestable: bool
    accepted_ranges: list[ReservationRange] = Field(
        serialization_alias="acceptedRanges"
    )


class SharedItemResponse(AliasModel):
    id: UUID
    owner: UserSummary
    name: str
    description: str | None
    visible_through: list[SharingGroupSummary] = Field(
        serialization_alias="visibleThrough"
    )
    item_photos: list[ItemPhotoResponse] = Field(serialization_alias="itemPhotos")
    categories: list[CategoryResponse] = []
    typical_location: TypicalLocationResponse = Field(
        serialization_alias="typicalLocation"
    )
    typical_placement: TypicalPlacementVisibility = Field(
        serialization_alias="typicalPlacement"
    )
    reservation_state: SharedItemReservationState = Field(
        serialization_alias="reservationState"
    )


class SharedItemEnvelope(AliasModel):
    shared_item: SharedItemResponse = Field(serialization_alias="sharedItem")


class SharedItemsEnvelope(AliasModel):
    shared_items: list[SharedItemResponse] = Field(serialization_alias="sharedItems")


class ReservationItemResponse(AliasModel):
    id: UUID
    name: str
    owner: UserSummary
    photo_url: str | None = Field(default=None, serialization_alias="photoUrl")
    typical_location: TypicalLocationResponse = Field(
        serialization_alias="typicalLocation"
    )
    typical_placement: TypicalPlacementVisibility = Field(
        serialization_alias="typicalPlacement"
    )


class ReservationResponse(AliasModel):
    id: UUID
    sharing_group: SharingGroupSummary = Field(serialization_alias="sharingGroup")
    item: ReservationItemResponse
    requester: UserSummary
    status: Literal["pending", "accepted", "declined", "withdrawn", "cancelled"]
    start_local: str = Field(serialization_alias="startLocal")
    end_local: str = Field(serialization_alias="endLocal")
    start_at: datetime = Field(serialization_alias="startAt")
    end_at: datetime = Field(serialization_alias="endAt")
    timezone: str
    created_at: datetime = Field(serialization_alias="createdAt")
    decided_at: datetime | None = Field(serialization_alias="decidedAt")
    conflicts_with_accepted_reservation: bool = Field(
        serialization_alias="conflictsWithAcceptedReservation"
    )


class ReservationEnvelope(AliasModel):
    reservation: ReservationResponse


class ReservationsEnvelope(AliasModel):
    reservations: list[ReservationResponse]


class ReservationChangeProposalResponse(AliasModel):
    id: UUID
    reservation: ReservationResponse
    proposed_by: UserSummary = Field(serialization_alias="proposedBy")
    status: Literal["pending", "approved", "rejected", "void"]
    start_local: str = Field(serialization_alias="startLocal")
    end_local: str = Field(serialization_alias="endLocal")
    start_at: datetime = Field(serialization_alias="startAt")
    end_at: datetime = Field(serialization_alias="endAt")
    timezone: str
    created_at: datetime = Field(serialization_alias="createdAt")
    decided_at: datetime | None = Field(serialization_alias="decidedAt")


class ReservationChangeProposalEnvelope(AliasModel):
    change_proposal: ReservationChangeProposalResponse = Field(
        serialization_alias="changeProposal"
    )


class ReservationChangeProposalsEnvelope(AliasModel):
    change_proposals: list[ReservationChangeProposalResponse] = Field(
        serialization_alias="changeProposals"
    )


SLOT_LABEL_MAX_LENGTH = NAME_MAX_LENGTH
STRUCTURAL_DRAWING_KINDS = frozenset({"rect", "polyline"})
POLYLINE_POINTS_MIN = 2
POLYLINE_POINTS_MAX = 500
MAX_PLACEMENT_SURFACES_PER_LOCATION = 50
MAX_PLACEMENT_SLOTS_PER_LOCATION = 200
MAX_STRUCTURAL_DRAWINGS_PER_SURFACE = 200


def require_finite_number(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("must be a finite number")
    return value


class PlacementSurfaceInput(StrictModel):
    name: Annotated[str, Field(max_length=NAME_MAX_LENGTH)]

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalized_name(value)


class PlacementSurfacePatch(StrictModel):
    name: Annotated[str | None, Field(default=None, max_length=NAME_MAX_LENGTH)] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return normalized_name(value) if value is not None else None


class PlacementSlotInput(StrictModel):
    label: Annotated[str, Field(max_length=SLOT_LABEL_MAX_LENGTH)]
    x: float
    y: float
    width: Annotated[float, Field(gt=0)]
    height: Annotated[float, Field(gt=0)]

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        return normalized_name(value)

    @field_validator("x", "y", "width", "height")
    @classmethod
    def validate_finite_geometry(cls, value: float) -> float:
        return require_finite_number(value)


class PlacementSlotPatch(StrictModel):
    label: Annotated[
        str | None, Field(default=None, max_length=SLOT_LABEL_MAX_LENGTH)
    ] = None
    x: float | None = None
    y: float | None = None
    width: Annotated[float | None, Field(default=None, gt=0)] = None
    height: Annotated[float | None, Field(default=None, gt=0)] = None

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str | None) -> str | None:
        return normalized_name(value) if value is not None else None

    @field_validator("x", "y", "width", "height")
    @classmethod
    def validate_finite_geometry(cls, value: float | None) -> float | None:
        if value is None:
            return None
        return require_finite_number(value)


class PointInput(StrictModel):
    x: float
    y: float

    @field_validator("x", "y")
    @classmethod
    def validate_finite(cls, value: float) -> float:
        return require_finite_number(value)


class StructuralDrawingInput(StrictModel):
    kind: Literal["rect", "polyline"]
    x: float | None = None
    y: float | None = None
    width: Annotated[float | None, Field(default=None, gt=0)] = None
    height: Annotated[float | None, Field(default=None, gt=0)] = None
    points: (
        Annotated[
            list[PointInput],
            Field(min_length=POLYLINE_POINTS_MIN, max_length=POLYLINE_POINTS_MAX),
        ]
        | None
    ) = None

    @field_validator("x", "y", "width", "height")
    @classmethod
    def validate_finite_geometry(cls, value: float | None) -> float | None:
        if value is None:
            return None
        return require_finite_number(value)

    @model_validator(mode="after")
    def validate_geometry_for_kind(self) -> "StructuralDrawingInput":
        if self.kind == "rect":
            if (
                self.x is None
                or self.y is None
                or self.width is None
                or self.height is None
            ):
                raise ValueError("rect requires x, y, width, and height")
            if self.points is not None:
                raise ValueError("rect must not include points")
        else:
            if self.points is None:
                raise ValueError("polyline requires points")
            if (
                self.x is not None
                or self.y is not None
                or self.width is not None
                or self.height is not None
            ):
                raise ValueError("polyline must not include rect geometry")
        return self


class StructuralDrawingPatch(StrictModel):
    x: float | None = None
    y: float | None = None
    width: Annotated[float | None, Field(default=None, gt=0)] = None
    height: Annotated[float | None, Field(default=None, gt=0)] = None
    points: (
        Annotated[
            list[PointInput],
            Field(min_length=POLYLINE_POINTS_MIN, max_length=POLYLINE_POINTS_MAX),
        ]
        | None
    ) = None

    @field_validator("x", "y", "width", "height")
    @classmethod
    def validate_finite_geometry(cls, value: float | None) -> float | None:
        if value is None:
            return None
        return require_finite_number(value)


class PlacementSlotResponse(AliasModel):
    id: UUID
    surface_id: UUID = Field(serialization_alias="surfaceId")
    label: str
    x: float
    y: float
    width: float
    height: float
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class PointResponse(AliasModel):
    x: float
    y: float


class StructuralDrawingResponse(AliasModel):
    id: UUID
    surface_id: UUID = Field(serialization_alias="surfaceId")
    kind: Literal["rect", "polyline"]
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    points: list[PointResponse] | None = None
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class PlacementSurfaceSummaryResponse(AliasModel):
    id: UUID
    typical_location_id: UUID = Field(serialization_alias="typicalLocationId")
    name: str
    slot_count: int = Field(default=0, serialization_alias="slotCount")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class PlacementSurfaceDetailResponse(PlacementSurfaceSummaryResponse):
    slots: list[PlacementSlotResponse] = []
    structural_drawings: list[StructuralDrawingResponse] = Field(
        default_factory=list, serialization_alias="structuralDrawings"
    )


class PlacementSurfaceEnvelope(AliasModel):
    placement_surface: PlacementSurfaceDetailResponse = Field(
        serialization_alias="placementSurface"
    )


class PlacementSurfaceSummaryEnvelope(AliasModel):
    placement_surface: PlacementSurfaceSummaryResponse = Field(
        serialization_alias="placementSurface"
    )


class PlacementSurfacesEnvelope(AliasModel):
    placement_surfaces: list[PlacementSurfaceSummaryResponse] = Field(
        serialization_alias="placementSurfaces"
    )


class PlacementSlotEnvelope(AliasModel):
    placement_slot: PlacementSlotResponse = Field(
        serialization_alias="placementSlot"
    )


class StructuralDrawingEnvelope(AliasModel):
    structural_drawing: StructuralDrawingResponse = Field(
        serialization_alias="structuralDrawing"
    )
