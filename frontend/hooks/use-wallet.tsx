"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { linkWalletAddress } from "@/services/auth";

export function normalizeChainId(id: string | number | null | undefined): number | null {
  if (id === null || id === undefined || id === "") return null;
  if (typeof id === "number") return id;
  const str = String(id).trim();
  if (str.startsWith("0x") || str.startsWith("0X")) {
    return parseInt(str, 16);
  }
  return parseInt(str, 10);
}

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_HEX_CHAIN_ID = "0xaa36a7";

interface WalletContextType {
  account: string | null;
  chainId: string | null;
  numChainId: number | null;
  networkName: string;
  isConnecting: boolean;
  isSepolia: boolean;
  isSupportedNetwork: boolean;
  error: string | null;
  hasProvider: boolean;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  switchNetwork: (targetChainId?: number) => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  const numChainId = normalizeChainId(chainId);
  const isSepolia = numChainId === SEPOLIA_CHAIN_ID;
  const isSupportedNetwork =
    numChainId === SEPOLIA_CHAIN_ID ||
    numChainId === 31337 ||
    numChainId === 1337 ||
    numChainId === 80002 ||
    numChainId === 1;

  const getNetworkName = (id: string | null): string => {
    const num = normalizeChainId(id);
    if (!num) return "Not Connected";
    switch (num) {
      case 1:
        return "Ethereum Mainnet";
      case SEPOLIA_CHAIN_ID:
        return "Sepolia Testnet";
      case 80002:
        return "Polygon Amoy";
      case 31337:
      case 1337:
        return "Hardhat Localhost";
      default:
        return `Chain ID: ${num}`;
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      setHasProvider(true);
      const ethereum = (window as any).ethereum;

      // Check if already connected
      ethereum
        .request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          }
        })
        .catch(() => {});

      ethereum
        .request({ method: "eth_chainId" })
        .then((currentChainId: string) => {
          setChainId(currentChainId);
        })
        .catch(() => {});

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          linkWalletAddress(accounts[0]).catch(() => {});
        } else {
          setAccount(null);
        }
      };

      const handleChainChanged = (newChainId: string) => {
        setChainId(newChainId);
      };

      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("chainChanged", handleChainChanged);

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener("accountsChanged", handleAccountsChanged);
          ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, []);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setError("No EVM wallet detected (MetaMask/Rabby). Please install a Web3 wallet.");
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts && accounts.length > 0) {
        const selectedAccount = accounts[0];
        setAccount(selectedAccount);

        const currentChainId = await ethereum.request({ method: "eth_chainId" });
        setChainId(currentChainId);

        try {
          await linkWalletAddress(selectedAccount);
        } catch {
          // Non-blocking if offline
        }

        return selectedAccount;
      }
      return null;
    } catch (err: any) {
      if (err.code === 4001) {
        setError("User rejected connection request in wallet.");
      } else {
        setError(err.message || "Failed to connect Web3 wallet.");
      }
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(
    async (targetChainId: number = SEPOLIA_CHAIN_ID): Promise<boolean> => {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        setError("No Web3 wallet available to switch network.");
        return false;
      }

      const ethereum = (window as any).ethereum;
      const hexChainId = `0x${targetChainId.toString(16)}`;

      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        });
        const currentChainId = await ethereum.request({ method: "eth_chainId" });
        setChainId(currentChainId);
        setError(null);
        return true;
      } catch (switchError: any) {
        // Error code 4902 means the chain has not been added to MetaMask
        if (switchError.code === 4902 && targetChainId === SEPOLIA_CHAIN_ID) {
          try {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: SEPOLIA_HEX_CHAIN_ID,
                  chainName: "Sepolia Test Network",
                  nativeCurrency: {
                    name: "Sepolia ETH",
                    symbol: "SEP",
                    decimals: 18,
                  },
                  rpcUrls: [
                    "https://sepolia.infura.io/v3/e4d498c7ac8743e6ae8cecb576b8bbce",
                    "https://rpc.sepolia.org",
                    "https://rpc2.sepolia.org",
                  ],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
            const currentChainId = await ethereum.request({ method: "eth_chainId" });
            setChainId(currentChainId);
            setError(null);
            return true;
          } catch (addError: any) {
            setError(addError.message || "Failed to add Sepolia testnet to wallet.");
            return false;
          }
        } else if (switchError.code === 4001) {
          setError("Network switch was cancelled in wallet.");
        } else {
          setError(switchError.message || "Failed to switch network.");
        }
        return false;
      }
    },
    []
  );

  const disconnectWallet = useCallback(() => {
    setAccount(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        chainId,
        numChainId,
        networkName: getNetworkName(chainId),
        isConnecting,
        isSepolia,
        isSupportedNetwork,
        error,
        hasProvider,
        connectWallet,
        disconnectWallet,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
