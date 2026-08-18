"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, ShieldCheck, Inbox, ScrollText, Activity } from "lucide-react";
import { getHealth } from "@/services/health";

const STAT_CARDS = [
  { label: "Medical Records", value: "—", icon: FileText, color: "from-sky-500 to-blue-600" },
  { label: "Active Consents", value: "—", icon: ShieldCheck, color: "from-emerald-500 to-teal-600" },
  { label: "Pending Requests", value: "—", icon: Inbox, color: "from-amber-500 to-orange-600" },
  { label: "Audit Events", value: "—", icon: ScrollText, color: "from-violet-500 to-purple-600" },
];

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    getHealth()
      .then((res) => {
        setBackendStatus(res.status === "ok" ? "online" : "offline");
      })
      .catch(() => {
        setBackendStatus("offline");
      });
  }, []);

  if (!isAuthenticated || !user) return null;

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto">
        {/* Greeting */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Welcome back, {user.email.split("@")[0]}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Role: <span className="capitalize">{user.role.replace("_", " ")}</span> · Phase 1 Dashboard
          </p>
        </div>

        {/* Backend status */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: "80ms" }}>
          <div className="glass-card px-5 py-3 inline-flex items-center gap-3">
            <Activity className="w-4 h-4 text-[var(--muted)]" />
            <span className="text-sm text-[var(--muted)]">Backend API:</span>
            <span
              className={`flex items-center gap-1.5 text-sm font-medium ${
                backendStatus === "online"
                  ? "text-[var(--success)]"
                  : backendStatus === "offline"
                    ? "text-[var(--danger)]"
                    : "text-[var(--warning)]"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === "online"
                    ? "bg-[var(--success)]"
                    : backendStatus === "offline"
                      ? "bg-[var(--danger)]"
                      : "bg-[var(--warning)] animate-pulse"
                }`}
              />
              {backendStatus === "online" ? "Connected" : backendStatus === "offline" ? "Unreachable" : "Checking..."}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
          {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="glass-card p-5 hover:border-[var(--accent)]/15 transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Phase 1 notice */}
        <div className="glass-card p-6 border-[var(--accent)]/10 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">
            Phase 1 — Foundation
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            This is the scaffolding phase. The dashboard currently displays placeholder data.
            In Phase 2, real CRUD APIs, authentication, and database integration will populate these cards
            with live data from the backend.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Monorepo ✓", "Frontend Shell ✓", "Backend API ✓", "DB Models ✓", "Auth — Phase 2", "Blockchain — Phase 4", "ZK Proofs — Phase 5"].map(
              (tag) => (
                <span
                  key={tag}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    tag.includes("✓")
                      ? "bg-[var(--success)]/10 text-[var(--success)]"
                      : "bg-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {tag}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
