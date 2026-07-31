"""link Items to Placement Slots for Typical Placement

Revision ID: 20260731_03
Revises: 20260731_02
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260731_03"
down_revision: str | None = "20260731_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing free-text typical_placement values are preserved unchanged.
    # placement_slot_id is optional; Items without a link keep free-text-only
    # or empty Typical Placement.
    op.add_column(
        "items",
        sa.Column("placement_slot_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_items_placement_slot_id"),
        "items",
        ["placement_slot_id"],
    )
    op.create_foreign_key(
        "items_placement_slot_id_fkey",
        "items",
        "placement_slots",
        ["placement_slot_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("items_placement_slot_id_fkey", "items", type_="foreignkey")
    op.drop_index(op.f("ix_items_placement_slot_id"), table_name="items")
    op.drop_column("items", "placement_slot_id")
