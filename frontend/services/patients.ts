import { apiClient } from "@/lib/api-client";
import type { PatientSearchResult, PatientRecordSummary } from "@/types";

export async function searchPatients(
  query: string,
  limit: number = 20
): Promise<PatientSearchResult[]> {
  const q = encodeURIComponent(query.trim());
  return apiClient.get<PatientSearchResult[]>(
    `/api/patients/search?q=${q}&limit=${limit}`
  );
}

export async function getPatientRecords(
  patientId: string
): Promise<PatientRecordSummary[]> {
  return apiClient.get<PatientRecordSummary[]>(
    `/api/patients/${patientId}/records`
  );
}
