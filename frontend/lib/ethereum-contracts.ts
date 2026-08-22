/**
 * Ethereum Smart Contract Integration for MedVault.
 * Interacts directly with Sepolia EVM contracts using MetaMask / Web3 Provider.
 */

export const CONTRACT_ADDRESSES = {
  CONSENT_MANAGER: "0xDA0bab807633f07f013f94DD0E6A4F96F8742B53",
  MEDICAL_RECORD_REGISTRY: "0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47",
  IDENTITY_REGISTRY: "0xD7ACd2a9FD159E69Bb102A1ca21C9a3e3A5F771B",
  ZK_VERIFIER: "0x358AA13c52544ECCEF6B0ADD0f801012ADAD5eE3",
};

// Known Role Hashes in IdentityRegistry
export const ROLES: Record<string, string> = {
  "0x892a06141a27e025da26b0db37b2d5eb92f741da80a562629b36021570ff2270": "Patient",
  "0x6d9eb4fae2db8f08a543f32400f135b8637cf21b1b46a9a089069d2d0c242fa5": "Doctor",
  "0x89a05c317b3f0df6eb883fa9ccf458dbe9ee053ba49dfd3d4bfae6e9ff3f3174": "Hospital Admin",
  "0x70529d3c522199b0c793ff0624ceea8e45ccad91e1dcf6960d70425c27031826": "Emergency Provider",
};

// Function Selectors (EVM 4-byte Keccak-256 signatures)
const SELECTORS = {
  grantConsent: "0x8e642e97", // grantConsent(bytes32,address,uint8,uint256)
  revokeConsent: "0x003ff040", // revokeConsent(bytes32,address)
  registerRecord: "0xcf478ed6", // registerRecord(bytes32,bytes32,bytes32,bytes32)
  getIdentity: "0x2fea7b81", // getIdentity(address)
};

/**
 * Clean and pad hex string to 32 bytes (64 characters).
 */
export function pad32(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return clean.padStart(64, "0");
}

/**
 * Encode Ethereum address to 32-byte ABI word.
 */
export function encodeAddress(address: string): string {
  const clean = address.toLowerCase().startsWith("0x") ? address.slice(2) : address;
  return clean.padStart(64, "0");
}

/**
 * Encode unsigned integer to 32-byte ABI word.
 */
export function encodeUint(val: number | bigint): string {
  const hex = BigInt(val).toString(16);
  return hex.padStart(64, "0");
}

/**
 * Derive 32-byte hex bytes32 identifier from record ID or hash.
 */
export async function toBytes32(val: string): Promise<string> {
  const clean = val.startsWith("0x") ? val.slice(2) : val;
  if (clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean)) {
    return clean;
  }
  // Compute SHA-256 hash using Web Crypto API
  const msgUint8 = new TextEncoder().encode(val);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Wait for transaction receipt by polling eth_getTransactionReceipt.
 */
export async function waitForTransactionReceipt(
  txHash: string,
  maxWaitMs: number = 60000
): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    return true;
  }
  const ethereum = (window as any).ethereum;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const receipt = await ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
      if (receipt) {
        return receipt.status === "0x1" || receipt.status === 1;
      }
    } catch {
      // Ignore network hiccup
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return true;
}

export type TransactionLifecycleStatus =
  | "idle"
  | "waiting_for_signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "error"
  | "rejected";

/**
 * Execute grantConsent on ConsentManager smart contract.
 */
export async function grantConsentOnChain(
  recordId: string,
  doctorAddress: string,
  permissions: number = 1,
  expiresAtUnix: number,
  onStatusChange?: (status: TransactionLifecycleStatus, txHash?: string) => void
): Promise<{ txHash: string }> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No EVM wallet detected. Please connect MetaMask.");
  }
  const ethereum = (window as any).ethereum;
  const accounts = await ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("Wallet not connected. Please connect your Web3 wallet.");
  }

  const userAddress = accounts[0];
  const recordIdBytes32 = await toBytes32(recordId);

  // ABI encode: [selector][recordId][grantee][permissions][expiresAt]
  const calldata =
    SELECTORS.grantConsent +
    pad32(recordIdBytes32) +
    encodeAddress(doctorAddress) +
    encodeUint(permissions) +
    encodeUint(expiresAtUnix);

  onStatusChange?.("waiting_for_signature");

  try {
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: userAddress,
          to: CONTRACT_ADDRESSES.CONSENT_MANAGER,
          data: calldata,
        },
      ],
    });

    onStatusChange?.("submitted", txHash);
    onStatusChange?.("confirming", txHash);

    await waitForTransactionReceipt(txHash, 45000);
    onStatusChange?.("confirmed", txHash);

    return { txHash };
  } catch (err: any) {
    if (err.code === 4001 || err.message?.includes("rejected")) {
      onStatusChange?.("rejected");
      throw new Error("Transaction rejected in wallet.");
    }
    onStatusChange?.("error");
    throw new Error(err.message || "Failed to execute on-chain consent transaction.");
  }
}

/**
 * Execute revokeConsent on ConsentManager smart contract.
 */
export async function revokeConsentOnChain(
  recordId: string,
  doctorAddress: string,
  onStatusChange?: (status: TransactionLifecycleStatus, txHash?: string) => void
): Promise<{ txHash: string }> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No EVM wallet detected. Please connect MetaMask.");
  }
  const ethereum = (window as any).ethereum;
  const accounts = await ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("Wallet not connected. Please connect your Web3 wallet.");
  }

  const userAddress = accounts[0];
  const recordIdBytes32 = await toBytes32(recordId);

  const calldata =
    SELECTORS.revokeConsent + pad32(recordIdBytes32) + encodeAddress(doctorAddress);

  onStatusChange?.("waiting_for_signature");

  try {
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: userAddress,
          to: CONTRACT_ADDRESSES.CONSENT_MANAGER,
          data: calldata,
        },
      ],
    });

    onStatusChange?.("submitted", txHash);
    onStatusChange?.("confirming", txHash);

    await waitForTransactionReceipt(txHash, 45000);
    onStatusChange?.("confirmed", txHash);

    return { txHash };
  } catch (err: any) {
    if (err.code === 4001 || err.message?.includes("rejected")) {
      onStatusChange?.("rejected");
      throw new Error("Transaction rejected in wallet.");
    }
    onStatusChange?.("error");
    throw new Error(err.message || "Failed to revoke consent on-chain.");
  }
}

/**
 * Execute registerRecord on MedicalRecordRegistry smart contract.
 */
export async function anchorRecordOnChain(
  recordId: string,
  recordHash: string,
  patientCommitment: string,
  storageCommitment: string,
  onStatusChange?: (status: TransactionLifecycleStatus, txHash?: string) => void
): Promise<{ txHash: string }> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No EVM wallet detected. Please connect MetaMask.");
  }
  const ethereum = (window as any).ethereum;
  const accounts = await ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("Wallet not connected. Please connect your Web3 wallet.");
  }

  const userAddress = accounts[0];
  const recordIdBytes32 = await toBytes32(recordId);
  const hashBytes32 = await toBytes32(recordHash);
  const patientBytes32 = await toBytes32(patientCommitment);
  const storageBytes32 = await toBytes32(storageCommitment);

  const calldata =
    SELECTORS.registerRecord +
    pad32(recordIdBytes32) +
    pad32(hashBytes32) +
    pad32(patientBytes32) +
    pad32(storageBytes32);

  onStatusChange?.("waiting_for_signature");

  try {
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: userAddress,
          to: CONTRACT_ADDRESSES.MEDICAL_RECORD_REGISTRY,
          data: calldata,
        },
      ],
    });

    onStatusChange?.("submitted", txHash);
    onStatusChange?.("confirming", txHash);

    await waitForTransactionReceipt(txHash, 45000);
    onStatusChange?.("confirmed", txHash);

    return { txHash };
  } catch (err: any) {
    if (err.code === 4001 || err.message?.includes("rejected")) {
      onStatusChange?.("rejected");
      throw new Error("Transaction rejected in wallet.");
    }
    onStatusChange?.("error");
    throw new Error(err.message || "Failed to anchor record commitment on blockchain.");
  }
}

/**
 * Read Identity details from IdentityRegistry contract.
 */
export async function getIdentityOnChain(
  walletAddress: string
): Promise<{
  roleHash: string;
  roleName: string;
  isActive: boolean;
  registeredAt: number;
} | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    return null;
  }
  const ethereum = (window as any).ethereum;

  const calldata = SELECTORS.getIdentity + encodeAddress(walletAddress);

  try {
    const result = await ethereum.request({
      method: "eth_call",
      params: [
        {
          to: CONTRACT_ADDRESSES.IDENTITY_REGISTRY,
          data: calldata,
        },
        "latest",
      ],
    });

    if (!result || result === "0x" || result.length < 130) {
      return null;
    }

    const clean = result.slice(2);
    const roleHash = `0x${clean.slice(0, 64)}`;
    const isActive = parseInt(clean.slice(64, 128), 16) === 1;
    const registeredAt = parseInt(clean.slice(128, 192), 16);

    const roleName = ROLES[roleHash.toLowerCase()] || "Verified User";

    return {
      roleHash,
      roleName,
      isActive,
      registeredAt,
    };
  } catch {
    // If account not registered or call reverted
    return null;
  }
}
