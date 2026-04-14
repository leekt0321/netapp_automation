from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.constants import AUTH_COOKIE_NAME
from app.db import get_db
from app.schemas.payloads import DeleteUserPayload, LoginPayload, RegisterPayload
from app.services.auth_service import (
    delete_user,
    get_current_user_optional,
    get_session_cookie,
    list_users,
    login_user,
    logout_user,
    register_user,
    require_admin_user,
    require_current_user,
    serialize_user,
)


router = APIRouter()


@router.post("/auth/register")
def register_user_route(payload: RegisterPayload, db: Session = Depends(get_db)):
    return register_user(payload, db)


@router.post("/auth/login")
def login_route(payload: LoginPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    result = login_user(payload, db, request)
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=result["session_token"],
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
        max_age=result["expires_in_hours"] * 60 * 60,
    )
    return result["user"]


@router.post("/auth/logout")
def logout_route(
    response: Response,
    session_token: Optional[str] = Depends(get_session_cookie),
    db: Session = Depends(get_db),
):
    logout_user(session_token, db)
    response.delete_cookie(AUTH_COOKIE_NAME, path="/")
    return {"logged_out": True}


@router.get("/auth/me")
def current_user_route(current_user=Depends(get_current_user_optional)):
    if current_user is None:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": serialize_user(current_user)}


@router.delete("/auth/delete")
def delete_user_route(
    payload: DeleteUserPayload,
    response: Response,
    current_user=Depends(require_current_user),
    db: Session = Depends(get_db),
):
    result = delete_user(payload, current_user, db)
    response.delete_cookie(AUTH_COOKIE_NAME, path="/")
    return result


@router.get("/users")
def list_users_route(_: object = Depends(require_admin_user), db: Session = Depends(get_db)):
    return list_users(db)
