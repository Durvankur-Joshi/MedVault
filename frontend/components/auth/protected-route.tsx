"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { UserRole } from "@/types";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--muted)]">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
        <div className="glass-card p-8 text-center max-w-md">
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-2">Access Restricted</h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Your current role (<span className="capitalize">{user.role.replace("_", " ")}</span>) does not have access to this resource.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
