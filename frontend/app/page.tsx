"use client";

import Link from "next/link";
import { Shield, Lock, Eye, ArrowRight, Heart, Database, FileCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const FEATURES = [
  {
    icon: Shield,
    title: "Patient-Controlled Access",
    description: "You decide who sees your medical records. Grant and revoke consent in real time.",
  },
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "Records are encrypted before leaving your device. Only authorized parties can decrypt.",
  },
  {
    icon: Eye,
    title: "Zero-Knowledge Proofs",
    description: "Prove authorization without revealing your identity. True privacy-preserving access control.",
  },
  {
    icon: Database,
    title: "Off-Chain Storage",
    description: "Medical data lives on encrypted decentralized storage — never on a public blockchain.",
  },
  {
    icon: FileCheck,
    title: "FHIR Compliant",
    description: "Records normalized to HL7 FHIR standards for interoperability across healthcare systems.",
  },
  {
    icon: Heart,
    title: "Immutable Audit Trail",
    description: "Every access event is recorded on-chain. Full transparency, tamper-proof history.",
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--background)] relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--accent)]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--accent-secondary)]/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[var(--foreground)]">MedVault</span>
        </div>
        <Link
          href={isAuthenticated ? "/dashboard" : "/login"}
          className="px-5 py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)]/20 transition-colors border border-[var(--accent)]/20"
        >
          {isAuthenticated ? "Dashboard" : "Sign In"}
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-xs font-medium text-[var(--accent)] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Built for HackNexus&apos;26
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight animate-slide-up">
          <span className="text-[var(--foreground)]">Your Medical Records.</span>
          <br />
          <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] bg-clip-text text-transparent animate-gradient">
            Your Control.
          </span>
        </h1>

        <p className="mt-6 text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: "150ms" }}>
          MedVault is a privacy-first decentralized medical history ledger. Medical records are
          encrypted off-chain, consent is managed on-chain, and access is verified with zero-knowledge proofs.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "300ms" }}>
          <Link
            href="/login"
            className="group flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/20 transition-all duration-300 hover:-translate-y-0.5"
          >
            Get Started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="https://github.com"
            target="_blank"
            className="px-7 py-3 rounded-xl text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--muted)] transition-colors"
          >
            View on GitHub
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="glass-card p-6 hover:border-[var(--accent)]/20 transition-all duration-300 hover:-translate-y-1 group"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--accent)]/20 transition-colors">
                <Icon className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--foreground)] mb-2">{title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture callout */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="glass-card p-8 lg:p-10 glow-accent text-center">
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">
            Medical Data Never Touches the Blockchain
          </h2>
          <p className="text-[var(--muted)] leading-relaxed max-w-2xl mx-auto">
            The blockchain stores only cryptographic commitments, consent state, and audit events.
            Your medical records are encrypted with AES-256-GCM and stored on decentralized
            off-chain storage. No PII is ever written on-chain.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] py-8 px-6 text-center">
        <p className="text-sm text-[var(--muted)]">
          MedVault — HackNexus&apos;26 · Privacy-First Decentralized Medical History Ledger
        </p>
      </footer>
    </div>
  );
}
