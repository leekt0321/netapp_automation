import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.constants import MANUAL_FIELD_DEFINITIONS, SUMMARY_DISPLAY_LABELS
from app.core.paths import INVALID_FILENAME_CHARS, UPLOAD_DIR
from app.models import StorageSite, UploadedLog
from app.parser_netapp import (
    decode_text_content,
    extract_disk_section_text,
    extract_event_log_section_contents,
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
from app.schemas.payloads import ManualFieldsPayload, SpecialNotePayload
from app.services.site_service import get_validated_site, validate_storage_name


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
    while (UPLOAD_DIR / unique_name).exists():
        unique_name = f"{stem}({counter}){suffix}"
        counter += 1
    return unique_name


def get_summary_filename(filename: str) -> str:
    candidate = Path(filename)
    return get_unique_filename(f"{candidate.stem}_summary.txt")


def resolve_summary_path(log: UploadedLog) -> Path:
    if log.summary_path:
        return Path(log.summary_path)
    return UPLOAD_DIR / f"{Path(log.filename).stem}_summary.txt"


def read_summary_text(summary_path: Path) -> str:
    if not summary_path.exists():
        raise HTTPException(status_code=404, detail="summary 파일을 찾을 수 없습니다.")
    return summary_path.read_text(encoding="utf-8")


def write_summary_file(saved_name: str, summary: dict) -> Path:
    summary_name = get_summary_filename(saved_name)
    summary_path = UPLOAD_DIR / summary_name
    summary_path.write_text(format_summary_text(summary), encoding="utf-8")
    return summary_path


def cleanup_generated_files(*paths: Optional[Path]) -> None:
    for path in paths:
        if path is None:
            continue
        try:
            if path.exists():
                path.unlink()
        except OSError:
            # Best-effort cleanup only. The DB transaction is the source of truth.
            continue


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
    saved_path = UPLOAD_DIR / saved_name
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")
    summary_path: Optional[Path] = None

    try:
        saved_path.write_bytes(content)

        text_content = decode_text_content(content)
        summary = parse_netapp_log(text_content)
        summary_path = write_summary_file(saved_name, summary)

        log = UploadedLog(
            filename=saved_name,
            stored_path=str(saved_path),
            summary_path=str(summary_path),
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
    except HTTPException:
        db.rollback()
        cleanup_generated_files(summary_path, saved_path)
        raise
    except SQLAlchemyError:
        db.rollback()
        cleanup_generated_files(summary_path, saved_path)
        raise HTTPException(status_code=500, detail="로그 메타데이터 저장에 실패했습니다.")
    except Exception:
        db.rollback()
        cleanup_generated_files(summary_path, saved_path)
        raise

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
        "summary_filename": Path(log.summary_path).name if log.summary_path else "",
        "summary_stored_path": log.summary_path,
        "summary": summary,
    }


async def upload_logs(files, file, save_name, save_names, storage_name, site_id, manual_fields_json, db: Session) -> dict:
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
        items.append(await upload_log(current_file, resolved_name, validated_storage_name, validated_site, manual_fields, db))
    latest_item = items[-1]
    return {
        "count": len(items),
        "items": items,
        "latest": latest_item,
        "storage_name": validated_storage_name,
        "site_id": validated_site.id,
        "site_name": validated_site.name,
    }


def list_logs(storage_name: Optional[str], site_id: Optional[int], db: Session) -> list[dict]:
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
            "summary_stored_path": row[0].summary_path,
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


def get_raw_log(log_id: int, db: Session) -> dict:
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


def download_log(log_id: int, db: Session) -> FileResponse:
    log = db.query(UploadedLog).filter(UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")
    raw_path = Path(log.stored_path)
    if not raw_path.exists():
        raise HTTPException(status_code=404, detail="원본 로그 파일을 찾을 수 없습니다.")
    return FileResponse(path=raw_path, filename=log.filename, media_type=log.content_type or "application/octet-stream")


def delete_log(log_id: int, db: Session) -> dict:
    log = db.query(UploadedLog).filter(UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")
    raw_path = Path(log.stored_path)
    summary_path = resolve_summary_path(log)
    filename = log.filename
    storage_name = log.storage_name
    site_id = log.site_id
    summary_stored_path = log.summary_path or str(summary_path)
    db.delete(log)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="로그 삭제 중 DB 처리에 실패했습니다.")
    cleanup_generated_files(raw_path, summary_path)
    return {
        "deleted": True,
        "id": log_id,
        "filename": filename,
        "storage_name": storage_name,
        "site_id": site_id,
        "summary_stored_path": summary_stored_path,
    }


def get_log_summary(log_id: int, db: Session) -> dict:
    row = db.query(UploadedLog, StorageSite.name.label("site_name")).outerjoin(StorageSite, UploadedLog.site_id == StorageSite.id).filter(UploadedLog.id == log_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")
    log = row[0]
    summary_path = resolve_summary_path(log)
    summary_filename = summary_path.name
    raw_text = read_summary_text(summary_path)
    display_raw_text = raw_text.replace("cluster_name:", "hostname:")
    original_raw_text = Path(log.stored_path).read_text(encoding="utf-8", errors="replace")
    summary = {}
    for line in raw_text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        normalized_key = "hostname" if key.strip() == "cluster_name" else key.strip()
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


def add_log_special_note(log_id: int, payload: SpecialNotePayload, db: Session) -> dict:
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
    return {"id": log.id, "special_notes": notes}


def update_log_manual_fields(log_id: int, payload: ManualFieldsPayload, db: Session) -> dict:
    log = db.query(UploadedLog).filter(UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="업로드 파일을 찾을 수 없습니다.")
    manual_fields = normalize_manual_fields(payload.manual_fields)
    log.manual_fields_json = encode_manual_fields_json(manual_fields)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "manual_fields": manual_fields}
