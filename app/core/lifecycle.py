from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import settings
from app.core.constants import SERVER_SESSION_ID, USER_ROLE_ADMIN
from app.db import engine, get_db
from app.models import DeletionRequest, User, UserSession


def ensure_admin_user(db: Session) -> None:
    existing_user = db.query(User).filter(User.username == settings.admin_username).first()
    if existing_user:
        existing_user.full_name = settings.admin_full_name
        existing_user.role = USER_ROLE_ADMIN
        existing_user.is_active = True
        if existing_user.approved_at is None:
            existing_user.approved_at = existing_user.created_at
        db.commit()
        return

    admin_user = User(
        username=settings.admin_username,
        password_hash=hash_password(settings.admin_password),
        full_name=settings.admin_full_name,
        role=USER_ROLE_ADMIN,
        is_active=True,
        approved_at=None,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    admin_user.approved_at = admin_user.created_at
    db.commit()


def ensure_database_ready() -> None:
    inspector = inspect(engine)
    required_tables = {
        "alembic_version",
        "users",
        "uploaded_logs",
        "storage_sites",
        "request_posts",
        "bug_posts",
        "user_sessions",
        "deletion_requests",
    }
    missing_tables = sorted(table for table in required_tables if inspector.has_table(table) is False)
    if missing_tables:
        raise RuntimeError(
            "Database schema is not ready. Run `alembic upgrade head` before starting the application. "
            f"Missing tables: {', '.join(missing_tables)}"
        )


def on_startup(app) -> None:
    app.state.server_session_id = SERVER_SESSION_ID
    _ = (UserSession, DeletionRequest)
    ensure_database_ready()
    db = next(get_db())
    try:
        ensure_admin_user(db)
    finally:
        db.close()
