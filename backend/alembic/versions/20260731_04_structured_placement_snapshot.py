"""Store structured Typical Placement snapshot on reservations.

Revision ID: 20260731_04
Revises: 20260731_03
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260731_04"
down_revision: str | None = "20260731_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("reservations") as batch:
        batch.add_column(
            sa.Column(
                "typical_placement_structured_snapshot",
                sa.JSON(),
                nullable=True,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("reservations") as batch:
        batch.drop_column("typical_placement_structured_snapshot")
