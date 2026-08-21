import { apiClient } from "@/lib/api-client";
import type {
  ZKGenerateProofResponse,
  ZKStatusResponse,
  ZKVerifyResponse,
} from "@/types";

/**
 * Get ZK proof subsystem configuration and status.
 */
export async function getZKStatus(): Promise<ZKStatusResponse> {
  return apiClient.get<ZKStatusResponse>("/api/zk/status");
}

/**
 * Generate a Zero-Knowledge authorization proof for a medical record.
 * Doctor / Hospital Admin only.
 */
export async function generateZKProof(
  recordId: string,
  consentId?: string
): Promise<ZKGenerateProofResponse> {
  return apiClient.post<ZKGenerateProofResponse>("/api/zk/generate-proof", {
    record_id: recordId,
    consent_id: consentId || null,
  });
}

/**
 * Verify a Zero-Knowledge authorization proof against public commitments.
 */
export async function verifyZKProof(
  proof: string,
  recordCommitment: string,
  authorizationCommitment: string,
  requesterNullifier: string
): Promise<ZKVerifyResponse> {
  return apiClient.post<ZKVerifyResponse>("/api/zk/verify", {
    proof,
    record_commitment: recordCommitment,
    authorization_commitment: authorizationCommitment,
    requester_nullifier: requesterNullifier,
  });
}
