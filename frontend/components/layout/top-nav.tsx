"use client";

import { Menu, LogOut, Shield, Blocks, Stethoscope, UserCheck, Building2, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types";
import { useRouter } from "next/navigation";
import { WalletButton } from "@/components/wallet/wallet-button";

interface TopNavProps {
  onMenuClick: () => void;
}

const PORTAL_CONFIG: Record<
  UserRole,
  { label: string; tag: string; color: string; badgeColor: string; icon: typeof UserCheck }
> = {
  patient: {
    label: "Patient Portal",
    tag: "Personal Health Ledger",
    color: "text-emerald-400",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-emerald-950/40",
    icon: UserCheck,
  },
  doctor: {
    label: "Doctor Portal",
    tag: "Clinical Workspace",
    color: "text-cyan-400",
    badgeColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-cyan-950/40",
    icon: Stethoscope,
  },
  hospital_admin: {
    label: "Hospital Portal",
    tag: "Institutional Workspace",
    color: "text-amber-400",
    badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-amber-950/40",
    icon: Building2,
  },
  admin: {
    label: "Admin Portal",
    tag: "System Administration",
    color: "text-purple-400",
    badgeColor: "bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-purple-950/40",
    icon: Shield,
  },
};

export function TopNav({ onMenuClick }: TopNavProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const portal = user ? PORTAL_CONFIG[user.role] : null;
  const PortalIcon = portal?.icon || User;

  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--sidebar-bg)]/80 backdrop-blur-xl border-b border-[var(--border)]">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: mobile menu + Portal Badge + Security badges */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Prominent Portal Badge */}
          {portal && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all ${portal.badgeColor}`}
            >
              <PortalIcon className="w-4 h-4" />
              <span className="font-bold tracking-tight">{portal.label}</span>
              <span className="hidden md:inline text-[10px] opacity-75 font-normal border-l border-current/30 pl-2">
                {portal.tag}
              </span>
            </div>
          )}

          <div className="hidden xl:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold tracking-wide">
              <Shield className="w-3.5 h-3.5" />
              AES-256 Encrypted
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px] font-semibold tracking-wide">
              <Blocks className="w-3.5 h-3.5" />
              Blockchain Anchored
            </span>
          </div>
        </div>

        {/* Right: Web3 Wallet + User role + logout */}
        {user && (
          <div className="flex items-center gap-3">
            <WalletButton />

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

