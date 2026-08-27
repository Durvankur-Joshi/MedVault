import { apiClient } from "@/lib/api-client";
import type { Consent, ConsentPermission } from "@/types";

export interface GrantConsentPayload {
  record_id: string;
  permission: ConsentPermission;
  grantee_doctor_id?: string | null;
  grantee_hospital_id?: string | null;
  expires_at?: string | null;
  blockchain_tx_hash?: string | null;
  blockchain_network?: string | null;
  blockchain_contract_address?: string | null;
  blockchain_consent_id?: string | null;
}

/**
 * Fetch all consents concerning the authenticated user (patient or doctor).
 */
export async function listConsents(): Promise<Consent[]> {
  return apiClient.get<Consent[]>("/api/consent");
}

/**
 * Grant a new access consent with automatic EVM smart contract synchronization.
 */
export async function grantConsent(
  payload: GrantConsentPayload
): Promise<Consent> {
  return apiClient.post<Consent>("/api/consent", payload);
}

/**
 * Revoke an existing consent grant on-chain and off-chain.
 */
export async function revokeConsent(
  consentId: string,
  blockchain_tx_hash?: string | null
): Promise<Consent> {
  return apiClient.patch<Consent>(
    `/api/consent/${consentId}/revoke`,
    blockchain_tx_hash ? { blockchain_tx_hash } : undefined
  );
}

/**
 * Get a specific consent entry by ID.
 */
export async function getConsent(consentId: string): Promise<Consent> {
  return apiClient.get<Consent>(`/api/consent/${consentId}`);
}
