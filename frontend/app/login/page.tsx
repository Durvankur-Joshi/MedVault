"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, User, Stethoscope, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types";

const ROLES: { role: UserRole; label: string; description: string; icon: typeof User }[] = [
  {
    role: "patient",
    label: "Patient",
    description: "View and manage your medical records, control consent",
    icon: User,
  },
  {
    role: "doctor",
    label: "Doctor",
    description: "Request access to patient records, view consented data",
    icon: Stethoscope,
  },
  {
    role: "hospital_admin",
    label: "Hospital Admin",
    description: "Manage hospital doctors, oversee access policies",
    icon: Building2,
  },
];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  function handleLogin() {
    if (!selectedRole) return;
    login(selectedRole);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute top-[-30%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[var(--accent)]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-[var(--foreground)]">MedVault</span>
        </div>

        {/* Card */}
        <div className="glass-card p-8 animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
              Demo Sign In
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Select a role to explore the MedVault interface.
              <br />
              <span className="text-xs text-[var(--accent)]">
                Real authentication will be implemented in Phase 2.
              </span>
            </p>
          </div>

          {/* Role selection */}
          <div className="space-y-3 mb-8">
            {ROLES.map(({ role, label, description, icon: Icon }) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-xl border text-left
                  transition-all duration-200
                  ${
                    selectedRole === role
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-lg shadow-[var(--accent)]/5"
                      : "border-[var(--border)] hover:border-[var(--muted)] hover:bg-[var(--hover)]"
                  }
                `}
              >
                <div
                  className={`
                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                    transition-colors duration-200
                    ${
                      selectedRole === role
                        ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                        : "bg-[var(--hover)] text-[var(--muted)]"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      selectedRole === role ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {label}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={!selectedRole}
            className={`
              w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300
              ${
                selectedRole
                  ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/20 hover:-translate-y-0.5"
                  : "bg-[var(--border)] text-[var(--muted)] cursor-not-allowed"
              }
            `}
          >
            Continue as {selectedRole ? ROLES.find((r) => r.role === selectedRole)?.label : "..."}
          </button>
        </div>
      </div>
    </div>
  );
}
