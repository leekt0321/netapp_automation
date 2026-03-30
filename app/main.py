from pathlib import Path
import re
from typing import List, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.config import settings
from app.db import Base, engine, get_db
from app.models import RequestPost, StorageSite, UploadedLog, User
from app.parser_netapp import decode_text_content, format_summary_text, parse_netapp_log


app = FastAPI(title=settings.app_name)
SERVER_SESSION_ID = str(uuid4())
STORAGE_CHOICES = {"storage1", "storage2", "storage3"}
REQUEST_STATUS_CHOICES = {"대기", "진행중", "완료"}

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


class StorageSitePayload(BaseModel):
    storage_name: str
    name: str


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


async def upload_log(file: UploadFile, save_name: str, storage_name: str, site: StorageSite, db: Session) -> dict:
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


@app.post("/upload")
async def upload_logs(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    save_name: str = Form(""),
    save_names: Optional[List[str]] = Form(None),
    storage_name: str = Form("storage1"),
    site_id: int = Form(...),
    db: Session = Depends(get_db),
):
    upload_files = [current for current in (files or []) if hasattr(current, "filename")]
    if file is not None and hasattr(file, "filename"):
        upload_files.append(file)

    if not upload_files:
        raise HTTPException(status_code=400, detail="업로드할 파일을 선택하세요.")

    validated_storage_name = validate_storage_name(storage_name)
    validated_site = get_validated_site(db, validated_storage_name, site_id)
    resolved_names = resolve_save_names(upload_files, save_name, save_names)

    items = []
    for current_file, resolved_name in zip(upload_files, resolved_names):
        items.append(await upload_log(file=current_file, save_name=resolved_name, storage_name=validated_storage_name, site=validated_site, db=db))

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
    summary = {}
    for line in raw_text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        normalized_key = key.strip()
        if normalized_key == "cluster_name":
            normalized_key = "hostname"
        summary[normalized_key] = value.strip()

    return {
        "id": log.id,
        "filename": log.filename,
        "storage_name": log.storage_name,
        "site_id": log.site_id,
        "site_name": row[1],
        "summary_filename": summary_filename,
        "summary_stored_path": str(summary_path),
        "summary": summary,
        "raw_text": display_raw_text,
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
