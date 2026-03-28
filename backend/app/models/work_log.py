import uuid

from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class WorkLog(Base):
    __tablename__ = "work_logs"
    __table_args__ = (
        CheckConstraint("minutes_total >= 0", name="ck_work_logs_minutes_total_nonnegative"),
        CheckConstraint("minutes_regular >= 0", name="ck_work_logs_minutes_regular_nonnegative"),
        CheckConstraint("minutes_overtime >= 0", name="ck_work_logs_minutes_overtime_nonnegative"),
        CheckConstraint("minutes_weekend >= 0", name="ck_work_logs_minutes_weekend_nonnegative"),
        CheckConstraint("minutes_holiday >= 0", name="ck_work_logs_minutes_holiday_nonnegative"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    technician_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    work_date = Column(Date, nullable=False, index=True)
    time_from = Column(Time, nullable=False)
    time_to = Column(Time, nullable=False)
    minutes_total = Column(Integer, nullable=False, default=0)
    minutes_regular = Column(Integer, nullable=False, default=0)
    minutes_overtime = Column(Integer, nullable=False, default=0)
    minutes_weekend = Column(Integer, nullable=False, default=0)
    minutes_holiday = Column(Integer, nullable=False, default=0)
    activity_description = Column(Text, nullable=False)
    repair_type_code = Column(String, nullable=True)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    request = relationship("ServiceRequest", back_populates="work_logs")
    technician_user = relationship("User", foreign_keys=[technician_user_id])
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
