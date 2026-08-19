"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { ProtectedRoute } from "@/components/auth/protected-route";
import type { UserRole } from "@/types";

interface DashboardShellProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function DashboardShell({ children, allowedRoles }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopNav onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
