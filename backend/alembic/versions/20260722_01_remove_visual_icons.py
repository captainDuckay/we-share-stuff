"""remove persisted visual icons

Revision ID: 20260722_01
Revises: 20260718_02
Create Date: 2026-07-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260722_01"
down_revision: str | None = "20260718_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("sharing_groups", "visual_icon")
    op.drop_column("items", "visual_icon")


def downgrade() -> None:
    op.add_column(
        "items", sa.Column("visual_icon", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "sharing_groups",
        sa.Column("visual_icon", sa.String(length=100), nullable=True),
    )
