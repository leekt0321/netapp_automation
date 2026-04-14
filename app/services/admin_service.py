from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.constants import (
    DELETION_REQUEST_STATUS_EXECUTED,
    DELETION_REQUEST_STATUS_PENDING,
    DELETION_REQUEST_STATUS_REJECTED,
    USER_ROLE_ADMIN,
)
from app.models import DeletionRequest, UploadedLog, User, UserSession
from app.schemas.payloads import DeletionReviewPayload, UserStatusPayload
from app.services.auth_service import display_name_for_user, serialize_user
from app.services.log_service import delete_log


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def list_active_sessions(db: Session) -> list[dict]:
    now = utc_now()
    sessions = db.query(UserSession).order_by(UserSession.last_seen_at.desc(), UserSession.id.desc()).all()
    user_ids = [session.user_id for session in sessions]
    users = {}
    if user_ids:
        users = {user.id: user for user in db.query(User).filter(User.id.in_(user_ids)).all()}
    items = []
    for session in sessions:
        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            continue
        user = users.get(session.user_id)
        if not user:
            continue
        items.append(
            {
                "id": session.id,
                "user_id": user.id,
                "username": user.username,
                "display_name": display_name_for_user(user),
                "role": user.role,
                "ip_address": session.ip_address,
                "user_agent": session.user_agent,
                "created_at": session.created_at,
                "last_seen_at": session.last_seen_at,
                "expires_at": session.expires_at,
            }
        )
    return items


def update_user_status(user_id: int, payload: UserStatusPayload, admin_user: User, db: Session) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if user.id == admin_user.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="현재 로그인한 관리자 계정은 비활성화할 수 없습니다.")

    user.is_active = payload.is_active
    if payload.is_active is False:
        db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()
    db.refresh(user)
    return serialize_user(user)


def serialize_deletion_request(row: DeletionRequest) -> dict:
    return {
        "id": row.id,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "target_label": row.target_label,
        "requester_user_id": row.requester_user_id,
        "requester_name": row.requester_name,
        "reason": row.reason,
        "status": row.status,
        "review_comment": row.review_comment,
        "reviewed_by_user_id": row.reviewed_by_user_id,
        "reviewed_by_name": row.reviewed_by_name,
        "created_at": row.created_at,
        "reviewed_at": row.reviewed_at,
        "executed_at": row.executed_at,
    }


def list_deletion_requests(db: Session, status: str | None = None) -> list[dict]:
    query = db.query(DeletionRequest)
    if status:
        query = query.filter(DeletionRequest.status == status)
    rows = query.order_by(DeletionRequest.created_at.desc(), DeletionRequest.id.desc()).all()
    return [serialize_deletion_request(row) for row in rows]


def create_log_deletion_request(log_id: int, reason: str | None, requester: User, db: Session) -> dict:
    log = db.query(UploadedLog).filter(UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")

    existing = db.query(DeletionRequest).filter(
        DeletionRequest.target_type == "log",
        DeletionRequest.target_id == log_id,
        DeletionRequest.status == DELETION_REQUEST_STATUS_PENDING,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 대기 중인 삭제 요청이 있습니다.")

    row = DeletionRequest(
        target_type="log",
        target_id=log.id,
        target_label=log.filename,
        requester_user_id=requester.id,
        requester_name=display_name_for_user(requester),
        reason=(reason or "").strip() or None,
        status=DELETION_REQUEST_STATUS_PENDING,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_deletion_request(row)


def review_deletion_request(request_id: int, payload: DeletionReviewPayload, reviewer: User, db: Session) -> dict:
    row = db.query(DeletionRequest).filter(DeletionRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="삭제 요청을 찾을 수 없습니다.")
    if row.status != DELETION_REQUEST_STATUS_PENDING:
        raise HTTPException(status_code=400, detail="이미 처리된 삭제 요청입니다.")

    action = payload.action.strip().lower()
    review_comment = payload.comment.strip() if payload.comment else None
    now = utc_now()

    row.reviewed_by_user_id = reviewer.id
    row.reviewed_by_name = display_name_for_user(reviewer)
    row.review_comment = review_comment
    row.reviewed_at = now

    if action == "reject":
        row.status = DELETION_REQUEST_STATUS_REJECTED
        db.commit()
        db.refresh(row)
        return serialize_deletion_request(row)

    if action != "approve":
        raise HTTPException(status_code=400, detail="action은 approve 또는 reject만 허용됩니다.")

    if row.target_type != "log":
        raise HTTPException(status_code=400, detail="현재는 로그 삭제 요청만 처리할 수 있습니다.")

    delete_log(row.target_id, db)
    row.status = DELETION_REQUEST_STATUS_EXECUTED
    row.executed_at = now
    db.commit()
    db.refresh(row)
    return serialize_deletion_request(row)


def ensure_admin_user_role(user: User) -> None:
    user.role = USER_ROLE_ADMIN
