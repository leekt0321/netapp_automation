"""P2 log summary paths

Revision ID: 20260415_03
Revises: 20260415_02
Create Date: 2026-04-15 11:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260415_03"
down_revision: Union[str, None] = "20260415_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("uploaded_logs")}
    if "summary_path" not in columns:
        op.add_column("uploaded_logs", sa.Column("summary_path", sa.String(length=500), nullable=True))
        op.execute(
            """
            UPDATE uploaded_logs
            SET summary_path = regexp_replace(stored_path, E'([^/]+)$', regexp_replace(filename, E'\\.[^.]+$', '') || '_summary.txt')
            WHERE summary_path IS NULL AND stored_path IS NOT NULL AND filename IS NOT NULL
            """
        )
    index_names = {index["name"] for index in inspector.get_indexes("uploaded_logs")}
    if "ix_uploaded_logs_summary_path" not in index_names:
        op.create_index("ix_uploaded_logs_summary_path", "uploaded_logs", ["summary_path"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    index_names = {index["name"] for index in inspector.get_indexes("uploaded_logs")}
    if "ix_uploaded_logs_summary_path" in index_names:
        op.drop_index("ix_uploaded_logs_summary_path", table_name="uploaded_logs")
    columns = {column["name"] for column in inspector.get_columns("uploaded_logs")}
    if "summary_path" in columns:
        op.drop_column("uploaded_logs", "summary_path")
