"use client";

import { Menu, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef, useEffect } from "react";
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
  patient: "bg-emerald-500/20 text-emerald-400",
  doctor: "bg-blue-500/20 text-blue-400",
  hospital_admin: "bg-amber-500/20 text-amber-400",
};

export function TopNav({ onMenuClick }: TopNavProps) {
  const { user, switchRole, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--sidebar-bg)]/80 backdrop-blur-xl border-b border-[var(--border)]">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: mobile menu + breadcrumb area */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-medium">
              Phase 1 — Demo Mode
            </span>
          </div>
        </div>

        {/* Right: role switcher + logout */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Role badge */}
            <span
              className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>

            {/* Role switcher dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
              >
                Switch Role
                <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        switchRole(role);
                        setIsDropdownOpen(false);
                      }}
                      className={`
                        w-full text-left px-4 py-2 text-sm transition-colors
                        ${user.role === role ? "text-[var(--accent)] bg-[var(--accent)]/5" : "text-[var(--foreground)] hover:bg-[var(--hover)]"}
                      `}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="p-2 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
