"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, ApiError } from "@/lib/api-client";
import type { Consent, MedicalRecord } from "@/types";
import { ShieldCheck, Plus, XCircle, Loader2, AlertCircle, CheckCircle2, Blocks, Clock, Key } from "lucide-react";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function ConsentPage() {
  const { user } = useAuth();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Grant Consent Modal State
  const [showModal, setShowModal] = useState(false);
  const [recordId, setRecordId] = useState("");
  const [granteeType, setGranteeType] = useState<"doctor" | "hospital">("doctor");
  const [granteeId, setGranteeId] = useState("");
  const [permission, setPermission] = useState<"read" | "write" | "full">("read");
  const [expiryDuration, setExpiryDuration] = useState<"24h" | "7d" | "30d" | "never">("30d");
  const [submitting, setSubmitting] = useState(false);

  const loadConsents = async () => {
    try {
      const data = await apiClient.get<Consent[]>("/api/consent");
      setConsents(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load consents.");
      } else {
        setError("Unable to connect to backend service.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async () => {
    try {
      const data = await apiClient.get<MedicalRecord[]>("/api/records");
      setRecords(data);
      if (data.length > 0) {
        setRecordId(data[0].id);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<Consent[]>("/api/consent")
      .then((data) => {
        if (isMounted) {
          setConsents(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.detail || "Failed to load consents.");
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

  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setActionSuccess(null);

    if (!recordId) {
      setError("Please select a medical record.");
      setSubmitting(false);
      return;
    }

    if (!granteeId.trim()) {
      setError(`Please enter the ${granteeType} ID.`);
      setSubmitting(false);
      return;
    }

    let expiresAt: string | null = null;
    const now = new Date();
    if (expiryDuration === "24h") {
      expiresAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    } else if (expiryDuration === "7d") {
      expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    } else if (expiryDuration === "30d") {
      expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
    }

    try {
      const res = await apiClient.post<Consent>("/api/consent", {
        record_id: recordId,
        permission: permission,
        grantee_doctor_id: granteeType === "doctor" ? granteeId.trim() : null,
        grantee_hospital_id: granteeType === "hospital" ? granteeId.trim() : null,
        expires_at: expiresAt,
      });
      setShowModal(false);
      setGranteeId("");
      setActionSuccess(
        `Consent granted and anchored to smart contract! Tx: ${res.blockchain_tx_hash ? res.blockchain_tx_hash.slice(0, 14) + "..." : "Simulated"}`
      );
      await loadConsents();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to grant consent.");
      } else {
        setError("Error communicating with backend.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeConsent = async (consentId: string) => {
    if (!confirm("Are you sure you want to revoke this consent permission on-chain?")) return;
    setError(null);
    setActionSuccess(null);

    try {
      await apiClient.patch(`/api/consent/${consentId}/revoke`);
      setActionSuccess("Consent permission revoked both in ledger and on-chain smart contract.");
      await loadConsents();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to revoke consent.");
      } else {
        setError("Error communicating with backend.");
      }
    }
  };

  const isPatient = user?.role === "patient";

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Consent Management</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Phase 4 Smart Contract Guard
              </span>
            </div>
            <p className="text-sm text-[var(--muted)] mt-1">
              Time-bound, revocable, and granular on-chain permissions for medical records
            </p>
          </div>
          {isPatient && (
            <button
              onClick={() => {
                loadRecords();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Grant Time-Bound Consent</span>
            </button>
          )}
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-sm text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-sm text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mb-3" />
            <p className="text-sm text-[var(--muted)]">Loading on-chain consent registry...</p>
          </div>
        ) : consents.length === 0 ? (
          <div className="glass-card empty-state p-12 text-center flex flex-col items-center justify-center animate-slide-up">
            <ShieldCheck className="w-12 h-12 text-[var(--muted)] mb-3" />
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No Consent Grants Found
            </h2>
            <p className="text-sm text-[var(--muted)] max-w-md">
              {isPatient
                ? "You haven't granted consent to any doctors or hospitals yet. Click 'Grant Time-Bound Consent' to share records safely."
                : "No active consents currently found."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
            {consents.map((consent) => {
              const status = consent.status;
              const isExpired = consent.expires_at && new Date(consent.expires_at) < new Date();
              const displayStatus = isExpired ? "expired" : status;

              return (
                <div
                  key={consent.id}
                  className="glass-card p-5 hover:border-cyan-500/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide border ${
                            displayStatus === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : displayStatus === "revoked"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {displayStatus}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                          <Blocks className="w-3 h-3" /> Smart Contract
                        </span>
                      </div>

                      {isPatient && displayStatus === "active" && (
                        <button
                          onClick={() => handleRevokeConsent(consent.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                          title="Revoke Permission"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Revoke On-Chain</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 text-xs text-[var(--muted)]">
                      <div className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--foreground)] font-semibold flex items-center gap-1">
                            <Key className="w-3 h-3 text-cyan-400" /> Permission Scope
                          </span>
                          <span className="capitalize font-semibold text-cyan-300">
                            {consent.permission}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--muted)] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" /> Expiration
                          </span>
                          <span className="text-amber-300 font-mono">
                            {consent.expires_at ? formatDate(consent.expires_at) : "No Expiration (30 Days Default)"}
                          </span>
                        </div>
                      </div>

                      {consent.blockchain_tx_hash && (
                        <div className="p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/20 font-mono text-[11px]">
                          <span className="text-cyan-400 font-sans font-semibold text-[10px]">On-Chain Tx: </span>
                          <span className="text-slate-300 break-all">{consent.blockchain_tx_hash}</span>
                        </div>
                      )}

                      <p>
                        <strong className="text-[var(--foreground)]">Record ID:</strong>{" "}
                        <span className="font-mono">{consent.record_id || consent.recordId}</span>
                      </p>
                      {(consent.grantee_doctor_id || consent.granteeDoctorId) && (
                        <p>
                          <strong className="text-[var(--foreground)]">Grantee Doctor:</strong>{" "}
                          <span className="font-mono">
                            {consent.grantee_doctor_id || consent.granteeDoctorId}
                          </span>
                        </p>
                      )}
                      {(consent.grantee_hospital_id || consent.granteeHospitalId) && (
                        <p>
                          <strong className="text-[var(--foreground)]">Grantee Hospital:</strong>{" "}
                          <span className="font-mono">
                            {consent.grantee_hospital_id || consent.granteeHospitalId}
                          </span>
                        </p>
                      )}
                      <p>
                        <strong className="text-[var(--foreground)]">Granted On:</strong>{" "}
                        {formatDate(consent.created_at || consent.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grant Consent Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-md animate-in fade-in zoom-in-95">
              <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
                Grant Time-Bound Consent
              </h2>
              <p className="text-xs text-[var(--muted)] mb-4">
                Anchors an authorization grant on the EVM ConsentManager contract.
              </p>

              <form onSubmit={handleGrantConsent} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Target Medical Record
                  </label>
                  {records.length === 0 ? (
                    <p className="text-xs text-amber-400">
                      No records found. Please create a record first.
                    </p>
                  ) : (
                    <select
                      value={recordId}
                      onChange={(e) => setRecordId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      {records.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.record_type || r.recordType} ({r.id.slice(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Grantee Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGranteeType("doctor")}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        granteeType === "doctor"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                          : "border-[var(--border)] text-[var(--muted)]"
                      }`}
                    >
                      Doctor
                    </button>
                    <button
                      type="button"
                      onClick={() => setGranteeType("hospital")}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        granteeType === "hospital"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                          : "border-[var(--border)] text-[var(--muted)]"
                      }`}
                    >
                      Hospital
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    {granteeType === "doctor" ? "Doctor ID / User ID / Wallet" : "Hospital ID"}
                  </label>
                  <input
                    type="text"
                    value={granteeId}
                    onChange={(e) => setGranteeId(e.target.value)}
                    placeholder="Enter UUID or address..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Permission Scope
                  </label>
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value as "read" | "write" | "full")}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="read">Read Only (Decrypted Observation / Doc)</option>
                    <option value="write">Write / Append Notes</option>
                    <option value="full">Full Access (Read + Export + Download)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Time-Bound Validity
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: "24h", label: "24h" },
                      { key: "7d", label: "7 Days" },
                      { key: "30d", label: "30 Days" },
                      { key: "never", label: "Max" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setExpiryDuration(item.key as any)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                          expiryDuration === item.key
                            ? "border-amber-500 bg-amber-500/10 text-amber-300"
                            : "border-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
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
                    disabled={submitting || records.length === 0}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing & Anchoring...</span>
                      </>
                    ) : (
                      <span>Grant On-Chain</span>
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
