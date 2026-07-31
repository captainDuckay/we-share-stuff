"""Freeze free-text Typical Placement snapshot on reservations.

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

DESCRIPTION_MAX_LENGTH = 2_000


def upgrade() -> None:
    with op.batch_alter_table("reservations") as batch:
        batch.add_column(
            sa.Column(
                "typical_placement_snapshot",
                sa.String(length=DESCRIPTION_MAX_LENGTH),
                nullable=True,
            )
        )
        batch.create_check_constraint(
            "reservations_typical_placement_snapshot_max_length",
            "typical_placement_snapshot IS NULL"
            f" OR length(typical_placement_snapshot) <= {DESCRIPTION_MAX_LENGTH}",
        )


def downgrade() -> None:
    with op.batch_alter_table("reservations") as batch:
        batch.drop_constraint(
            "reservations_typical_placement_snapshot_max_length", type_="check"
        )
        batch.drop_column("typical_placement_snapshot")
