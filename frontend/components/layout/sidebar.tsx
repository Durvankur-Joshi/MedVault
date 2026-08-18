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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Records", icon: FileText },
  { href: "/consent", label: "Consent", icon: ShieldCheck },
  { href: "/access-requests", label: "Access Requests", icon: Inbox },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

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
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center transition-transform group-hover:scale-110">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-[var(--foreground)]">MedVault</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${
                    isActive
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                  }
                `}
              >
                <Icon className={`w-[18px] h-[18px] ${isActive ? "text-[var(--accent)]" : ""}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom */}
        {user && (
          <div className="px-4 py-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center text-xs font-bold text-white">
                {user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {user.email.split("@")[0]}
                </p>
                <p className="text-xs text-[var(--muted)] capitalize">
                  {user.role.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
