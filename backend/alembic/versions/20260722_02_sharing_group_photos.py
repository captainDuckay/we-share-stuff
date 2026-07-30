"""add Sharing Group Photos

Revision ID: 20260722_02
Revises: 20260722_01
Create Date: 2026-07-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260722_02"
down_revision: str | None = "20260722_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sharing_group_photos",
        sa.Column("sharing_group_id", sa.Uuid(), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
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
        sa.CheckConstraint("size_bytes > 0", name="sharing_group_photos_size_positive"),
        sa.CheckConstraint(
            "length(content_type) <= 100",
            name="sharing_group_photos_content_type_max_length",
        ),
        sa.ForeignKeyConstraint(
            ["sharing_group_id"], ["sharing_groups.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("sharing_group_id"),
        sa.UniqueConstraint("storage_path"),
    )


def downgrade() -> None:
    op.drop_table("sharing_group_photos")
