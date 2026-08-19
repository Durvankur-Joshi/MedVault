"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AccessRequest } from "@/types";
import { Inbox, Plus, CheckCircle, XCircle, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default function AccessRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Doctor / Admin Create Request Modal
  const [showModal, setShowModal] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [recordId, setRecordId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
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
  };

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<AccessRequest[]>("/api/access-requests")
      .then((data) => {
        if (isMounted) {
          setRequests(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.detail || "Failed to load access requests.");
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

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setActionSuccess(null);

    if (!patientId.trim()) {
      setError("Please enter the Patient ID.");
      setSubmitting(false);
      return;
    }

    try {
      await apiClient.post<AccessRequest>("/api/access-requests", {
        patient_id: patientId.trim(),
        record_id: recordId.trim() || null,
        reason: reason.trim() || null,
      });
      setShowModal(false);
      setPatientId("");
      setRecordId("");
      setReason("");
      setActionSuccess("Access request created successfully.");
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to create access request.");
      } else {
        setError("Error communicating with backend.");
      }
    } finally {
      setSubmitting(false);
    }
  };

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
              onClick={() => setShowModal(true)}
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
                      <p>
                        <strong className="text-[var(--foreground)]">Request ID:</strong>{" "}
                        <span className="font-mono">{req.id}</span>
                      </p>
                      <p>
                        <strong className="text-[var(--foreground)]">Patient ID:</strong>{" "}
                        <span className="font-mono">{req.patient_id || req.patientId}</span>
                      </p>
                      {(req.record_id || req.recordId) && (
                        <p>
                          <strong className="text-[var(--foreground)]">Record ID:</strong>{" "}
                          <span className="font-mono">{req.record_id || req.recordId}</span>
                        </p>
                      )}
                      {(req.requester_doctor_id || req.requesterDoctorId) && (
                        <p>
                          <strong className="text-[var(--foreground)]">Doctor ID:</strong>{" "}
                          <span className="font-mono">
                            {req.requester_doctor_id || req.requesterDoctorId}
                          </span>
                        </p>
                      )}
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

        {/* Create Request Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-md animate-in fade-in zoom-in-95">
              <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
                Submit Access Request
              </h2>
              <p className="text-xs text-[var(--muted)] mb-4">
                Request permission from a patient to view their medical history.
              </p>

              <form onSubmit={handleCreateRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Patient ID
                  </label>
                  <input
                    type="text"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    placeholder="Enter Patient UUID..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Specific Record ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={recordId}
                    onChange={(e) => setRecordId(e.target.value)}
                    placeholder="Leave blank for general history access..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Reason for Request
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Diagnostic review, second opinion, treatment planning..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] resize-none"
                  />
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
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Send Request</span>
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
