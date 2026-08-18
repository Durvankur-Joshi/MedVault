"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { User, UserRole } from "@/types";

// ─── DEMO ONLY ──────────────────────────────────────────────────────
// This is a placeholder authentication context for development.
// It will be replaced with real JWT/wallet authentication in Phase 2.
// ─────────────────────────────────────────────────────────────────────

const DEMO_USERS: Record<UserRole, User> = {
  patient: {
    id: "demo-patient-001",
    email: "patient@medvault.demo",
    role: "patient",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  doctor: {
    id: "demo-doctor-001",
    email: "doctor@medvault.demo",
    role: "doctor",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  hospital_admin: {
    id: "demo-admin-001",
    email: "admin@medvault.demo",
    role: "hospital_admin",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((role: UserRole) => {
    setUser(DEMO_USERS[role]);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    setUser(DEMO_USERS[role]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        login,
        logout,
        switchRole,
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
