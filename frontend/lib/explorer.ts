/**
 * Blockchain Explorer URL Helpers for MedVault.
 * Resolves transaction, address, and contract links dynamically based on EVM chain ID.
 */

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
    explorerUrl: "",
    isTestnet: true,
  },
  1337: {
    name: "Localhost",
    explorerUrl: "",
    isTestnet: true,
  },
};

export const DEFAULT_CHAIN_ID = 11155111; // Sepolia Testnet for Hackathon

export function getExplorerTxUrl(
  txHash?: string | null,
  chainId: number = DEFAULT_CHAIN_ID
): string | null {
  if (!txHash) return null;
  const config = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[DEFAULT_CHAIN_ID];
  if (!config.explorerUrl) return null;
  return `${config.explorerUrl}/tx/${txHash.trim()}`;
}

export function getExplorerAddressUrl(
  address?: string | null,
  chainId: number = DEFAULT_CHAIN_ID
): string | null {
  if (!address) return null;
  const config = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[DEFAULT_CHAIN_ID];
  if (!config.explorerUrl) return null;
  return `${config.explorerUrl}/address/${address.trim()}`;
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
