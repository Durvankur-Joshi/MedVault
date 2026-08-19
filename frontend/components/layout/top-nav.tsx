"use client";

import { Menu, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types";
import { useRouter } from "next/navigation";

interface TopNavProps {
  onMenuClick: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  hospital_admin: "Hospital Admin",
};

const ROLE_COLORS: Record<UserRole, string> = {
  patient: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  doctor: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  hospital_admin: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
};

export function TopNav({ onMenuClick }: TopNavProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--sidebar-bg)]/80 backdrop-blur-xl border-b border-[var(--border)]">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: mobile menu + status badge */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold tracking-wide">
              <Shield className="w-3.5 h-3.5" />
              Phase 2 Active
            </span>
          </div>
        </div>

        {/* Right: Authenticated user role + logout */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Role badge */}
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[user.role] || "bg-gray-500/20 text-gray-300"}`}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
