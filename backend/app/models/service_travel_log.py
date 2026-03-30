import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ServiceTravelLog(Base):
    __tablename__ = "service_travel_logs"
    __table_args__ = (
        CheckConstraint("estimated_duration_minutes IS NULL OR estimated_duration_minutes >= 0", name="ck_service_travel_logs_estimated_duration_nonnegative"),
        CheckConstraint("final_duration_minutes IS NULL OR final_duration_minutes >= 0", name="ck_service_travel_logs_final_duration_nonnegative"),
        CheckConstraint("estimated_distance_km IS NULL OR estimated_distance_km >= 0", name="ck_service_travel_logs_estimated_distance_nonnegative"),
        CheckConstraint("final_distance_km IS NULL OR final_distance_km >= 0", name="ck_service_travel_logs_final_distance_nonnegative"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    technician_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ended_at = Column(DateTime(timezone=True), nullable=True, index=True)
    start_latitude = Column(Numeric(10, 6), nullable=True)
    start_longitude = Column(Numeric(10, 6), nullable=True)
    end_latitude = Column(Numeric(10, 6), nullable=True)
    end_longitude = Column(Numeric(10, 6), nullable=True)
    estimated_duration_minutes = Column(Integer, nullable=True)
    final_duration_minutes = Column(Integer, nullable=True)
    estimated_distance_km = Column(Numeric(10, 2), nullable=True)
    final_distance_km = Column(Numeric(10, 2), nullable=True)
    is_gps_estimated = Column(Boolean, nullable=False, default=False, server_default="false")
    manual_adjustment_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    request = relationship("ServiceRequest", back_populates="travel_logs")
    technician_user = relationship("User", foreign_keys=[technician_user_id])
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
