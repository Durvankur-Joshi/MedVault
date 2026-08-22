"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  ExternalLink,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Award,
  Blocks,
  Copy,
  Check,
} from "lucide-react";
import { BlockchainTxLink } from "@/components/blockchain/blockchain-tx-link";
import { getIdentityOnChain, CONTRACT_ADDRESSES } from "@/lib/ethereum-contracts";
import { getExplorerAddressUrl } from "@/lib/explorer";

interface BlockchainProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: {
    display_name: string;
    license_number?: string | null;
    specialization?: string | null;
    hospital_name?: string | null;
    wallet_address?: string | null;
  } | null;
}

export function BlockchainProfileModal({
  isOpen,
  onClose,
  doctor,
}: BlockchainProfileModalProps) {
  const [loadingChain, setLoadingChain] = useState(false);
  const [onChainIdentity, setOnChainIdentity] = useState<{
    roleHash: string;
    roleName: string;
    isActive: boolean;
    registeredAt: number;
  } | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);

  useEffect(() => {
    if (!isOpen || !doctor?.wallet_address) {
      setOnChainIdentity(null);
      return;
    }

    let cancelled = false;
    setLoadingChain(true);

    getIdentityOnChain(doctor.wallet_address)
      .then((res) => {
        if (!cancelled) {
          setOnChainIdentity(res);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOnChainIdentity(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingChain(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, doctor?.wallet_address]);

  if (!isOpen || !doctor) return null;

  const wallet = doctor.wallet_address || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const etherscanUrl = getExplorerAddressUrl(wallet, 11155111);
  const contractUrl = getExplorerAddressUrl(CONTRACT_ADDRESSES.IDENTITY_REGISTRY, 11155111);

  const copyWallet = () => {
    navigator.clipboard.writeText(wallet);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card p-6 w-full max-w-lg space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Doctor Blockchain Identity</h2>
              <p className="text-xs text-slate-400">
                Verified EVM Identity on Sepolia Smart Contract
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Doctor Summary Header Card */}
        <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-sm">
                Dr
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">{doctor.display_name}</h3>
                <p className="text-xs text-slate-400">
                  {doctor.specialization || "General Medicine Practitioner"}
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Licensed Doctor
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800 text-slate-300">
            {doctor.license_number && (
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-slate-400">ID:</span>
                <span className="font-mono text-cyan-300">{doctor.license_number}</span>
              </div>
            )}
            {doctor.hospital_name && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400">Hospital:</span>
                <span className="truncate">{doctor.hospital_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* On-Chain Identity Status Card */}
        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-1.5">
              <Blocks className="w-4 h-4 text-cyan-400" />
              <span>IdentityRegistry On-Chain Status</span>
            </div>
            {loadingChain ? (
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            ) : onChainIdentity?.isActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                <CheckCircle2 className="w-3 h-3" /> Active on Sepolia
              </span>
            ) : (
              <span className="text-[10px] text-cyan-400 font-mono">Sepolia Testnet</span>
            )}
          </div>

          <div className="space-y-2 text-xs">
            {/* Wallet Address */}
            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Ethereum Wallet Address</span>
                <button
                  onClick={copyWallet}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[10px]"
                >
                  {copiedWallet ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-cyan-300 text-xs break-all">{wallet}</span>
                {etherscanUrl && (
                  <a
                    href={etherscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                    title="View wallet on Sepolia Etherscan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Smart Contract Reference */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
              <div>
                <span className="block text-slate-500">Registry Contract:</span>
                <a
                  href={contractUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-cyan-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>0xD7AC...771B</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div>
                <span className="block text-slate-500">Network:</span>
                <span className="text-slate-300">Ethereum Sepolia (11155111)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}
