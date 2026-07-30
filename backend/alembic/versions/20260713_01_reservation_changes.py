"""Add reservation change proposals and expanded statuses.

Revision ID: 20260713_01
Revises: 20260712_01
Create Date: 2026-07-13

"""

import sqlalchemy as sa

from alembic import op

revision = "20260713_01"
down_revision = "20260712_01"
branch_labels = None
depends_on = None

STATUS_MAX_LENGTH = 20
TIMEZONE_MAX_LENGTH = 100


def timestamp_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        server_default=sa.func.now() if not nullable else None,
        nullable=nullable,
    )


def upgrade() -> None:
    with op.batch_alter_table("reservations") as batch:
        batch.drop_constraint("reservations_status_valid", type_="check")
        batch.create_check_constraint(
            "reservations_status_valid",
            "status IN ('pending', 'accepted', 'declined', 'withdrawn', 'cancelled')",
        )

    op.create_table(
        "reservation_change_proposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column("proposed_by_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=STATUS_MAX_LENGTH), nullable=False),
        sa.Column("proposed_start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("proposed_end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=TIMEZONE_MAX_LENGTH), nullable=False),
        timestamp_column("created_at"),
        timestamp_column("decided_at", nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'void')",
            name="reservation_change_proposals_status_valid",
        ),
        sa.CheckConstraint(
            "proposed_end_at > proposed_start_at",
            name="reservation_change_proposals_end_after_start",
        ),
        sa.ForeignKeyConstraint(
            ["reservation_id"], ["reservations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["proposed_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_reservation_change_proposals_reservation_id",
        "reservation_change_proposals",
        ["reservation_id"],
    )
    op.create_index(
        "ix_reservation_change_proposals_proposed_by_id",
        "reservation_change_proposals",
        ["proposed_by_id"],
    )
    op.create_index(
        "reservation_change_proposals_reservation_status_index",
        "reservation_change_proposals",
        ["reservation_id", "status"],
    )


def downgrade() -> None:
    op.drop_index(
        "reservation_change_proposals_reservation_status_index",
        table_name="reservation_change_proposals",
    )
    op.drop_index(
        "ix_reservation_change_proposals_proposed_by_id",
        table_name="reservation_change_proposals",
    )
    op.drop_index(
        "ix_reservation_change_proposals_reservation_id",
        table_name="reservation_change_proposals",
    )
    op.drop_table("reservation_change_proposals")

    with op.batch_alter_table("reservations") as batch:
        batch.drop_constraint("reservations_status_valid", type_="check")
        batch.create_check_constraint(
            "reservations_status_valid",
            "status IN ('pending', 'accepted', 'declined')",
        )
