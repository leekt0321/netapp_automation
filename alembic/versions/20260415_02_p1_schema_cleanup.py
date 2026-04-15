"""P1 schema cleanup

Revision ID: 20260415_02
Revises: 20260415_01
Create Date: 2026-04-15 10:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260415_02"
down_revision: Union[str, None] = "20260415_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("uploaded_logs"):
        columns = {column["name"] for column in inspector.get_columns("uploaded_logs")}
        if "storage_name" in columns:
            op.execute("UPDATE uploaded_logs SET storage_name = 'storage1' WHERE storage_name IS NULL")
            op.alter_column("uploaded_logs", "storage_name", existing_type=sa.String(length=50), nullable=False)
        index_names = {index["name"] for index in inspector.get_indexes("uploaded_logs")}
        if "ix_uploaded_logs_site_id" not in index_names:
            op.create_index("ix_uploaded_logs_site_id", "uploaded_logs", ["site_id"], unique=False)

    if inspector.has_table("users"):
        columns = {column["name"] for column in inspector.get_columns("users")}
        if "role" in columns:
            op.execute("UPDATE users SET role = 'user' WHERE role IS NULL")
            op.alter_column("users", "role", existing_type=sa.String(length=20), nullable=False)
        if "approved_at" in columns:
            op.alter_column("users", "approved_at", existing_type=sa.DateTime(), type_=sa.DateTime(timezone=True), existing_nullable=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("uploaded_logs"):
        index_names = {index["name"] for index in inspector.get_indexes("uploaded_logs")}
        if "ix_uploaded_logs_site_id" in index_names:
            op.drop_index("ix_uploaded_logs_site_id", table_name="uploaded_logs")
        columns = {column["name"] for column in inspector.get_columns("uploaded_logs")}
        if "storage_name" in columns:
            op.alter_column("uploaded_logs", "storage_name", existing_type=sa.String(length=50), nullable=True)

    if inspector.has_table("users"):
        columns = {column["name"] for column in inspector.get_columns("users")}
        if "role" in columns:
            op.alter_column("users", "role", existing_type=sa.String(length=20), nullable=True)
        if "approved_at" in columns:
            op.alter_column("users", "approved_at", existing_type=sa.DateTime(timezone=True), type_=sa.DateTime(), existing_nullable=True)
