"""enforce restricted Typical Location deletion

Revision ID: 20260718_02
Revises: 20260718_01
Create Date: 2026-07-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260718_02"
down_revision: str | None = "20260718_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("items_typical_location_id_fkey", "items", type_="foreignkey")
    op.create_foreign_key(
        "items_typical_location_id_fkey",
        "items",
        "typical_locations",
        ["typical_location_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("items_typical_location_id_fkey", "items", type_="foreignkey")
    op.create_foreign_key(
        "items_typical_location_id_fkey",
        "items",
        "typical_locations",
        ["typical_location_id"],
        ["id"],
        ondelete="SET NULL",
    )
