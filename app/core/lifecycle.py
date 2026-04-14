from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import settings
from app.core.constants import SERVER_SESSION_ID, USER_ROLE_ADMIN, USER_ROLE_USER
from app.db import Base, engine, get_db
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


def ensure_schema_updates() -> None:
    inspector = inspect(engine)
    if inspector.has_table("users"):
        columns = {column["name"] for column in inspector.get_columns("users")}
        if "role" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20)"))
                connection.execute(text("UPDATE users SET role = :role WHERE role IS NULL"), {"role": USER_ROLE_USER})
        if "approved_at" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN approved_at TIMESTAMP"))
                connection.execute(text("UPDATE users SET approved_at = created_at WHERE is_active = TRUE AND approved_at IS NULL"))
    if not inspector.has_table("storage_sites"):
        return
    if inspector.has_table("uploaded_logs"):
        columns = {column["name"] for column in inspector.get_columns("uploaded_logs")}
        if "storage_name" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE uploaded_logs ADD COLUMN storage_name VARCHAR(50)"))
                connection.execute(text("UPDATE uploaded_logs SET storage_name = 'storage1' WHERE storage_name IS NULL"))
        if "site_id" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE uploaded_logs ADD COLUMN site_id INTEGER"))
        if "manual_fields_json" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE uploaded_logs ADD COLUMN manual_fields_json TEXT"))
        if "note" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE uploaded_logs ADD COLUMN note TEXT"))


def on_startup(app) -> None:
    app.state.server_session_id = SERVER_SESSION_ID
    _ = (UserSession, DeletionRequest)
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    db = next(get_db())
    try:
        ensure_admin_user(db)
    finally:
        db.close()
