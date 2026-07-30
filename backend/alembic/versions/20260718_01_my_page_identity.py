"""my page identity

Revision ID: 20260718_01
Revises: 20260713_02
Create Date: 2026-07-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260718_01"
down_revision: str | None = "20260713_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("display_name", sa.String(length=200), nullable=True)
    )
    op.execute(sa.text("UPDATE users SET display_name = 'User'"))
    op.alter_column("users", "display_name", nullable=False)
    op.create_check_constraint(
        "users_display_name_not_blank", "users", "length(display_name) >= 1"
    )
    op.create_check_constraint(
        "users_display_name_max_length", "users", "length(display_name) <= 200"
    )
    op.create_table(
        "profile_photos",
        sa.Column("user_id", sa.Uuid(), nullable=False),
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
        sa.CheckConstraint("size_bytes > 0", name="profile_photos_size_positive"),
        sa.CheckConstraint(
            "length(content_type) <= 100",
            name="profile_photos_content_type_max_length",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("storage_path"),
    )


def downgrade() -> None:
    op.drop_table("profile_photos")
    op.drop_constraint("users_display_name_max_length", "users", type_="check")
    op.drop_constraint("users_display_name_not_blank", "users", type_="check")
    op.drop_column("users", "display_name")
