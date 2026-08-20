from abc import ABC, abstractmethod
import os
from pathlib import Path
import uuid
from typing import Optional

from fastapi import HTTPException, status

from app.core.config import settings


class StorageError(HTTPException):
    """Raised when an encrypted object storage operation fails."""

    def __init__(self, detail: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR) -> None:
        super().__init__(status_code=status_code, detail=detail)


class StorageService(ABC):
    """Abstract interface for off-chain encrypted object storage."""

    @abstractmethod
    def upload(self, data: bytes, reference_id: Optional[str] = None) -> str:
        """
        Store encrypted bytes and return a storage reference URI.
        e.g. 'local://f47ac10b-58cc-4372-a567-0e02b2c3d479.enc' or 'ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
        """
        pass

    @abstractmethod
    def download(self, storage_ref: str) -> bytes:
        """Retrieve encrypted bytes using a storage reference URI."""
        pass

    @abstractmethod
    def delete(self, storage_ref: str) -> bool:
        """Delete an encrypted object from storage."""
        pass


class LocalStorageService(StorageService):
    """
    Local filesystem implementation of off-chain encrypted object storage.
    Stores only encrypted binary blobs outside source control.
    """

    def __init__(self, storage_dir: Optional[str] = None) -> None:
        base_path = storage_dir or settings.storage_path
        self.storage_path = Path(base_path)
        # Ensure the directory exists
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, storage_ref: str) -> Path:
        """Convert a storage reference to a safe local file path."""
        # Strip scheme if present
        ref = storage_ref
        if ref.startswith("local://"):
            ref = ref[len("local://"):]

        # Prevent directory traversal
        clean_name = Path(ref).name
        return self.storage_path / clean_name

    def upload(self, data: bytes, reference_id: Optional[str] = None) -> str:
        if not isinstance(data, bytes):
            raise TypeError("Data to upload must be bytes")

        file_id = reference_id or str(uuid.uuid4())
        filename = f"{file_id}.enc"
        file_path = self.storage_path / filename

        try:
            with open(file_path, "wb") as f:
                f.write(data)
        except Exception as e:
            raise StorageError(f"Failed to write encrypted record to storage: {str(e)}")

        return f"local://{filename}"

    def download(self, storage_ref: str) -> bytes:
        file_path = self._get_file_path(storage_ref)
        if not file_path.exists():
            raise StorageError(f"Encrypted object not found in storage: {storage_ref}", status_code=status.HTTP_404_NOT_FOUND)

        try:
            with open(file_path, "rb") as f:
                return f.read()
        except Exception as e:
            raise StorageError(f"Failed to read encrypted object from storage: {str(e)}")

    def delete(self, storage_ref: str) -> bool:
        file_path = self._get_file_path(storage_ref)
        if not file_path.exists():
            return False
        try:
            file_path.unlink()
            return True
        except Exception:
            return False


class IPFSStorageService(StorageService):
    """
    Stub interface for future Phase 4 IPFS decentralized off-chain storage.
    Ready for IPFS node pinning without breaking the StorageService abstraction.
    """

    def __init__(self, ipfs_gateway_url: Optional[str] = None) -> None:
        self.gateway_url = ipfs_gateway_url

    def upload(self, data: bytes, reference_id: Optional[str] = None) -> str:
        # Fallback to local storage or raise if IPFS provider is not configured
        raise NotImplementedError("IPFS storage provider is prepared for Phase 4 decentralized integration.")

    def download(self, storage_ref: str) -> bytes:
        raise NotImplementedError("IPFS storage provider is prepared for Phase 4 decentralized integration.")

    def delete(self, storage_ref: str) -> bool:
        raise NotImplementedError("IPFS storage provider is prepared for Phase 4 decentralized integration.")


def get_storage_service() -> StorageService:
    """Factory to retrieve the configured storage service."""
    if settings.storage_type == "ipfs":
        return IPFSStorageService()
    return LocalStorageService()
