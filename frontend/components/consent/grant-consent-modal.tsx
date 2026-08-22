"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Search,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  KeyRound,
  FileText,
  Wallet,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { searchDoctors } from "@/services/patients";
import { grantConsent } from "@/services/consent";
import { grantConsentOnChain, TransactionLifecycleStatus } from "@/lib/ethereum-contracts";
import { useWallet, SEPOLIA_CHAIN_ID } from "@/hooks/use-wallet";
import { BlockchainTxLink } from "@/components/blockchain/blockchain-tx-link";
import type { DoctorSearchResult, MedicalRecord, Consent, ConsentPermission } from "@/types";

interface GrantConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (consent: Consent, txHash?: string) => void;
  availableRecords: MedicalRecord[];
  initialDoctor?: {
    id: string;
    display_name: string;
    specialization?: string | null;
    hospital_name?: string | null;
    license_number?: string | null;
    wallet_address?: string | null;
  } | null;
  initialRecordId?: string | null;
}

export function GrantConsentModal({
  isOpen,
  onClose,
  onSuccess,
  availableRecords,
  initialDoctor,
  initialRecordId,
}: GrantConsentModalProps) {
  const { account, chainId, isSepolia, connectWallet, switchNetwork } = useWallet();

  // Selected State
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorSearchResult | null>(
    (initialDoctor as DoctorSearchResult) || null
  );
  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    initialRecordId || (availableRecords.length > 0 ? availableRecords[0].id : "")
  );

  // Permissions (Bitmask: 1=View, 2=Doc, 4=FHIR, 8=Download)
  const [permViewRecord, setPermViewRecord] = useState(true);
  const [permViewDocument, setPermViewDocument] = useState(true);
  const [permViewFHIR, setPermViewFHIR] = useState(true);
  const [permDownload, setPermDownload] = useState(false);

  // Expiration Duration
  const [duration, setDuration] = useState<"1h" | "24h" | "7d" | "30d" | "custom">("24h");
  const [customDate, setCustomDate] = useState("");

  // Doctor Search
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctorResults, setDoctorResults] = useState<DoctorSearchResult[]>([]);
  const [searchingDoctors, setSearchingDoctors] = useState(false);

  // Stepped Transaction Flow
  const [txStep, setTxStep] = useState<
    "idle" | "preparing" | "signing_metamask" | "confirming_chain" | "syncing_backend" | "success"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialDoctor) {
      setSelectedDoctor(initialDoctor as DoctorSearchResult);
    }
  }, [initialDoctor]);

  useEffect(() => {
    if (initialRecordId) {
      setSelectedRecordId(initialRecordId);
    } else if (availableRecords.length > 0 && !selectedRecordId) {
      setSelectedRecordId(availableRecords[0].id);
    }
  }, [initialRecordId, availableRecords, selectedRecordId]);

  // Debounced Doctor Search
  useEffect(() => {
    if (!doctorQuery || doctorQuery.trim().length < 2) {
      setDoctorResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingDoctors(true);
      try {
        const res = await searchDoctors(doctorQuery.trim());
        setDoctorResults(res);
      } catch {
        setDoctorResults([]);
      } finally {
        setSearchingDoctors(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [doctorQuery]);

  if (!isOpen) return null;

  // Calculate permissions bitmask
  const calculateBitmask = (): number => {
    let mask = 0;
    if (permViewRecord) mask |= 1;
    if (permViewDocument) mask |= 2;
    if (permViewFHIR) mask |= 4;
    if (permDownload) mask |= 8;
    return mask || 1; // Default at least view
  };

  const calculateExpiresAt = (): { iso: string; unix: number } => {
    const now = new Date();
    let expiryDate: Date;
    switch (duration) {
      case "1h":
        expiryDate = new Date(now.getTime() + 3600 * 1000);
        break;
      case "24h":
        expiryDate = new Date(now.getTime() + 24 * 3600 * 1000);
        break;
      case "7d":
        expiryDate = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
        break;
      case "30d":
        expiryDate = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
        break;
      case "custom":
        expiryDate = customDate ? new Date(customDate) : new Date(now.getTime() + 24 * 3600 * 1000);
        break;
    }
    return {
      iso: expiryDate.toISOString(),
      unix: Math.floor(expiryDate.getTime() / 1000),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDoctor) {
      setError("Please search and select a licensed doctor to grant access.");
      return;
    }
    if (!selectedRecordId) {
      setError("Please select a medical record from your ledger.");
      return;
    }

    const bitmask = calculateBitmask();
    const { iso: expiresIso, unix: expiresUnix } = calculateExpiresAt();
    const permissionStr: ConsentPermission =
      bitmask === 15 ? "full" : bitmask >= 2 ? "write" : "read";

    setSubmitting(true);
    setTxStep("preparing");

    let onChainTxHash: string | undefined = undefined;

    // 1. If MetaMask is connected and doctor has wallet address, execute on-chain grant
    if (account && selectedDoctor.wallet_address) {
      try {
        if (!isSepolia) {
          await switchNetwork(SEPOLIA_CHAIN_ID);
        }

        setTxStep("signing_metamask");

        const txRes = await grantConsentOnChain(
          selectedRecordId,
          selectedDoctor.wallet_address,
          bitmask,
          expiresUnix,
          (status: TransactionLifecycleStatus, submittedTx?: string) => {
            if (status === "submitted" || status === "confirming") {
              setTxStep("confirming_chain");
              if (submittedTx) setTxHash(submittedTx);
            }
          }
        );

        onChainTxHash = txRes.txHash;
        setTxHash(onChainTxHash);
      } catch (chainErr: any) {
        setError(chainErr.message || "Failed to confirm transaction in MetaMask.");
        setSubmitting(false);
        setTxStep("idle");
        return;
      }
    }

    // 2. Synchronize consent state with MedVault backend
    setTxStep("syncing_backend");
    try {
      const consent = await grantConsent({
        record_id: selectedRecordId,
        permission: permissionStr,
        grantee_doctor_id: selectedDoctor.id,
        expires_at: expiresIso,
      });

      setTxStep("success");
      setTimeout(() => {
        onSuccess(consent, onChainTxHash);
        onClose();
      }, 1500);
    } catch (apiErr: any) {
      setError(apiErr.message || "Failed to sync consent state with ledger.");
      setTxStep("idle");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRecord = availableRecords.find((r) => r.id === selectedRecordId);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card p-6 w-full max-w-xl max-h-[92vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Grant Medical Ledger Access</h2>
              <p className="text-xs text-slate-400">
                Time-Bound Cryptographic Consent Anchored to Blockchain
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepped Transaction Feedback Banner */}
        {txStep !== "idle" && (
          <div className="p-3.5 bg-cyan-950/50 border border-cyan-500/40 rounded-xl space-y-2 text-xs text-cyan-200 animate-fade-in">
            <div className="flex items-center gap-2 font-semibold">
              {txStep === "signing_metamask" && (
                <>
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>Please confirm transaction in MetaMask wallet...</span>
                </>
              )}
              {txStep === "confirming_chain" && (
                <>
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>Transaction submitted! Waiting for Sepolia block confirmation...</span>
                </>
              )}
              {txStep === "syncing_backend" && (
                <>
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>Recording consent in encrypted ledger...</span>
                </>
              )}
              {txStep === "success" && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">
                    Consent successfully granted and anchored on-chain!
                  </span>
                </>
              )}
            </div>

            {txHash && (
              <div className="pt-1 border-t border-cyan-900/60">
                <BlockchainTxLink hash={txHash} type="tx" label="Tx Hash" />
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Doctor Search & Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              1. Grantee Doctor <span className="text-red-400">*</span>
            </label>

            {selectedDoctor ? (
              <div className="p-3 bg-slate-900/90 border border-cyan-500/40 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                    Dr
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-100">{selectedDoctor.display_name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{selectedDoctor.specialization || "General Practice"}</span>
                      {selectedDoctor.license_number && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-cyan-400">ID: {selectedDoctor.license_number}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {!initialDoctor && (
                  <button
                    type="button"
                    onClick={() => setSelectedDoctor(null)}
                    className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div className="relative space-y-1">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={doctorQuery}
                    onChange={(e) => setDoctorQuery(e.target.value)}
                    placeholder="Search doctor by name, specialty, or license ID..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  {searchingDoctors && (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin absolute right-3 top-3" />
                  )}
                </div>

                {doctorResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-11 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-800">
                    {doctorResults.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDoctor(d);
                          setDoctorQuery("");
                          setDoctorResults([]);
                        }}
                        className="w-full p-2.5 text-left hover:bg-cyan-950/40 text-xs flex items-center justify-between text-slate-300 hover:text-cyan-200"
                      >
                        <div>
                          <p className="font-semibold">{d.display_name}</p>
                          <p className="text-[10px] text-slate-400">
                            {d.specialization || "General Medicine"}{" "}
                            {d.license_number && `• ID: ${d.license_number}`}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Record Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              2. Target Medical Record <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
              required
            >
              {availableRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.original_document_filename || r.fhir_resource_type || r.record_type.replace("_", " ").toUpperCase()} (ID: {r.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </div>

          {/* 3. Granular Permissions (Bitmask) */}
          <div className="space-y-2 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              3. Access Permissions (Granular Bitmask)
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permViewRecord}
                  onChange={(e) => setPermViewRecord(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>View Record (Bit 1)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permViewDocument}
                  onChange={(e) => setPermViewDocument(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>View Document (Bit 2)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permViewFHIR}
                  onChange={(e) => setPermViewFHIR(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>View FHIR (Bit 4)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permDownload}
                  onChange={(e) => setPermDownload(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Download (Bit 8)</span>
              </label>
            </div>
          </div>

          {/* 4. Access Duration */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              4. Time-Bound Expiration
            </label>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {(["1h", "24h", "7d", "30d"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`py-2 rounded-lg font-semibold border transition-all ${
                    duration === d
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {d === "1h" ? "1 Hour" : d === "24h" ? "24 Hours" : d === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Notice */}
          <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                {account
                  ? `Signing with wallet: ${account.slice(0, 6)}...${account.slice(-4)}`
                  : "MetaMask not connected — consent will record in ledger"}
              </span>
            </div>
            {!account && (
              <button
                type="button"
                onClick={connectWallet}
                className="text-xs text-cyan-400 hover:underline font-semibold"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/50 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Grant...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Confirm & Grant Consent</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
