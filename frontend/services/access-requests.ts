import { apiClient } from "@/lib/api-client";
import type { AccessRequest } from "@/types";

export interface CreateAccessRequestPayload {
  patient_id: string;
  record_id?: string | null;
  reason?: string | null;
}

export interface ApproveAccessRequestPayload {
  permission?: string;
  expires_at?: string | null;
}

/**
 * Fetch all access requests concerning the current user (patient requests or doctor outgoing requests).
 */
export async function listAccessRequests(): Promise<AccessRequest[]> {
  return apiClient.get<AccessRequest[]>("/api/access-requests");
}

/**
 * Create a new record or profile access request (Doctor or Hospital Admin only).
 */
export async function createAccessRequest(
  payload: CreateAccessRequestPayload
): Promise<AccessRequest> {
  return apiClient.post<AccessRequest>("/api/access-requests", payload);
}

/**
 * Get a specific access request by ID with authorization check.
 */
export async function getAccessRequest(
  requestId: string
): Promise<AccessRequest> {
  return apiClient.get<AccessRequest>(`/api/access-requests/${requestId}`);
}

/**
 * Approve an access request (Patient only). Generates an on-chain/off-chain Consent record.
 */
export async function approveAccessRequest(
  requestId: string,
  payload?: ApproveAccessRequestPayload
): Promise<AccessRequest> {
  return apiClient.patch<AccessRequest>(
    `/api/access-requests/${requestId}/approve`,
    payload || {}
  );
}

/**
 * Deny an access request (Patient only).
 */
export async function denyAccessRequest(
  requestId: string
): Promise<AccessRequest> {
  return apiClient.patch<AccessRequest>(
    `/api/access-requests/${requestId}/deny`
  );
}
