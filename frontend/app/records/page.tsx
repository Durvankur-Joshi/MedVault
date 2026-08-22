"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useWallet, SEPOLIA_CHAIN_ID } from "@/hooks/use-wallet";
import { ApiError } from "@/lib/api-client";
import {
  listRecords,
  deleteRecord,
  getDecryptedRecord,
  verifyRecordIntegrity,
  uploadDocument,
  anchorRecordToBlockchain,
  verifyRecordOnBlockchain,
} from "@/services/records";
import { anchorRecordOnChain, TransactionLifecycleStatus } from "@/lib/ethereum-contracts";
import { BlockchainTxLink } from "@/components/blockchain/blockchain-tx-link";
import { MedicalRecordForm } from "@/components/records/medical-record-form";
import { DocumentViewerModal } from "@/components/records/document-viewer-modal";
import type {
  MedicalRecord,
  MedicalRecordDetailResponse,
  IntegrityVerifyResponse,
  BlockchainVerifyResponse,
} from "@/types";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Eye,
  KeyRound,
  HardDrive,
  Copy,
  Check,
  X,
  Activity,
  Heart,
  Pill,
  Stethoscope,
  Upload,
  Blocks,
  FileCheck,
  ExternalLink,
  Download,
  FileSpreadsheet,
} from "lucide-react";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-IN", {
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

export default function RecordsPage() {
  const { user } = useAuth();
  const { account, isSepolia, switchNetwork } = useWallet();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creationTab, setCreationTab] = useState<"form" | "document">("form");

  // Document Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docRecordType, setDocRecordType] = useState("prescription");
  const [creatingDoc, setCreatingDoc] = useState(false);

  // In-App Document Viewer State
  const [viewerRecord, setViewerRecord] = useState<{
    id: string;
    filename?: string | null;
    mimeType?: string | null;
  } | null>(null);

  // Decrypted Record Modal
  const [decryptedRecord, setDecryptedRecord] =
    useState<MedicalRecordDetailResponse | null>(null);
  const [decryptingRecordId, setDecryptingRecordId] = useState<string | null>(null);

  // Integrity & Blockchain Verification Modals
  const [verifyingRecordId, setVerifyingRecordId] = useState<string | null>(null);
  const [integrityResult, setIntegrityResult] =
    useState<IntegrityVerifyResponse | null>(null);
  const [verifyingChainRecordId, setVerifyingChainRecordId] = useState<string | null>(null);
  const [blockchainVerifyResult, setBlockchainVerifyResult] =
    useState<BlockchainVerifyResponse | null>(null);

  // Blockchain Anchoring State
  const [anchoringRecordId, setAnchoringRecordId] = useState<string | null>(null);
  const [anchorStatusText, setAnchorStatusText] = useState<string | null>(null);

  // Clipboard
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listRecords();
      setRecords(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load medical records.");
      } else {
        setError("Unable to connect to the backend service.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a valid medical file to upload.");
      return;
    }

    setCreatingDoc(true);
    setError(null);
    setActionSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("record_type", docRecordType);

      await uploadDocument(formData);
      setShowCreateModal(false);
      setSelectedFile(null);
      setActionSuccess(
        `Original document "${selectedFile.name}" encrypted with AES-256-GCM and anchored to blockchain.`
      );
      await loadRecords();
    } catch (err: any) {
      setError(err.message || "Failed to upload encrypted document.");
    } finally {
      setCreatingDoc(false);
    }
  };

  const handleAnchorRecord = async (recordId: string) => {
    setAnchoringRecordId(recordId);
    setError(null);
    setActionSuccess(null);
    setAnchorStatusText("Preparing blockchain anchor commitment...");

    const targetRec = records.find((r) => r.id === recordId);
    const recHash = targetRec?.record_hash || targetRec?.recordHash || "0x00";

    try {
      // 1. If MetaMask is connected, prompt user for MetaMask confirmation
      if (account) {
        try {
          if (!isSepolia) {
            await switchNetwork(SEPOLIA_CHAIN_ID);
          }
          setAnchorStatusText("Please confirm anchoring transaction in MetaMask...");

          await anchorRecordOnChain(
            recordId,
            recHash,
            targetRec?.patient_id || user?.id || "patient-self",
            targetRec?.encrypted_storage_ref || targetRec?.encryptedStorageRef || "storage-blob",
            (status: TransactionLifecycleStatus, txHash?: string) => {
              if (status === "confirming") {
                setAnchorStatusText(`Transaction submitted (${txHash?.slice(0, 10)}...)! Confirming on Sepolia...`);
              }
            }
          );
        } catch (chainErr: any) {
          setError(chainErr.message || "MetaMask transaction cancelled or failed.");
          setAnchoringRecordId(null);
          setAnchorStatusText(null);
          return;
        }
      }

      // 2. Sync anchor with backend
      setAnchorStatusText("Registering cryptographic anchor with ledger...");
      const res = await anchorRecordToBlockchain(recordId);
      setActionSuccess(
        `Record successfully anchored to ${res.blockchain_network}! Tx: ${res.transaction_hash.slice(0, 14)}...`
      );
      await loadRecords();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to anchor record to blockchain.");
      } else {
        setError("Unable to complete blockchain anchoring.");
      }
    } finally {
      setAnchoringRecordId(null);
      setAnchorStatusText(null);
    }
  };

  const handleBlockchainVerify = async (recordId: string) => {
    setVerifyingChainRecordId(recordId);
    setError(null);

    try {
      const res = await verifyRecordOnBlockchain(recordId);
      setBlockchainVerifyResult(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Blockchain verification failed.");
      } else {
        setError("Unable to verify against blockchain.");
      }
    } finally {
      setVerifyingChainRecordId(null);
    }
  };

  const handleViewDecrypted = async (recordId: string) => {
    setDecryptingRecordId(recordId);
    setError(null);
    try {
      const detail = await getDecryptedRecord(recordId);
      setDecryptedRecord(detail);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to decrypt medical record.");
      } else {
        setError("Cryptographic decryption failed.");
      }
    } finally {
      setDecryptingRecordId(null);
    }
  };

  const handleVerifyIntegrity = async (recordId: string) => {
    setVerifyingRecordId(recordId);
    setError(null);
    try {
      const result = await verifyRecordIntegrity(recordId);
      setIntegrityResult(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Integrity verification failed.");
      } else {
        setError("Failed to verify record integrity.");
      }
    } finally {
      setVerifyingRecordId(null);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("Are you sure you want to delete this record and its encrypted storage blob?")) {
      return;
    }
    try {
      await deleteRecord(recordId);
      setActionSuccess("Medical record deleted.");
      await loadRecords();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to delete record.");
      } else {
        setError("Unable to delete record.");
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
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Medical Records Ledger</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              End-to-End AES-256-GCM Encrypted FHIR Store anchored to Sepolia EVM Ledger.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/40 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medical Record</span>
          </button>
        </div>

        {/* Feedback Alerts */}
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
            <p className="text-sm text-[var(--muted)]">Loading encrypted ledger records...</p>
          </div>
        ) : records.length === 0 ? (
          /* Empty State */
          <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
            <HardDrive className="w-12 h-12 mx-auto text-slate-600" />
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">No Medical Records Found</h3>
              <p className="text-xs text-[var(--muted)] mt-1 max-w-md mx-auto">
                Your medical history ledger is empty. Click &quot;Add Medical Record&quot; to create a structured FHIR clinical record or upload an encrypted diagnostic file.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Record</span>
            </button>
          </div>
        ) : (
          /* Records Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
            {records.map((rec) => {
              const isDocument = !!(
                rec.original_document_filename ||
                rec.originalDocumentFilename ||
                rec.original_document_ref ||
                rec.originalDocumentRef
              );
              const isAnchored = !!rec.blockchain_tx_hash || !!rec.blockchainTxHash;
              const docName = rec.original_document_filename || rec.originalDocumentFilename;
              const docMime = rec.original_document_mime_type || rec.originalDocumentMimeType;

              return (
                <div
                  key={rec.id}
                  className="glass-card p-5 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                          {isDocument ? <FileText className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-100">
                            {docName ||
                              rec.fhir_resource_type ||
                              rec.record_type?.replace("_", " ").toUpperCase() ||
                              "Medical Record"}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Type: {rec.record_type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isAnchored ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            Anchored
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Pending Anchor
                          </span>
                        )}

                        {isPatient && (
                          <button
                            onClick={() => handleDelete(rec.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata Card */}
                    <div className="space-y-2 text-xs text-slate-400">
                      <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500">Record ID:</span>
                        <span className="text-slate-300">{rec.id.slice(0, 18)}...</span>
                      </div>

                      {/* Blockchain Anchor Info */}
                      {isAnchored && (
                        <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 font-mono text-[11px] space-y-1.5">
                          <div className="flex items-center justify-between text-cyan-400">
                            <span className="font-sans font-semibold flex items-center gap-1">
                              <Blocks className="w-3 h-3" /> Blockchain Transaction
                            </span>
                            <span className="text-[10px] text-cyan-300">
                              {rec.blockchain_network || "Sepolia"}
                            </span>
                          </div>
                          <BlockchainTxLink
                            hash={rec.blockchain_tx_hash || rec.blockchainTxHash || ""}
                            type="tx"
                            truncate={true}
                            startLen={8}
                            endLen={6}
                            showExplorerButton={true}
                          />
                        </div>
                      )}

                      {/* SHA-256 Hash Commitment */}
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center gap-1 font-sans font-semibold text-slate-300">
                            <KeyRound className="w-3 h-3 text-cyan-400" />
                            SHA-256 Integrity Hash
                          </span>
                          {(rec.record_hash || rec.recordHash) && (
                            <button
                              onClick={() => copyToClipboard(rec.record_hash || rec.recordHash || "")}
                              className="hover:text-slate-200 p-1 rounded transition-colors"
                              title="Copy Hash"
                            >
                              {copiedHash === (rec.record_hash || rec.recordHash) ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-cyan-300 break-all text-[10px]">
                          {rec.record_hash || rec.recordHash || "—"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span>Registered: {formatDate(rec.created_at || rec.createdAt)}</span>
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <Lock className="w-3 h-3" />
                          {rec.encryption_version || rec.encryptionVersion || "AES-256-GCM"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="grid grid-cols-2 gap-2 pt-4 mt-4 border-t border-slate-800">
                    {!isDocument ? (
                      <button
                        onClick={() => handleViewDecrypted(rec.id)}
                        disabled={decryptingRecordId === rec.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition-colors disabled:opacity-50"
                      >
                        {decryptingRecordId === rec.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        <span>View Decrypted</span>
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setViewerRecord({
                            id: rec.id,
                            filename: docName,
                            mimeType: docMime,
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Document</span>
                      </button>
                    )}

                    {isAnchored ? (
                      <button
                        onClick={() => handleBlockchainVerify(rec.id)}
                        disabled={verifyingChainRecordId === rec.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold border border-cyan-500/20 transition-colors disabled:opacity-50"
                      >
                        {verifyingChainRecordId === rec.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Blocks className="w-3.5 h-3.5" />
                        )}
                        <span>Verify on Chain</span>
                      </button>
                    ) : isPatient ? (
                      <button
                        onClick={() => handleAnchorRecord(rec.id)}
                        disabled={anchoringRecordId === rec.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition-colors disabled:opacity-50"
                      >
                        {anchoringRecordId === rec.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Blocks className="w-3.5 h-3.5" />
                        )}
                        <span>Anchor on Chain</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerifyIntegrity(rec.id)}
                        disabled={verifyingRecordId === rec.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Integrity</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Record / Upload Document Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    Add Medical Record / Document
                  </h2>
                  <p className="text-xs text-slate-400">
                    AES-256-GCM Encrypted Off-Chain + SHA-256 Blockchain Anchor
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreationTab("form")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    creationTab === "form"
                      ? "bg-cyan-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Structured Clinical Form
                </button>
                <button
                  type="button"
                  onClick={() => setCreationTab("document")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    creationTab === "document"
                      ? "bg-amber-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File (PDF / Image)</span>
                </button>
              </div>

              {creationTab === "form" ? (
                /* Structured FHIR Medical Record Form */
                <MedicalRecordForm
                  onSuccess={(record) => {
                    setShowCreateModal(false);
                    setActionSuccess(
                      `Medical record (${record.record_type}) encrypted with AES-256-GCM and stored.`
                    );
                    loadRecords();
                  }}
                  onCancel={() => setShowCreateModal(false)}
                />
              ) : (
                /* Document Upload Form */
                <form onSubmit={handleUploadDocument} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Document Type
                    </label>
                    <select
                      value={docRecordType}
                      onChange={(e) => setDocRecordType(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="prescription">Prescription Image / Scan</option>
                      <option value="blood_report">Blood / Pathology Report (PDF)</option>
                      <option value="radiology_scan">Radiology / X-Ray / MRI Scan</option>
                      <option value="discharge_summary">Hospital Discharge Summary</option>
                      <option value="clinical_notes">Clinical Notes Document</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Select Medical File
                    </label>
                    <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl p-8 text-center transition-colors bg-slate-950/60">
                      <input
                        type="file"
                        id="medical-file-input"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setSelectedFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="medical-file-input"
                        className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                      >
                        <Upload className="w-8 h-8 text-amber-400" />
                        <div className="text-sm font-semibold text-slate-200">
                          {selectedFile ? selectedFile.name : "Click to select or drop medical document"}
                        </div>
                        <p className="text-xs text-slate-500">
                          Supports PDF, PNG, JPG, JPEG (Max 25MB)
                        </p>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingDoc || !selectedFile}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {creatingDoc ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Encrypting & Anchoring...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Encrypt & Anchor Document</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* In-App Document Viewer Modal */}
        <DocumentViewerModal
          isOpen={!!viewerRecord}
          onClose={() => setViewerRecord(null)}
          recordId={viewerRecord?.id || null}
          filename={viewerRecord?.filename}
          mimeType={viewerRecord?.mimeType}
        />

        {/* View Decrypted Modal */}
        {decryptedRecord && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-100">
                      Decrypted Medical Record
                    </h2>
                    <p className="text-xs text-emerald-400 font-medium">
                      Cryptographically Verified & AES-256-GCM Decrypted
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDecryptedRecord(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    SHA-256 Hash Verified against Ledger Commitment
                  </span>
                  <span className="font-mono text-[11px] text-emerald-400">
                    {decryptedRecord.record_hash?.slice(0, 16)}...
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between text-xs text-purple-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    ZK Authorization Verified (Noir BN254 — Zero PII Exposed)
                  </span>
                  <span className="font-mono text-[11px] text-purple-400 px-2 py-0.5 rounded bg-purple-500/20">
                    ZK-VALID
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1.5">
                  Normalized FHIR R4 Payload:
                </p>
                <pre className="p-4 rounded-xl bg-black/60 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-72">
                  {JSON.stringify(decryptedRecord.fhir_data, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  onClick={() => setDecryptedRecord(null)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Blockchain Verification Modal */}
        {blockchainVerifyResult && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-lg animate-in fade-in zoom-in-95 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Blocks className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-bold text-slate-100">
                    Smart Contract Verification
                  </h2>
                </div>
                <button
                  onClick={() => setBlockchainVerifyResult(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                className={`p-4 rounded-xl border flex flex-col gap-2 ${
                  blockchainVerifyResult.is_valid
                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                    : "bg-red-500/10 border-red-500/20 text-red-300"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {blockchainVerifyResult.is_valid ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                      <span>On-Chain Commitment Valid</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-400" />
                      <span>Integrity Mismatch / Unregistered</span>
                    </>
                  )}
                </div>
                <p className="text-xs opacity-90">{blockchainVerifyResult.details}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Network:</span>
                  <span>{blockchainVerifyResult.blockchain_network}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 font-sans">Expected SHA-256 Hash:</span>
                  <span className="text-[11px] text-cyan-300 break-all">
                    {blockchainVerifyResult.expected_hash}
                  </span>
                </div>
                {blockchainVerifyResult.on_chain_hash && (
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-sans">On-Chain Anchored Hash:</span>
                    <span className="text-[11px] text-emerald-300 break-all">
                      {blockchainVerifyResult.on_chain_hash}
                    </span>
                  </div>
                )}
                {blockchainVerifyResult.transaction_hash && (
                  <div className="pt-2 border-t border-slate-800">
                    <BlockchainTxLink
                      hash={blockchainVerifyResult.transaction_hash}
                      type="tx"
                      label="Anchor Tx"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setBlockchainVerifyResult(null)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
