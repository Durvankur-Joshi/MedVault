import pytest
from app.services import fhir_service
from app.services.fhir_service import FHIRValidationError


def test_valid_observation_validation():
    """Verify validation of a valid FHIR Observation."""
    obs = {
        "resourceType": "Observation",
        "status": "final",
        "code": {
            "coding": [{"system": "http://loinc.org", "code": "8480-6", "display": "Systolic blood pressure"}],
            "text": "Systolic Blood Pressure",
        },
        "valueQuantity": {"value": 120, "unit": "mmHg"},
    }
    assert fhir_service.validate_resource(obs) == "Observation"


def test_valid_condition_validation():
    """Verify validation of a valid FHIR Condition."""
    cond = {
        "resourceType": "Condition",
        "clinicalStatus": "active",
        "code": {
            "coding": [{"system": "http://snomed.info/sct", "code": "38341003", "display": "Hypertensive disorder"}],
            "text": "Hypertension",
        },
        "subject": {"reference": "Patient/pat-123"},
    }
    assert fhir_service.validate_resource(cond) == "Condition"


def test_valid_medication_request_validation():
    """Verify validation of a valid FHIR MedicationRequest."""
    med = {
        "resourceType": "MedicationRequest",
        "status": "active",
        "intent": "order",
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "197361", "display": "Amlodipine 5 MG Oral Tablet"}],
            "text": "Amlodipine 5mg",
        },
        "subject": {"reference": "Patient/pat-123"},
    }
    assert fhir_service.validate_resource(med) == "MedicationRequest"


def test_valid_encounter_validation():
    """Verify validation of a valid FHIR Encounter."""
    enc = {
        "resourceType": "Encounter",
        "status": "finished",
        "class": {"code": "AMB", "display": "ambulatory"},
        "subject": {"reference": "Patient/pat-123"},
    }
    assert fhir_service.validate_resource(enc) == "Encounter"


def test_invalid_resource_type():
    """Verify that unsupported resource types raise FHIRValidationError."""
    with pytest.raises(FHIRValidationError) as exc:
        fhir_service.validate_resource({"resourceType": "UnknownCustomResource"})
    assert "Unsupported FHIR resourceType" in str(exc.value.detail)


def test_missing_required_fields():
    """Verify that missing required fields raise FHIRValidationError."""
    with pytest.raises(FHIRValidationError) as exc:
        fhir_service.validate_resource({"resourceType": "Observation"})
    assert "missing required fields" in str(exc.value.detail)


def test_deterministic_canonicalization():
    """Verify that identical FHIR documents with different key order produce identical canonical bytes."""
    doc1 = {
        "resourceType": "Observation",
        "valueQuantity": {"unit": "mmHg", "value": 120},
        "status": "final",
        "code": {"text": "Blood Pressure", "coding": [{"code": "8480-6", "system": "http://loinc.org"}]},
    }

    doc2 = {
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}], "text": "Blood Pressure"},
        "status": "final",
        "resourceType": "Observation",
        "valueQuantity": {"value": 120, "unit": "mmHg"},
    }

    bytes1, dict1 = fhir_service.canonicalize_fhir(doc1)
    bytes2, dict2 = fhir_service.canonicalize_fhir(doc2)

    assert bytes1 == bytes2
    assert dict1 == dict2
