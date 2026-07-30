"""Add authentication sessions and private inventory tables.

Revision ID: 20260711_02
Revises: 20260711_01
Create Date: 2026-07-11

"""

import sqlalchemy as sa

from alembic import op

revision = "20260711_02"
down_revision = "20260711_01"
branch_labels = None
depends_on = None

NAME_MAX_LENGTH = 200
DESCRIPTION_MAX_LENGTH = 2_000
TOKEN_DIGEST_LENGTH = 64
EMAIL_MAX_LENGTH = 320


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=EMAIL_MAX_LENGTH), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "token_digest", sa.String(length=TOKEN_DIGEST_LENGTH), nullable=False
        ),
        sa.Column("csrf_digest", sa.String(length=TOKEN_DIGEST_LENGTH), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_digest"),
    )
    op.create_index(
        "ix_sessions_token_digest", "sessions", ["token_digest"], unique=False
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], unique=False)
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"], unique=False)
    op.create_table(
        "items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=NAME_MAX_LENGTH), nullable=False),
        sa.Column(
            "description", sa.String(length=DESCRIPTION_MAX_LENGTH), nullable=True
        ),
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
        sa.CheckConstraint("length(name) >= 1", name="items_name_not_blank"),
        sa.CheckConstraint(
            f"length(name) <= {NAME_MAX_LENGTH}", name="items_name_max_length"
        ),
        sa.CheckConstraint(
            f"description IS NULL OR length(description) <= {DESCRIPTION_MAX_LENGTH}",
            name="items_description_max_length",
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_items_owner_id", "items", ["owner_id"], unique=False)
    op.create_index(
        "items_owner_created_at_index",
        "items",
        ["owner_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("items_owner_created_at_index", table_name="items")
    op.drop_index("ix_items_owner_id", table_name="items")
    op.drop_table("items")
    op.drop_index("ix_sessions_expires_at", table_name="sessions")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_index("ix_sessions_token_digest", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
