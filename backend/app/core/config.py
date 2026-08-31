import json
import os
import urllib.parse
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Test mode flag
    testing: bool = False

    # Database
    # In production (Render), DATABASE_URL is supplied via environment variables.
    # In local development, it is loaded from the local .env file.
    database_url: str = "postgresql://postgres:postgres@localhost:5432/medvault"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Any) -> Any:
        """Normalize postgres:// to postgresql:// for SQLAlchemy 2.0 compatibility."""
        if isinstance(v, str):
            cleaned = v.strip().strip("'\"")
            if cleaned.startswith("postgres://"):
                return cleaned.replace("postgres://", "postgresql://", 1)
            return cleaned
        return v


    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,https://medvault-gcoeara.vercel.app,https://medvault-umber.vercel.app"

    # JWT
    jwt_secret_key: str = "medvault-dev-secret-key-change-in-production-2026"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Phase 3 — Encryption (AES-256-GCM 32-byte key)
    # Default is a 32-byte base64-encoded key for local development/testing
    medical_record_encryption_key: str = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="

    # Phase 3 — Storage
    storage_type: str = "local"
    storage_path: str = "storage/encrypted"

    # Phase 4 — Blockchain (EVM / Hardhat / Sepolia)
    blockchain_rpc_url: str = "http://127.0.0.1:8545"
    blockchain_chain_id: int = 31337
    blockchain_network_name: str = "Hardhat Localhost"
    blockchain_private_key: str = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    identity_registry_address: str = ""
    medical_record_registry_address: str = ""
    consent_manager_address: str = ""
    zk_verifier_contract_address: str = ""
    ultra_verifier_contract_address: str = ""
    blockchain_enabled: bool = True
    patient_commitment_salt: str = "medvault_patient_secret_salt_2026"

    # Phase 5 — Zero-Knowledge Privacy (Noir)
    zk_enabled: bool = True
    zk_prover_mode: str = "local"  # "local" (deterministic simulation) or "nargo"
    zk_circuit_path: str = "zk/authorization"
    zk_secret_salt: str = "medvault_zk_auth_salt_2026"


    @property
    def cors_origins_list(self) -> list[str]:
        """Parse and normalize CORS origins into a clean list of explicit trusted origins."""
        raw = self.cors_origins
        # Fallback to alternate environment variable names if cors_origins is empty
        if not raw or not str(raw).strip():
            raw = os.getenv("CORS_ORIGIN") or os.getenv("ALLOWED_ORIGINS") or os.getenv("FRONTEND_URL") or ""

        origins_raw: list[str] = []
        if isinstance(raw, (list, tuple, set)):
            for item in raw:
                if isinstance(item, str):
                    origins_raw.append(item)
        elif isinstance(raw, str):
            cleaned_str = raw.strip()
            # Support JSON array string e.g. '["http://localhost:3000", "https://..."]'
            if cleaned_str.startswith("[") and cleaned_str.endswith("]"):
                try:
                    parsed = json.loads(cleaned_str)
                    if isinstance(parsed, list):
                        for item in parsed:
                            if isinstance(item, str):
                                origins_raw.extend([chunk.strip() for chunk in item.split(",") if chunk.strip()])
                except Exception:
                    pass
            if not origins_raw:
                delims_replaced = cleaned_str.replace(";", ",").replace("\n", ",").replace("\r", ",")
                for chunk in delims_replaced.split(","):
                    origins_raw.append(chunk)

        normalized: list[str] = []
        for item in origins_raw:
            cleaned = item.strip().strip("'\"`“”‘’[]").strip()
            if cleaned:
                norm = cleaned.rstrip("/")
                if norm and norm not in normalized:
                    normalized.append(norm)

        return normalized

    @property
    def safe_db_info(self) -> dict[str, Any]:
        """Safe non-sensitive database connection metadata (no credentials)."""
        try:
            parsed = urllib.parse.urlparse(self.database_url)
            host = parsed.hostname or "unknown"
            port = parsed.port or (5432 if parsed.scheme.startswith("postgres") else None)
            is_pooler = "pooler.supabase.com" in host
            is_direct_supabase = host.startswith("db.") and "supabase.co" in host
            return {
                "host": host,
                "port": port,
                "is_pooler": is_pooler,
                "is_direct_supabase": is_direct_supabase,
                "scheme": parsed.scheme,
            }
        except Exception:
            return {
                "host": "parse_error",
                "port": None,
                "is_pooler": False,
                "is_direct_supabase": False,
                "scheme": "unknown",
            }

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


settings = Settings()

