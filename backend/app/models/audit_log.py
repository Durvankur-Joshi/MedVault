from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class AuditLog(UUIDMixin, Base):
    """
    Immutable audit log entry. Tracks all significant actions in the system.
    Never contains PII or medical record content — only references and
    action metadata.
    """

    __tablename__ = "audit_logs"

    # Who performed the action
    actor_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    # What action was performed
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. record.created, consent.granted, access.requested

    # What resource was affected (generic reference)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. medical_record, consent
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False)

    # Additional non-sensitive context
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Blockchain reference for on-chain audit events
    blockchain_tx_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
