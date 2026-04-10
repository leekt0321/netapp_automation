from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.constants import REQUEST_STATUS_CHOICES
from app.models import BugPost, RequestPost
from app.schemas.payloads import BugPostPayload, RequestPostPayload


def validate_request_post_payload(payload: RequestPostPayload) -> tuple[str, str, str, str | None]:
    title = payload.title.strip()
    content = payload.content.strip()
    status = payload.status.strip()
    author = payload.author.strip() if payload.author else None
    if not title or not content:
        raise HTTPException(status_code=400, detail="제목과 내용을 모두 입력해주세요.")
    if status not in REQUEST_STATUS_CHOICES:
        raise HTTPException(status_code=400, detail="유효한 진행 상태를 선택해주세요.")
    return title, content, status, author


def validate_bug_post_payload(payload: BugPostPayload) -> tuple[str, str, str | None]:
    title = payload.title.strip()
    content = payload.content.strip()
    author = payload.author.strip() if payload.author else None
    if not title or not content:
        raise HTTPException(status_code=400, detail="제목과 내용을 모두 입력해주세요.")
    return title, content, author


def list_request_posts(db: Session) -> list[dict]:
    rows = db.query(RequestPost).order_by(RequestPost.id.desc()).all()
    return [
        {
            "id": row.id,
            "title": row.title,
            "content": row.content,
            "status": row.status,
            "author": row.author,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]


def create_request_post(payload: RequestPostPayload, db: Session) -> dict:
    title, content, status, author = validate_request_post_payload(payload)
    row = RequestPost(title=title, content=content, status=status, author=author)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "title": row.title,
        "content": row.content,
        "status": row.status,
        "author": row.author,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def update_request_post(post_id: int, payload: RequestPostPayload, db: Session) -> dict:
    row = db.query(RequestPost).filter(RequestPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="수정 요청 글을 찾을 수 없습니다.")
    title, content, status, author = validate_request_post_payload(payload)
    row.title = title
    row.content = content
    row.status = status
    row.author = author
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "title": row.title,
        "content": row.content,
        "status": row.status,
        "author": row.author,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def delete_request_post(post_id: int, db: Session) -> dict:
    row = db.query(RequestPost).filter(RequestPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="수정 요청 글을 찾을 수 없습니다.")
    title = row.title
    db.delete(row)
    db.commit()
    return {"deleted": True, "id": post_id, "title": title}


def list_bug_posts(db: Session) -> list[dict]:
    rows = db.query(BugPost).order_by(BugPost.id.desc()).all()
    return [
        {
            "id": row.id,
            "title": row.title,
            "content": row.content,
            "author": row.author,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]


def create_bug_post(payload: BugPostPayload, db: Session) -> dict:
    title, content, author = validate_bug_post_payload(payload)
    row = BugPost(title=title, content=content, author=author)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "title": row.title,
        "content": row.content,
        "author": row.author,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def update_bug_post(post_id: int, payload: BugPostPayload, db: Session) -> dict:
    row = db.query(BugPost).filter(BugPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="버그 글을 찾을 수 없습니다.")
    title, content, author = validate_bug_post_payload(payload)
    row.title = title
    row.content = content
    row.author = author
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "title": row.title,
        "content": row.content,
        "author": row.author,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def delete_bug_post(post_id: int, db: Session) -> dict:
    row = db.query(BugPost).filter(BugPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="버그 글을 찾을 수 없습니다.")
    title = row.title
    db.delete(row)
    db.commit()
    return {"deleted": True, "id": post_id, "title": title}

