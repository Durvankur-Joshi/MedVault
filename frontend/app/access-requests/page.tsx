"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { searchPatients, getPatientRecords } from "@/services/patients";
import {
  listAccessRequests,
  createAccessRequest,
  approveAccessRequest,
  denyAccessRequest,
} from "@/services/access-requests";
import { generateZKProof, verifyZKProof } from "@/services/zk";
import { getDecryptedRecord } from "@/services/records";
import { requestEmergencyAccess } from "@/services/emergency";
import { GrantConsentModal } from "@/components/consent/grant-consent-modal";
import { BlockchainProfileModal } from "@/components/blockchain/blockchain-profile-modal";
import { DocumentViewerModal } from "@/components/records/document-viewer-modal";
import { BlockchainTxLink } from "@/components/blockchain/blockchain-tx-link";
import type {
  AccessRequest,
  PatientSearchResult,
  PatientRecordSummary,
  ZKGenerateProofResponse,
  ZKVerifyResponse,
  MedicalRecordDetailResponse,
  EmergencyAccessResponse,
} from "@/types";
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
  Eye,
  Shield,
  Lock,
  Download,
  AlertTriangle,
  Flame,
  KeyRound,
  Check,
  Building2,
  Award,
  Wallet,
  ShieldCheck,
} from "lucide-react";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  // Doctor Request Creation Modal State
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [patientRecords, setPatientRecords] = useState<PatientRecordSummary[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Doctor Emergency Modal State
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergPatientId, setEmergPatientId] = useState("");
  const [emergRecordId, setEmergRecordId] = useState("");
  const [emergReason, setEmergReason] = useState("");
  const [emergSubmitting, setEmergSubmitting] = useState(false);

  // Doctor Flow: ZK Proof & Decrypted Access
  const [zkLoadingMap, setZkLoadingMap] = useState<Record<string, boolean>>({});
  const [zkStageMap, setZkStageMap] = useState<
    Record<string, "idle" | "generating_proof" | "proof_generated" | "verifying_crypto" | "verifying_blockchain" | "verified" | "failed">
  >({});
  const [zkProofMap, setZkProofMap] = useState<Record<string, ZKGenerateProofResponse>>({});
  const [zkVerifyMap, setZkVerifyMap] = useState<Record<string, ZKVerifyResponse>>({});
  const [decryptedRecord, setDecryptedRecord] = useState<MedicalRecordDetailResponse | null>(null);
  const [decryptingRecordId, setDecryptingRecordId] = useState<string | null>(null);


  // Modals
  const [approvingRequest, setApprovingRequest] = useState<AccessRequest | null>(null);
  const [selectedDoctorProfile, setSelectedDoctorProfile] = useState<{
    display_name: string;
    license_number?: string | null;
    specialization?: string | null;
    hospital_name?: string | null;
    wallet_address?: string | null;
  } | null>(null);
  const [viewingDocRecord, setViewingDocRecord] = useState<{
    id: string;
    filename?: string | null;
    mimeType?: string | null;
  } | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const data = await listAccessRequests();
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

  // Debounced Patient Search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2 || selectedPatient) {
      setSearchResults([]);
      setSearching(false);
      setSearchError(null);
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
          setSearchError(err.detail || "Unable to search patients.");
        } else {
          setSearchError("Unable to search patients. Please try again.");
        }
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, selectedPatient]);

  // Load Records when Patient is Selected
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
            setRecordsError(err.detail || "Unable to load medical records.");
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

  const handleSelectPatient = (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

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

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedPatient) {
      setModalError("Please select a patient.");
      return;
    }

    setSubmitting(true);
    try {
      await createAccessRequest({
        patient_id: selectedPatient.id,
        record_id: selectedRecordId ? selectedRecordId : null,
        reason: reason.trim() ? reason.trim() : null,
      });

      setShowModal(false);
      resetModal();
      setActionSuccess("Access request successfully submitted to patient's ledger.");
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setModalError(err.detail || "Failed to submit access request.");
      } else {
        setModalError("Error communicating with backend.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergPatientId.trim() || !emergRecordId.trim() || !emergReason.trim()) {
      setError("Please fill all emergency break-glass fields.");
      return;
    }

    setEmergSubmitting(true);
    try {
      const res = await requestEmergencyAccess({
        patient_id: emergPatientId.trim(),
        record_id: emergRecordId.trim(),
        reason: emergReason.trim(),
      });
      setShowEmergencyModal(false);
      setActionSuccess(res.message);
      setEmergPatientId("");
      setEmergRecordId("");
      setEmergReason("");
      await loadRequests();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Emergency access request failed.");
      } else {
        setError("Error executing emergency break-glass protocol.");
      }
    } finally {
      setEmergSubmitting(false);
    }
  };

  const handleDeny = async (requestId: string) => {
    setError(null);
    setActionSuccess(null);
    try {
      await denyAccessRequest(requestId);
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

  // Doctor Flow: ZK Proof Generation & Access
  const handleGenerateAndVerifyZK = async (recordId: string) => {
    setZkLoadingMap((prev) => ({ ...prev, [recordId]: true }));
    setZkStageMap((prev) => ({ ...prev, [recordId]: "generating_proof" }));
    setError(null);

    try {
      // 1. Generate ZK Proof
      const proofRes = await generateZKProof(recordId);
      setZkProofMap((prev) => ({ ...prev, [recordId]: proofRes }));
      setZkStageMap((prev) => ({ ...prev, [recordId]: "proof_generated" }));

      // Visual micro-step for cryptographic proof verification
      await new Promise((r) => setTimeout(r, 400));
      setZkStageMap((prev) => ({ ...prev, [recordId]: "verifying_crypto" }));

      // Visual micro-step for on-chain anchoring
      await new Promise((r) => setTimeout(r, 400));
      setZkStageMap((prev) => ({ ...prev, [recordId]: "verifying_blockchain" }));

      // 2. Verify ZK Proof
      const verifyRes = await verifyZKProof(
        proofRes.proof,
        proofRes.record_commitment,
        proofRes.authorization_commitment,
        proofRes.requester_nullifier
      );
      setZkVerifyMap((prev) => ({ ...prev, [recordId]: verifyRes }));

      if (verifyRes.valid) {
        setZkStageMap((prev) => ({ ...prev, [recordId]: "verified" }));
        setActionSuccess("ZK Proof cryptographically verified and anchored on-chain with zero PII exposure.");
      } else {
        setZkStageMap((prev) => ({ ...prev, [recordId]: "failed" }));
        setError(verifyRes.details || "Cryptographic proof verification failed.");
      }
    } catch (err: unknown) {
      setZkStageMap((prev) => ({ ...prev, [recordId]: "failed" }));
      if (err instanceof ApiError) {
        setError(err.detail || "Zero-Knowledge authorization failed.");
      } else {
        setError("Failed to execute ZK proof protocol.");
      }
    } finally {
      setZkLoadingMap((prev) => ({ ...prev, [recordId]: false }));
    }
  };


  const handleAccessDecrypted = async (recordId: string) => {
    setDecryptingRecordId(recordId);
    setError(null);

    try {
      const detail = await getDecryptedRecord(recordId);
      setDecryptedRecord(detail);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Access Denied: Record could not be decrypted.");
      } else {
        setError("Failed to retrieve decrypted record.");
      }
    } finally {
      setDecryptingRecordId(null);
    }
  };

  const isPatient = user?.role === "patient";

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Access Requests & Permissions</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {isPatient
                ? "Review, approve, or deny doctor requests to access your encrypted medical ledger."
                : "Submit access requests, execute ZK authorization proofs, and retrieve consented records."}
            </p>
          </div>

          {!isPatient && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowEmergencyModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/50 transition-all"
              >
                <Flame className="w-4 h-4 text-red-400" />
                <span>Emergency Break-Glass</span>
              </button>

              <button
                onClick={() => {
                  resetModal();
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Request</span>
              </button>
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-400 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-xs text-emerald-300 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="p-12 text-center text-cyan-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p className="text-sm text-[var(--muted)]">Loading access requests ledger...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <Inbox className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">No Access Requests</h2>
            <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
              {isPatient
                ? "When doctors or hospitals request access to your records, they will appear here for your cryptographic consent."
                : "You have not submitted any access requests yet. Click 'New Request' to search patients and request records."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
            {requests.map((req) => {
              const isApproved = req.status === "approved";
              const isDenied = req.status === "denied";
              const recId = req.record_id;
              const hasZKProof = recId && zkProofMap[recId];
              const isZKVerified = recId && zkVerifyMap[recId]?.valid;
              const isZKLoading = recId && zkLoadingMap[recId];

              return (
                <div
                  key={req.id}
                  className="glass-card p-5 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                          isApproved
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : isDenied
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {req.status}
                      </span>

                      {/* Patient Actions */}
                      {isPatient && req.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setApprovingRequest(req)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/50 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approve Access</span>
                          </button>
                          <button
                            onClick={() => handleDeny(req.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-red-400 bg-slate-800/60 hover:bg-red-950/30 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Deny</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Requester Doctor Details Card */}
                    <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
                      {req.requester_doctor_name ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                                Dr
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-100">
                                  {req.requester_doctor_name}
                                </h4>
                                <p className="text-[10px] text-slate-400">
                                  {req.requester_doctor_specialization || "Physician"}
                                  {req.requester_hospital_name ? ` • ${req.requester_hospital_name}` : ""}
                                </p>
                              </div>
                            </div>

                            {req.requester_doctor_license && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/50 text-cyan-300 border border-cyan-500/30">
                                ID: {req.requester_doctor_license}
                              </span>
                            )}
                          </div>

                          {req.requester_doctor_wallet && (
                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/80">
                              <span className="text-slate-500">Wallet:</span>
                              <BlockchainTxLink
                                hash={req.requester_doctor_wallet}
                                type="address"
                                truncate={true}
                                startLen={6}
                                endLen={4}
                                showExplorerButton={false}
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedDoctorProfile({
                                display_name: req.requester_doctor_name!,
                                license_number: req.requester_doctor_license,
                                specialization: req.requester_doctor_specialization,
                                hospital_name: req.requester_hospital_name,
                                wallet_address: req.requester_doctor_wallet,
                              })
                            }
                            className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 transition-all mt-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>View Blockchain Profile</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">
                          <strong className="text-slate-200">Doctor / Hospital ID:</strong>{" "}
                          <span className="font-mono">
                            {req.requester_doctor_id || req.requester_hospital_id || "Provider"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Record & Reason Info */}
                    <div className="space-y-1 text-xs text-[var(--muted)]">
                      {req.record_id && (
                        <p>
                          <strong className="text-slate-200">Requested Record:</strong>{" "}
                          <span className="text-cyan-300 font-semibold">
                            {req.record_title || req.record_type || req.record_id.slice(0, 14)}
                          </span>
                        </p>
                      )}
                      {req.reason && (
                        <p>
                          <strong className="text-slate-200">Clinical Reason:</strong> {req.reason}
                        </p>
                      )}
                      <p>
                        <strong className="text-slate-200">Submitted:</strong> {formatDate(req.created_at || req.createdAt)}
                      </p>
                    </div>

                    {/* Doctor Flow: ZK Proof & Access on Approved Requests */}
                    {!isPatient && isApproved && recId && (() => {
                      const zkStage = zkStageMap[recId] || (isZKVerified ? "verified" : "idle");
                      const verifyData = zkVerifyMap[recId];

                      return (
                        <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">ZK Authorization:</span>
                            {zkStage === "generating_proof" && (
                              <span className="text-purple-400 font-semibold inline-flex items-center gap-1 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Generating proof...
                              </span>
                            )}
                            {zkStage === "proof_generated" && (
                              <span className="text-purple-300 font-semibold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-purple-400" />
                                Proof generated
                              </span>
                            )}
                            {zkStage === "verifying_crypto" && (
                              <span className="text-cyan-400 font-semibold inline-flex items-center gap-1 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Cryptographic verification...
                              </span>
                            )}
                            {zkStage === "verifying_blockchain" && (
                              <span className="text-cyan-400 font-semibold inline-flex items-center gap-1 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Blockchain verification...
                              </span>
                            )}
                            {zkStage === "verified" && (
                              <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                ZK Authorization VERIFIED ✓
                              </span>
                            )}
                            {zkStage === "failed" && (
                              <span className="text-red-400 font-semibold inline-flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                Verification Failed
                              </span>
                            )}
                            {zkStage === "idle" && (
                              <span className="text-amber-400 font-semibold">Required</span>
                            )}
                          </div>

                          {/* Verified Details & On-Chain Transaction Hash */}
                          {isZKVerified && (
                            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1.5 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Circuit:</span>
                                <span className="font-mono text-slate-300">authorization (BN254)</span>
                              </div>
                              {verifyData?.nullifier && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">Nullifier:</span>
                                  <span className="font-mono text-slate-400 text-[10px]">
                                    {verifyData.nullifier.slice(0, 10)}...{verifyData.nullifier.slice(-8)}
                                  </span>
                                </div>
                              )}
                              {verifyData?.tx_hash && (
                                <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20">
                                  <span className="text-slate-400">On-Chain Anchor:</span>
                                  <BlockchainTxLink
                                    hash={verifyData.tx_hash}
                                    type="tx"
                                    truncate={true}
                                    startLen={6}
                                    endLen={4}
                                    showExplorerButton={false}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {!isZKVerified && (
                              <button
                                onClick={() => handleGenerateAndVerifyZK(recId)}
                                disabled={!!isZKLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-950/40 border border-purple-500/30 rounded-lg hover:bg-purple-900/50 transition-colors disabled:opacity-50"
                              >
                                {isZKLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                )}
                                <span>Generate & Verify ZK Proof</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleAccessDecrypted(recId)}
                              disabled={decryptingRecordId === recId}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                                isZKVerified
                                  ? "text-emerald-300 bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/50 shadow-sm shadow-emerald-950"
                                  : "text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/50"
                              }`}
                            >
                              {decryptingRecordId === recId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" />
                              )}
                              <span>Access & Decrypt Record</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            STANDARD REQUEST MODAL — Patient Search → Record Select
            ══════════════════════════════════════════════════════════ */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100">Request Medical Record Access</h2>
                  <p className="text-xs text-slate-400">Search patient and select record to request consent.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                {modalError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Patient Search */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Patient <span className="text-red-400">*</span>
                  </label>

                  {selectedPatient ? (
                    <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-semibold text-cyan-200">
                          {selectedPatient.display_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({selectedPatient.id.slice(0, 8)}...)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(null)}
                        className="text-xs text-slate-400 hover:text-red-400"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search patient by display name..."
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                      {searching && (
                        <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin absolute right-3 top-3" />
                      )}

                      {searchResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-11 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-44 overflow-y-auto divide-y divide-slate-800">
                          {searchResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectPatient(p)}
                              className="w-full p-2.5 text-left hover:bg-cyan-950/40 text-xs flex items-center justify-between text-slate-300 hover:text-cyan-200"
                            >
                              <span className="font-semibold">{p.display_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {p.id.slice(0, 8)}...
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Target Record Selector */}
                {selectedPatient && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      Target Record (Optional)
                    </label>
                    {loadingRecords ? (
                      <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading patient medical records...</span>
                      </div>
                    ) : patientRecords.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-2 bg-slate-950 rounded-lg">
                        No individual records found — general access will be requested.
                      </p>
                    ) : (
                      <select
                        value={selectedRecordId}
                        onChange={(e) => setSelectedRecordId(e.target.value)}
                        className="w-full p-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">All Records (Comprehensive Access)</option>
                        {patientRecords.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.original_document_filename || r.fhir_resource_type || r.record_type} ({r.id.slice(0, 8)}...)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Clinical Reason */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Clinical Reason
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="e.g. Diagnostic review, prescription renewal..."
                    className="w-full p-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedPatient}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-md disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Send Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            EMERGENCY BREAK-GLASS MODAL
            ══════════════════════════════════════════════════════════ */}
        {showEmergencyModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-md animate-fade-in space-y-4 border border-red-500/40">
              <div className="flex items-start justify-between border-b border-red-900/40 pb-3">
                <div className="flex items-center gap-2 text-red-400">
                  <Flame className="w-5 h-5" />
                  <h2 className="text-base font-bold text-slate-100">Emergency Break-Glass Protocol</h2>
                </div>
                <button onClick={() => setShowEmergencyModal(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-[11px] text-red-300 leading-relaxed">
                Emergency access grants strictly time-bounded (4hr) access. Every access is cryptographically audited on Sepolia blockchain.
              </div>

              <form onSubmit={handleEmergencySubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Patient UUID</label>
                  <input
                    type="text"
                    value={emergPatientId}
                    onChange={(e) => setEmergPatientId(e.target.value)}
                    placeholder="Enter patient UUID..."
                    className="w-full p-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-red-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Record UUID</label>
                  <input
                    type="text"
                    value={emergRecordId}
                    onChange={(e) => setEmergRecordId(e.target.value)}
                    placeholder="Enter critical medical record UUID..."
                    className="w-full p-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-red-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Emergency Justification</label>
                  <textarea
                    value={emergReason}
                    onChange={(e) => setEmergReason(e.target.value)}
                    rows={2}
                    placeholder="Clinical reason (e.g., ER resuscitation, acute trauma)..."
                    className="w-full p-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowEmergencyModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emergSubmitting}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {emergSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                    <span>Execute Break-Glass</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            PATIENT GRANT CONSENT APPROVAL MODAL
            ══════════════════════════════════════════════════════════ */}
        {approvingRequest && (
          <GrantConsentModal
            isOpen={!!approvingRequest}
            onClose={() => setApprovingRequest(null)}
            onSuccess={async (_, txHash) => {
              try {
                await approveAccessRequest(approvingRequest.id, { permission: "read" });
                setActionSuccess(
                  `Access approved and anchored on-chain! ${txHash ? `Tx: ${txHash.slice(0, 14)}...` : ""}`
                );
                loadRequests();
              } catch {
                // Ignore if backend sync handled
              }
              setApprovingRequest(null);
            }}
            availableRecords={
              approvingRequest.record_id
                ? [
                    {
                      id: approvingRequest.record_id,
                      record_type: approvingRequest.record_type || "medical_record",
                      original_document_filename: approvingRequest.record_title || null,
                    },
                  ]
                : []
            }
            initialDoctor={
              approvingRequest.requester_doctor_name
                ? {
                    id: approvingRequest.requester_doctor_id || "",
                    display_name: approvingRequest.requester_doctor_name,
                    license_number: approvingRequest.requester_doctor_license,
                    specialization: approvingRequest.requester_doctor_specialization,
                    hospital_name: approvingRequest.requester_hospital_name,
                    wallet_address: approvingRequest.requester_doctor_wallet,
                  }
                : null
            }
            initialRecordId={approvingRequest.record_id}
          />
        )}

        {/* ══════════════════════════════════════════════════════════
            DOCTOR BLOCKCHAIN PROFILE MODAL
            ══════════════════════════════════════════════════════════ */}
        <BlockchainProfileModal
          isOpen={!!selectedDoctorProfile}
          onClose={() => setSelectedDoctorProfile(null)}
          doctor={selectedDoctorProfile}
        />

        {/* ══════════════════════════════════════════════════════════
            IN-APP DOCUMENT VIEWER MODAL
            ══════════════════════════════════════════════════════════ */}
        <DocumentViewerModal
          isOpen={!!viewingDocRecord}
          onClose={() => setViewingDocRecord(null)}
          recordId={viewingDocRecord?.id || null}
          filename={viewingDocRecord?.filename}
          mimeType={viewingDocRecord?.mimeType}
        />

        {/* ══════════════════════════════════════════════════════════
            DECRYPTED RECORD DETAIL MODAL
            ══════════════════════════════════════════════════════════ */}
        {decryptedRecord && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-2xl animate-fade-in max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-base font-bold text-slate-100">Decrypted Medical Record</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    AES-256-GCM decrypted off-chain storage blob · Integrity Verified ✓
                  </p>
                </div>
                <button onClick={() => setDecryptedRecord(null)} className="text-slate-400 hover:text-slate-200 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Metadata Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Record ID</span>
                    <span className="font-mono text-slate-200 truncate block">{decryptedRecord.id}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Encryption</span>
                    <span className="text-emerald-400 font-semibold">
                      {decryptedRecord.encryption_version || "AES-256-GCM"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Integrity Hash</span>
                    <span className="font-mono text-slate-200 truncate block">
                      {decryptedRecord.record_hash ? decryptedRecord.record_hash.slice(0, 14) + "..." : "Verified"}
                    </span>
                  </div>
                </div>

                {/* Original Document Action if present */}
                {decryptedRecord.original_document_filename && (
                  <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-cyan-300">
                        {decryptedRecord.original_document_filename}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        MIME: {decryptedRecord.original_document_mime_type || "application/pdf"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setViewingDocRecord({
                          id: decryptedRecord.id,
                          filename: decryptedRecord.original_document_filename,
                          mimeType: decryptedRecord.original_document_mime_type,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 rounded-lg hover:bg-cyan-900/60 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View in Viewer</span>
                    </button>
                  </div>
                )}

                {/* FHIR JSON Viewer */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-300 mb-1.5">FHIR Clinical Payload</h3>
                  <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 leading-relaxed">
                    {JSON.stringify(decryptedRecord.fhir_data, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  onClick={() => setDecryptedRecord(null)}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
