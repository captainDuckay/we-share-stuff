"""add Placement Surfaces, Slots, and Structural Drawings

Revision ID: 20260731_01
Revises: 20260722_02
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260731_01"
down_revision: str | None = "20260722_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "placement_surfaces",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("typical_location_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(name) >= 1", name="placement_surfaces_name_not_blank"
        ),
        sa.CheckConstraint(
            "length(name) <= 200", name="placement_surfaces_name_max_length"
        ),
        sa.ForeignKeyConstraint(
            ["typical_location_id"],
            ["typical_locations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "placement_surfaces_location_created_at_index",
        "placement_surfaces",
        ["typical_location_id", "created_at"],
    )
    op.create_index(
        op.f("ix_placement_surfaces_typical_location_id"),
        "placement_surfaces",
        ["typical_location_id"],
    )

    op.create_table(
        "placement_slots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("surface_id", sa.Uuid(), nullable=False),
        sa.Column("typical_location_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("height", sa.Float(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(label) >= 1", name="placement_slots_label_not_blank"
        ),
        sa.CheckConstraint(
            "length(label) <= 200", name="placement_slots_label_max_length"
        ),
        sa.CheckConstraint("width > 0", name="placement_slots_width_positive"),
        sa.CheckConstraint("height > 0", name="placement_slots_height_positive"),
        sa.ForeignKeyConstraint(
            ["surface_id"], ["placement_surfaces.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["typical_location_id"],
            ["typical_locations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "placement_slots_location_label_index",
        "placement_slots",
        ["typical_location_id", "label"],
    )
    op.create_index(
        "placement_slots_surface_index", "placement_slots", ["surface_id"]
    )
    op.create_index(
        op.f("ix_placement_slots_surface_id"), "placement_slots", ["surface_id"]
    )
    op.create_index(
        op.f("ix_placement_slots_typical_location_id"),
        "placement_slots",
        ["typical_location_id"],
    )

    op.create_table(
        "structural_drawings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("surface_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("x", sa.Float(), nullable=True),
        sa.Column("y", sa.Float(), nullable=True),
        sa.Column("width", sa.Float(), nullable=True),
        sa.Column("height", sa.Float(), nullable=True),
        sa.Column("points", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('rect', 'polyline')",
            name="structural_drawings_kind_valid",
        ),
        sa.CheckConstraint(
            "width IS NULL OR width > 0",
            name="structural_drawings_width_positive",
        ),
        sa.CheckConstraint(
            "height IS NULL OR height > 0",
            name="structural_drawings_height_positive",
        ),
        sa.ForeignKeyConstraint(
            ["surface_id"], ["placement_surfaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "structural_drawings_surface_index", "structural_drawings", ["surface_id"]
    )
    op.create_index(
        op.f("ix_structural_drawings_surface_id"),
        "structural_drawings",
        ["surface_id"],
    )


def downgrade() -> None:
    op.drop_table("structural_drawings")
    op.drop_table("placement_slots")
    op.drop_table("placement_surfaces")
