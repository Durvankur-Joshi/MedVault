"""Phase 3 migration - add created_by, encryption_version, and storage_provider to medical_records

Revision ID: 002_phase3_pipeline
Revises: 001_initial
Create Date: 2026-08-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002_phase3_pipeline"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "medical_records",
        sa.Column("created_by_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index(
        "ix_medical_records_created_by_user_id",
        "medical_records",
        ["created_by_user_id"],
    )
    op.add_column(
        "medical_records",
        sa.Column("encryption_version", sa.String(20), nullable=True, server_default="aes-256-gcm-v1"),
    )
    op.add_column(
        "medical_records",
        sa.Column("storage_provider", sa.String(50), nullable=True, server_default="local"),
    )


def downgrade() -> None:
    op.drop_column("medical_records", "storage_provider")
    op.drop_column("medical_records", "encryption_version")
    op.drop_index("ix_medical_records_created_by_user_id", table_name="medical_records")
    op.drop_column("medical_records", "created_by_user_id")
