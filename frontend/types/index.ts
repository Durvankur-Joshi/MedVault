// ─── Role Types ─────────────────────────────────────────────────────

export type UserRole = "patient" | "doctor" | "hospital_admin";

// ─── Core Entities ──────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
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
  patientId: string;
  recordType: string;
  fhirResourceType: string | null;
  encryptedStorageRef: string | null;
  recordHash: string | null;
  blockchainRecordId: string | null;
  createdAt: string;
}

// ─── Consent ────────────────────────────────────────────────────────

export type ConsentPermission = "read" | "write" | "full";
export type ConsentStatus = "active" | "revoked" | "expired";

export interface Consent {
  id: string;
  patientId: string;
  recordId: string;
  granteeDoctorId: string | null;
  granteeHospitalId: string | null;
  permission: ConsentPermission;
  status: ConsentStatus;
  expiresAt: string | null;
  blockchainConsentId: string | null;
  createdAt: string;
}

// ─── Access Requests ────────────────────────────────────────────────

export type AccessRequestStatus = "pending" | "approved" | "denied";

export interface AccessRequest {
  id: string;
  patientId: string;
  recordId: string | null;
  requesterDoctorId: string | null;
  requesterHospitalId: string | null;
  status: AccessRequestStatus;
  reason: string | null;
  createdAt: string;
}

// ─── Audit Log ──────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string | null;
  blockchainTxId: string | null;
  createdAt: string;
}

// ─── API Response Wrapper ───────────────────────────────────────────

export interface HealthResponse {
  status: string;
  service: string;
}
