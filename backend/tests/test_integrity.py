import hashlib
from app.services import integrity_service


def test_hash_calculation_deterministic():
    """Verify that calculate_record_hash produces consistent SHA-256 digests."""
    data = {
        "resourceType": "Observation",
        "status": "final",
        "code": {"text": "Heart Rate"},
        "valueQuantity": {"value": 72, "unit": "bpm"},
    }

    hash1 = integrity_service.calculate_record_hash(data)
    hash2 = integrity_service.calculate_record_hash(data)

    assert hash1 == hash2
    assert len(hash1) == 64  # SHA-256 hex length


def test_hash_changes_on_data_modification():
    """Verify that any modification in the clinical data alters the integrity hash."""
    data1 = {
        "resourceType": "Observation",
        "status": "final",
        "code": {"text": "Heart Rate"},
        "valueQuantity": {"value": 72, "unit": "bpm"},
    }

    data2 = {
        "resourceType": "Observation",
        "status": "final",
        "code": {"text": "Heart Rate"},
        "valueQuantity": {"value": 73, "unit": "bpm"},
    }

    hash1 = integrity_service.calculate_record_hash(data1)
    hash2 = integrity_service.calculate_record_hash(data2)

    assert hash1 != hash2


def test_verify_record_hash_constant_time():
    """Verify constant-time hash verification helper."""
    data = "canonical_record_payload"
    expected = hashlib.sha256(data.encode("utf-8")).hexdigest()

    assert integrity_service.verify_record_hash(data, expected) is True
    assert integrity_service.verify_record_hash(data, "a" * 64) is False
    assert integrity_service.verify_record_hash(data, "") is False
