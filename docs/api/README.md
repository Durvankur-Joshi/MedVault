# MedVault — API Documentation

## Base URL

- **Development**: `http://127.0.0.1:8000`
- **Production**: TBD

---

## Authentication & Authorization

All protected endpoints require an `Authorization` header with a valid JWT Bearer token:

```http
Authorization: Bearer <access_token>
```

> **Note on Authorization:**
> A valid JWT verifies user identity, but **JWT ≠ authorization**.
> Business authorization (record ownership, active patient consent, or role permission) is verified per request by the service layer.

---

## Implemented Endpoints (Phase 1, 2 & 3)

### 1. Health Check

#### `GET /api/health`
Check API service availability.

- **Auth**: None
- **Response** `200 OK`:
  ```json
  {
    "status": "ok",
    "service": "medvault-backend"
  }
  ```

---

### 2. Authentication

#### `POST /api/auth/register`
Register a new user account (and auto-creates patient profile for patient role).

- **Auth**: None
- **Request Body**:
  ```json
  {
    "email": "patient@example.com",
    "password": "strongpassword123",
    "role": "patient"
  }
  ```
  *Allowed roles: `patient`, `doctor`, `hospital_admin`*
- **Response** `201 Created`:
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "patient@example.com",
    "role": "patient",
    "is_active": true,
    "created_at": "2026-08-19T14:00:00Z"
  }
  ```
- **Errors**: `400 Bad Request` (invalid role), `409 Conflict` (email already registered).

#### `POST /api/auth/login`
Authenticate with email and password to receive a JWT access token.

- **Auth**: None
- **Request Body**:
  ```json
  {
    "email": "patient@example.com",
    "password": "strongpassword123"
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "email": "patient@example.com",
      "role": "patient",
      "is_active": true,
      "created_at": "2026-08-19T14:00:00Z"
    }
  }
  ```
- **Errors**: `401 Unauthorized` (invalid credentials or deactivated account).

#### `GET /api/auth/me`
Retrieve the currently authenticated user's profile.

- **Auth**: Bearer Token
- **Response** `200 OK`: `UserResponse`
- **Errors**: `401 Unauthorized` (missing/expired/invalid token).

---

### 3. Medical Records (Phase 3 Privacy Pipeline)

*Plaintext clinical content and encryption keys are NEVER stored in PostgreSQL or on the blockchain.*

#### `POST /api/records`
Create a privacy-preserving medical record.
The clinical payload is validated against HL7 FHIR R4, canonicalized, hashed with SHA-256, encrypted with AES-256-GCM, and stored off-chain. Safe metadata is stored in PostgreSQL.

- **Auth**: Bearer Token (`patient` or `doctor` role)
- **Request Body**:
  ```json
  {
    "record_type": "observation",
    "fhir_resource_type": "Observation",
    "fhir_data": {
      "resourceType": "Observation",
      "status": "final",
      "code": {
        "text": "Blood Pressure"
      },
      "valueQuantity": {
        "value": 120,
        "unit": "mmHg"
      }
    },
    "patient_id": "patient-uuid-optional-for-patient-required-for-doctor"
  }
  ```
- **Response** `201 Created`:
  ```json
  {
    "id": "record-uuid",
    "patient_id": "patient-uuid",
    "created_by_user_id": "user-uuid",
    "record_type": "observation",
    "fhir_resource_type": "Observation",
    "encrypted_storage_ref": "local://7881c19b-c40d-4da4-8bcf-62723cf23a7e.enc",
    "record_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "encryption_version": "aes-256-gcm-v1",
    "storage_provider": "local",
    "blockchain_record_id": null,
    "created_at": "2026-08-19T16:00:00Z"
  }
  ```
- **Errors**: `400 Bad Request` (invalid FHIR payload), `403 Forbidden`, `404 Not Found`.

#### `GET /api/records`
List medical records metadata. Patients see their own records; Doctors see records where active, non-expired consent has been granted.

- **Auth**: Bearer Token
- **Response** `200 OK`: `list[MedicalRecordResponse]`

#### `GET /api/records/{record_id}`
Retrieve record metadata with authorization verification.

- **Auth**: Bearer Token
- **Response** `200 OK`: `MedicalRecordResponse`
- **Errors**: `403 Forbidden` (patient not owner or doctor lacks active consent), `404 Not Found`.

#### `GET /api/records/{record_id}/decrypted`
Retrieve and decrypt an authorized medical record. Downloads off-chain ciphertext, decrypts with AES-256-GCM, and verifies the SHA-256 integrity hash before returning the FHIR payload.

- **Auth**: Bearer Token (`patient` owner or `doctor` with active consent)
- **Response** `200 OK`:
  ```json
  {
    "id": "record-uuid",
    "patient_id": "patient-uuid",
    "record_type": "observation",
    "fhir_resource_type": "Observation",
    "encrypted_storage_ref": "local://7881c19b-c40d-4da4-8bcf-62723cf23a7e.enc",
    "record_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "created_at": "2026-08-19T16:00:00Z",
    "fhir_data": {
      "resourceType": "Observation",
      "status": "final",
      "code": { "text": "Blood Pressure" },
      "valueQuantity": { "value": 120, "unit": "mmHg" }
    },
    "integrity_verified": true
  }
  ```
- **Errors**: `400 Bad Request` (decryption tag mismatch or integrity failure), `403 Forbidden`, `404 Not Found`.

#### `GET /api/records/{record_id}/verify`
Perform on-demand cryptographic integrity verification. Compares stored PostgreSQL hash commitment with the recalculated hash of the decrypted off-chain storage blob.

- **Auth**: Bearer Token
- **Response** `200 OK`:
  ```json
  {
    "record_id": "record-uuid",
    "stored_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "recalculated_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "integrity_verified": true,
    "status": "verified",
    "details": "SHA-256 commitment successfully verified against AES-256-GCM decrypted storage blob."
  }
  ```
- **Errors**: `403 Forbidden`, `404 Not Found`.

#### `DELETE /api/records/{record_id}`
Delete a medical record and its off-chain encrypted blob. Only the owning patient can delete.

- **Auth**: Bearer Token (`patient` role required)
- **Response** `204 No Content`
- **Errors**: `403 Forbidden` (not owner), `404 Not Found`.

---

### 4. Consent Management

#### `POST /api/consent`
Grant access consent for a specific medical record to a doctor or hospital.

- **Auth**: Bearer Token (`patient` role required)
- **Request Body**:
  ```json
  {
    "record_id": "record-uuid",
    "permission": "read",
    "grantee_doctor_id": "doctor-uuid",
    "expires_at": "2026-09-19T14:00:00Z"
  }
  ```
  *Permissions: `read`, `write`, `full`*
- **Response** `201 Created`: `ConsentResponse`
- **Errors**: `400 Bad Request`, `403 Forbidden`, `404 Not Found`.

#### `GET /api/consent`
List consent entries associated with the current patient.

- **Auth**: Bearer Token
- **Response** `200 OK`: `list[ConsentResponse]`

#### `GET /api/consent/{consent_id}`
Retrieve a specific consent entry.

- **Auth**: Bearer Token
- **Response** `200 OK`: `ConsentResponse`

#### `PATCH /api/consent/{consent_id}/revoke`
Revoke an active consent permission. Only the granting patient can revoke.

- **Auth**: Bearer Token (`patient` role required)
- **Response** `200 OK`: `ConsentResponse` (status set to `revoked`)

---

### 5. Access Requests

#### `POST /api/access-requests`
Submit a request to access a patient's medical record.

- **Auth**: Bearer Token (`doctor` or `hospital_admin` role required)
- **Request Body**:
  ```json
  {
    "patient_id": "patient-uuid",
    "record_id": "record-uuid-optional",
    "reason": "Diagnostic evaluation"
  }
  ```
- **Response** `201 Created`: `AccessRequestResponse`

#### `GET /api/access-requests`
List access requests for the authenticated user.

- **Auth**: Bearer Token
- **Response** `200 OK`: `list[AccessRequestResponse]`

#### `PATCH /api/access-requests/{request_id}/approve`
Approve an access request. Auto-provisions active `Consent`.

- **Auth**: Bearer Token (`patient` role required)
- **Response** `200 OK`: `AccessRequestResponse` (status set to `approved`)

#### `PATCH /api/access-requests/{request_id}/deny`
Deny an access request.

- **Auth**: Bearer Token (`patient` role required)
- **Response** `200 OK`: `AccessRequestResponse` (status set to `denied`)

---

### 6. Audit Trail

#### `GET /api/audit`
Retrieve non-PII audit log events associated with the authenticated user.

- **Auth**: Bearer Token
- **Response** `200 OK`: `list[AuditLogResponse]`

---

## Error Format

All error responses return a standardized JSON structure:

```json
{
  "detail": "Human-readable error description"
}
```
