from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func

from app.db import Base


class StorageSite(Base):
    __tablename__ = "storage_sites"

    id = Column(Integer, primary_key=True, index=True)
    storage_name = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class UploadedLog(Base):
    __tablename__ = "uploaded_logs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    stored_path = Column(String(500), nullable=False)
    content_type = Column(String(255), nullable=True)
    size = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False, default="uploaded")
    storage_name = Column(String(50), nullable=False, default="storage1")
    site_id = Column(Integer, nullable=True, index=True)
    manual_fields_json = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RequestPost(Base):
    __tablename__ = "request_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="대기")
    author = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class BugPost(Base):
    __tablename__ = "bug_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
