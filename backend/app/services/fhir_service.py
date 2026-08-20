import json
from typing import Any

from fastapi import HTTPException, status

SUPPORTED_RESOURCE_TYPES: set[str] = {
    "Observation",
    "Condition",
    "MedicationRequest",
    "Encounter",
    "Patient",
}

# Required top-level fields for supported FHIR R4 resource types
REQUIRED_FIELDS: dict[str, list[str]] = {
    "Observation": ["resourceType", "status", "code"],
    "Condition": ["resourceType", "clinicalStatus", "code", "subject"],
    "MedicationRequest": ["resourceType", "status", "intent", "subject"],
    "Encounter": ["resourceType", "status", "class", "subject"],
    "Patient": ["resourceType"],
}


class FHIRValidationError(HTTPException):
    """Raised when FHIR resource validation fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _sort_recursively(obj: Any) -> Any:
    """Recursively sort dictionary keys for deterministic canonicalization."""
    if isinstance(obj, dict):
        return {k: _sort_recursively(v) for k, v in sorted(obj.items())}
    if isinstance(obj, list):
        return [_sort_recursively(item) for item in obj]
    return obj


def validate_resource(data: dict[str, Any]) -> str:
    """
    Validate a FHIR R4-style resource dictionary.
    Returns the validated resourceType string.
    Raises FHIRValidationError if invalid.
    """
    if not isinstance(data, dict):
        raise FHIRValidationError("FHIR resource must be a JSON object")

    resource_type = data.get("resourceType")
    if not resource_type or not isinstance(resource_type, str):
        raise FHIRValidationError("FHIR resource must contain a string 'resourceType'")

    if resource_type not in SUPPORTED_RESOURCE_TYPES:
        allowed = ", ".join(sorted(SUPPORTED_RESOURCE_TYPES))
        raise FHIRValidationError(
            f"Unsupported FHIR resourceType '{resource_type}'. Supported types: {allowed}"
        )

    # Check required fields
    required = REQUIRED_FIELDS.get(resource_type, ["resourceType"])
    missing = [f for f in required if f not in data or data[f] is None]
    if missing:
        raise FHIRValidationError(
            f"FHIR '{resource_type}' is missing required fields: {', '.join(missing)}"
        )

    # Specific resource validations
    if resource_type == "Observation":
        if not isinstance(data.get("status"), str):
            raise FHIRValidationError("Observation 'status' must be a string")
        if not isinstance(data.get("code"), dict):
            raise FHIRValidationError("Observation 'code' must be an object")

    elif resource_type == "Condition":
        if not isinstance(data.get("clinicalStatus"), (dict, str)):
            raise FHIRValidationError("Condition 'clinicalStatus' must be an object or string")
        if not isinstance(data.get("code"), dict):
            raise FHIRValidationError("Condition 'code' must be an object")

    elif resource_type == "MedicationRequest":
        if not isinstance(data.get("status"), str):
            raise FHIRValidationError("MedicationRequest 'status' must be a string")
        if not isinstance(data.get("intent"), str):
            raise FHIRValidationError("MedicationRequest 'intent' must be a string")
        if "medicationCodeableConcept" not in data and "medicationReference" not in data:
            raise FHIRValidationError(
                "MedicationRequest requires 'medicationCodeableConcept' or 'medicationReference'"
            )

    elif resource_type == "Encounter":
        if not isinstance(data.get("status"), str):
            raise FHIRValidationError("Encounter 'status' must be a string")
        if not isinstance(data.get("class"), (dict, str)):
            raise FHIRValidationError("Encounter 'class' must be an object or string")

    return resource_type


def canonicalize_fhir(data: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    """
    Validate and produce a deterministic canonical JSON representation of a FHIR resource.
    - Keys are recursively sorted.
    - Compact separators (no redundant whitespace) are used.
    - Encoded to UTF-8 bytes.

    Returns:
        tuple[bytes, dict]: (canonical_utf8_bytes, sorted_dict)
    """
    validate_resource(data)
    sorted_dict = _sort_recursively(data)
    canonical_bytes = json.dumps(
        sorted_dict,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return canonical_bytes, sorted_dict
