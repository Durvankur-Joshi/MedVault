"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Inbox } from "lucide-react";

export default function AccessRequestsPage() {
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Access Requests</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Review and respond to requests for your medical records
          </p>
        </div>

        <div className="glass-card empty-state animate-slide-up">
          <Inbox className="w-12 h-12" />
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            No Pending Requests
          </h2>
          <p className="text-sm text-[var(--muted)] max-w-md">
            When doctors or hospitals request access to your records, they will appear here.
            You can approve or deny each request, creating a consent entry that is tracked on-chain.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
