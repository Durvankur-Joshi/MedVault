/**
 * Blockchain Explorer URL Helpers for MedVault.
 * Resolves transaction, address, and contract links for Ethereum Sepolia EVM network.
 */

export const SEPOLIA_CHAIN_ID = 11155111;
export const DEFAULT_CHAIN_ID = SEPOLIA_CHAIN_ID;
export const SEPOLIA_EXPLORER_BASE = "https://sepolia.etherscan.io";

export const CHAIN_CONFIG: Record<
  number,
  { name: string; explorerUrl: string; isTestnet?: boolean }
> = {
  11155111: {
    name: "Sepolia Testnet",
    explorerUrl: "https://sepolia.etherscan.io",
    isTestnet: true,
  },
  1: {
    name: "Ethereum Mainnet",
    explorerUrl: "https://etherscan.io",
    isTestnet: false,
  },
  80002: {
    name: "Polygon Amoy",
    explorerUrl: "https://amoy.polygonscan.com",
    isTestnet: true,
  },
  31337: {
    name: "Hardhat Localhost",
    explorerUrl: "https://sepolia.etherscan.io",
    isTestnet: true,
  },
  1337: {
    name: "Localhost",
    explorerUrl: "https://sepolia.etherscan.io",
    isTestnet: true,
  },
};

/**
 * Validate standard 32-byte Ethereum transaction hash (0x + 64 hex characters).
 */
export function isValidTxHash(hash?: string | null): boolean {
  if (!hash || typeof hash !== "string") return false;
  const clean = hash.trim();
  return /^0x[0-9a-fA-F]{64}$/.test(clean);
}

/**
 * Validate standard 20-byte Ethereum address (0x + 40 hex characters).
 */
export function isValidAddress(address?: string | null): boolean {
  if (!address || typeof address !== "string") return false;
  const clean = address.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(clean);
}

/**
 * Generate full explorer URL for an Ethereum transaction hash.
 * Defaults reliably to Ethereum Sepolia Testnet.
 */
export function getExplorerTxUrl(
  txHash?: string | null,
  chainId: number = DEFAULT_CHAIN_ID
): string | null {
  if (!isValidTxHash(txHash)) return null;
  const cleanHash = txHash!.trim();
  const config = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[DEFAULT_CHAIN_ID];
  const baseUrl = config?.explorerUrl || SEPOLIA_EXPLORER_BASE;
  return `${baseUrl}/tx/${cleanHash}`;
}

/**
 * Generate full explorer URL for an Ethereum address.
 * Defaults reliably to Ethereum Sepolia Testnet.
 */
export function getExplorerAddressUrl(
  address?: string | null,
  chainId: number = DEFAULT_CHAIN_ID
): string | null {
  if (!isValidAddress(address)) return null;
  const cleanAddr = address!.trim();
  const config = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[DEFAULT_CHAIN_ID];
  const baseUrl = config?.explorerUrl || SEPOLIA_EXPLORER_BASE;
  return `${baseUrl}/address/${cleanAddr}`;
}

export function truncateHash(
  hash?: string | null,
  startLen: number = 6,
  endLen: number = 4
): string {
  if (!hash) return "—";
  const clean = hash.trim();
  if (clean.length <= startLen + endLen + 2) return clean;
  return `${clean.slice(0, startLen)}...${clean.slice(-endLen)}`;
}

