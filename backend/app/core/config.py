from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Test mode flag
    testing: bool = False

    # Database
    database_url: str = "postgresql://medvault_user:medvault_dev_password@localhost:5432/medvault"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,https://medvault-umber.vercel.app"

    # JWT
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
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
    blockchain_enabled: bool = True
    patient_commitment_salt: str = "medvault_patient_secret_salt_2026"

    # Phase 5 — Zero-Knowledge Privacy (Noir)
    zk_enabled: bool = True
    zk_prover_mode: str = "local"  # "local" (deterministic simulation) or "nargo"
    zk_circuit_path: str = "zk/authorization"
    zk_secret_salt: str = "medvault_zk_auth_salt_2026"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


settings = Settings()
