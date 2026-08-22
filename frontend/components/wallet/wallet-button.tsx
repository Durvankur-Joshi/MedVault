"use client";

import React, { useState } from "react";
import { useWallet, SEPOLIA_CHAIN_ID } from "@/hooks/use-wallet";
import {
  Wallet,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  Check,
  LogOut,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { BlockchainTxLink } from "@/components/blockchain/blockchain-tx-link";

export function WalletButton() {
  const {
    account,
    chainId,
    numChainId,
    networkName,
    isConnecting,
    isSepolia,
    isSupportedNetwork,
    error,
    connectWallet,
    disconnectWallet,
    switchNetwork,
  } = useWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleSwitchToSepolia = async () => {
    setSwitchingNetwork(true);
    try {
      await switchNetwork(SEPOLIA_CHAIN_ID);
    } finally {
      setSwitchingNetwork(false);
    }
  };

  if (!account) {
    return (
      <div className="relative">
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-cyan-400 bg-cyan-950/50 border border-cyan-500/40 rounded-lg hover:bg-cyan-900/60 hover:border-cyan-400/60 transition-all shadow-sm disabled:opacity-50"
        >
          <Wallet className="w-3.5 h-3.5" />
          {isConnecting ? "Connecting..." : "Connect Web3 Wallet"}
        </button>
        {error && (
          <div className="absolute right-0 top-12 z-50 p-2.5 bg-red-950/95 border border-red-500/50 rounded-lg text-xs text-red-200 shadow-2xl max-w-xs animate-fade-in">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Network is considered valid if it's Sepolia (production testnet) or Hardhat/Localhost (offline dev)
  const isRecommendedNetwork = isSepolia || numChainId === 31337 || numChainId === 1337;

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all shadow-sm ${
          !isRecommendedNetwork
            ? "text-amber-300 bg-amber-950/40 border border-amber-500/40 hover:bg-amber-900/50"
            : "text-slate-200 bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700/60"
        }`}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            isRecommendedNetwork ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
          }`}
        />
        <span className="font-mono">{formatAddress(account)}</span>
        <span
          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
            isRecommendedNetwork
              ? "bg-cyan-950/60 text-cyan-400 border-cyan-500/20"
              : "bg-amber-950/60 text-amber-300 border-amber-500/30"
          }`}
        >
          {networkName}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 p-3.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-50 animate-fade-in space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Web3 Ledger Identity</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{networkName}</span>
          </div>

          <div className="p-2.5 bg-slate-950/90 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 mb-1">Connected Address</div>
            <BlockchainTxLink
              hash={account}
              type="address"
              truncate={true}
              startLen={10}
              endLen={6}
              showExplorerButton={true}
            />
          </div>

          {!isRecommendedNetwork && (
            <div className="p-2.5 bg-amber-950/50 border border-amber-500/40 rounded-lg text-xs text-amber-200 space-y-2">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>Please switch to <strong>Sepolia Testnet</strong>.</span>
              </div>
              <button
                onClick={handleSwitchToSepolia}
                disabled={switchingNetwork}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 rounded text-xs font-semibold transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${switchingNetwork ? "animate-spin" : ""}`} />
                {switchingNetwork ? "Switching..." : "Switch to Sepolia"}
              </button>
            </div>
          )}

          <div className="text-[11px] text-slate-400 leading-relaxed">
            Linked to MedVault. Cryptographic commitments and consent authorizations are verified on-chain.
          </div>

          <button
            onClick={() => {
              disconnectWallet();
              setDropdownOpen(false);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 border border-red-500/20 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
}
