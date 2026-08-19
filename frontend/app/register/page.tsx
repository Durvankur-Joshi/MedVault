"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Loader2,
  User,
  Stethoscope,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import type { UserRole } from "@/types";

const ROLE_OPTIONS: { role: UserRole; label: string; description: string; icon: typeof User }[] = [
  {
    role: "patient",
    label: "Patient",
    description: "Manage your records & consent permissions",
    icon: User,
  },
  {
    role: "doctor",
    label: "Doctor",
    description: "Request & view consented patient records",
    icon: Stethoscope,
  },
  {
    role: "hospital_admin",
    label: "Hospital Admin",
    description: "Oversee hospital organization & staff access",
    icon: Building2,
  },
];

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("patient");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register(trimmedEmail, password, role);
      setSuccess("Account registered successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("A user with this email address already exists.");
        } else if (err.detail) {
          setError(err.detail);
        } else {
          setError(`Registration failed (${err.status}).`);
        }
      } else if (err instanceof Error) {
        setError(err.message || "Failed to register account.");
      } else {
        setError("Unable to connect to registration service.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute top-[-30%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[var(--accent)]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 animate-fade-in group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center transition-transform group-hover:scale-105">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-[var(--foreground)]">MedVault</span>
        </Link>

        {/* Card */}
        <div className="glass-card p-8 animate-slide-up">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-[var(--foreground)] mb-1">
              Create an Account
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Select your role and enter your details to register
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-sm text-red-400 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-sm text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                Account Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {ROLE_OPTIONS.map(({ role: optionRole, label, icon: Icon }) => (
                  <button
                    key={optionRole}
                    type="button"
                    onClick={() => setRole(optionRole)}
                    className={`
                      flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200
                      ${
                        role === optionRole
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)] hover:bg-[var(--hover)]"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                Password (min. 8 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Register</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-sm text-[var(--muted)]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-[var(--accent)] hover:underline font-medium"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
