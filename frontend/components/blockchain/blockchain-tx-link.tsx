"use client";

import React, { useState } from "react";
import { ExternalLink, Copy, Check, AlertCircle } from "lucide-react";
import {
  getExplorerTxUrl,
  getExplorerAddressUrl,
  isValidTxHash,
  isValidAddress,
  truncateHash,
  DEFAULT_CHAIN_ID,
} from "@/lib/explorer";

interface BlockchainTxLinkProps {
  hash: string | null | undefined;
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
  chainId = DEFAULT_CHAIN_ID,
  truncate = true,
  startLen = 6,
  endLen = 4,
  showCopy = true,
  showExplorerButton = true,
  label,
  className = "",
}: BlockchainTxLinkProps) {
  const [copied, setCopied] = useState(false);

  if (!hash || hash.trim() === "" || hash.trim() === "—") {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-slate-400 ${className}`}>
        {label && <span className="text-slate-400 font-normal">{label}:</span>}
        <span className="font-mono text-slate-500">—</span>
        <span className="text-[11px] text-slate-400 italic">
          (Blockchain transaction not available yet)
        </span>
      </div>
    );
  }

  const cleanHash = hash.trim();
  const isValid = type === "address" ? isValidAddress(cleanHash) : isValidTxHash(cleanHash);

  if (!isValid) {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        {label && <span className="text-slate-400 text-xs">{label}:</span>}
        <span className="font-mono text-xs text-amber-400/90" title={cleanHash}>
          {truncate ? truncateHash(cleanHash, startLen, endLen) : cleanHash}
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded">
          <AlertCircle className="w-2.5 h-2.5" />
          <span>Invalid transaction hash</span>
        </span>
      </div>
    );
  }

  const currentChainId = chainId || DEFAULT_CHAIN_ID;
  const explorerUrl =
    type === "address"
      ? getExplorerAddressUrl(cleanHash, currentChainId)
      : getExplorerTxUrl(cleanHash, currentChainId);

  const displayString = truncate ? truncateHash(cleanHash, startLen, endLen) : cleanHash;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(cleanHash);
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
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-mono text-cyan-400 hover:text-cyan-300 hover:underline transition-colors group"
          title={`View on Sepolia Etherscan (${cleanHash})`}
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
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 hover:text-cyan-100 border border-cyan-500/40 rounded-lg transition-all ml-1 shadow-sm group"
          title={`View transaction on Sepolia Etherscan`}
        >
          <span>View on Explore</span>
          <ExternalLink className="w-3 h-3 text-cyan-400 group-hover:text-cyan-200 transition-colors shrink-0" />
        </a>
      )}
    </div>
  );
}

