"""categories and visual icons

Revision ID: 20260713_02
Revises: 20260713_01
Create Date: 2026-07-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260713_02"
down_revision: str | None = "20260713_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("items", sa.Column("visual_icon", sa.String(length=100), nullable=True))
    op.add_column("sharing_groups", sa.Column("visual_icon", sa.String(length=100), nullable=True))
    op.create_table(
        "categories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.CheckConstraint("length(name) >= 1", name="categories_name_not_blank"),
        sa.CheckConstraint("length(name) <= 100", name="categories_name_max_length"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("categories_name_index", "categories", ["name"], unique=True)
    op.create_table(
        "item_categories",
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("item_id", "category_id"),
    )


def downgrade() -> None:
    op.drop_table("item_categories")
    op.drop_index("categories_name_index", table_name="categories")
    op.drop_table("categories")
    op.drop_column("sharing_groups", "visual_icon")
    op.drop_column("items", "visual_icon")
