"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, ApiError } from "@/lib/api-client";
import type { MedicalRecord } from "@/types";
import { FileText, Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

const RECORD_TYPES = [
  { value: "lab_result", label: "Lab Result" },
  { value: "prescription", label: "Prescription" },
  { value: "imaging", label: "Imaging Study" },
  { value: "consultation_note", label: "Consultation Note" },
  { value: "immunization", label: "Immunization Record" },
];

const FHIR_TYPES = [
  { value: "Observation", label: "Observation" },
  { value: "MedicationRequest", label: "MedicationRequest" },
  { value: "DiagnosticReport", label: "DiagnosticReport" },
  { value: "Immunization", label: "Immunization" },
  { value: "DocumentReference", label: "DocumentReference" },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default function RecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [recordType, setRecordType] = useState("lab_result");
  const [fhirType, setFhirType] = useState("Observation");
  const [submitting, setSubmitting] = useState(false);

  const loadRecords = async () => {
    try {
      const data = await apiClient.get<MedicalRecord[]>("/api/records");
      setRecords(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load medical records.");
      } else {
        setError("Unable to connect to backend service.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<MedicalRecord[]>("/api/records")
      .then((data) => {
        if (isMounted) {
          setRecords(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.detail || "Failed to load medical records.");
          } else {
            setError("Unable to connect to backend service.");
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setActionSuccess(null);

    try {
      await apiClient.post<MedicalRecord>("/api/records", {
        record_type: recordType,
        fhir_resource_type: fhirType,
      });
      setShowModal(false);
      setActionSuccess("Medical record metadata registered successfully.");
      await loadRecords();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to create record.");
      } else {
        setError("Error communicating with backend.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm("Are you sure you want to delete this record metadata?")) return;
    setError(null);
    setActionSuccess(null);

    try {
      await apiClient.delete(`/api/records/${recordId}`);
      setActionSuccess("Record deleted successfully.");
      await loadRecords();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to delete record.");
      } else {
        setError("Error communicating with backend.");
      }
    }
  };

  const isPatient = user?.role === "patient";

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Medical Records</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {isPatient
                ? "View and manage your registered medical record metadata"
                : "View patient records shared with you via active consent"}
            </p>
          </div>
          {isPatient && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Record</span>
            </button>
          )}
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-sm text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-sm text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mb-3" />
            <p className="text-sm text-[var(--muted)]">Loading medical records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="glass-card empty-state animate-slide-up">
            <FileText className="w-12 h-12" />
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No Records Found
            </h2>
            <p className="text-sm text-[var(--muted)] max-w-md">
              {isPatient
                ? "You haven't created any medical record metadata yet. Click 'Create Record' above to add one."
                : "No patient records have been consented to your account yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="glass-card p-5 hover:border-[var(--accent)]/20 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wide">
                      {rec.record_type || rec.recordType}
                    </span>
                    {isPatient && (
                      <button
                        onClick={() => handleDeleteRecord(rec.id)}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs text-[var(--muted)]">
                    <p>
                      <strong className="text-[var(--foreground)]">Record ID:</strong>{" "}
                      <span className="font-mono">{rec.id}</span>
                    </p>
                    {(rec.fhir_resource_type || rec.fhirResourceType) && (
                      <p>
                        <strong className="text-[var(--foreground)]">FHIR Type:</strong>{" "}
                        {rec.fhir_resource_type || rec.fhirResourceType}
                      </p>
                    )}
                    <p>
                      <strong className="text-[var(--foreground)]">Patient ID:</strong>{" "}
                      <span className="font-mono">{rec.patient_id || rec.patientId}</span>
                    </p>
                    <p>
                      <strong className="text-[var(--foreground)]">Registered:</strong>{" "}
                      {formatDate(rec.created_at || rec.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-md animate-in fade-in zoom-in-95">
              <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
                Register Record Metadata
              </h2>
              <p className="text-xs text-[var(--muted)] mb-4">
                Phase 2 stores safe metadata/reference fields only (no plaintext medical data).
              </p>

              <form onSubmit={handleCreateRecord} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Record Type
                  </label>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {RECORD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    FHIR Resource Type
                  </label>
                  <select
                    value={fhirType}
                    onChange={(e) => setFhirType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {FHIR_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Metadata</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
