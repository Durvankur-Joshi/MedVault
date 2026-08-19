"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { FileText, ShieldCheck, Inbox, ScrollText, Activity, Shield } from "lucide-react";
import { getHealth } from "@/services/health";
import { apiClient } from "@/lib/api-client";
import type { MedicalRecord, Consent, AccessRequest, AuditLog } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [recordCount, setRecordCount] = useState<number | string>("—");
  const [consentCount, setConsentCount] = useState<number | string>("—");
  const [requestCount, setRequestCount] = useState<number | string>("—");
  const [auditCount, setAuditCount] = useState<number | string>("—");

  useEffect(() => {
    getHealth()
      .then((res) => {
        setBackendStatus(res.status === "ok" ? "online" : "offline");
      })
      .catch(() => {
        setBackendStatus("offline");
      });

    // Fetch real metrics from backend
    apiClient
      .get<MedicalRecord[]>("/api/records")
      .then((res) => setRecordCount(res.length))
      .catch(() => setRecordCount(0));

    apiClient
      .get<Consent[]>("/api/consent")
      .then((res) => {
        const active = res.filter((c) => c.status === "active").length;
        setConsentCount(active);
      })
      .catch(() => setConsentCount(0));

    apiClient
      .get<AccessRequest[]>("/api/access-requests")
      .then((res) => {
        const pending = res.filter((r) => r.status === "pending").length;
        setRequestCount(pending);
      })
      .catch(() => setRequestCount(0));

    apiClient
      .get<AuditLog[]>("/api/audit")
      .then((res) => setAuditCount(res.length))
      .catch(() => setAuditCount(0));
  }, []);

  if (!user) return null;

  const STAT_CARDS = [
    { label: "Medical Records", value: recordCount, icon: FileText, color: "from-sky-500 to-blue-600" },
    { label: "Active Consents", value: consentCount, icon: ShieldCheck, color: "from-emerald-500 to-teal-600" },
    { label: "Pending Requests", value: requestCount, icon: Inbox, color: "from-amber-500 to-orange-600" },
    { label: "Audit Events", value: auditCount, icon: ScrollText, color: "from-violet-500 to-purple-600" },
  ];

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto">
        {/* Greeting */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Welcome back, {user.email.split("@")[0]}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Role: <span className="capitalize font-semibold text-[var(--accent)]">{user.role.replace("_", " ")}</span> · Account ID: <span className="font-mono text-xs text-[var(--muted)]">{user.id}</span>
          </p>
        </div>

        {/* Backend status */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: "80ms" }}>
          <div className="glass-card px-5 py-3 inline-flex items-center gap-3">
            <Activity className="w-4 h-4 text-[var(--muted)]" />
            <span className="text-sm text-[var(--muted)]">FastAPI Backend:</span>
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

        {/* Phase 2 Core Engine Card */}
        <div className="glass-card p-6 border-[var(--accent)]/10 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Phase 2 — Core Ledger Active
            </h2>
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            All backend CRUD operations, PostgreSQL database persistence, JWT authentication, and strict ownership/consent authorization checks are fully functional.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "FastAPI Backend ✓",
              "PostgreSQL DB ✓",
              "JWT Authentication ✓",
              "Alembic Migrations ✓",
              "Record CRUD ✓",
              "Consent Management ✓",
              "Access Requests ✓",
              "Audit Log API ✓",
              "Role-Based Access Control ✓",
            ].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
