"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Inbox,
  ScrollText,
  X,
  Heart,
  Stethoscope,
  UserCheck,
  Building2,
  Shield,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  sublabel?: string;
  icon: typeof LayoutDashboard;
}

const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  patient: [
    { href: "/dashboard", label: "My Dashboard", sublabel: "Overview & Health Metrics", icon: LayoutDashboard },
    { href: "/records", label: "My Medical Records", sublabel: "Personal Encrypted Files", icon: FileText },
    { href: "/consent", label: "My Consents", sublabel: "Authorizations Given", icon: ShieldCheck },
    { href: "/access-requests", label: "Incoming Requests", sublabel: "Doctor Inquiries", icon: Inbox },
    { href: "/audit", label: "My Audit Trail", sublabel: "Activity & Blockchain Log", icon: ScrollText },
  ],
  doctor: [
    { href: "/dashboard", label: "Clinical Dashboard", sublabel: "Practice Overview", icon: LayoutDashboard },
    { href: "/records", label: "Patient Records", sublabel: "Authorized Clinical Files", icon: FileText },
    { href: "/consent", label: "Granted Consents", sublabel: "Active Patient Access", icon: ShieldCheck },
    { href: "/access-requests", label: "Access Requests & ZK", sublabel: "Patient Search & Proofs", icon: Inbox },
    { href: "/audit", label: "Clinical Audit Trail", sublabel: "Cryptographic Evidence", icon: ScrollText },
  ],
  hospital_admin: [
    { href: "/dashboard", label: "Hospital Dashboard", sublabel: "Facility Overview", icon: LayoutDashboard },
    { href: "/records", label: "Institutional Records", sublabel: "Clinical Datasets", icon: FileText },
    { href: "/consent", label: "Facility Consents", sublabel: "Department Permissions", icon: ShieldCheck },
    { href: "/access-requests", label: "Access Management", sublabel: "Staff Access Queue", icon: Inbox },
    { href: "/audit", label: "Institutional Logs", sublabel: "Compliance Ledger", icon: ScrollText },
  ],
  admin: [
    { href: "/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
    { href: "/records", label: "Records Management", icon: FileText },
    { href: "/consent", label: "Consent Registry", icon: ShieldCheck },
    { href: "/access-requests", label: "Access Requests", icon: Inbox },
    { href: "/audit", label: "System Audit Log", icon: ScrollText },
  ],
};

const DEFAULT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Records", icon: FileText },
  { href: "/consent", label: "Consent", icon: ShieldCheck },
  { href: "/access-requests", label: "Access Requests", icon: Inbox },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = user ? ROLE_NAV_ITEMS[user.role] || DEFAULT_NAV : DEFAULT_NAV;
  const isPatient = user?.role === "patient";
  const isDoctor = user?.role === "doctor";

  // Accent gradient based on role
  const logoGradient = isPatient
    ? "from-emerald-500 to-teal-600"
    : isDoctor
    ? "from-cyan-500 to-blue-600"
    : "from-[var(--accent)] to-[var(--accent-secondary)]";

  const activeNavClass = isPatient
    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm"
    : isDoctor
    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-sm"
    : "bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm";

  const activeIconClass = isPatient
    ? "text-emerald-400"
    : isDoctor
    ? "text-cyan-400"
    : "text-[var(--accent)]";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 
          bg-[var(--sidebar-bg)] border-r border-[var(--border)]
          flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo & Portal Header */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${logoGradient} flex items-center justify-center transition-transform group-hover:scale-105 shadow-md`}>
                <Heart className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-[var(--foreground)] leading-tight">MedVault</span>
                <span className="text-[10px] font-semibold tracking-wide uppercase text-[var(--muted)]">
                  {isPatient ? "Patient Portal" : isDoctor ? "Doctor Portal" : "Decentralized Ledger"}
                </span>
              </div>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map(({ href, label, sublabel, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium
                  transition-all duration-200 group
                  ${
                    isActive
                      ? activeNavClass
                      : "text-slate-400 hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? activeIconClass : "text-slate-500 group-hover:text-slate-300"}`} />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{label}</span>
                  {sublabel && (
                    <span className="text-[10px] text-slate-500 font-normal truncate">
                      {sublabel}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Area at bottom */}
        {user && (
          <div className="p-3.5 border-t border-[var(--border)] bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${logoGradient} flex items-center justify-center text-xs font-bold text-white shrink-0 shadow`}>
                {isDoctor ? (
                  <Stethoscope className="w-4 h-4" />
                ) : isPatient ? (
                  <UserCheck className="w-4 h-4" />
                ) : (
                  user.email[0].toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--foreground)] truncate">
                  {isDoctor ? `Dr. ${user.email.split("@")[0]}` : user.email.split("@")[0]}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isPatient ? "text-emerald-400" : isDoctor ? "text-cyan-400" : "text-slate-400"}`}>
                    {user.role.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-slate-600">·</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

