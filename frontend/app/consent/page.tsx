"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";

export default function ConsentPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Consent Management</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Grant, revoke, and monitor access permissions for your records
          </p>
        </div>

        <div className="glass-card empty-state animate-slide-up">
          <ShieldCheck className="w-12 h-12" />
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            No Consent Entries
          </h2>
          <p className="text-sm text-[var(--muted)] max-w-md">
            Consent management will allow patients to grant time-limited, per-record access to doctors and hospitals.
            Consent state will be mirrored on-chain via smart contracts in Phase 4.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
