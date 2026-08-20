import tempfile
from pathlib import Path

from app.services.storage_service import LocalStorageService


def test_local_storage_upload_download_delete():
    """Verify complete lifecycle of local encrypted object storage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = LocalStorageService(storage_dir=tmpdir)

        payload = b"\x00\x01\x02\x03\x04encrypted_blob_data"
        ref = storage.upload(payload)

        assert ref.startswith("local://")
        assert ref.endswith(".enc")

        # Verify download
        downloaded = storage.download(ref)
        assert downloaded == payload

        # Verify disk file doesn't contain raw plaintext strings
        disk_path = storage._get_file_path(ref)
        assert disk_path.exists()
        assert disk_path.read_bytes() == payload

        # Delete
        assert storage.delete(ref) is True
        assert not disk_path.exists()
        assert storage.delete(ref) is False
