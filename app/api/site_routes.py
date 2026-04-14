from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.payloads import StorageSitePayload
from app.services.auth_service import require_admin_user, require_current_user
from app.services.site_service import create_storage_site, delete_storage_site, list_storage_sites, update_storage_site


router = APIRouter()


@router.get("/sites")
def list_storage_sites_route(
    storage_name: Optional[str] = None,
    _: object = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    return list_storage_sites(storage_name, db)


@router.post("/sites")
def create_storage_site_route(
    payload: StorageSitePayload,
    _: object = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return create_storage_site(payload, db)


@router.put("/sites/{site_id}")
def update_storage_site_route(
    site_id: int,
    payload: StorageSitePayload,
    _: object = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return update_storage_site(site_id, payload, db)


@router.delete("/sites/{site_id}")
def delete_storage_site_route(
    site_id: int,
    _: object = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    return delete_storage_site(site_id, db)
