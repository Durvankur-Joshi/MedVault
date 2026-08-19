# MedVault — API Documentation

## Base URL

- **Development**: `http://localhost:8000`
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

## Implemented Endpoints (Phase 2)

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

### 3. Medical Records

*Note: Phase 2 medical records only store safe metadata and reference pointers. No raw clinical or plaintext medical records are stored.*

#### `POST /api/records`
Register a new medical record metadata entry.

- **Auth**: Bearer Token (`patient` role required)
- **Request Body**:
  ```json
  {
    "record_type": "lab_result",
    "fhir_resource_type": "Observation"
  }
  ```
- **Response** `201 Created`:
  ```json
  {
    "id": "record-uuid",
    "patient_id": "patient-uuid",
    "record_type": "lab_result",
    "fhir_resource_type": "Observation",
    "encrypted_storage_ref": null,
    "record_hash": null,
    "blockchain_record_id": null,
    "created_at": "2026-08-19T14:00:00Z"
  }
  ```
- **Errors**: `403 Forbidden` (non-patient role).

#### `GET /api/records`
List medical records. Patients see their own records; Doctors see records where active, non-expired consent has been granted to them.

- **Auth**: Bearer Token
- **Response** `200 OK`: `list[MedicalRecordResponse]`

#### `GET /api/records/{record_id}`
Retrieve a single medical record with strict authorization verification.

- **Auth**: Bearer Token
- **Response** `200 OK`: `MedicalRecordResponse`
- **Errors**: `403 Forbidden` (patient not owner or doctor lacks active consent), `404 Not Found`.

#### `DELETE /api/records/{record_id}`
Delete a medical record metadata entry. Only the owning patient can delete.

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
- **Errors**: `400 Bad Request` (both/neither grantee specified, invalid permission), `403 Forbidden` (not owner of record), `404 Not Found`.

#### `GET /api/consent`
List consent entries associated with the current patient.

- **Auth**: Bearer Token
- **Response** `200 OK`: `list[ConsentResponse]`

#### `GET /api/consent/{consent_id}`
Retrieve a specific consent entry.

- **Auth**: Bearer Token
- **Response** `200 OK`: `ConsentResponse`
- **Errors**: `403 Forbidden`, `404 Not Found`.

#### `PATCH /api/consent/{consent_id}/revoke`
Revoke an active consent permission. Only the granting patient can revoke.

- **Auth**: Bearer Token (`patient` role required)
- **Response** `200 OK`: `ConsentResponse` (status set to `revoked`)
- **Errors**: `400 Bad Request` (already revoked), `403 Forbidden`, `404 Not Found`.

---

### 5. Access Requests

#### `POST /api/access-requests`
Submit a request to access a patient's medical record history.

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
- **Errors**: `403 Forbidden`, `404 Not Found`.

#### `GET /api/access-requests`
List incoming requests (for patients) or submitted requests (for doctors/hospitals).

- **Auth**: Bearer Token
- **Response** `200 OK`: `list[AccessRequestResponse]`

#### `GET /api/access-requests/{request_id}`
Retrieve a specific access request.

- **Auth**: Bearer Token
- **Response** `200 OK`: `AccessRequestResponse`

#### `PATCH /api/access-requests/{request_id}/approve`
Approve an access request. Only the targeted patient can approve. Automatically provisions the corresponding `Consent` record.

- **Auth**: Bearer Token (`patient` role required)
- **Response** `200 OK`: `AccessRequestResponse` (status set to `approved`)
- **Errors**: `400 Bad Request` (not pending), `403 Forbidden`, `404 Not Found`.

#### `PATCH /api/access-requests/{request_id}/deny`
Deny an access request. Does not create consent.

- **Auth**: Bearer Token (`patient` role required)
- **Response** `200 OK`: `AccessRequestResponse` (status set to `denied`)
- **Errors**: `400 Bad Request`, `403 Forbidden`, `404 Not Found`.

---

### 6. Audit Trail

#### `GET /api/audit`
Retrieve audit log events associated with the authenticated user.

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
