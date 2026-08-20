"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, ApiError } from "@/lib/api-client";
import { searchPatients, getPatientRecords } from "@/services/patients";
import type { AccessRequest, PatientSearchResult, PatientRecordSummary } from "@/types";
import {
  Inbox,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  User as UserIcon,
  FileText,
  X,
} from "lucide-react";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** Human-readable label for a record */
function recordLabel(rec: PatientRecordSummary): string {
  if (rec.original_document_filename) {
    return rec.original_document_filename;
  }
  if (rec.fhir_resource_type) {
    // e.g. "MedicationRequest" → "Medication Request"
    return rec.fhir_resource_type.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  // Fallback: capitalize record_type
  return rec.record_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AccessRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // ── Modal visibility ──────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);

  // ── Patient Search state ──────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Record Selection state ────────────────────────────────────
  const [patientRecords, setPatientRecords] = useState<PatientRecordSummary[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");

  // ── Reason + Submit ───────────────────────────────────────────
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // ── Load existing access requests ─────────────────────────────
  const loadRequests = useCallback(async () => {
    try {
      const data = await apiClient.get<AccessRequest[]>("/api/access-requests");
      setRequests(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load access requests.");
      } else {
        setError("Unable to connect to backend service.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // ── Debounced Patient Search ──────────────────────────────────
  useEffect(() => {
    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = searchQuery.trim();

    // Don't search if query is too short or patient already selected
    if (trimmed.length < 2 || selectedPatient) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPatients(trimmed);
        setSearchResults(results);
        setSearchError(null);
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setSearchError("Your session has expired. Please log in again.");
          } else if (err.status === 403) {
            setSearchError("You do not have permission to search patients.");
          } else {
            setSearchError(err.detail || "Unable to search patients.");
          }
        } else {
          setSearchError("Unable to search patients. Please try again.");
        }
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, selectedPatient]);

  // ── Load Records when Patient is Selected ─────────────────────
  useEffect(() => {
    if (!selectedPatient) {
      setPatientRecords([]);
      setSelectedRecordId("");
      setRecordsError(null);
      return;
    }

    let cancelled = false;
    setLoadingRecords(true);
    setRecordsError(null);
    setSelectedRecordId("");
    setPatientRecords([]);

    getPatientRecords(selectedPatient.id)
      .then((records) => {
        if (!cancelled) {
          setPatientRecords(records);
          setLoadingRecords(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof ApiError) {
            if (err.status === 404) {
              setRecordsError("Patient not found.");
            } else {
              setRecordsError(err.detail || "Unable to load medical records.");
            }
          } else {
            setRecordsError("Unable to load medical records for this patient.");
          }
          setLoadingRecords(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPatient]);

  // ── Select a patient from search results ──────────────────────
  const handleSelectPatient = (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

  // ── Change patient (reset selection) ──────────────────────────
  const handleChangePatient = () => {
    setSelectedPatient(null);
    setSearchQuery("");
    setSearchResults([]);
    setPatientRecords([]);
    setSelectedRecordId("");
    setRecordsError(null);
    setModalError(null);
  };

  // ── Reset entire modal state ──────────────────────────────────
  const resetModal = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSelectedPatient(null);
    setPatientRecords([]);
    setSelectedRecordId("");
    setRecordsError(null);
    setReason("");
    setModalError(null);
    setSubmitting(false);
  };

  const openModal = () => {
    resetModal();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetModal();
  };

  // ── Submit Access Request ─────────────────────────────────────
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedPatient) {
      setModalError("Please select a patient.");
      return;
    }
    if (!selectedRecordId) {
      setModalError("Please select a medical record.");
      return;
    }
    if (!reason.trim()) {
      setModalError("Please provide a reason for access.");
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post<AccessRequest>("/api/access-requests", {
        patient_id: selectedPatient.id,
        record_id: selectedRecordId,
        reason: reason.trim(),
      });
      closeModal();
      setActionSuccess("Access request sent successfully.");
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setModalError("Your session has expired. Please log in again.");
        } else if (err.status === 403) {
          setModalError("You do not have permission to request access.");
        } else if (err.status === 404) {
          setModalError(err.detail || "Patient or record not found.");
        } else {
          setModalError(err.detail || "Failed to create access request.");
        }
      } else {
        setModalError("Error communicating with backend.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Approve / Deny (Patient side — unchanged) ─────────────────
  const handleApprove = async (requestId: string) => {
    setError(null);
    setActionSuccess(null);
    try {
      await apiClient.patch(`/api/access-requests/${requestId}/approve`);
      setActionSuccess("Access request approved and consent granted.");
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to approve request.");
      } else {
        setError("Error communicating with backend.");
      }
    }
  };

  const handleDeny = async (requestId: string) => {
    setError(null);
    setActionSuccess(null);
    try {
      await apiClient.patch(`/api/access-requests/${requestId}/deny`);
      setActionSuccess("Access request denied.");
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to deny request.");
      } else {
        setError("Error communicating with backend.");
      }
    }
  };

  const isPatient = user?.role === "patient";
  const canSubmit = !!selectedPatient && !!selectedRecordId && reason.trim().length > 0 && !submitting;

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Access Requests</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {isPatient
                ? "Review and respond to doctor/hospital requests for your medical records"
                : "Manage and submit record access requests to patients"}
            </p>
          </div>
          {!isPatient && (
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Request</span>
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
            <p className="text-sm text-[var(--muted)]">Loading access requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="glass-card empty-state animate-slide-up">
            <Inbox className="w-12 h-12" />
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No Access Requests
            </h2>
            <p className="text-sm text-[var(--muted)] max-w-md">
              {isPatient
                ? "When doctors or hospitals request access to your records, they will appear here for your approval."
                : "You have not submitted any access requests yet. Click 'New Request' to submit one."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
            {requests.map((req) => {
              const status = req.status;
              return (
                <div
                  key={req.id}
                  className="glass-card p-5 hover:border-[var(--accent)]/20 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide border ${
                          status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : status === "denied"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {status}
                      </span>
                      {isPatient && status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(req.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleDeny(req.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Deny</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs text-[var(--muted)]">
                      {req.reason && (
                        <p>
                          <strong className="text-[var(--foreground)]">Reason:</strong>{" "}
                          {req.reason}
                        </p>
                      )}
                      <p>
                        <strong className="text-[var(--foreground)]">Requested:</strong>{" "}
                        {formatDate(req.created_at || req.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            NEW REQUEST MODAL — Patient Search → Record Select → Reason
            ═══════════════════════════════════════════════════════ */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-lg animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--foreground)]">
                    Request Medical Record Access
                  </h2>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Search for a patient, select their record, and provide a reason.
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Error */}
              {modalError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitRequest} className="space-y-5">

                {/* ── STEP 1: Patient Search ─────────────────── */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Search Patient
                  </label>

                  {!selectedPatient ? (
                    <>
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by patient name..."
                          autoFocus
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                        {searching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)] animate-spin" />
                        )}
                      </div>

                      {/* Search Error */}
                      {searchError && (
                        <p className="mt-2 text-xs text-red-400">{searchError}</p>
                      )}

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="mt-2 border border-[var(--border)] rounded-xl overflow-hidden">
                          {searchResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectPatient(p)}
                              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--hover)] transition-colors border-b border-[var(--border)] last:border-b-0"
                            >
                              <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                                <UserIcon className="w-4 h-4 text-[var(--accent)]" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[var(--foreground)]">
                                  {p.display_name}
                                </p>
                                <p className="text-xs text-[var(--muted)]">Patient</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* No Results */}
                      {!searching &&
                        searchQuery.trim().length >= 2 &&
                        searchResults.length === 0 &&
                        !searchError && (
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            No patients found matching &ldquo;{searchQuery.trim()}&rdquo;
                          </p>
                        )}
                    </>
                  ) : (
                    /* Selected Patient Card */
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {selectedPatient.display_name}
                          </p>
                          <p className="text-xs text-emerald-400">Selected Patient</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleChangePatient}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] border border-[var(--border)] transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* ── STEP 2: Medical Record Selection ────────── */}
                {selectedPatient && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                      Medical Record
                    </label>

                    {loadingRecords ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                        <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                        <span className="text-sm text-[var(--muted)]">Loading medical records...</span>
                      </div>
                    ) : recordsError ? (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {recordsError}
                      </div>
                    ) : patientRecords.length === 0 ? (
                      <div className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--muted)]">
                        No medical records available for this patient.
                      </div>
                    ) : (
                      <>
                        <select
                          value={selectedRecordId}
                          onChange={(e) => setSelectedRecordId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none cursor-pointer"
                        >
                          <option value="">Select a medical record...</option>
                          {patientRecords.map((rec) => (
                            <option key={rec.id} value={rec.id}>
                              {recordLabel(rec)} — {formatDate(rec.created_at)}
                            </option>
                          ))}
                        </select>

                        {/* Selected record detail card */}
                        {selectedRecordId && (() => {
                          const rec = patientRecords.find((r) => r.id === selectedRecordId);
                          if (!rec) return null;
                          return (
                            <div className="mt-2 p-3 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 flex items-start gap-3">
                              <FileText className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
                              <div className="text-xs space-y-0.5">
                                <p className="text-sm font-medium text-[var(--foreground)]">
                                  {recordLabel(rec)}
                                </p>
                                {rec.fhir_resource_type && (
                                  <p className="text-[var(--muted)]">
                                    Type: {rec.fhir_resource_type}
                                  </p>
                                )}
                                <p className="text-[var(--muted)]">
                                  Created: {formatDate(rec.created_at)}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* ── STEP 3: Reason ─────────────────────────── */}
                {selectedPatient && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                      Reason for Access
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why do you need access to this record?"
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] resize-none transition-colors"
                    />
                  </div>
                )}

                {/* ── Actions ────────────────────────────────── */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Send Access Request</span>
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
