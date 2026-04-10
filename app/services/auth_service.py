from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.core.constants import SERVER_SESSION_ID
from app.models import User
from app.schemas.payloads import DeleteUserPayload, LoginPayload, RegisterPayload


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


def register_user(payload: RegisterPayload, db: Session) -> dict:
    username = payload.username.strip()
    password = payload.password.strip()
    full_name = payload.full_name.strip() if payload.full_name else None
    if not username or not password:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해주세요.")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        from fastapi import HTTPException

        raise HTTPException(status_code=409, detail="이미 존재하는 사용자입니다.")

    user = User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "is_active": user.is_active,
    }


def login_user(payload: LoginPayload, db: Session, server_session_id: str = SERVER_SESSION_ID) -> dict:
    from fastapi import HTTPException

    username = payload.username.strip()
    password = payload.password.strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해주세요.")

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="로그인 정보가 올바르지 않습니다.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="비활성화된 사용자입니다.")

    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "server_session_id": server_session_id,
    }


def delete_user(payload: DeleteUserPayload, db: Session) -> dict:
    from fastapi import HTTPException

    username = payload.username.strip()
    password = payload.password.strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해주세요.")

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="회원탈퇴 정보가 올바르지 않습니다.")

    db.delete(user)
    db.commit()
    return {"deleted": True, "username": username}


def list_users(db: Session) -> list[dict]:
    users = db.query(User).order_by(User.created_at.desc(), User.id.desc()).all()
    return [serialize_user(user) for user in users]

