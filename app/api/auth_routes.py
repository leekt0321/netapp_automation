from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.payloads import DeleteUserPayload, LoginPayload, RegisterPayload
from app.services.auth_service import delete_user, list_users, login_user, register_user


router = APIRouter()


@router.post("/auth/register")
def register_user_route(payload: RegisterPayload, db: Session = Depends(get_db)):
    return register_user(payload, db)


@router.post("/auth/login")
def login_route(payload: LoginPayload, request: Request, db: Session = Depends(get_db)):
    return login_user(payload, db, getattr(request.app.state, "server_session_id", ""))


@router.delete("/auth/delete")
def delete_user_route(payload: DeleteUserPayload, db: Session = Depends(get_db)):
    return delete_user(payload, db)


@router.get("/users")
def list_users_route(db: Session = Depends(get_db)):
    return list_users(db)

