from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.core.constants import REQUEST_STATUS_CHOICES, SERVER_SESSION_ID, STORAGE_CHOICES
from app.core.paths import INDEX_PAGE
from app.db import get_db


router = APIRouter()


@router.get("/")
def root():
    return HTMLResponse(INDEX_PAGE.read_text(encoding="utf-8"))


@router.get("/api")
def api_root(request: Request):
    return {
        "message": "Storage AI Web API",
        "env": settings.app_env,
        "server_session_id": getattr(request.app.state, "server_session_id", SERVER_SESSION_ID),
        "storage_choices": sorted(STORAGE_CHOICES),
        "request_status_choices": sorted(REQUEST_STATUS_CHOICES, key=["대기", "진행중", "완료"].index),
    }


@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as error:
        db_status = f"error: {str(error)}"
    return {"app": "ok", "db": db_status}

