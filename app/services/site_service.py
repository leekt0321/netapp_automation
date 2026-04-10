from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.constants import STORAGE_CHOICES
from app.models import StorageSite, UploadedLog
from app.schemas.payloads import StorageSitePayload


def validate_storage_name(storage_name: str) -> str:
    normalized = storage_name.strip().lower()
    if normalized not in STORAGE_CHOICES:
        raise HTTPException(status_code=400, detail="유효한 스토리지 구분을 선택해주세요.")
    return normalized


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


def list_storage_sites(storage_name: str | None, db: Session) -> list[dict]:
    query = db.query(StorageSite)
    if storage_name:
        query = query.filter(StorageSite.storage_name == validate_storage_name(storage_name))
    rows = query.order_by(StorageSite.name.asc(), StorageSite.id.asc()).all()
    return [serialize_site(row) for row in rows]


def create_storage_site(payload: StorageSitePayload, db: Session) -> dict:
    storage_name, site_name = validate_site_payload(payload)
    existing = db.query(StorageSite).filter(StorageSite.storage_name == storage_name, StorageSite.name == site_name).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 등록된 사이트입니다.")

    row = StorageSite(storage_name=storage_name, name=site_name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_site(row)


def update_storage_site(site_id: int, payload: StorageSitePayload, db: Session) -> dict:
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


def delete_storage_site(site_id: int, db: Session) -> dict:
    row = get_site_or_404(db, site_id)
    attached_log = db.query(UploadedLog).filter(UploadedLog.site_id == row.id).first()
    if attached_log:
        raise HTTPException(status_code=400, detail="이 사이트에 업로드된 로그가 있어 삭제할 수 없습니다.")

    site_name = row.name
    storage_name = row.storage_name
    db.delete(row)
    db.commit()
    return {"deleted": True, "id": site_id, "name": site_name, "storage_name": storage_name}

