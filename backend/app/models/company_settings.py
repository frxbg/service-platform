from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class CompanySettings(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False, default="Моята Компания")
    company_address = Column(Text, nullable=True)
    company_phone = Column(String, nullable=True)
    company_email = Column(String, nullable=True)
    company_website = Column(String, nullable=True)
    company_vat_number = Column(String, nullable=True)
    company_registration_number = Column(String, nullable=True)
    footer_text = Column(Text, nullable=True)
    session_timeout_minutes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
