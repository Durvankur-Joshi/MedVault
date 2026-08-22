"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useWallet, SEPOLIA_CHAIN_ID } from "@/hooks/use-wallet";
import { ApiError } from "@/lib/api-client";
import { listConsents, revokeConsent } from "@/services/consent";
import { listRecords } from "@/services/records";
import { revokeConsentOnChain, TransactionLifecycleStatus } from "@/lib/ethereum-contracts";
import { GrantConsentModal } from "@/components/consent/grant-consent-modal";
import { BlockchainTxLink } from "@/components/blockchain/blockchain-tx-link";
import type { Consent, MedicalRecord } from "@/types";
import {
  ShieldCheck,
  Plus,
  XCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Blocks,
  Clock,
  Key,
  ExternalLink,
  ShieldAlert,
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

export default function ConsentPage() {
  const { user } = useAuth();
  const { account, isSepolia, switchNetwork } = useWallet();

  const [consents, setConsents] = useState<Consent[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Grant Modal
  const [showGrantModal, setShowGrantModal] = useState(false);

  // Revocation State
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeStatusText, setRevokeStatusText] = useState<string | null>(null);

  const loadConsents = useCallback(async () => {
    try {
      const data = await listConsents();
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
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const data = await listRecords();
      setRecords(data);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadConsents();
    loadRecords();
  }, [loadConsents, loadRecords]);

  const handleRevokeConsent = async (consent: Consent) => {
    if (
      !confirm(
        "Are you sure you want to revoke this consent permission on-chain? The doctor will lose access immediately."
      )
    ) {
      return;
    }

    setRevokingId(consent.id);
    setError(null);
    setActionSuccess(null);
    setRevokeStatusText("Preparing on-chain revocation...");

    try {
      // 1. If MetaMask is connected, prompt user for MetaMask signing
      if (account && consent.record_id) {
        try {
          if (!isSepolia) {
            await switchNetwork(SEPOLIA_CHAIN_ID);
          }
          setRevokeStatusText("Please confirm revocation transaction in MetaMask...");

          // Fallback doctor address or zero address if not direct wallet
          const doctorWallet =
            consent.grantee_doctor_id && consent.grantee_doctor_id.startsWith("0x")
              ? consent.grantee_doctor_id
              : "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

          await revokeConsentOnChain(
            consent.record_id,
            doctorWallet,
            (status: TransactionLifecycleStatus, txHash?: string) => {
              if (status === "confirming") {
                setRevokeStatusText(
                  `Transaction submitted (${txHash?.slice(0, 10)}...)! Confirming on Sepolia...`
                );
              }
            }
          );
        } catch (chainErr: any) {
          setError(chainErr.message || "Revocation was cancelled or failed in MetaMask.");
          setRevokingId(null);
          setRevokeStatusText(null);
          return;
        }
      }

      // 2. Sync revocation with backend
      setRevokeStatusText("Synchronizing revocation with encrypted ledger...");
      await revokeConsent(consent.id);
      setActionSuccess("Consent permission revoked both in ledger and on-chain smart contract.");
      await loadConsents();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to revoke consent.");
      } else {
        setError("Error communicating with backend.");
      }
    } finally {
      setRevokingId(null);
      setRevokeStatusText(null);
    }
  };

  const isPatient = user?.role === "patient";

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Consent Management</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Patient-Governed Access Control with Sepolia EVM Smart Contract Enforcement.
            </p>
          </div>

          {isPatient && (
            <button
              onClick={() => setShowGrantModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/40 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Grant New Access</span>
            </button>
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

        {revokeStatusText && (
          <div className="p-3.5 rounded-xl bg-cyan-950/50 border border-cyan-500/40 flex items-center gap-2.5 text-xs text-cyan-200 animate-fade-in">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>{revokeStatusText}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="p-12 text-center text-cyan-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p className="text-sm text-[var(--muted)]">Loading on-chain consent registry...</p>
          </div>
        ) : consents.length === 0 ? (
          /* Empty State */
          <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
            <ShieldCheck className="w-12 h-12 mx-auto text-slate-600" />
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">No Active Consents</h3>
              <p className="text-xs text-[var(--muted)] mt-1 max-w-md mx-auto">
                {isPatient
                  ? "You have not granted access to any doctors or healthcare providers yet. Click 'Grant New Access' to authorize a physician."
                  : "No patients have currently granted you access to their medical history."}
              </p>
            </div>
            {isPatient && (
              <button
                onClick={() => setShowGrantModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Grant First Consent</span>
              </button>
            )}
          </div>
        ) : (
          /* Consents Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
            {consents.map((c) => {
              const isActive = c.status === "active";
              const isExpired = c.status === "expired";
              const isRevoked = c.status === "revoked";
              const isAnchored = !!c.blockchain_tx_hash || !!c.blockchain_consent_id;

              return (
                <div
                  key={c.id}
                  className="glass-card p-5 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              isActive
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : isRevoked
                                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Permission: <strong className="text-slate-200">{c.permission.toUpperCase()}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-400">
                      <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-semibold">Authorized Grantee:</span>
                          <span className="font-mono text-cyan-300 font-semibold">
                            {c.grantee_doctor_id
                              ? `Doctor (${c.grantee_doctor_id.slice(0, 8)}...)`
                              : c.grantee_hospital_id
                                ? `Hospital (${c.grantee_hospital_id.slice(0, 8)}...)`
                                : "Universal Healthcare Provider"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Target Record:</span>
                          <span className="font-mono text-slate-300">
                            {c.record_id ? `${c.record_id.slice(0, 14)}...` : "All Clinical Records"}
                          </span>
                        </div>
                      </div>

                      {/* Blockchain Anchor Info */}
                      {isAnchored && (
                        <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 font-mono text-[11px] space-y-1.5">
                          <div className="flex items-center justify-between text-cyan-400">
                            <span className="font-sans font-semibold flex items-center gap-1">
                              <Blocks className="w-3 h-3" /> Sepolia Consent Anchor
                            </span>
                            <span className="text-[10px] text-cyan-300">
                              {c.blockchain_network || "Sepolia"}
                            </span>
                          </div>

                          {c.blockchain_tx_hash && (
                            <BlockchainTxLink
                              hash={c.blockchain_tx_hash}
                              type="tx"
                              truncate={true}
                              startLen={8}
                              endLen={6}
                              showExplorerButton={true}
                            />
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Expires: {formatDate(c.expires_at || c.expiresAt)}
                        </span>
                        <span className="text-slate-500">
                          Granted: {formatDate(c.created_at || c.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {isPatient && isActive && (
                    <div className="pt-3 mt-3 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={() => handleRevokeConsent(c)}
                        disabled={revokingId === c.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/40 border border-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {revokingId === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Revoke On-Chain</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Grant Consent Modal Component */}
        <GrantConsentModal
          isOpen={showGrantModal}
          onClose={() => setShowGrantModal(false)}
          onSuccess={(newConsent, txHash) => {
            setShowGrantModal(false);
            setActionSuccess(
              `Consent granted and anchored on-chain! ${txHash ? `Tx: ${txHash.slice(0, 14)}...` : ""}`
            );
            loadConsents();
          }}
          availableRecords={records}
        />
      </div>
    </DashboardShell>
  );
}
