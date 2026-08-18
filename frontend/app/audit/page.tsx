"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ScrollText } from "lucide-react";

export default function AuditPage() {
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit Log</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Immutable record of all access events and system actions
          </p>
        </div>

        <div className="glass-card empty-state animate-slide-up">
          <ScrollText className="w-12 h-12" />
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            No Audit Events
          </h2>
          <p className="text-sm text-[var(--muted)] max-w-md">
            Every record access, consent change, and system event will be logged here with an immutable audit trail.
            Critical events will be anchored on-chain for tamper-proof verification in Phase 4.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
