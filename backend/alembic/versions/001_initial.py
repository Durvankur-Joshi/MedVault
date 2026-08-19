"""Initial Phase 2 migration - create all tables

Revision ID: 001_initial
Revises:
Create Date: 2026-08-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- hospitals ---
    op.create_table(
        "hospitals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("registration_number", sa.String(100), unique=True, nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- patients ---
    op.create_table(
        "patients",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- doctors ---
    op.create_table(
        "doctors",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("hospital_id", sa.String(36), sa.ForeignKey("hospitals.id"), nullable=True),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("specialization", sa.String(255), nullable=True),
        sa.Column("license_number", sa.String(100), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- medical_records ---
    op.create_table(
        "medical_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=False, index=True),
        sa.Column("record_type", sa.String(100), nullable=False),
        sa.Column("fhir_resource_type", sa.String(100), nullable=True),
        sa.Column("encrypted_storage_ref", sa.Text(), nullable=True),
        sa.Column("record_hash", sa.String(64), nullable=True),
        sa.Column("blockchain_record_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- consents ---
    op.create_table(
        "consents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=False, index=True),
        sa.Column("record_id", sa.String(36), sa.ForeignKey("medical_records.id"), nullable=False, index=True),
        sa.Column("grantee_doctor_id", sa.String(36), sa.ForeignKey("doctors.id"), nullable=True),
        sa.Column("grantee_hospital_id", sa.String(36), sa.ForeignKey("hospitals.id"), nullable=True),
        sa.Column("permission", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blockchain_consent_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- access_requests ---
    op.create_table(
        "access_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=False, index=True),
        sa.Column("requester_doctor_id", sa.String(36), sa.ForeignKey("doctors.id"), nullable=True),
        sa.Column("requester_hospital_id", sa.String(36), sa.ForeignKey("hospitals.id"), nullable=True),
        sa.Column("record_id", sa.String(36), sa.ForeignKey("medical_records.id"), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(36), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("blockchain_tx_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("access_requests")
    op.drop_table("consents")
    op.drop_table("medical_records")
    op.drop_table("doctors")
    op.drop_table("patients")
    op.drop_table("hospitals")
    op.drop_table("users")
