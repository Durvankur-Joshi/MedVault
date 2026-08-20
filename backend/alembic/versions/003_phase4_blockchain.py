"""Phase 4 migration - add wallet_address to users, blockchain fields to medical_records and consents, and original document fields

Revision ID: 003_phase4_blockchain
Revises: 002_phase3_pipeline
Create Date: 2026-08-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "003_phase4_blockchain"
down_revision: Union[str, None] = "002_phase3_pipeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users: wallet_address
    op.add_column(
        "users",
        sa.Column("wallet_address", sa.String(42), nullable=True),
    )
    op.create_index(
        "ix_users_wallet_address",
        "users",
        ["wallet_address"],
        unique=True,
    )

    # 2. medical_records: blockchain & document fields
    op.add_column(
        "medical_records",
        sa.Column("blockchain_network", sa.String(50), nullable=True),
    )
    op.add_column(
        "medical_records",
        sa.Column("blockchain_contract_address", sa.String(42), nullable=True),
    )
    op.add_column(
        "medical_records",
        sa.Column("blockchain_tx_hash", sa.String(66), nullable=True),
    )
    op.add_column(
        "medical_records",
        sa.Column("blockchain_anchored_at", sa.String(50), nullable=True),
    )
    op.add_column(
        "medical_records",
        sa.Column("original_document_filename", sa.String(255), nullable=True),
    )
    op.add_column(
        "medical_records",
        sa.Column("original_document_mime_type", sa.String(100), nullable=True),
    )
    op.add_column(
        "medical_records",
        sa.Column("original_document_hash", sa.String(64), nullable=True),
    )
    op.add_column(
        "medical_records",
        sa.Column("original_document_ref", sa.Text(), nullable=True),
    )

    # 3. consents: blockchain fields
    op.add_column(
        "consents",
        sa.Column("blockchain_network", sa.String(50), nullable=True),
    )
    op.add_column(
        "consents",
        sa.Column("blockchain_contract_address", sa.String(42), nullable=True),
    )
    op.add_column(
        "consents",
        sa.Column("blockchain_tx_hash", sa.String(66), nullable=True),
    )


def downgrade() -> None:
    # consents
    op.drop_column("consents", "blockchain_tx_hash")
    op.drop_column("consents", "blockchain_contract_address")
    op.drop_column("consents", "blockchain_network")

    # medical_records
    op.drop_column("medical_records", "original_document_ref")
    op.drop_column("medical_records", "original_document_hash")
    op.drop_column("medical_records", "original_document_mime_type")
    op.drop_column("medical_records", "original_document_filename")
    op.drop_column("medical_records", "blockchain_anchored_at")
    op.drop_column("medical_records", "blockchain_tx_hash")
    op.drop_column("medical_records", "blockchain_contract_address")
    op.drop_column("medical_records", "blockchain_network")

    # users
    op.drop_index("ix_users_wallet_address", table_name="users")
    op.drop_column("users", "wallet_address")
