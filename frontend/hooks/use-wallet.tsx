"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { linkWalletAddress } from "@/services/auth";

interface WalletContextType {
  account: string | null;
  chainId: string | null;
  networkName: string;
  isConnecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  const getNetworkName = (id: string | null): string => {
    if (!id) return "Unknown";
    const numId = parseInt(id, 16);
    switch (numId) {
      case 1:
        return "Ethereum Mainnet";
      case 11155111:
        return "Sepolia Testnet";
      case 80002:
        return "Polygon Amoy";
      case 31337:
      case 1337:
        return "Hardhat Localhost";
      default:
        return `Chain ID: ${numId}`;
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
          // Sync with backend
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

        // Link with MedVault backend user account
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

  const disconnectWallet = useCallback(() => {
    setAccount(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        chainId,
        networkName: getNetworkName(chainId),
        isConnecting,
        error,
        hasProvider,
        connectWallet,
        disconnectWallet,
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
