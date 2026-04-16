import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.paths import UPLOAD_DIR
from app.db import engine
from app.models import UploadedLog
from app.services.log_service import resolve_summary_path


REQUIRED_TABLES = {
    "alembic_version",
    "users",
    "uploaded_logs",
    "storage_sites",
    "request_posts",
    "bug_posts",
    "user_sessions",
    "deletion_requests",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def collect_db_health(db: Session) -> dict:
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as error:
        return {"status": "error", "detail": str(error)}


def collect_upload_dir_health() -> dict:
    path = UPLOAD_DIR
    exists = path.exists()
    is_dir = path.is_dir()
    writable = os.access(path, os.W_OK) if exists else False
    status = "ok" if exists and is_dir and writable else "error"
    return {
        "status": status,
        "path": str(path),
        "exists": exists,
        "is_dir": is_dir,
        "writable": writable,
    }


def collect_schema_health(db: Session) -> dict:
    inspector = inspect(engine)
    missing_tables = sorted(table for table in REQUIRED_TABLES if inspector.has_table(table) is False)
    try:
        current_revision = db.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar()
    except Exception as error:
        return {
            "status": "error",
            "current_revision": None,
            "missing_tables": missing_tables,
            "detail": str(error),
        }

    status = "ok" if not missing_tables and current_revision else "error"
    return {
        "status": status,
        "current_revision": current_revision,
        "missing_tables": missing_tables,
    }


def build_health_report(db: Session) -> dict:
    db_health = collect_db_health(db)
    upload_dir_health = collect_upload_dir_health()
    schema_health = collect_schema_health(db)
    components = {
        "db": db_health,
        "upload_dir": upload_dir_health,
        "schema": schema_health,
    }
    overall_status = "ok"
    if any(item["status"] != "ok" for item in components.values()):
        overall_status = "degraded"
    return {
        "status": overall_status,
        "app": "ok",
        "checked_at": utc_now_iso(),
        "components": components,
    }


def _serialize_integrity_item(log: UploadedLog, summary_path: Path) -> dict:
    return {
        "id": log.id,
        "filename": log.filename,
        "storage_name": log.storage_name,
        "site_id": log.site_id,
        "stored_path": log.stored_path,
        "summary_stored_path": str(summary_path),
    }


def build_integrity_report(db: Session) -> dict:
    logs = db.query(UploadedLog).order_by(UploadedLog.id.asc()).all()
    raw_paths = set()
    summary_paths = set()
    missing_raw_logs = []
    missing_summary_logs = []
    outside_upload_dir_logs = []

    for log in logs:
        raw_path = Path(log.stored_path)
        summary_path = resolve_summary_path(log)
        raw_paths.add(str(raw_path))
        summary_paths.add(str(summary_path))

        if raw_path.exists() is False:
            missing_raw_logs.append(_serialize_integrity_item(log, summary_path))
        if summary_path.exists() is False:
            missing_summary_logs.append(_serialize_integrity_item(log, summary_path))
        if raw_path.parent != UPLOAD_DIR or summary_path.parent != UPLOAD_DIR:
            outside_upload_dir_logs.append(_serialize_integrity_item(log, summary_path))

    upload_files = [path for path in sorted(UPLOAD_DIR.iterdir(), key=lambda item: item.name) if path.is_file()]
    registered_paths = raw_paths | summary_paths
    orphan_files = [str(path) for path in upload_files if str(path) not in registered_paths]
    orphan_summary_files = [path for path in orphan_files if Path(path).name.endswith("_summary.txt")]
    orphan_raw_files = [path for path in orphan_files if path not in orphan_summary_files]

    issue_count = (
        len(missing_raw_logs)
        + len(missing_summary_logs)
        + len(orphan_raw_files)
        + len(orphan_summary_files)
        + len(outside_upload_dir_logs)
    )
    status = "ok" if issue_count == 0 else "warning"

    return {
        "status": status,
        "generated_at": utc_now_iso(),
        "counts": {
            "uploaded_logs": len(logs),
            "missing_raw_logs": len(missing_raw_logs),
            "missing_summary_logs": len(missing_summary_logs),
            "orphan_raw_files": len(orphan_raw_files),
            "orphan_summary_files": len(orphan_summary_files),
            "outside_upload_dir_logs": len(outside_upload_dir_logs),
        },
        "issues": {
            "missing_raw_logs": missing_raw_logs,
            "missing_summary_logs": missing_summary_logs,
            "orphan_raw_files": orphan_raw_files,
            "orphan_summary_files": orphan_summary_files,
            "outside_upload_dir_logs": outside_upload_dir_logs,
        },
    }
