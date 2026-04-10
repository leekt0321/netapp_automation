import json
from pathlib import Path
import re
from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.config import settings
from app.db import Base, engine, get_db
from app.models import BugPost, RequestPost, StorageSite, UploadedLog, User
from app.parser_netapp import (
    decode_text_content,
    extract_disk_section_text,
    extract_event_log_section_contents,
    extract_event_log_section_text,
    extract_fcp_section_text,
    extract_lun_section_text,
    extract_network_interface_section_text,
    extract_network_port_section_text,
    extract_shelf_section_text,
    extract_snapmirror_section_text,
    extract_volume_section_text,
    format_summary_text,
    parse_netapp_log,
)


app = FastAPI(title=settings.app_name)
SERVER_SESSION_ID = str(uuid4())
STORAGE_CHOICES = {"storage1", "storage2", "storage3"}
REQUEST_STATUS_CHOICES = {"대기", "진행중", "완료"}
MANUAL_FIELD_DEFINITIONS = (
    ("install_date", "설치 날짜"),
    ("warranty", "워런티"),
    ("maintenance", "유지보수"),
    ("office_name", "국사명"),
    ("install_rack", "설치 상면"),
    ("service", "서비스"),
    ("manager_contact", "담당자(연락처)"),
    ("id_password", "ID/PW"),
    ("asup", "ASUP"),
    ("aggr_diskcount_override", "maxraidsize, diskcount"),
)
SUMMARY_DISPLAY_LABELS = {
    "vendor": "vendor",
    "hostname": "hostname",
    "model_name": "model",
    "controller_serial": "Serial number",
    "ontap_version": "OS Version",
    "sp_ip_version": "SP IP/SP Version",
    "mgmt": "mgmt",
    "shelf_count": "Shelf 개수",
    "used_protocols": "사용 프로토콜",
    "snapmirror_in_use": "snapmirror 사용 유무",
    "expansion_slots": "현재 장착 중인 확장 슬롯",
    "aggr_diskcount_maxraidsize": "maxraidsize, diskcount",
    "volume_count": "볼륨 개수",
    "lun_count": "lun 개수",
}

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
INDEX_PAGE = TEMPLATE_DIR / "index.html"
upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


class LoginPayload(BaseModel):
    username: str
    password: str


class RegisterPayload(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None


class DeleteUserPayload(BaseModel):
    username: str
    password: str


class RequestPostPayload(BaseModel):
    title: str
    content: str
    status: str
    author: Optional[str] = None


class BugPostPayload(BaseModel):
    title: str
    content: str
    author: Optional[str] = None


class StorageSitePayload(BaseModel):
    storage_name: str
    name: str


class ManualFieldsPayload(BaseModel):
    manual_fields: dict[str, Optional[str]]


class SpecialNotePayload(BaseModel):
    content: str
    author: Optional[str] = None
    source_note_id: Optional[str] = None


def normalize_filename(requested_name: str, original_filename: str) -> str:
    cleaned_name = INVALID_FILENAME_CHARS.sub("_", requested_name).strip().strip(".")
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="저장할 파일 이름을 입력해주세요.")

    requested_path = Path(cleaned_name)
    original_ext = Path(original_filename).suffix
    final_ext = requested_path.suffix or original_ext
    final_stem = requested_path.stem if requested_path.suffix else cleaned_name
    final_stem = final_stem.strip().strip(".")

    if not final_stem:
        raise HTTPException(status_code=400, detail="유효한 파일 이름을 입력해주세요.")

    return f"{final_stem}{final_ext}"


def get_unique_filename(filename: str) -> str:
    candidate = Path(filename)
    stem = candidate.stem
    suffix = candidate.suffix
    unique_name = candidate.name
    counter = 1

    while (upload_dir / unique_name).exists():
        unique_name = f"{stem}({counter}){suffix}"
        counter += 1

    return unique_name


def get_summary_filename(filename: str) -> str:
    candidate = Path(filename)
    return get_unique_filename(f"{candidate.stem}_summary.txt")


def ensure_admin_user(db: Session) -> None:
    existing_user = db.query(User).filter(User.username == settings.admin_username).first()
    if existing_user:
        existing_user.password_hash = hash_password(settings.admin_password)
        existing_user.full_name = settings.admin_full_name
        existing_user.is_active = True
        db.commit()
        return

    admin_user = User(
        username=settings.admin_username,
        password_hash=hash_password(settings.admin_password),
        full_name=settings.admin_full_name,
        is_active=True,
    )
    db.add(admin_user)
    db.commit()


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


def ensure_schema_updates() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("storage_sites"):
        return
    if inspector.has_table("uploaded_logs"):
        columns = {column["name"] for column in inspector.get_columns("uploaded_logs")}
        if "storage_name" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE uploaded_logs ADD COLUMN storage_name VARCHAR(50)"))
                connection.execute(text("UPDATE uploaded_logs SET storage_name = 'storage1' WHERE storage_name IS NULL"))
        if "site_id" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE uploaded_logs ADD COLUMN site_id INTEGER"))
        if "manual_fields_json" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE uploaded_logs ADD COLUMN manual_fields_json TEXT"))
        if "note" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE uploaded_logs ADD COLUMN note TEXT"))


def validate_storage_name(storage_name: str) -> str:
    normalized = storage_name.strip().lower()
    if normalized not in STORAGE_CHOICES:
        raise HTTPException(status_code=400, detail="유효한 스토리지 구분을 선택해주세요.")
    return normalized


def validate_request_post_payload(payload: RequestPostPayload) -> tuple[str, str, str, Optional[str]]:
    title = payload.title.strip()
    content = payload.content.strip()
    status = payload.status.strip()
    author = payload.author.strip() if payload.author else None

    if not title or not content:
        raise HTTPException(status_code=400, detail="제목과 내용을 모두 입력해주세요.")
    if status not in REQUEST_STATUS_CHOICES:
        raise HTTPException(status_code=400, detail="유효한 진행 상태를 선택해주세요.")

    return title, content, status, author


def validate_bug_post_payload(payload: BugPostPayload) -> tuple[str, str, Optional[str]]:
    title = payload.title.strip()
    content = payload.content.strip()
    author = payload.author.strip() if payload.author else None

    if not title or not content:
        raise HTTPException(status_code=400, detail="제목과 내용을 모두 입력해주세요.")

    return title, content, author


def serialize_site(site: StorageSite) -> dict:
    return {
        "id": site.id,
        "storage_name": site.storage_name,
        "name": site.name,
        "created_at": site.created_at,
        "updated_at": site.updated_at,
    }


def validate_site_payload(payload: StorageSitePayload) -> tuple[str, str]:
    storage_name = validate_storage_name(payload.storage_name)
    site_name = payload.name.strip()
    if not site_name:
        raise HTTPException(status_code=400, detail="사이트 이름을 입력해주세요.")
    return storage_name, site_name


def get_site_or_404(db: Session, site_id: int) -> StorageSite:
    site = db.query(StorageSite).filter(StorageSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="사이트를 찾을 수 없습니다.")
    return site


def get_validated_site(db: Session, storage_name: str, site_id: int) -> StorageSite:
    site = db.query(StorageSite).filter(StorageSite.id == site_id).first()
    if not site or site.storage_name != storage_name:
        raise HTTPException(status_code=400, detail="선택한 스토리지에 등록된 사이트만 업로드할 수 있습니다.")
    return site


def normalize_manual_fields(raw_fields: Optional[dict]) -> dict[str, str]:
    source = raw_fields or {}
    normalized = {}
    for field_key, _ in MANUAL_FIELD_DEFINITIONS:
        value = source.get(field_key, "")
        normalized[field_key] = value.strip() if isinstance(value, str) else ""
    return normalized


def parse_manual_fields_json(raw_value: Optional[str]) -> dict[str, str]:
    if not raw_value:
        return normalize_manual_fields({})
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return normalize_manual_fields({})
    return normalize_manual_fields(parsed if isinstance(parsed, dict) else {})


def encode_manual_fields_json(manual_fields: dict[str, str]) -> str:
    return json.dumps(normalize_manual_fields(manual_fields), ensure_ascii=False)


def parse_special_notes_json(raw_value: Optional[str]) -> list[dict]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []

    notes = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        content = str(item.get("content", "")).strip()
        if content == "":
            continue
        notes.append(
            {
                "id": str(item.get("id", "")).strip() or str(uuid4()),
                "content": content,
                "author": str(item.get("author", "") or "").strip(),
                "created_at": str(item.get("created_at", "") or "").strip(),
                "source_note_id": str(item.get("source_note_id", "") or "").strip(),
            }
        )
    return notes


def encode_special_notes_json(notes: list[dict]) -> str:
    return json.dumps(notes, ensure_ascii=False)


def format_summary_value(key: str, value):
    if value in ("", None):
        return "-"
    text_value = str(value)
    if key in {"sp_ip_version", "expansion_slots", "aggr_diskcount_maxraidsize"}:
        return text_value.replace(",", ",\n")
    return text_value


def build_summary_display(summary: dict, manual_fields: dict[str, str]) -> dict:
    combined = {}
    for field_key, label in MANUAL_FIELD_DEFINITIONS:
        if field_key == "aggr_diskcount_override":
            continue
        combined[label] = manual_fields.get(field_key, "") or "-"
    for key in (
        "vendor",
        "hostname",
        "model_name",
        "controller_serial",
        "ontap_version",
        "sp_ip_version",
        "mgmt",
        "shelf_count",
        "used_protocols",
        "snapmirror_in_use",
        "expansion_slots",
        "aggr_diskcount_maxraidsize",
        "volume_count",
        "lun_count",
    ):
        value = summary.get(key)
        if key == "aggr_diskcount_maxraidsize" and manual_fields.get("aggr_diskcount_override", ""):
            value = manual_fields["aggr_diskcount_override"]
        combined[SUMMARY_DISPLAY_LABELS[key]] = format_summary_value(key, value)
    disk_count = summary.get("disk_count")
    spare_count = summary.get("spare_count")
    combined["disk 개수/spare 개수"] = f"{disk_count if disk_count not in ('', None) else '-'} / {spare_count if spare_count not in ('', None) else '-'}"
    return combined


def resolve_save_name(file: UploadFile, requested_name: str = "") -> str:
    original_filename = (file.filename or "").strip()
    if not original_filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")

    final_name = requested_name.strip() or original_filename
    return normalize_filename(final_name, original_filename)


def resolve_save_names(upload_files: List[UploadFile], save_name: str, save_names: Optional[List[str]]) -> List[str]:
    if save_names:
        cleaned_names = [name for name in save_names if name is not None]
        if len(cleaned_names) != len(upload_files):
            raise HTTPException(status_code=400, detail="파일별 저장 이름 개수가 선택한 파일 수와 일치해야 합니다.")
        return [resolve_save_name(file, requested_name) for file, requested_name in zip(upload_files, cleaned_names)]

    if len(upload_files) == 1:
        return [resolve_save_name(upload_files[0], save_name)]

    return [resolve_save_name(file) for file in upload_files]


async def upload_log(file: UploadFile, save_name: str, storage_name: str, site: StorageSite, manual_fields: dict[str, str], db: Session) -> dict:
    requested_name = resolve_save_name(file, save_name)
    saved_name = get_unique_filename(requested_name)
    saved_path = upload_dir / saved_name

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")

    saved_path.write_bytes(content)

    text_content = decode_text_content(content)
    summary = parse_netapp_log(text_content)
    summary_name = get_summary_filename(saved_name)
    summary_path = upload_dir / summary_name
    summary_path.write_text(format_summary_text(summary), encoding="utf-8")

    log = UploadedLog(
        filename=saved_name,
        stored_path=str(saved_path),
        content_type=file.content_type,
        size=len(content),
        status="uploaded",
        storage_name=validate_storage_name(storage_name),
        site_id=site.id,
        manual_fields_json=encode_manual_fields_json(manual_fields),
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "id": log.id,
        "filename": log.filename,
        "stored_path": log.stored_path,
        "size": log.size,
        "status": log.status,
        "storage_name": log.storage_name,
        "site_id": site.id,
        "site_name": site.name,
        "manual_fields": manual_fields,
        "summary_filename": summary_name,
        "summary_stored_path": str(summary_path),
        "summary": summary,
    }


@app.on_event("startup")
def on_startup():
    app.state.server_session_id = SERVER_SESSION_ID
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    db = next(get_db())
    try:
        ensure_admin_user(db)
    finally:
        db.close()


@app.get("/")
def root():
    return HTMLResponse(INDEX_PAGE.read_text(encoding="utf-8"))


@app.get("/api")
def api_root():
    return {
        "message": "Storage AI Web API",
        "env": settings.app_env,
        "server_session_id": getattr(app.state, "server_session_id", SERVER_SESSION_ID),
        "storage_choices": sorted(STORAGE_CHOICES),
        "request_status_choices": ["대기", "진행중", "완료"],
    }


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "app": "ok",
        "db": db_status,
    }


@app.post("/auth/register")
def register_user(payload: RegisterPayload, db: Session = Depends(get_db)):
    username = payload.username.strip()
    password = payload.password.strip()
    full_name = payload.full_name.strip() if payload.full_name else None
    if not username or not password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해주세요.")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
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


@app.post("/auth/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
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
        "server_session_id": getattr(app.state, "server_session_id", SERVER_SESSION_ID),
    }


@app.delete("/auth/delete")
def delete_user(payload: DeleteUserPayload, db: Session = Depends(get_db)):
    username = payload.username.strip()
    password = payload.password.strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해주세요.")

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="회원탈퇴 정보가 올바르지 않습니다.")

    db.delete(user)
    db.commit()

    return {
        "deleted": True,
        "username": username,
    }


@app.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc(), User.id.desc()).all()
    return [serialize_user(user) for user in users]


@app.post("/upload")
async def upload_logs(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    save_name: str = Form(""),
    save_names: Optional[List[str]] = Form(None),
    storage_name: str = Form("storage1"),
    site_id: int = Form(...),
    manual_fields_json: str = Form(""),
    db: Session = Depends(get_db),
):
    upload_files = [current for current in (files or []) if hasattr(current, "filename")]
    if file is not None and hasattr(file, "filename"):
        upload_files.append(file)

    if not upload_files:
        raise HTTPException(status_code=400, detail="업로드할 파일을 선택하세요.")

    validated_storage_name = validate_storage_name(storage_name)
    validated_site = get_validated_site(db, validated_storage_name, site_id)
    manual_fields = parse_manual_fields_json(manual_fields_json)
    resolved_names = resolve_save_names(upload_files, save_name, save_names)

    items = []
    for current_file, resolved_name in zip(upload_files, resolved_names):
        items.append(await upload_log(file=current_file, save_name=resolved_name, storage_name=validated_storage_name, site=validated_site, manual_fields=manual_fields, db=db))

    latest_item = items[-1]
    return {
        "count": len(items),
        "items": items,
        "latest": latest_item,
        "storage_name": validated_storage_name,
        "site_id": validated_site.id,
        "site_name": validated_site.name,
    }


@app.get("/logs")
def list_logs(
    storage_name: Optional[str] = None,
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(UploadedLog, StorageSite.name.label("site_name")).outerjoin(StorageSite, UploadedLog.site_id == StorageSite.id)
    if storage_name:
        query = query.filter(UploadedLog.storage_name == validate_storage_name(storage_name))
    if site_id is not None:
        query = query.filter(UploadedLog.site_id == site_id)

    rows = query.order_by(UploadedLog.id.desc()).all()

    return [
        {
            "id": row[0].id,
            "filename": row[0].filename,
            "stored_path": row[0].stored_path,
            "content_type": row[0].content_type,
            "size": row[0].size,
            "status": row[0].status,
            "storage_name": row[0].storage_name,
            "site_id": row[0].site_id,
            "site_name": row[1],
            "created_at": row[0].created_at,
        }
        for row in rows
    ]


@app.get("/logs/{log_id}/raw")
def get_raw_log(log_id: int, db: Session = Depends(get_db)):
    row = db.query(UploadedLog, StorageSite.name.label("site_name")).outerjoin(StorageSite, UploadedLog.site_id == StorageSite.id).filter(UploadedLog.id == log_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")
    log = row[0]

    raw_path = Path(log.stored_path)
    if not raw_path.exists():
        raise HTTPException(status_code=404, detail="원본 로그 파일을 찾을 수 없습니다.")

    return {
        "id": log.id,
        "filename": log.filename,
        "stored_path": log.stored_path,
        "size": log.size,
        "status": log.status,
        "storage_name": log.storage_name,
        "site_id": log.site_id,
        "site_name": row[1],
        "raw_text": raw_path.read_text(encoding="utf-8", errors="replace"),
    }


@app.get("/logs/{log_id}/download")
def download_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(UploadedLog).filter(UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")

    raw_path = Path(log.stored_path)
    if not raw_path.exists():
        raise HTTPException(status_code=404, detail="원본 로그 파일을 찾을 수 없습니다.")

    return FileResponse(path=raw_path, filename=log.filename, media_type=log.content_type or "application/octet-stream")


@app.delete("/logs/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(UploadedLog).filter(UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")

    raw_path = Path(log.stored_path)
    summary_path = upload_dir / f"{Path(log.filename).stem}_summary.txt"

    if raw_path.exists():
        raw_path.unlink()
    if summary_path.exists():
        summary_path.unlink()

    filename = log.filename
    storage_name = log.storage_name
    site_id = log.site_id
    db.delete(log)
    db.commit()

    return {
        "deleted": True,
        "id": log_id,
        "filename": filename,
        "storage_name": storage_name,
        "site_id": site_id,
    }


@app.get("/logs/{log_id}/summary")
def get_log_summary(log_id: int, db: Session = Depends(get_db)):
    row = db.query(UploadedLog, StorageSite.name.label("site_name")).outerjoin(StorageSite, UploadedLog.site_id == StorageSite.id).filter(UploadedLog.id == log_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")
    log = row[0]

    summary_filename = f"{Path(log.filename).stem}_summary.txt"
    summary_path = upload_dir / summary_filename
    if not summary_path.exists():
        raise HTTPException(status_code=404, detail="summary 파일을 찾을 수 없습니다.")

    raw_text = summary_path.read_text(encoding="utf-8")
    display_raw_text = raw_text.replace("cluster_name:", "hostname:")
    original_raw_text = Path(log.stored_path).read_text(encoding="utf-8", errors="replace")
    summary = {}
    for line in raw_text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        normalized_key = key.strip()
        if normalized_key == "cluster_name":
            normalized_key = "hostname"
        summary[normalized_key] = value.strip()
    manual_fields = parse_manual_fields_json(log.manual_fields_json)
    section_contents = {
        "Shelf": extract_shelf_section_text(original_raw_text),
        "Disk": extract_disk_section_text(original_raw_text),
        "FCP": extract_fcp_section_text(original_raw_text),
        "Network Interface": extract_network_interface_section_text(original_raw_text),
        "Network Port": extract_network_port_section_text(original_raw_text),
        "Volume": extract_volume_section_text(original_raw_text),
        "LUN": extract_lun_section_text(original_raw_text),
        "Snapmirror": extract_snapmirror_section_text(original_raw_text),
        "Event log": extract_event_log_section_contents(original_raw_text),
        "특이사항": parse_special_notes_json(log.note),
    }

    return {
        "id": log.id,
        "filename": log.filename,
        "storage_name": log.storage_name,
        "site_id": log.site_id,
        "site_name": row[1],
        "summary_filename": summary_filename,
        "summary_stored_path": str(summary_path),
        "summary": build_summary_display(summary, manual_fields),
        "parsed_summary": summary,
        "manual_fields": manual_fields,
        "raw_text": display_raw_text,
        "section_contents": section_contents,
    }


@app.post("/logs/{log_id}/special-notes")
def add_log_special_note(log_id: int, payload: SpecialNotePayload, db: Session = Depends(get_db)):
    log = db.query(UploadedLog).filter(UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")

    content = payload.content.strip()
    if content == "":
        raise HTTPException(status_code=400, detail="특이사항 내용을 입력해주세요.")

    notes = parse_special_notes_json(log.note)
    entry = {
        "id": str(uuid4()),
        "content": content,
        "author": (payload.author or "").strip(),
        "created_at": datetime.utcnow().isoformat(timespec="seconds"),
        "source_note_id": (payload.source_note_id or "").strip(),
    }
    notes.insert(0, entry)
    log.note = encode_special_notes_json(notes)
    db.commit()
    db.refresh(log)

    return {
        "id": log.id,
        "special_notes": notes,
    }


@app.put("/logs/{log_id}/manual-fields")
def update_log_manual_fields(log_id: int, payload: ManualFieldsPayload, db: Session = Depends(get_db)):
    log = db.query(UploadedLog).filter(UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")

    manual_fields = normalize_manual_fields(payload.manual_fields)
    log.manual_fields_json = encode_manual_fields_json(manual_fields)
    db.commit()
    db.refresh(log)

    return {
        "id": log.id,
        "manual_fields": manual_fields,
    }


@app.get("/sites")
def list_storage_sites(storage_name: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(StorageSite)
    if storage_name:
        query = query.filter(StorageSite.storage_name == validate_storage_name(storage_name))

    rows = query.order_by(StorageSite.name.asc(), StorageSite.id.asc()).all()
    return [serialize_site(row) for row in rows]


@app.post("/sites")
def create_storage_site(payload: StorageSitePayload, db: Session = Depends(get_db)):
    storage_name, site_name = validate_site_payload(payload)
    existing = db.query(StorageSite).filter(StorageSite.storage_name == storage_name, StorageSite.name == site_name).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 등록된 사이트입니다.")

    row = StorageSite(storage_name=storage_name, name=site_name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_site(row)


@app.put("/sites/{site_id}")
def update_storage_site(site_id: int, payload: StorageSitePayload, db: Session = Depends(get_db)):
    row = get_site_or_404(db, site_id)
    storage_name, site_name = validate_site_payload(payload)

    duplicate = db.query(StorageSite).filter(
        StorageSite.storage_name == storage_name,
        StorageSite.name == site_name,
        StorageSite.id != site_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="이미 등록된 사이트입니다.")

    row.storage_name = storage_name
    row.name = site_name
    db.commit()
    db.refresh(row)
    return serialize_site(row)


@app.delete("/sites/{site_id}")
def delete_storage_site(site_id: int, db: Session = Depends(get_db)):
    row = get_site_or_404(db, site_id)
    attached_log = db.query(UploadedLog).filter(UploadedLog.site_id == row.id).first()
    if attached_log:
        raise HTTPException(status_code=400, detail="이 사이트에 업로드된 로그가 있어 삭제할 수 없습니다.")

    site_name = row.name
    storage_name = row.storage_name
    db.delete(row)
    db.commit()

    return {
        "deleted": True,
        "id": site_id,
        "name": site_name,
        "storage_name": storage_name,
    }


@app.get("/requests")
def list_request_posts(db: Session = Depends(get_db)):
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


@app.post("/requests")
def create_request_post(payload: RequestPostPayload, db: Session = Depends(get_db)):
    title, content, status, author = validate_request_post_payload(payload)

    row = RequestPost(
        title=title,
        content=content,
        status=status,
        author=author,
    )
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


@app.put("/requests/{post_id}")
def update_request_post(post_id: int, payload: RequestPostPayload, db: Session = Depends(get_db)):
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


@app.delete("/requests/{post_id}")
def delete_request_post(post_id: int, db: Session = Depends(get_db)):
    row = db.query(RequestPost).filter(RequestPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="수정 요청 글을 찾을 수 없습니다.")

    title = row.title
    db.delete(row)
    db.commit()

    return {
        "deleted": True,
        "id": post_id,
        "title": title,
    }


@app.get("/bugs")
def list_bug_posts(db: Session = Depends(get_db)):
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


@app.post("/bugs")
def create_bug_post(payload: BugPostPayload, db: Session = Depends(get_db)):
    title, content, author = validate_bug_post_payload(payload)

    row = BugPost(
        title=title,
        content=content,
        author=author,
    )
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


@app.put("/bugs/{post_id}")
def update_bug_post(post_id: int, payload: BugPostPayload, db: Session = Depends(get_db)):
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


@app.delete("/bugs/{post_id}")
def delete_bug_post(post_id: int, db: Session = Depends(get_db)):
    row = db.query(BugPost).filter(BugPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="버그 글을 찾을 수 없습니다.")

    title = row.title
    db.delete(row)
    db.commit()

    return {
        "deleted": True,
        "id": post_id,
        "title": title,
    }
