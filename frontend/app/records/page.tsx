"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import {
  listRecords,
  createRecord,
  deleteRecord,
  getDecryptedRecord,
  verifyRecordIntegrity,
} from "@/services/records";
import type {
  MedicalRecord,
  MedicalRecordDetailResponse,
  IntegrityVerifyResponse,
} from "@/types";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Eye,
  KeyRound,
  HardDrive,
  Copy,
  Check,
  X,
  Activity,
  Heart,
  Pill,
  Stethoscope,
} from "lucide-react";

interface FHIRTemplate {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  record_type: string;
  fhir_resource_type: string;
  description: string;
  data: Record<string, unknown>;
}

const FHIR_TEMPLATES: FHIRTemplate[] = [
  {
    name: "Blood Pressure Observation",
    icon: Heart,
    record_type: "observation",
    fhir_resource_type: "Observation",
    description: "Systolic & Diastolic Blood Pressure measurement",
    data: {
      resourceType: "Observation",
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "vital-signs",
              display: "Vital Signs",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "85354-9",
            display: "Blood pressure panel with all children optional",
          },
        ],
        text: "Blood Pressure",
      },
      effectiveDateTime: new Date().toISOString(),
      component: [
        {
          code: {
            coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }],
            text: "Systolic Blood Pressure",
          },
          valueQuantity: { value: 120, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
        },
        {
          code: {
            coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }],
            text: "Diastolic Blood Pressure",
          },
          valueQuantity: { value: 80, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
        },
      ],
    },
  },
  {
    name: "Fasting Blood Glucose",
    icon: Activity,
    record_type: "observation",
    fhir_resource_type: "Observation",
    description: "Lab test for Fasting Blood Sugar level",
    data: {
      resourceType: "Observation",
      status: "final",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "1558-6",
            display: "Fasting glucose [Mass/volume] in Serum or Plasma",
          },
        ],
        text: "Fasting Blood Glucose",
      },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: {
        value: 95,
        unit: "mg/dL",
        system: "http://unitsofmeasure.org",
        code: "mg/dL",
      },
      interpretation: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
              code: "N",
              display: "Normal",
            },
          ],
          text: "Normal",
        },
      ],
    },
  },
  {
    name: "Hypertension Diagnosis",
    icon: Stethoscope,
    record_type: "condition",
    fhir_resource_type: "Condition",
    description: "Clinical condition diagnosis with SNOMED code",
    data: {
      resourceType: "Condition",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
            display: "Active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed",
            display: "Confirmed",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
              display: "Encounter Diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "38341003",
            display: "Hypertensive disorder, systemic arterial",
          },
        ],
        text: "Essential Hypertension",
      },
      subject: { reference: "Patient/self" },
      recordedDate: new Date().toISOString().split("T")[0],
    },
  },
  {
    name: "Prescription (Medication)",
    icon: Pill,
    record_type: "medication_request",
    fhir_resource_type: "MedicationRequest",
    description: "Prescription with dosage instruction",
    data: {
      resourceType: "MedicationRequest",
      status: "active",
      intent: "order",
      medicationCodeableConcept: {
        coding: [
          {
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: "197361",
            display: "Amlodipine 5 MG Oral Tablet",
          },
        ],
        text: "Amlodipine 5mg Tablet",
      },
      subject: { reference: "Patient/self" },
      authoredOn: new Date().toISOString(),
      dosageInstruction: [
        {
          text: "Take 1 tablet by mouth daily in the morning",
          timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } },
        },
      ],
    },
  },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function RecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [customJson, setCustomJson] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [creating, setCreating] = useState(false);

  // Decrypted Detail Modal State
  const [decryptedRecord, setDecryptedRecord] =
    useState<MedicalRecordDetailResponse | null>(null);
  const [decryptingRecordId, setDecryptingRecordId] = useState<string | null>(
    null
  );

  // Integrity Verify State
  const [verifyResult, setVerifyResult] =
    useState<IntegrityVerifyResponse | null>(null);
  const [verifyingRecordId, setVerifyingRecordId] = useState<string | null>(
    null
  );

  // Copied state
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      const data = await listRecords();
      setRecords(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load medical records.");
      } else {
        setError("Unable to connect to backend service.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    listRecords()
      .then((data) => {
        if (isMounted) {
          setRecords(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.detail || "Failed to load medical records.");
          } else {
            setError("Unable to connect to backend service.");
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setActionSuccess(null);

    let fhirData: Record<string, unknown>;
    let recordType: string;
    let fhirResourceType: string;

    if (isCustomMode) {
      try {
        fhirData = JSON.parse(customJson);
        fhirResourceType = (fhirData.resourceType as string) || "Observation";
        recordType = fhirResourceType.toLowerCase();
      } catch {
        setError("Invalid JSON format in custom FHIR payload.");
        setCreating(false);
        return;
      }
    } else {
      const template = FHIR_TEMPLATES[selectedTemplateIndex];
      fhirData = template.data;
      recordType = template.record_type;
      fhirResourceType = template.fhir_resource_type;
    }

    try {
      await createRecord({
        record_type: recordType,
        fhir_resource_type: fhirResourceType,
        fhir_data: fhirData,
      });
      setShowCreateModal(false);
      setIsCustomMode(false);
      setActionSuccess(
        "Medical record successfully normalized to FHIR, hashed with SHA-256, and encrypted with AES-256-GCM."
      );
      await loadRecords();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to create medical record.");
      } else {
        setError("Error communicating with backend.");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleViewDecrypted = async (recordId: string) => {
    setDecryptingRecordId(recordId);
    setError(null);
    try {
      const detail = await getDecryptedRecord(recordId);
      setDecryptedRecord(detail);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to decrypt medical record.");
      } else {
        setError("Unable to retrieve and decrypt record.");
      }
    } finally {
      setDecryptingRecordId(null);
    }
  };

  const handleVerifyIntegrity = async (recordId: string) => {
    setVerifyingRecordId(recordId);
    setError(null);
    try {
      const res = await verifyRecordIntegrity(recordId);
      setVerifyResult(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Integrity verification failed.");
      } else {
        setError("Unable to complete integrity verification.");
      }
    } finally {
      setVerifyingRecordId(null);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this medical record and its encrypted storage blob?"
      )
    )
      return;
    setError(null);
    setActionSuccess(null);

    try {
      await deleteRecord(recordId);
      setActionSuccess("Record and encrypted object deleted successfully.");
      await loadRecords();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to delete record.");
      } else {
        setError("Error communicating with backend.");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const isPatient = user?.role === "patient";

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                Medical Records
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Phase 3 Privacy Pipeline
              </span>
            </div>
            <p className="text-sm text-[var(--muted)] mt-1">
              {isPatient
                ? "Privacy-first health ledger with AES-256-GCM encryption & SHA-256 cryptographic commitments"
                : "Consented patient records with verified cryptographic integrity"}
            </p>
          </div>
          {isPatient && (
            <button
              onClick={() => {
                setShowCreateModal(true);
                setIsCustomMode(false);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Encrypted Record</span>
            </button>
          )}
        </div>

        {/* Security / Privacy Banner */}
        <div className="glass-card p-4 rounded-2xl border border-[var(--accent)]/20 bg-gradient-to-r from-[var(--accent)]/5 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-[var(--foreground)]">
                Zero-Knowledge Privacy Architecture
              </p>
              <p>
                Clinical records are normalized to HL7 FHIR R4, committed with
                SHA-256, and encrypted with AES-256-GCM off-chain. No plaintext
                medical data is stored in the database.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] font-mono text-[11px]">
              <Lock className="w-3 h-3 text-emerald-400" /> AES-256-GCM
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] font-mono text-[11px]">
              <KeyRound className="w-3 h-3 text-cyan-400" /> SHA-256
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] font-mono text-[11px]">
              <HardDrive className="w-3 h-3 text-purple-400" /> Off-Chain
            </span>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-sm text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-sm text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Records Content */}
        {loading ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mb-3" />
            <p className="text-sm text-[var(--muted)]">
              Loading medical records from secure ledger...
            </p>
          </div>
        ) : records.length === 0 ? (
          <div className="glass-card empty-state p-12 text-center flex flex-col items-center justify-center animate-slide-up">
            <FileText className="w-12 h-12 text-[var(--muted)] mb-3" />
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              No Medical Records Found
            </h2>
            <p className="text-sm text-[var(--muted)] max-w-md mb-4">
              {isPatient
                ? "You haven't created any encrypted medical records yet. Click 'Create Encrypted Record' above to submit clinical data."
                : "No patient records have been shared with you via active consent."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="glass-card p-5 hover:border-[var(--accent)]/30 transition-all group flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wide">
                        {rec.record_type || rec.recordType}
                      </span>
                      {(rec.fhir_resource_type || rec.fhirResourceType) && (
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          FHIR: {rec.fhir_resource_type || rec.fhirResourceType}
                        </span>
                      )}
                    </div>
                    {isPatient && (
                      <button
                        onClick={() => handleDeleteRecord(rec.id)}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Metadata fields */}
                  <div className="space-y-2 text-xs text-[var(--muted)]">
                    <div>
                      <span className="text-[var(--foreground)] font-medium">
                        Record ID:
                      </span>{" "}
                      <span className="font-mono text-[var(--foreground)]/80">
                        {rec.id}
                      </span>
                    </div>

                    {/* Storage reference */}
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-[var(--foreground)] font-medium">
                        Storage Pointer:
                      </span>
                      <span className="font-mono text-[11px] text-purple-300 truncate">
                        {rec.encrypted_storage_ref ||
                          rec.encryptedStorageRef ||
                          "local://pending.enc"}
                      </span>
                    </div>

                    {/* SHA-256 Hash Commitment */}
                    <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] font-mono text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-[var(--muted)]">
                        <span className="flex items-center gap-1 font-sans font-semibold text-[var(--foreground)]">
                          <KeyRound className="w-3 h-3 text-cyan-400" />
                          SHA-256 Integrity Commitment
                        </span>
                        {(rec.record_hash || rec.recordHash) && (
                          <button
                            onClick={() =>
                              copyToClipboard(
                                rec.record_hash || rec.recordHash || ""
                              )
                            }
                            className="hover:text-[var(--foreground)] p-1 rounded transition-colors"
                            title="Copy Full Hash"
                          >
                            {copiedHash ===
                            (rec.record_hash || rec.recordHash) ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-cyan-300 break-all">
                        {rec.record_hash || rec.recordHash || "—"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span>
                        Registered: {formatDate(rec.created_at || rec.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <Lock className="w-3 h-3" />
                        {rec.encryption_version ||
                          rec.encryptionVersion ||
                          "aes-256-gcm-v1"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Bottom Bar */}
                <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[var(--border)]">
                  <button
                    onClick={() => handleViewDecrypted(rec.id)}
                    disabled={decryptingRecordId === rec.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold border border-[var(--accent)]/20 transition-colors disabled:opacity-50"
                  >
                    {decryptingRecordId === rec.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span>View Decrypted</span>
                  </button>

                  <button
                    onClick={() => handleVerifyIntegrity(rec.id)}
                    disabled={verifyingRecordId === rec.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {verifyingRecordId === rec.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Verify Integrity</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Record Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <h2 className="text-lg font-bold text-[var(--foreground)]">
                    Create Encrypted Medical Record
                  </h2>
                  <p className="text-xs text-[var(--muted)]">
                    FHIR R4 Normalization → SHA-256 Commitment → AES-256-GCM
                    Off-Chain Storage
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-2 p-1 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    !isCustomMode
                      ? "bg-[var(--accent)] text-white shadow"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  FHIR Clinical Templates
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(true);
                    if (!customJson) {
                      setCustomJson(
                        JSON.stringify(
                          FHIR_TEMPLATES[selectedTemplateIndex].data,
                          null,
                          2
                        )
                      );
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isCustomMode
                      ? "bg-[var(--accent)] text-white shadow"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Custom FHIR JSON
                </button>
              </div>

              <form onSubmit={handleCreateRecord} className="space-y-4">
                {!isCustomMode ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Select FHIR Template
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {FHIR_TEMPLATES.map((tmpl, idx) => {
                        const Icon = tmpl.icon;
                        const isSelected = selectedTemplateIndex === idx;
                        return (
                          <button
                            key={tmpl.name}
                            type="button"
                            onClick={() => setSelectedTemplateIndex(idx)}
                            className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                              isSelected
                                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)] shadow-md"
                                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hover)] text-[var(--muted)]"
                            }`}
                          >
                            <div
                              className={`p-2 rounded-lg ${
                                isSelected
                                  ? "bg-[var(--accent)] text-white"
                                  : "bg-[var(--muted)]/10 text-[var(--muted)]"
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[var(--foreground)]">
                                {tmpl.name}
                              </p>
                              <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5">
                                {tmpl.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Preview of Selected FHIR payload */}
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">
                        Payload Preview:
                      </p>
                      <pre className="p-3 rounded-xl bg-black/40 border border-[var(--border)] font-mono text-[11px] text-emerald-300 max-h-40 overflow-y-auto">
                        {JSON.stringify(
                          FHIR_TEMPLATES[selectedTemplateIndex].data,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      FHIR R4 JSON Payload
                    </label>
                    <textarea
                      value={customJson}
                      onChange={(e) => setCustomJson(e.target.value)}
                      rows={10}
                      className="w-full p-3 rounded-xl bg-black/40 border border-[var(--border)] font-mono text-xs text-emerald-300 focus:outline-none focus:border-[var(--accent)]"
                      placeholder='{ "resourceType": "Observation", ... }'
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] text-white shadow-lg hover:shadow-[var(--accent)]/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Encrypting & Storing...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Normalize, Encrypt & Commit</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Decrypted Modal */}
        {decryptedRecord && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--foreground)]">
                      Decrypted Medical Record
                    </h2>
                    <p className="text-xs text-emerald-400 font-medium">
                      Cryptographically Verified & AES-256-GCM Decrypted
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDecryptedRecord(null)}
                  className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Integrity status card */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
                <span className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  SHA-256 Hash Verified against Ledger Commitment
                </span>
                <span className="font-mono text-[11px] text-emerald-400">
                  {decryptedRecord.record_hash?.slice(0, 16)}...
                </span>
              </div>

              {/* Decrypted FHIR JSON Content */}
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">
                  Normalized FHIR R4 Payload:
                </p>
                <pre className="p-4 rounded-xl bg-black/60 border border-[var(--border)] font-mono text-xs text-emerald-300 overflow-x-auto">
                  {JSON.stringify(decryptedRecord.fhir_data, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => setDecryptedRecord(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--card)] hover:bg-[var(--hover)] border border-[var(--border)] text-[var(--foreground)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Integrity Verification Modal */}
        {verifyResult && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-lg animate-in fade-in zoom-in-95 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className={`w-5 h-5 ${
                      verifyResult.integrity_verified
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  />
                  <h2 className="text-lg font-bold text-[var(--foreground)]">
                    Integrity Verification Result
                  </h2>
                </div>
                <button
                  onClick={() => setVerifyResult(null)}
                  className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                className={`p-4 rounded-xl border flex flex-col gap-2 ${
                  verifyResult.integrity_verified
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-red-500/10 border-red-500/20 text-red-300"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {verifyResult.integrity_verified ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>INTEGRITY VERIFIED: NO TAMPERING DETECTED</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-400" />
                      <span>INTEGRITY MISMATCH DETECTED</span>
                    </>
                  )}
                </div>
                <p className="text-xs">{verifyResult.details}</p>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                <div>
                  <p className="font-sans text-xs font-semibold text-[var(--muted)]">
                    Stored Ledger Commitment:
                  </p>
                  <p className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-cyan-300 break-all text-[11px] mt-1">
                    {verifyResult.stored_hash}
                  </p>
                </div>
                <div>
                  <p className="font-sans text-xs font-semibold text-[var(--muted)]">
                    Recalculated Off-Chain Blob Hash:
                  </p>
                  <p className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-emerald-300 break-all text-[11px] mt-1">
                    {verifyResult.recalculated_hash}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => setVerifyResult(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--card)] hover:bg-[var(--hover)] border border-[var(--border)] text-[var(--foreground)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
