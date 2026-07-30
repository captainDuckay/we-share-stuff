from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "length(display_name) >= 1", name="users_display_name_not_blank"
        ),
        CheckConstraint(
            "length(display_name) <= 200", name="users_display_name_max_length"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    profile_photo: Mapped[ProfilePhoto | None] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="joined",
        uselist=False,
    )


class ProfilePhoto(Base):
    __tablename__ = "profile_photos"
    __table_args__ = (
        CheckConstraint("size_bytes > 0", name="profile_photos_size_positive"),
        CheckConstraint(
            "length(content_type) <= 100", name="profile_photos_content_type_max_length"
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    storage_path: Mapped[str] = mapped_column(String(500), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="profile_photo")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    token_digest: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_digest: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    invalidated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class TypicalLocation(Base):
    __tablename__ = "typical_locations"
    __table_args__ = (
        CheckConstraint("length(name) >= 1", name="typical_locations_name_not_blank"),
        CheckConstraint(
            "length(name) <= 200", name="typical_locations_name_max_length"
        ),
        CheckConstraint(
            "details IS NULL OR length(details) <= 2000",
            name="typical_locations_details_max_length",
        ),
        CheckConstraint(
            "length(timezone) >= 1", name="typical_locations_timezone_not_blank"
        ),
        CheckConstraint(
            "length(timezone) <= 100", name="typical_locations_timezone_max_length"
        ),
        Index("typical_locations_owner_created_at_index", "owner_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    details: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    timezone: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        CheckConstraint("length(name) >= 1", name="items_name_not_blank"),
        CheckConstraint("length(name) <= 200", name="items_name_max_length"),
        CheckConstraint(
            "description IS NULL OR length(description) <= 2000",
            name="items_description_max_length",
        ),
        CheckConstraint(
            "typical_placement IS NULL OR length(typical_placement) <= 2000",
            name="items_typical_placement_max_length",
        ),
        Index("items_owner_created_at_index", "owner_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    typical_location_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("typical_locations.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    typical_placement: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    typical_location: Mapped[TypicalLocation | None] = relationship()


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("length(name) >= 1", name="categories_name_not_blank"),
        CheckConstraint("length(name) <= 100", name="categories_name_max_length"),
        Index("categories_name_index", "name", unique=True),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class ItemCategory(Base):
    __tablename__ = "item_categories"

    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )
    category_id: Mapped[UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True
    )

    category: Mapped[Category] = relationship()


class ItemPhoto(Base):
    __tablename__ = "item_photos"
    __table_args__ = (
        CheckConstraint("size_bytes > 0", name="item_photos_size_positive"),
        CheckConstraint(
            "length(content_type) <= 100", name="item_photos_content_type_max_length"
        ),
        Index("item_photos_item_created_at_index", "item_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), index=True
    )
    storage_path: Mapped[str] = mapped_column(String(500), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    item: Mapped[Item] = relationship()


class SharingGroup(Base):
    __tablename__ = "sharing_groups"
    __table_args__ = (
        CheckConstraint("length(name) >= 1", name="sharing_groups_name_not_blank"),
        CheckConstraint("length(name) <= 200", name="sharing_groups_name_max_length"),
        Index(
            "sharing_groups_created_by_created_at_index", "created_by_id", "created_at"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200))
    created_by_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    created_by: Mapped[User] = relationship()


class SharingGroupPhoto(Base):
    __tablename__ = "sharing_group_photos"
    __table_args__ = (
        CheckConstraint("size_bytes > 0", name="sharing_group_photos_size_positive"),
        CheckConstraint(
            "length(content_type) <= 100",
            name="sharing_group_photos_content_type_max_length",
        ),
    )

    sharing_group_id: Mapped[UUID] = mapped_column(
        ForeignKey("sharing_groups.id", ondelete="CASCADE"), primary_key=True
    )
    storage_path: Mapped[str] = mapped_column(String(500), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SharingGroupMember(Base):
    __tablename__ = "sharing_group_members"
    __table_args__ = (Index("sharing_group_members_user_index", "user_id"),)

    sharing_group_id: Mapped[UUID] = mapped_column(
        ForeignKey("sharing_groups.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    sharing_group: Mapped[SharingGroup] = relationship()
    user: Mapped[User] = relationship()


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'cancelled')",
            name="invitations_status_valid",
        ),
        Index("invitations_email_status_index", "invited_email", "status"),
        Index("invitations_group_status_index", "sharing_group_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    sharing_group_id: Mapped[UUID] = mapped_column(
        ForeignKey("sharing_groups.id", ondelete="CASCADE"), index=True
    )
    invited_email: Mapped[str] = mapped_column(String(320), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    sharing_group: Mapped[SharingGroup] = relationship()


class ItemSharing(Base):
    __tablename__ = "item_sharing"
    __table_args__ = (
        Index("item_sharing_group_shared_at_index", "sharing_group_id", "shared_at"),
    )

    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )
    sharing_group_id: Mapped[UUID] = mapped_column(
        ForeignKey("sharing_groups.id", ondelete="CASCADE"), primary_key=True
    )
    shared_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    item: Mapped[Item] = relationship()
    sharing_group: Mapped[SharingGroup] = relationship()


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'withdrawn', 'cancelled')",
            name="reservations_status_valid",
        ),
        CheckConstraint("end_at > start_at", name="reservations_end_after_start"),
        Index(
            "reservations_item_status_time_index",
            "item_id",
            "status",
            "start_at",
            "end_at",
        ),
        Index("reservations_requester_status_index", "requester_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    sharing_group_id: Mapped[UUID] = mapped_column(
        ForeignKey("sharing_groups.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), index=True
    )
    requester_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    sharing_group: Mapped[SharingGroup] = relationship()
    item: Mapped[Item] = relationship()
    requester: Mapped[User] = relationship()


class ReservationChangeProposal(Base):
    __tablename__ = "reservation_change_proposals"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'void')",
            name="reservation_change_proposals_status_valid",
        ),
        CheckConstraint(
            "proposed_end_at > proposed_start_at",
            name="reservation_change_proposals_end_after_start",
        ),
        Index(
            "reservation_change_proposals_reservation_status_index",
            "reservation_id",
            "status",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    reservation_id: Mapped[UUID] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"), index=True
    )
    proposed_by_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    proposed_start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    proposed_end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    reservation: Mapped[Reservation] = relationship()
    proposed_by: Mapped[User] = relationship()
