from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.payloads import StorageSitePayload
from app.services.site_service import create_storage_site, delete_storage_site, list_storage_sites, update_storage_site


router = APIRouter()


@router.get("/sites")
def list_storage_sites_route(storage_name: Optional[str] = None, db: Session = Depends(get_db)):
    return list_storage_sites(storage_name, db)


@router.post("/sites")
def create_storage_site_route(payload: StorageSitePayload, db: Session = Depends(get_db)):
    return create_storage_site(payload, db)


@router.put("/sites/{site_id}")
def update_storage_site_route(site_id: int, payload: StorageSitePayload, db: Session = Depends(get_db)):
    return update_storage_site(site_id, payload, db)


@router.delete("/sites/{site_id}")
def delete_storage_site_route(site_id: int, db: Session = Depends(get_db)):
    return delete_storage_site(site_id, db)
