import { apiClient } from "@/lib/api-client";
import type {
  CreateRecordPayload,
  IntegrityVerifyResponse,
  MedicalRecord,
  MedicalRecordDetailResponse,
} from "@/types";

export type { CreateRecordPayload };

/**
 * Fetch all authorized medical records metadata.
 */
export async function listRecords(): Promise<MedicalRecord[]> {
  return apiClient.get<MedicalRecord[]>("/api/records");
}

/**
 * Fetch medical record metadata only (non-decrypted).
 */
export async function getRecord(recordId: string): Promise<MedicalRecord> {
  return apiClient.get<MedicalRecord>(`/api/records/${recordId}`);
}

/**
 * Retrieve and decrypt the FHIR medical record with cryptographic integrity verification.
 */
export async function getDecryptedRecord(
  recordId: string
): Promise<MedicalRecordDetailResponse> {
  return apiClient.get<MedicalRecordDetailResponse>(
    `/api/records/${recordId}/decrypted`
  );
}

/**
 * On-demand cryptographic integrity verification of an off-chain storage blob.
 */
export async function verifyRecordIntegrity(
  recordId: string
): Promise<IntegrityVerifyResponse> {
  return apiClient.get<IntegrityVerifyResponse>(
    `/api/records/${recordId}/verify`
  );
}

/**
 * Create a new medical record through the Phase 3 privacy pipeline.
 * FHIR normalization -> SHA-256 integrity hash -> AES-256-GCM encryption -> off-chain storage.
 */
export async function createRecord(
  payload: CreateRecordPayload
): Promise<MedicalRecord> {
  return apiClient.post<MedicalRecord>("/api/records", payload);
}

/**
 * Delete a medical record and its off-chain encrypted storage blob.
 */
export async function deleteRecord(recordId: string): Promise<void> {
  return apiClient.delete<void>(`/api/records/${recordId}`);
}
