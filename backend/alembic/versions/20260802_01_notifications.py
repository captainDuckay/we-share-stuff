"""Add notifications inbox table.

Revision ID: 20260802_01
Revises: 20260731_04
Create Date: 2026-08-02
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260802_01"
down_revision: str | None = "20260731_04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recipient_user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("subject_id", sa.Uuid(), nullable=False),
        sa.Column("subject_status", sa.String(length=40), nullable=False),
        sa.Column("attention", sa.String(length=20), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("deep_link", sa.JSON(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ("
            "'invitation', "
            "'reservation_request', "
            "'reservation_change_proposal'"
            ")",
            name="notifications_kind_valid",
        ),
        sa.CheckConstraint(
            "attention IN ('unread', 'read')",
            name="notifications_attention_valid",
        ),
        sa.CheckConstraint(
            "length(summary) >= 1",
            name="notifications_summary_not_blank",
        ),
        sa.CheckConstraint(
            "length(subject_status) >= 1",
            name="notifications_subject_status_not_blank",
        ),
        sa.ForeignKeyConstraint(
            ["recipient_user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recipient_user_id",
            "kind",
            "subject_id",
            name="notifications_recipient_kind_subject_unique",
        ),
    )
    op.create_index(
        "notifications_recipient_user_id_index",
        "notifications",
        ["recipient_user_id"],
    )
    op.create_index(
        "notifications_recipient_updated_at_index",
        "notifications",
        ["recipient_user_id", "updated_at"],
    )
    op.create_index(
        "notifications_recipient_attention_index",
        "notifications",
        ["recipient_user_id", "attention"],
    )


def downgrade() -> None:
    op.drop_index(
        "notifications_recipient_attention_index", table_name="notifications"
    )
    op.drop_index(
        "notifications_recipient_updated_at_index", table_name="notifications"
    )
    op.drop_index(
        "notifications_recipient_user_id_index", table_name="notifications"
    )
    op.drop_table("notifications")
