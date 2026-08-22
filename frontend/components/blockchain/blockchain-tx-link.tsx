"use client";

import React, { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { getExplorerTxUrl, getExplorerAddressUrl, truncateHash, DEFAULT_CHAIN_ID } from "@/lib/explorer";
import { useWallet } from "@/hooks/use-wallet";

interface BlockchainTxLinkProps {
  hash: string;
  type?: "tx" | "address";
  chainId?: number;
  truncate?: boolean;
  startLen?: number;
  endLen?: number;
  showCopy?: boolean;
  showExplorerButton?: boolean;
  label?: string;
  className?: string;
}

export function BlockchainTxLink({
  hash,
  type = "tx",
  chainId,
  truncate = true,
  startLen = 6,
  endLen = 4,
  showCopy = true,
  showExplorerButton = true,
  label,
  className = "",
}: BlockchainTxLinkProps) {
  const { chainId: walletChainId } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!hash) return <span className="text-slate-500 font-mono text-xs">—</span>;

  const currentChainId =
    chainId ||
    (walletChainId
      ? walletChainId.startsWith("0x")
        ? parseInt(walletChainId, 16)
        : parseInt(walletChainId, 10)
      : DEFAULT_CHAIN_ID);

  const explorerUrl =
    type === "address"
      ? getExplorerAddressUrl(hash, currentChainId)
      : getExplorerTxUrl(hash, currentChainId);

  const displayString = truncate ? truncateHash(hash, startLen, endLen) : hash;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {label && <span className="text-slate-400 text-xs">{label}:</span>}

      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-cyan-400 hover:text-cyan-300 hover:underline transition-colors group"
          title={`View on Blockchain Explorer (${hash})`}
        >
          <span>{displayString}</span>
          <ExternalLink className="w-3 h-3 text-cyan-500 group-hover:text-cyan-300 shrink-0" />
        </a>
      ) : (
        <span className="font-mono text-slate-300">{displayString}</span>
      )}

      {showCopy && (
        <button
          onClick={handleCopy}
          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800/80 transition-colors"
          title="Copy full hash"
          type="button"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      )}

      {showExplorerButton && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 rounded transition-all ml-1"
        >
          <span>View on Explorer</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
}
