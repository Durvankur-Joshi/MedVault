"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User, UserRole, TokenResponse } from "@/types";
import { apiClient, getToken, setToken, clearToken } from "@/lib/api-client";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    role: UserRole
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(raw: User): User {
  return {
    id: raw.id,
    email: raw.email,
    role: raw.role,
    isActive: raw.is_active ?? raw.isActive ?? true,
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const token = getToken();
      if (!token) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const currentUser = await apiClient.get<User>("/api/auth/me");
        if (isMounted) {
          setUser(normalizeUser(currentUser));
        }
      } catch {
        // Token invalid or expired
        clearToken();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.post<TokenResponse>("/api/auth/login", {
      email,
      password,
    });
    setToken(response.access_token);
    setUser(normalizeUser(response.user));
  }, []);

  const register = useCallback(
    async (email: string, password: string, role: UserRole) => {
      await apiClient.post<User>("/api/auth/register", {
        email,
        password,
        role,
      });
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
