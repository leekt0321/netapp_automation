"""P1 baseline schema

Revision ID: 20260415_01
Revises:
Create Date: 2026-04-15 10:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260415_01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def has_table(inspector, table_name: str) -> bool:
    return inspector.has_table(table_name)


def get_column_names(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def get_index_names(inspector, table_name: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table_name)}


def create_index_if_missing(inspector, table_name: str, index_name: str, columns: list[str], unique: bool = False) -> None:
    if index_name not in get_index_names(inspector, table_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not has_table(inspector, "storage_sites"):
        op.create_table(
            "storage_sites",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("storage_name", sa.String(length=50), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        inspector = sa.inspect(bind)
    create_index_if_missing(inspector, "storage_sites", "ix_storage_sites_id", ["id"])
    create_index_if_missing(inspector, "storage_sites", "ix_storage_sites_storage_name", ["storage_name"])

    if not has_table(inspector, "uploaded_logs"):
        op.create_table(
            "uploaded_logs",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("filename", sa.String(length=255), nullable=False),
            sa.Column("stored_path", sa.String(length=500), nullable=False),
            sa.Column("content_type", sa.String(length=255), nullable=True),
            sa.Column("size", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="uploaded"),
            sa.Column("storage_name", sa.String(length=50), nullable=False, server_default="storage1"),
            sa.Column("site_id", sa.Integer(), nullable=True),
            sa.Column("manual_fields_json", sa.Text(), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        inspector = sa.inspect(bind)
    else:
        uploaded_log_columns = get_column_names(inspector, "uploaded_logs")
        if "storage_name" not in uploaded_log_columns:
            op.add_column("uploaded_logs", sa.Column("storage_name", sa.String(length=50), nullable=True, server_default="storage1"))
            op.execute("UPDATE uploaded_logs SET storage_name = 'storage1' WHERE storage_name IS NULL")
            op.alter_column("uploaded_logs", "storage_name", server_default=None, nullable=False)
        else:
            op.execute("UPDATE uploaded_logs SET storage_name = 'storage1' WHERE storage_name IS NULL")
            op.alter_column("uploaded_logs", "storage_name", existing_type=sa.String(length=50), nullable=False)
        if "site_id" not in uploaded_log_columns:
            op.add_column("uploaded_logs", sa.Column("site_id", sa.Integer(), nullable=True))
        if "manual_fields_json" not in uploaded_log_columns:
            op.add_column("uploaded_logs", sa.Column("manual_fields_json", sa.Text(), nullable=True))
        if "note" not in uploaded_log_columns:
            op.add_column("uploaded_logs", sa.Column("note", sa.Text(), nullable=True))
        inspector = sa.inspect(bind)
    create_index_if_missing(inspector, "uploaded_logs", "ix_uploaded_logs_id", ["id"])
    create_index_if_missing(inspector, "uploaded_logs", "ix_uploaded_logs_site_id", ["site_id"])

    if not has_table(inspector, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("username", sa.String(length=100), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("full_name", sa.String(length=255), nullable=True),
            sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        inspector = sa.inspect(bind)
    else:
        user_columns = get_column_names(inspector, "users")
        if "role" not in user_columns:
            op.add_column("users", sa.Column("role", sa.String(length=20), nullable=True, server_default="user"))
            op.execute("UPDATE users SET role = 'user' WHERE role IS NULL")
            op.alter_column("users", "role", server_default=None, nullable=False)
        else:
            op.execute("UPDATE users SET role = 'user' WHERE role IS NULL")
            op.alter_column("users", "role", existing_type=sa.String(length=20), nullable=False)
        if "approved_at" not in user_columns:
            op.add_column("users", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
            op.execute("UPDATE users SET approved_at = created_at WHERE is_active = TRUE AND approved_at IS NULL")
        else:
            op.alter_column("users", "approved_at", existing_type=sa.DateTime(), type_=sa.DateTime(timezone=True), existing_nullable=True)
        inspector = sa.inspect(bind)
    create_index_if_missing(inspector, "users", "ix_users_id", ["id"])
    create_index_if_missing(inspector, "users", "ix_users_username", ["username"], unique=True)

    if not has_table(inspector, "user_sessions"):
        op.create_table(
            "user_sessions",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("session_token_hash", sa.String(length=255), nullable=False),
            sa.Column("ip_address", sa.String(length=255), nullable=True),
            sa.Column("user_agent", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        )
        inspector = sa.inspect(bind)
    create_index_if_missing(inspector, "user_sessions", "ix_user_sessions_id", ["id"])
    create_index_if_missing(inspector, "user_sessions", "ix_user_sessions_user_id", ["user_id"])
    create_index_if_missing(inspector, "user_sessions", "ix_user_sessions_session_token_hash", ["session_token_hash"], unique=True)

    if not has_table(inspector, "request_posts"):
        op.create_table(
            "request_posts",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="대기"),
            sa.Column("author", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        inspector = sa.inspect(bind)
    create_index_if_missing(inspector, "request_posts", "ix_request_posts_id", ["id"])

    if not has_table(inspector, "bug_posts"):
        op.create_table(
            "bug_posts",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("author", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        inspector = sa.inspect(bind)
    create_index_if_missing(inspector, "bug_posts", "ix_bug_posts_id", ["id"])

    if not has_table(inspector, "deletion_requests"):
        op.create_table(
            "deletion_requests",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("target_type", sa.String(length=50), nullable=False),
            sa.Column("target_id", sa.Integer(), nullable=False),
            sa.Column("target_label", sa.String(length=255), nullable=True),
            sa.Column("requester_user_id", sa.Integer(), nullable=False),
            sa.Column("requester_name", sa.String(length=255), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
            sa.Column("review_comment", sa.Text(), nullable=True),
            sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
            sa.Column("reviewed_by_name", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        )
        inspector = sa.inspect(bind)
    create_index_if_missing(inspector, "deletion_requests", "ix_deletion_requests_id", ["id"])
    create_index_if_missing(inspector, "deletion_requests", "ix_deletion_requests_requester_user_id", ["requester_user_id"])
    create_index_if_missing(inspector, "deletion_requests", "ix_deletion_requests_reviewed_by_user_id", ["reviewed_by_user_id"])
    create_index_if_missing(inspector, "deletion_requests", "ix_deletion_requests_status", ["status"])
    create_index_if_missing(inspector, "deletion_requests", "ix_deletion_requests_target_id", ["target_id"])
    create_index_if_missing(inspector, "deletion_requests", "ix_deletion_requests_target_type", ["target_type"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if has_table(inspector, "deletion_requests"):
        op.drop_table("deletion_requests")
    if has_table(inspector, "bug_posts"):
        op.drop_table("bug_posts")
    if has_table(inspector, "request_posts"):
        op.drop_table("request_posts")
    if has_table(inspector, "user_sessions"):
        op.drop_table("user_sessions")
    if has_table(inspector, "users"):
        op.drop_table("users")
    if has_table(inspector, "uploaded_logs"):
        op.drop_table("uploaded_logs")
    if has_table(inspector, "storage_sites"):
        op.drop_table("storage_sites")
