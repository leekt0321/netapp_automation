from typing import Optional

from pydantic import BaseModel


class LoginPayload(BaseModel):
    username: str
    password: str


class RegisterPayload(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None


class DeleteUserPayload(BaseModel):
    username: Optional[str] = None
    password: str


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


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


class UserStatusPayload(BaseModel):
    is_active: bool


class DeletionRequestPayload(BaseModel):
    reason: Optional[str] = None


class DeletionReviewPayload(BaseModel):
    action: str
    comment: Optional[str] = None
