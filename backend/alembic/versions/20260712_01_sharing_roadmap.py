"""Add sharing roadmap tables.

Revision ID: 20260712_01
Revises: 20260711_02
Create Date: 2026-07-12

"""

import sqlalchemy as sa

from alembic import op

revision = "20260712_01"
down_revision = "20260711_02"
branch_labels = None
depends_on = None

NAME_MAX_LENGTH = 200
DESCRIPTION_MAX_LENGTH = 2_000
TIMEZONE_MAX_LENGTH = 100
EMAIL_MAX_LENGTH = 320
STATUS_MAX_LENGTH = 20
CONTENT_TYPE_MAX_LENGTH = 100
STORAGE_PATH_MAX_LENGTH = 500


def timestamp_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        server_default=sa.func.now() if not nullable else None,
        nullable=nullable,
    )


def upgrade() -> None:
    op.create_table(
        "typical_locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=NAME_MAX_LENGTH), nullable=False),
        sa.Column("details", sa.String(length=DESCRIPTION_MAX_LENGTH), nullable=True),
        sa.Column("timezone", sa.String(length=TIMEZONE_MAX_LENGTH), nullable=False),
        timestamp_column("created_at"),
        timestamp_column("updated_at"),
        sa.CheckConstraint(
            "length(name) >= 1", name="typical_locations_name_not_blank"
        ),
        sa.CheckConstraint(
            f"length(name) <= {NAME_MAX_LENGTH}",
            name="typical_locations_name_max_length",
        ),
        sa.CheckConstraint(
            f"details IS NULL OR length(details) <= {DESCRIPTION_MAX_LENGTH}",
            name="typical_locations_details_max_length",
        ),
        sa.CheckConstraint(
            "length(timezone) >= 1", name="typical_locations_timezone_not_blank"
        ),
        sa.CheckConstraint(
            f"length(timezone) <= {TIMEZONE_MAX_LENGTH}",
            name="typical_locations_timezone_max_length",
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_typical_locations_owner_id",
        "typical_locations",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        "typical_locations_owner_created_at_index",
        "typical_locations",
        ["owner_id", "created_at"],
        unique=False,
    )
    op.add_column("items", sa.Column("typical_location_id", sa.Uuid(), nullable=True))
    op.add_column(
        "items",
        sa.Column(
            "typical_placement", sa.String(length=DESCRIPTION_MAX_LENGTH), nullable=True
        ),
    )
    op.create_foreign_key(
        "items_typical_location_id_fkey",
        "items",
        "typical_locations",
        ["typical_location_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_items_typical_location_id", "items", ["typical_location_id"], unique=False
    )
    op.create_check_constraint(
        "items_typical_placement_max_length",
        "items",
        f"typical_placement IS NULL OR length(typical_placement) <= {DESCRIPTION_MAX_LENGTH}",
    )
    op.create_table(
        "item_photos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column(
            "storage_path", sa.String(length=STORAGE_PATH_MAX_LENGTH), nullable=False
        ),
        sa.Column(
            "content_type", sa.String(length=CONTENT_TYPE_MAX_LENGTH), nullable=False
        ),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        timestamp_column("created_at"),
        sa.CheckConstraint("size_bytes > 0", name="item_photos_size_positive"),
        sa.CheckConstraint(
            f"length(content_type) <= {CONTENT_TYPE_MAX_LENGTH}",
            name="item_photos_content_type_max_length",
        ),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_path"),
    )
    op.create_index("ix_item_photos_item_id", "item_photos", ["item_id"], unique=False)
    op.create_index(
        "item_photos_item_created_at_index",
        "item_photos",
        ["item_id", "created_at"],
        unique=False,
    )
    op.create_table(
        "sharing_groups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=NAME_MAX_LENGTH), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        timestamp_column("created_at"),
        timestamp_column("updated_at"),
        sa.CheckConstraint("length(name) >= 1", name="sharing_groups_name_not_blank"),
        sa.CheckConstraint(
            f"length(name) <= {NAME_MAX_LENGTH}", name="sharing_groups_name_max_length"
        ),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sharing_groups_created_by_id",
        "sharing_groups",
        ["created_by_id"],
        unique=False,
    )
    op.create_index(
        "sharing_groups_created_by_created_at_index",
        "sharing_groups",
        ["created_by_id", "created_at"],
        unique=False,
    )
    op.create_table(
        "sharing_group_members",
        sa.Column("sharing_group_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        timestamp_column("joined_at"),
        sa.ForeignKeyConstraint(
            ["sharing_group_id"], ["sharing_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("sharing_group_id", "user_id"),
    )
    op.create_index(
        "sharing_group_members_user_index",
        "sharing_group_members",
        ["user_id"],
        unique=False,
    )
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sharing_group_id", sa.Uuid(), nullable=False),
        sa.Column("invited_email", sa.String(length=EMAIL_MAX_LENGTH), nullable=False),
        sa.Column("status", sa.String(length=STATUS_MAX_LENGTH), nullable=False),
        timestamp_column("created_at"),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'cancelled')",
            name="invitations_status_valid",
        ),
        sa.ForeignKeyConstraint(
            ["sharing_group_id"], ["sharing_groups.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_invitations_sharing_group_id",
        "invitations",
        ["sharing_group_id"],
        unique=False,
    )
    op.create_index(
        "ix_invitations_invited_email", "invitations", ["invited_email"], unique=False
    )
    op.create_index(
        "invitations_email_status_index",
        "invitations",
        ["invited_email", "status"],
        unique=False,
    )
    op.create_index(
        "invitations_group_status_index",
        "invitations",
        ["sharing_group_id", "status"],
        unique=False,
    )
    op.create_table(
        "item_sharing",
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("sharing_group_id", sa.Uuid(), nullable=False),
        timestamp_column("shared_at"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["sharing_group_id"], ["sharing_groups.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("item_id", "sharing_group_id"),
    )
    op.create_index(
        "item_sharing_group_shared_at_index",
        "item_sharing",
        ["sharing_group_id", "shared_at"],
        unique=False,
    )
    op.create_table(
        "reservations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sharing_group_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("requester_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=STATUS_MAX_LENGTH), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=TIMEZONE_MAX_LENGTH), nullable=False),
        timestamp_column("created_at"),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined')",
            name="reservations_status_valid",
        ),
        sa.CheckConstraint("end_at > start_at", name="reservations_end_after_start"),
        sa.ForeignKeyConstraint(
            ["sharing_group_id"], ["sharing_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_reservations_sharing_group_id",
        "reservations",
        ["sharing_group_id"],
        unique=False,
    )
    op.create_index(
        "ix_reservations_item_id", "reservations", ["item_id"], unique=False
    )
    op.create_index(
        "ix_reservations_requester_id",
        "reservations",
        ["requester_id"],
        unique=False,
    )
    op.create_index(
        "reservations_item_status_time_index",
        "reservations",
        ["item_id", "status", "start_at", "end_at"],
        unique=False,
    )
    op.create_index(
        "reservations_requester_status_index",
        "reservations",
        ["requester_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("reservations_requester_status_index", table_name="reservations")
    op.drop_index("reservations_item_status_time_index", table_name="reservations")
    op.drop_index("ix_reservations_requester_id", table_name="reservations")
    op.drop_index("ix_reservations_item_id", table_name="reservations")
    op.drop_index("ix_reservations_sharing_group_id", table_name="reservations")
    op.drop_table("reservations")
    op.drop_index("item_sharing_group_shared_at_index", table_name="item_sharing")
    op.drop_table("item_sharing")
    op.drop_index("invitations_group_status_index", table_name="invitations")
    op.drop_index("invitations_email_status_index", table_name="invitations")
    op.drop_index("ix_invitations_invited_email", table_name="invitations")
    op.drop_index("ix_invitations_sharing_group_id", table_name="invitations")
    op.drop_table("invitations")
    op.drop_index(
        "sharing_group_members_user_index", table_name="sharing_group_members"
    )
    op.drop_table("sharing_group_members")
    op.drop_index(
        "sharing_groups_created_by_created_at_index", table_name="sharing_groups"
    )
    op.drop_index("ix_sharing_groups_created_by_id", table_name="sharing_groups")
    op.drop_table("sharing_groups")
    op.drop_index("item_photos_item_created_at_index", table_name="item_photos")
    op.drop_index("ix_item_photos_item_id", table_name="item_photos")
    op.drop_table("item_photos")
    op.drop_constraint("items_typical_placement_max_length", "items", type_="check")
    op.drop_index("ix_items_typical_location_id", table_name="items")
    op.drop_constraint("items_typical_location_id_fkey", "items", type_="foreignkey")
    op.drop_column("items", "typical_placement")
    op.drop_column("items", "typical_location_id")
    op.drop_index(
        "typical_locations_owner_created_at_index", table_name="typical_locations"
    )
    op.drop_index("ix_typical_locations_owner_id", table_name="typical_locations")
    op.drop_table("typical_locations")
