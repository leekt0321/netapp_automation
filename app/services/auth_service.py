import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.core.constants import AUTH_COOKIE_NAME, USER_ROLE_ADMIN, USER_ROLE_USER
from app.db import get_db
from app.models import User, UserSession
from app.schemas.payloads import DeleteUserPayload, LoginPayload, RegisterPayload


SESSION_DURATION_HOURS = 12


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def display_name_for_user(user: User) -> str:
    return user.full_name if user.full_name and user.full_name.strip() else user.username


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "display_name": display_name_for_user(user),
        "role": user.role or USER_ROLE_USER,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_user_session(user: User, request: Request, db: Session) -> str:
    token = secrets.token_urlsafe(48)
    now = utc_now()
    session = UserSession(
        user_id=user.id,
        session_token_hash=hash_session_token(token),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        expires_at=now + timedelta(hours=SESSION_DURATION_HOURS),
        last_seen_at=now,
    )
    db.add(session)
    db.commit()
    return token


def get_session_cookie(session_token: Optional[str] = Cookie(default=None, alias=AUTH_COOKIE_NAME)) -> Optional[str]:
    return session_token


def get_current_user_optional(
    session_token: Optional[str] = Depends(get_session_cookie),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not session_token:
        return None

    session = db.query(UserSession).filter(UserSession.session_token_hash == hash_session_token(session_token)).first()
    if not session:
        return None

    now = utc_now()
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        db.delete(session)
        db.commit()
        return None

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or user.is_active is False:
        db.delete(session)
        db.commit()
        return None

    session.last_seen_at = now
    db.commit()
    return user


def require_current_user(current_user: Optional[User] = Depends(get_current_user_optional)) -> User:
    if current_user is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    return current_user


def require_admin_user(current_user: User = Depends(require_current_user)) -> User:
    if (current_user.role or USER_ROLE_USER) != USER_ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return current_user


def register_user(payload: RegisterPayload, db: Session) -> dict:
    username = payload.username.strip()
    password = payload.password.strip()
    full_name = payload.full_name.strip() if payload.full_name else None
    if not username or not password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해주세요.")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="이미 존재하는 사용자입니다.")

    user = User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        role=USER_ROLE_USER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


def login_user(payload: LoginPayload, db: Session, request: Request) -> dict:
    username = payload.username.strip()
    password = payload.password.strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해주세요.")

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="로그인 정보가 올바르지 않습니다.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="비활성화된 사용자입니다.")

    token = create_user_session(user, request, db)
    return {
        "user": serialize_user(user),
        "session_token": token,
        "expires_in_hours": SESSION_DURATION_HOURS,
    }


def logout_user(session_token: Optional[str], db: Session) -> None:
    if not session_token:
        return
    session = db.query(UserSession).filter(UserSession.session_token_hash == hash_session_token(session_token)).first()
    if session:
        db.delete(session)
        db.commit()


def delete_user(payload: DeleteUserPayload, current_user: User, db: Session) -> dict:
    password = payload.password.strip()
    if password == "":
        raise HTTPException(status_code=400, detail="비밀번호를 입력해주세요.")

    if not verify_password(password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="회원탈퇴 정보가 올바르지 않습니다.")

    db.query(UserSession).filter(UserSession.user_id == current_user.id).delete()
    username = current_user.username
    db.delete(current_user)
    db.commit()
    return {"deleted": True, "username": username}


def list_users(db: Session) -> list[dict]:
    users = db.query(User).order_by(User.created_at.desc(), User.id.desc()).all()
    return [serialize_user(user) for user in users]
