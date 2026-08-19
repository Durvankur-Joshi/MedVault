"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Lock, Mail, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Invalid email or password.");
        } else if (err.detail) {
          setError(err.detail);
        } else {
          setError(`Authentication failed (${err.status}).`);
        }
      } else if (err instanceof Error) {
        setError(err.message || "Failed to connect to backend server.");
      } else {
        setError("Unable to connect to the authentication service.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute top-[-30%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[var(--accent)]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
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
              Sign In
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Enter your credentials to access your decentralized ledger
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-sm text-red-400 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-sm text-[var(--muted)]">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-[var(--accent)] hover:underline font-medium"
              >
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
