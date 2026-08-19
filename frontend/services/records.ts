import { apiClient } from "@/lib/api-client";
import type { MedicalRecord } from "@/types";

export interface CreateRecordPayload {
  record_type: string;
  fhir_resource_type?: string | null;
}

export async function listRecords(): Promise<MedicalRecord[]> {
  return apiClient.get<MedicalRecord[]>("/api/records");
}

export async function getRecord(recordId: string): Promise<MedicalRecord> {
  return apiClient.get<MedicalRecord>(`/api/records/${recordId}`);
}

export async function createRecord(payload: CreateRecordPayload): Promise<MedicalRecord> {
  return apiClient.post<MedicalRecord>("/api/records", payload);
}

export async function deleteRecord(recordId: string): Promise<void> {
  return apiClient.delete<void>(`/api/records/${recordId}`);
}
