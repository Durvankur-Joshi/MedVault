"use client";

import React, { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { Wallet, ShieldCheck, ExternalLink, ChevronDown, Check, LogOut } from "lucide-react";

export function WalletButton() {
  const { account, networkName, isConnecting, error, connectWallet, disconnectWallet } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!account) {
    return (
      <div>
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 rounded-lg hover:bg-cyan-900/50 transition-colors disabled:opacity-50"
        >
          <Wallet className="w-3.5 h-3.5" />
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
        {error && (
          <div className="absolute right-4 top-16 z-50 p-2 bg-red-950/90 border border-red-500/40 rounded text-xs text-red-200 shadow-xl max-w-xs">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 border border-slate-700/60 rounded-lg hover:bg-slate-700/60 transition-colors shadow-sm"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono">{formatAddress(account)}</span>
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-950/60 text-cyan-400 border border-cyan-500/20 rounded">
          {networkName}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 p-3 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Web3 Identity</span>
            </div>
            <span className="text-[10px] text-slate-400">{networkName}</span>
          </div>

          <div className="p-2 mb-2 bg-slate-950/80 rounded border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-300 truncate max-w-[160px]">{account}</span>
            <button
              onClick={copyAddress}
              className="text-slate-400 hover:text-slate-200 p-1"
              title="Copy Address"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            Wallet linked to MedVault ledger. Records & consents are anchored with cryptographic proofs.
          </div>

          <button
            onClick={() => {
              disconnectWallet();
              setDropdownOpen(false);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/30 border border-red-500/20 rounded-lg transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
