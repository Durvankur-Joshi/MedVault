"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AuditLog } from "@/types";
import { ScrollText, Loader2, AlertCircle, ShieldAlert } from "lucide-react";

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

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit Log</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Immutable log of system actions and access events associated with your account
          </p>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-sm text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mb-3" />
            <p className="text-sm text-[var(--muted)]">Loading audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="glass-card empty-state animate-slide-up">
            <ScrollText className="w-12 h-12" />
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No Audit Events Recorded
            </h2>
            <p className="text-sm text-[var(--muted)] max-w-md">
              Events such as logins, record creations, consent grants/revocations, and access approvals will be logged here.
            </p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden animate-slide-up">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card)]/50 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <th className="px-6 py-3.5">Action</th>
                    <th className="px-6 py-3.5">Resource</th>
                    <th className="px-6 py-3.5">Resource ID</th>
                    <th className="px-6 py-3.5">Details</th>
                    <th className="px-6 py-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--hover)] transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-[var(--accent)]">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)] capitalize">
                        {log.resource_type || log.resourceType}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[var(--muted)]">
                        {(log.resource_id || log.resourceId || "").slice(0, 13)}...
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--muted)]">
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
        <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted)]">
          <ShieldAlert className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>
            Privacy Guarantee: MedVault audit logs never store patient diagnoses, prescriptions, credentials, encryption keys, or unnecessary PII.
          </span>
        </div>
      </div>
    </DashboardShell>
  );
}
