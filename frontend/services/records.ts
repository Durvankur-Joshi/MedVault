import { apiClient, getToken } from "@/lib/api-client";
import type {
  BlockchainAnchorResponse,
  BlockchainVerifyResponse,
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
 * Upload an original medical document (PDF, JPG, PNG).
 * File is AES-256-GCM encrypted and anchored on-chain.
 */
export async function uploadDocument(
  formData: FormData
): Promise<MedicalRecord> {
  const token = getToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const response = await fetch(`${baseUrl}/api/records/upload-document`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to upload medical document");
  }

  return response.json();
}

/**
 * Anchor a medical record's SHA-256 integrity commitment to the EVM blockchain.
 */
export async function anchorRecordToBlockchain(
  recordId: string
): Promise<BlockchainAnchorResponse> {
  return apiClient.post<BlockchainAnchorResponse>(
    `/api/records/${recordId}/anchor`
  );
}

/**
 * Verify record integrity directly against the on-chain smart contract anchor.
 */
export async function verifyRecordOnBlockchain(
  recordId: string
): Promise<BlockchainVerifyResponse> {
  return apiClient.get<BlockchainVerifyResponse>(
    `/api/records/${recordId}/blockchain-verify`
  );
}

/**
 * Fetch authenticated decrypted document binary blob for in-app viewing.
 */
export async function fetchDocumentBlob(
  recordId: string
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const token = getToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const response = await fetch(`${baseUrl}/api/records/${recordId}/document`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to retrieve decrypted document");
  }

  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const disposition = response.headers.get("content-disposition") || "";
  let filename = "medical-document";
  const match = disposition.match(/filename="?([^";]+)"?/);
  if (match) {
    filename = match[1];
  }
  const blob = await response.blob();
  return { blob, mimeType, filename };
}

/**
 * Get direct stream URL for decrypted medical document.
 */
export function getDocumentUrl(recordId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return `${baseUrl}/api/records/${recordId}/document`;
}

/**
 * Delete a medical record and its off-chain encrypted storage blob.
 */
export async function deleteRecord(recordId: string): Promise<void> {
  return apiClient.delete<void>(`/api/records/${recordId}`);
}
