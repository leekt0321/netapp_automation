import asyncio

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.core.constants import REQUEST_STATUS_CHOICES, SERVER_SESSION_ID, STORAGE_CHOICES
from app.core.paths import INDEX_PAGE
from app.db import get_db
from app.services.operations_service import build_health_report


router = APIRouter()
HEARTBEAT_INTERVAL_SECONDS = 5


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
    return build_health_report(db)


@router.websocket("/ws/health")
async def websocket_health(websocket: WebSocket):
    await websocket.accept()
    server_session_id = getattr(websocket.app.state, "server_session_id", SERVER_SESSION_ID)

    try:
        await websocket.send_json({
            "type": "server_status",
            "status": "connected",
            "server_session_id": server_session_id,
            "heartbeat_interval_ms": HEARTBEAT_INTERVAL_SECONDS * 1000,
        })
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
            await websocket.send_json({
                "type": "heartbeat",
                "server_session_id": server_session_id,
            })
    except WebSocketDisconnect:
        return
