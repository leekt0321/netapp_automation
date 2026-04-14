from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.payloads import DeletionRequestPayload, ManualFieldsPayload, SpecialNotePayload
from app.services.admin_service import create_log_deletion_request
from app.services.auth_service import display_name_for_user, require_admin_user, require_current_user
from app.services.log_service import (
    add_log_special_note,
    delete_log,
    download_log,
    get_log_summary,
    get_raw_log,
    list_logs,
    update_log_manual_fields,
    upload_logs,
)


router = APIRouter()


@router.post("/upload")
async def upload_logs_route(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    save_name: str = Form(""),
    save_names: Optional[List[str]] = Form(None),
    storage_name: str = Form("storage1"),
    site_id: int = Form(...),
    manual_fields_json: str = Form(""),
    _: object = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    return await upload_logs(files, file, save_name, save_names, storage_name, site_id, manual_fields_json, db)


@router.get("/logs")
def list_logs_route(
    storage_name: Optional[str] = None,
    site_id: Optional[int] = None,
    _: object = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    return list_logs(storage_name, site_id, db)


@router.get("/logs/{log_id}/raw")
def get_raw_log_route(log_id: int, _: object = Depends(require_current_user), db: Session = Depends(get_db)):
    return get_raw_log(log_id, db)


@router.get("/logs/{log_id}/download")
def download_log_route(log_id: int, _: object = Depends(require_current_user), db: Session = Depends(get_db)):
    return download_log(log_id, db)


@router.delete("/logs/{log_id}")
def delete_log_route(log_id: int, _: object = Depends(require_admin_user), db: Session = Depends(get_db)):
    return delete_log(log_id, db)


@router.get("/logs/{log_id}/summary")
def get_log_summary_route(log_id: int, _: object = Depends(require_current_user), db: Session = Depends(get_db)):
    return get_log_summary(log_id, db)


@router.post("/logs/{log_id}/special-notes")
def add_log_special_note_route(
    log_id: int,
    payload: SpecialNotePayload,
    current_user=Depends(require_current_user),
    db: Session = Depends(get_db),
):
    normalized_payload = SpecialNotePayload(
        content=payload.content,
        author=display_name_for_user(current_user),
        source_note_id=payload.source_note_id,
    )
    return add_log_special_note(log_id, normalized_payload, db)


@router.put("/logs/{log_id}/manual-fields")
def update_log_manual_fields_route(
    log_id: int,
    payload: ManualFieldsPayload,
    _: object = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    return update_log_manual_fields(log_id, payload, db)


@router.post("/logs/{log_id}/deletion-requests")
def create_log_deletion_request_route(
    log_id: int,
    payload: DeletionRequestPayload,
    current_user=Depends(require_current_user),
    db: Session = Depends(get_db),
):
    return create_log_deletion_request(log_id, payload.reason, current_user, db)
