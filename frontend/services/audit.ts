import { apiClient } from "@/lib/api-client";
import type { AuditLog } from "@/types";

/**
 * Fetch audit events for the currently authenticated user.
 */
export async function listAuditEvents(): Promise<AuditLog[]> {
  return apiClient.get<AuditLog[]>("/api/audit");
}