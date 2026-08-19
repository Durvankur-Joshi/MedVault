// ─── Role Types ─────────────────────────────────────────────────────

export type UserRole = "patient" | "doctor" | "hospital_admin";

// ─── Core Entities ──────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  is_active?: boolean;
  createdAt?: string;
  created_at?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Patient {
  id: string;
  userId: string;
  displayName: string;
  createdAt: string;
}

export interface Hospital {
  id: string;
  name: string;
  registrationNumber: string;
  isVerified: boolean;
  createdAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  hospitalId: string | null;
  displayName: string;
  specialization: string | null;
  licenseNumber: string;
  createdAt: string;
}

// ─── Medical Records ────────────────────────────────────────────────

export interface MedicalRecord {
  id: string;
  patient_id?: string;
  patientId?: string;
  record_type?: string;
  recordType?: string;
  fhir_resource_type?: string | null;
  fhirResourceType?: string | null;
  encrypted_storage_ref?: string | null;
  encryptedStorageRef?: string | null;
  record_hash?: string | null;
  recordHash?: string | null;
  blockchain_record_id?: string | null;
  blockchainRecordId?: string | null;
  created_at?: string;
  createdAt?: string;
}

// ─── Consent ────────────────────────────────────────────────────────

export type ConsentPermission = "read" | "write" | "full";
export type ConsentStatus = "active" | "revoked" | "expired";

export interface Consent {
  id: string;
  patient_id?: string;
  patientId?: string;
  record_id?: string;
  recordId?: string;
  grantee_doctor_id?: string | null;
  granteeDoctorId?: string | null;
  grantee_hospital_id?: string | null;
  granteeHospitalId?: string | null;
  permission: ConsentPermission;
  status: ConsentStatus;
  expires_at?: string | null;
  expiresAt?: string | null;
  blockchain_consent_id?: string | null;
  blockchainConsentId?: string | null;
  created_at?: string;
  createdAt?: string;
}

// ─── Access Requests ────────────────────────────────────────────────

export type AccessRequestStatus = "pending" | "approved" | "denied";

export interface AccessRequest {
  id: string;
  patient_id?: string;
  patientId?: string;
  record_id?: string | null;
  recordId?: string | null;
  requester_doctor_id?: string | null;
  requesterDoctorId?: string | null;
  requester_hospital_id?: string | null;
  requesterHospitalId?: string | null;
  status: AccessRequestStatus;
  reason: string | null;
  created_at?: string;
  createdAt?: string;
}

// ─── Audit Log ──────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  actor_user_id?: string;
  actorUserId?: string;
  action: string;
  resource_type?: string;
  resourceType?: string;
  resource_id?: string;
  resourceId?: string;
  details: string | null;
  blockchain_tx_id?: string | null;
  blockchainTxId?: string | null;
  created_at?: string;
  createdAt?: string;
}

// ─── API Response Wrapper ───────────────────────────────────────────

export interface HealthResponse {
  status: string;
  service: string;
}
