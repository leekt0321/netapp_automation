from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.db import Base


class UploadedLog(Base):
    __tablename__ = "uploaded_logs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    stored_path = Column(String(500), nullable=False)
    content_type = Column(String(255), nullable=True)
    size = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False, default="uploaded")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
