import { apiClient } from "@/lib/api-client";
import type { HealthResponse } from "@/types";

/**
 * Check the backend health status.
 */
export async function getHealth(): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>("/api/health");
}
