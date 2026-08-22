// ─── User & Authentication ──────────────────────────────────────────

export type UserRole = "patient" | "doctor" | "hospital_admin" | "admin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  wallet_address?: string | null;
  walletAddress?: string | null;
  is_active?: boolean;
  isActive?: boolean;
  created_at?: string;
  createdAt?: string;
  profile?: PatientProfile | DoctorProfile | HospitalProfile | null;
}

export interface PatientProfile {
  id: string;
  user_id?: string;
  userId?: string;
  display_name: string;
  displayName?: string;
}

export interface DoctorProfile {
  id: string;
  user_id?: string;
  userId?: string;
  display_name: string;
  displayName?: string;
  license_number: string;
  licenseNumber?: string;
  specialization?: string | null;
  hospital_id?: string | null;
  hospitalId?: string | null;
}

export interface HospitalProfile {
  id: string;
  name: string;
  registration_number: string;
  registrationNumber?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type TokenResponse = AuthResponse;

// ─── Medical Records ────────────────────────────────────────────────

export interface MedicalRecord {
  id: string;
  patient_id?: string;
  patientId?: string;
  created_by_user_id?: string;
  createdByUserId?: string;
  record_type: string;
  recordType?: string;
  fhir_resource_type?: string | null;
  fhirResourceType?: string | null;
  encrypted_storage_ref?: string | null;
  encryptedStorageRef?: string | null;
  record_hash?: string | null;
  recordHash?: string | null;
  storage_provider?: string;
  storageProvider?: string;
  encryption_version?: string;
  encryptionVersion?: string;
  blockchain_record_id?: string | null;
  blockchainRecordId?: string | null;
  blockchain_network?: string | null;
  blockchainNetwork?: string | null;
  blockchain_contract_address?: string | null;
  blockchainContractAddress?: string | null;
  blockchain_tx_hash?: string | null;
  blockchainTxHash?: string | null;
  blockchain_anchored_at?: string | null;
  blockchainAnchoredAt?: string | null;
  original_document_filename?: string | null;
  originalDocumentFilename?: string | null;
  original_document_mime_type?: string | null;
  originalDocumentMimeType?: string | null;
  original_document_hash?: string | null;
  originalDocumentHash?: string | null;
  original_document_ref?: string | null;
  originalDocumentRef?: string | null;
  created_at?: string;
  createdAt?: string;
}

export interface MedicalRecordDetailResponse extends MedicalRecord {
  fhir_data: Record<string, unknown>;
  integrity_verified: boolean;
}

export interface IntegrityVerifyResponse {
  record_id: string;
  stored_hash: string;
  recalculated_hash: string;
  integrity_verified: boolean;
  status: string;
  details?: string | null;
}

export interface BlockchainAnchorResponse {
  record_id: string;
  record_chain_id: string;
  record_hash: string;
  patient_commitment: string;
  blockchain_network: string;
  contract_address: string;
  transaction_hash: string;
  anchored_at: string;
  status: string;
}

export interface BlockchainVerifyResponse {
  record_id: string;
  is_valid: boolean;
  on_chain_hash?: string | null;
  expected_hash: string;
  transaction_hash?: string | null;
  blockchain_network: string;
  status: string;
  details: string;
}

export interface CreateRecordPayload {
  record_type: string;
  fhir_resource_type: string;
  fhir_data: Record<string, unknown>;
  patient_id?: string;
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
  blockchain_network?: string | null;
  blockchain_contract_address?: string | null;
  blockchain_tx_hash?: string | null;
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
  requester_doctor_name?: string | null;
  requester_doctor_license?: string | null;
  requester_doctor_wallet?: string | null;
  requester_doctor_specialization?: string | null;
  requester_hospital_name?: string | null;
  record_type?: string | null;
  record_title?: string | null;
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

// ─── Search Models ──────────────────────────────────────────────────

export interface PatientSearchResult {
  id: string;
  display_name: string;
}

export interface DoctorSearchResult {
  id: string;
  user_id: string;
  display_name: string;
  specialization?: string | null;
  license_number: string;
  hospital_name?: string | null;
  wallet_address?: string | null;
}

export interface PatientRecordSummary {
  id: string;
  record_type: string;
  fhir_resource_type?: string | null;
  original_document_filename?: string | null;
  created_at: string;
}

// ─── Phase 5: Zero-Knowledge Privacy (Noir) ─────────────────────────

export interface ZKGenerateProofResponse {
  proof: string;
  record_commitment: string;
  authorization_commitment: string;
  requester_nullifier: string;
  circuit_name: string;
  generated_at: string;
  status: string;
}

export interface ZKVerifyResponse {
  valid: boolean;
  circuit_name: string;
  nullifier: string;
  verified_at: string;
  details: string;
}

export interface ZKStatusResponse {
  enabled: boolean;
  prover_mode: string;
  circuit_name: string;
  circuit_path: string;
  supported_curve: string;
}

// ─── Phase 6: Emergency Break-Glass Access ─────────────────────────

export interface EmergencyAccessPayload {
  patient_id: string;
  record_id: string;
  reason: string;
}

export interface EmergencyAccessResponse {
  consent_id: string;
  record_id: string;
  patient_id: string;
  grantee_doctor_id: string;
  permission: string;
  status: string;
  expires_at: string;
  blockchain_tx_hash?: string | null;
  audit_event_logged: boolean;
  message: string;
}
