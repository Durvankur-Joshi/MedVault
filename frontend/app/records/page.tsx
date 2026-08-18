"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FileText } from "lucide-react";

export default function RecordsPage() {
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Medical Records</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            View and manage medical record references
          </p>
        </div>

        <div className="glass-card empty-state animate-slide-up">
          <FileText className="w-12 h-12" />
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            No Records Yet
          </h2>
          <p className="text-sm text-[var(--muted)] max-w-md">
            Medical records will be listed here once the backend CRUD APIs are implemented in Phase 2.
            Records are stored encrypted off-chain — this page displays only metadata and references.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
