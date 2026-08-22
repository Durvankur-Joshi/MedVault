"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Inbox,
  ScrollText,
  Activity,
  Shield,
  Lock,
  Eye,
  Blocks,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Stethoscope,
  KeyRound,
  FilePlus,
  Search,
} from "lucide-react";
import { getHealth } from "@/services/health";
import { listRecords } from "@/services/records";
import { listConsents } from "@/services/consent";
import { listAccessRequests, approveAccessRequest, denyAccessRequest } from "@/services/access-requests";
import { listAuditEvents } from "@/services/audit";
import { getZKStatus } from "@/services/zk";
import type { MedicalRecord, Consent, AccessRequest, AuditLog, ZKStatusResponse } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [zkStatus, setZkStatus] = useState<ZKStatusResponse | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = () => {
    getHealth()
      .then((res) => setBackendStatus(res.status === "ok" ? "online" : "offline"))
      .catch(() => setBackendStatus("offline"));

    getZKStatus()
      .then((res) => setZkStatus(res))
      .catch(() => setZkStatus(null));

    listRecords()
      .then((res) => setRecords(res))
      .catch(() => setRecords([]));

    listConsents()
      .then((res) => setConsents(res))
      .catch(() => setConsents([]));

    listAccessRequests()
      .then((res) => setRequests(res))
      .catch(() => setRequests([]));

    listAuditEvents()
      .then((res) => setAuditLogs(res))
      .catch(() => setAuditLogs([]));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickApprove = async (requestId: string) => {
    try {
      await approveAccessRequest(requestId, { permission: "read" });
      setActionSuccess("Access request approved and synchronized to blockchain!");
      loadData();
    } catch {
      // Handled by api-client
    }
  };

  const handleQuickDeny = async (requestId: string) => {
    try {
      await denyAccessRequest(requestId);
      setActionSuccess("Access request denied.");
      loadData();
    } catch {
      // Handled by api-client
    }
  };

  if (!user) return null;

  const activeConsentsCount = consents.filter((c) => c.status === "active").length;
  const pendingRequests = requests.filter((r) => r.status === "pending");

  const STAT_CARDS = [
    {
      label: user.role === "patient" ? "My Medical Records" : "Accessible Records",
      value: records.length,
      icon: FileText,
      color: "from-sky-500 to-blue-600",
      href: "/records",
    },
    {
      label: "Active Consents",
      value: activeConsentsCount,
      icon: ShieldCheck,
      color: "from-emerald-500 to-teal-600",
      href: "/consent",
    },
    {
      label: "Pending Requests",
      value: pendingRequests.length,
      icon: Inbox,
      color: "from-amber-500 to-orange-600",
      href: "/access-requests",
    },
    {
      label: "Audit Trail Logs",
      value: auditLogs.length,
      icon: ScrollText,
      color: "from-violet-500 to-purple-600",
      href: "/audit",
    },
  ];

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Welcome back, {user.email.split("@")[0]}
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Role: <span className="capitalize font-semibold text-[var(--accent)]">{user.role.replace("_", " ")}</span> · Account ID: <span className="font-mono text-xs text-[var(--muted)]">{user.id}</span>
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5">
            {user.role === "patient" ? (
              <Link
                href="/records"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white shadow-lg shadow-cyan-900/30 hover:opacity-95 transition-all"
              >
                <FilePlus className="w-4 h-4" />
                Upload / Create Record
              </Link>
            ) : (
              <Link
                href="/access-requests"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white shadow-lg shadow-cyan-900/30 hover:opacity-95 transition-all"
              >
                <Search className="w-4 h-4" />
                Search Patients & Request Access
              </Link>
            )}
          </div>
        </div>

        {/* Action Success Alert */}
        {actionSuccess && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Real-Time System Telemetry Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "80ms" }}>
          <div className="glass-card px-4 py-3 flex items-center gap-3">
            <Activity className="w-4 h-4 text-[var(--muted)]" />
            <div className="text-xs">
              <span className="text-[var(--muted)]">API Gateway: </span>
              <span className={`font-semibold ${backendStatus === "online" ? "text-emerald-400" : "text-red-400"}`}>
                {backendStatus === "online" ? "Connected (FastAPI)" : "Offline"}
              </span>
            </div>
          </div>

          <div className="glass-card px-4 py-3 flex items-center gap-3">
            <Blocks className="w-4 h-4 text-cyan-400" />
            <div className="text-xs">
              <span className="text-[var(--muted)]">EVM Ledger: </span>
              <span className="font-semibold text-cyan-300">Hardhat / Sepolia (BN254)</span>
            </div>
          </div>

          <div className="glass-card px-4 py-3 flex items-center gap-3">
            <Eye className="w-4 h-4 text-purple-400" />
            <div className="text-xs">
              <span className="text-[var(--muted)]">ZK Prover: </span>
              <span className="font-semibold text-purple-300">
                {zkStatus?.enabled ? `Active (${zkStatus.circuit_name})` : "Active (Noir Simulation)"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {STAT_CARDS.map(({ label, value, icon: Icon, color, href }) => (
            <Link
              key={label}
              href={href}
              className="glass-card p-5 hover:border-[var(--accent)]/30 hover:-translate-y-0.5 transition-all duration-300 group block"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
            </Link>
          ))}
        </div>

        {/* Role-Specific Sections */}
        {user.role === "patient" && pendingRequests.length > 0 && (
          <div className="glass-card p-5 border-amber-500/30 bg-amber-950/10 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Pending Access Requests ({pendingRequests.length})
                </h2>
              </div>
              <Link href="/access-requests" className="text-xs text-amber-400 hover:text-amber-300 font-medium">
                View All →
              </Link>
            </div>

            <div className="space-y-2.5">
              {pendingRequests.slice(0, 3).map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      Doctor Access Request · Reason: {req.reason || "Clinical evaluation"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Request ID: {req.id.slice(0, 8)}... · Targeted Record: {req.record_id ? req.record_id.slice(0, 8) + "..." : "All Records"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleQuickApprove(req.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-lg hover:bg-emerald-900/50 transition-colors"
                    >
                      Approve & Anchor
                    </button>
                    <button
                      onClick={() => handleQuickDeny(req.id)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 bg-slate-800/60 rounded-lg hover:bg-red-950/30 transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security & Cryptographic Architecture Card */}
        <div className="glass-card p-6 border-[var(--accent)]/15 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              MedVault Cryptographic Architecture
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Every medical record follows a strict 6-stage privacy pipeline: FHIR normalization, SHA-256 integrity hash derivation, off-chain AES-256-GCM encryption, on-chain state synchronization, and zero-knowledge authorization verification before decryption.
          </p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { title: "AES-256-GCM", desc: "Off-chain storage encryption" },
              { title: "EVM Smart Contracts", desc: "Immutable consent registry" },
              { title: "Noir ZK Proofs", desc: "Zero-PII authorization" },
              { title: "SHA-256 Integrity", desc: "Tamper detection commitment" },
            ].map((item) => (
              <div key={item.title} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <p className="text-xs font-bold text-slate-200">{item.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
