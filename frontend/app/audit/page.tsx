"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AuditLog } from "@/types";
import { ScrollText, Loader2, AlertCircle, ShieldAlert, Blocks, Lock, UserCheck, ShieldCheck } from "lucide-react";

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<AuditLog[]>("/api/audit")
      .then((data) => {
        if (isMounted) {
          setLogs(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.detail || "Failed to load audit logs.");
          } else {
            setError("Unable to connect to backend service.");
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getActionBadge = (action: string) => {
    if (action.includes("blockchain") || action.includes("anchored") || action.includes("wallet")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Blocks className="w-3 h-3" /> {action}
        </span>
      );
    }
    if (action.includes("verified") || action.includes("created") || action.includes("uploaded")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Lock className="w-3 h-3" /> {action}
        </span>
      );
    }
    if (action.includes("consent") || action.includes("access")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <ShieldCheck className="w-3 h-3" /> {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20">
        <UserCheck className="w-3 h-3" /> {action}
      </span>
    );
  };

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Immutable Audit Trail</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Phase 4 Verified
              </span>
            </div>
            <p className="text-sm text-[var(--muted)] mt-1">
              Cryptographically verified record access, document upload, on-chain consent, and identity events
            </p>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-sm text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mb-3" />
            <p className="text-sm text-[var(--muted)]">Loading immutable audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="glass-card empty-state p-12 text-center flex flex-col items-center justify-center animate-slide-up">
            <ScrollText className="w-12 h-12 text-[var(--muted)] mb-3" />
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No Audit Events Recorded
            </h2>
            <p className="text-sm text-[var(--muted)] max-w-md">
              Events such as logins, document uploads, record creations, on-chain anchoring, and consent changes will be logged here.
            </p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden animate-slide-up">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card)]/50 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <th className="px-6 py-3.5">Action Event</th>
                    <th className="px-6 py-3.5">Resource</th>
                    <th className="px-6 py-3.5">Resource ID</th>
                    <th className="px-6 py-3.5">Audit Metadata</th>
                    <th className="px-6 py-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--hover)] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)] capitalize text-xs">
                        {log.resource_type || log.resourceType}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[var(--muted)]">
                        {(log.resource_id || log.resourceId || "").slice(0, 14)}...
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-300 max-w-xs truncate">
                        {log.details || "—"}
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--muted)] whitespace-nowrap">
                        {formatDateTime(log.created_at || log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Privacy notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted)]">
          <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            Zero-Knowledge Principle: MedVault audit logs never store patient clinical notes, diagnoses, prescriptions, raw FHIR objects, or encryption keys.
          </span>
        </div>
      </div>
    </DashboardShell>
  );
}
