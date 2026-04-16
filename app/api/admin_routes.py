from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.payloads import DeletionReviewPayload, UserStatusPayload
from app.services.admin_service import list_active_sessions, list_deletion_requests, review_deletion_request, update_user_status
from app.services.auth_service import require_admin_user
from app.services.operations_service import build_integrity_report


router = APIRouter(prefix="/admin")


@router.get("/sessions")
def list_active_sessions_route(_: object = Depends(require_admin_user), db: Session = Depends(get_db)):
    return list_active_sessions(db)


@router.put("/users/{user_id}/status")
def update_user_status_route(
    user_id: int,
    payload: UserStatusPayload,
    admin_user=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return update_user_status(user_id, payload, admin_user, db)


@router.get("/deletion-requests")
def list_deletion_requests_route(
    status: Optional[str] = None,
    _: object = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return list_deletion_requests(db, status)


@router.put("/deletion-requests/{request_id}/review")
def review_deletion_request_route(
    request_id: int,
    payload: DeletionReviewPayload,
    admin_user=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return review_deletion_request(request_id, payload, admin_user, db)


@router.get("/operations/integrity")
def integrity_report_route(_: object = Depends(require_admin_user), db: Session = Depends(get_db)):
    return build_integrity_report(db)
