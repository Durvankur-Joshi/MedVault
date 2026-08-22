import { apiClient } from "@/lib/api-client";
import type { EmergencyAccessPayload, EmergencyAccessResponse } from "@/types";

export type { EmergencyAccessPayload, EmergencyAccessResponse };

/**
 * Request emergency break-glass access to a patient's medical record.
 * Doctor / Hospital Admin only.
 */
export async function requestEmergencyAccess(
  payload: EmergencyAccessPayload
): Promise<EmergencyAccessResponse> {
  return apiClient.post<EmergencyAccessResponse>(
    "/api/emergency-access",
    payload
  );
}