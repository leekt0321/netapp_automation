from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.payloads import BugPostPayload, RequestPostPayload
from app.services.board_service import (
    create_bug_post,
    create_request_post,
    delete_bug_post,
    delete_request_post,
    list_bug_posts,
    list_request_posts,
    update_bug_post,
    update_request_post,
)


router = APIRouter()


@router.get("/requests")
def list_request_posts_route(db: Session = Depends(get_db)):
    return list_request_posts(db)


@router.post("/requests")
def create_request_post_route(payload: RequestPostPayload, db: Session = Depends(get_db)):
    return create_request_post(payload, db)


@router.put("/requests/{post_id}")
def update_request_post_route(post_id: int, payload: RequestPostPayload, db: Session = Depends(get_db)):
    return update_request_post(post_id, payload, db)


@router.delete("/requests/{post_id}")
def delete_request_post_route(post_id: int, db: Session = Depends(get_db)):
    return delete_request_post(post_id, db)


@router.get("/bugs")
def list_bug_posts_route(db: Session = Depends(get_db)):
    return list_bug_posts(db)


@router.post("/bugs")
def create_bug_post_route(payload: BugPostPayload, db: Session = Depends(get_db)):
    return create_bug_post(payload, db)


@router.put("/bugs/{post_id}")
def update_bug_post_route(post_id: int, payload: BugPostPayload, db: Session = Depends(get_db)):
    return update_bug_post(post_id, payload, db)


@router.delete("/bugs/{post_id}")
def delete_bug_post_route(post_id: int, db: Session = Depends(get_db)):
    return delete_bug_post(post_id, db)

