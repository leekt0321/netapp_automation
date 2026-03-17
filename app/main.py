from pathlib import Path
import re

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, engine, get_db
from app.models import UploadedLog


app = FastAPI(title=settings.app_name)

upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)

INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


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


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "message": "Storage AI Web API",
        "env": settings.app_env,
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


@app.post("/upload")
async def upload_log(
    file: UploadFile = File(...),
    save_name: str = Form(...),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")

    requested_name = normalize_filename(save_name, file.filename)
    saved_name = get_unique_filename(requested_name)
    saved_path = upload_dir / saved_name

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")

    saved_path.write_bytes(content)

    log = UploadedLog(
        filename=saved_name,
        stored_path=str(saved_path),
        content_type=file.content_type,
        size=len(content),
        status="uploaded",
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
    }


@app.get("/logs")
def list_logs(db: Session = Depends(get_db)):
    rows = db.query(UploadedLog).order_by(UploadedLog.id.desc()).all()

    return [
        {
            "id": row.id,
            "filename": row.filename,
            "stored_path": row.stored_path,
            "content_type": row.content_type,
            "size": row.size,
            "status": row.status,
            "created_at": row.created_at,
        }
        for row in rows
    ]
