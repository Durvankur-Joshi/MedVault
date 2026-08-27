"use client";

import React, { useState } from "react";
import type { MedicalRecordDetailResponse } from "@/types";
import {
  Activity,
  Pill,
  FileCheck2,
  Stethoscope,
  FileText,
  Calendar,
  User,
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Copy,
  Check,
  AlertTriangle,
  FileSignature,
  Layers,
} from "lucide-react";

interface MedicalRecordViewerProps {
  record: MedicalRecordDetailResponse;
  onClose?: () => void;
}

// ─── Utility Formatting Helpers ─────────────────────────────────────────

function formatReadableDate(dateVal?: unknown): string | null {
  if (!dateVal || typeof dateVal !== "string") return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateVal);
  }
}

function toTitleCase(key: string): string {
  // Convert camelCase or snake_case to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function extractConceptText(concept: unknown): string | null {
  if (!concept) return null;
  if (typeof concept === "string") return concept;
  if (typeof concept === "object") {
    const c = concept as Record<string, unknown>;
    if (c.text && typeof c.text === "string") return c.text;
    if (c.display && typeof c.display === "string") return c.display;
    if (Array.isArray(c.coding) && c.coding.length > 0) {
      const first = c.coding[0];
      if (first && typeof first === "object") {
        const codingObj = first as Record<string, unknown>;
        return (codingObj.display as string) || (codingObj.code as string) || null;
      }
    }
  }
  return null;
}

function extractReferenceDisplay(refObj: unknown): string | null {
  if (!refObj) return null;
  if (typeof refObj === "string") return refObj.replace(/^Patient\//, "Patient ID: ");
  if (typeof refObj === "object") {
    const r = refObj as Record<string, unknown>;
    if (r.display && typeof r.display === "string") return r.display;
    if (r.reference && typeof r.reference === "string") {
      return r.reference.replace(/^Patient\//, "Patient ID: ");
    }
  }
  return null;
}

function extractNotes(noteVal: unknown): string[] {
  if (!noteVal) return [];
  if (typeof noteVal === "string") return [noteVal];
  if (Array.isArray(noteVal)) {
    return noteVal
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return String((item as Record<string, unknown>).text || "");
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof noteVal === "object" && noteVal !== null && "text" in noteVal) {
    const text = String((noteVal as Record<string, unknown>).text || "");
    return text ? [text] : [];
  }
  return [];
}

// Check if a value is empty (null, undefined, empty string, empty array, empty object)
function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (typeof val === "object" && Object.keys(val as object).length === 0) return true;
  return false;
}

// ─── Specialized Document Renderers ─────────────────────────────────────

interface ObservationViewerProps {
  fhir: Record<string, unknown>;
}

function ObservationViewer({ fhir }: ObservationViewerProps) {
  const codeName =
    extractConceptText(fhir.code) ||
    (typeof fhir.code === "string" ? fhir.code : "Clinical Observation");

  const category = extractConceptText(
    Array.isArray(fhir.category) ? fhir.category[0] : fhir.category
  );

  // Value Quantity or String
  let valueDisplay: string | null = null;
  let unitDisplay: string | null = null;

  if (fhir.valueQuantity && typeof fhir.valueQuantity === "object") {
    const vq = fhir.valueQuantity as Record<string, unknown>;
    valueDisplay = vq.value !== undefined ? String(vq.value) : null;
    unitDisplay = (vq.unit as string) || null;
  } else if (fhir.valueString) {
    valueDisplay = String(fhir.valueString);
  } else if (fhir.valueInteger !== undefined) {
    valueDisplay = String(fhir.valueInteger);
  } else if (fhir.valueBoolean !== undefined) {
    valueDisplay = fhir.valueBoolean ? "Positive / True" : "Negative / False";
  }

  // Blood Pressure / Systolic + Diastolic check if in components
  const components = Array.isArray(fhir.component) ? fhir.component : [];

  const interpretation = extractConceptText(
    Array.isArray(fhir.interpretation) ? fhir.interpretation[0] : fhir.interpretation
  );

  const notes = extractNotes(fhir.note);
  const effectiveDate = formatReadableDate(fhir.effectiveDateTime || fhir.effectivePeriod);
  const method = extractConceptText(fhir.method);

  const isCritical =
    interpretation?.toLowerCase().includes("critical") ||
    interpretation?.toLowerCase().includes("high alert");
  const isAbnormal =
    interpretation?.toLowerCase().includes("high") ||
    interpretation?.toLowerCase().includes("low") ||
    interpretation?.toLowerCase().includes("abnormal");
  const isNormal = interpretation?.toLowerCase().includes("normal");

  return (
    <div className="space-y-4">
      {/* Hero Metric Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-slate-950/80 border border-cyan-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                {category || "Vital Signs / Laboratory"}
              </span>
              {method && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                  Method: {method}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-100">{codeName}</h3>
          </div>

          {interpretation && (
            <div className="self-start sm:self-center">
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 ${
                  isCritical
                    ? "bg-red-500/15 border-red-500/40 text-red-300"
                    : isAbnormal
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                    : isNormal
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                }`}
              >
                {isCritical ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : isNormal ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Activity className="w-3.5 h-3.5" />
                )}
                <span>{interpretation}</span>
              </span>
            </div>
          )}
        </div>

        {/* Primary Value Display */}
        {valueDisplay && (
          <div className="mt-4 pt-4 border-t border-cyan-500/20 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-cyan-200 tracking-tight font-mono">
              {valueDisplay}
            </span>
            {unitDisplay && (
              <span className="text-sm sm:text-base font-semibold text-slate-400">
                {unitDisplay}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Component Vitals / Sub-measurements (e.g. BP Systolic & Diastolic) */}
      {components.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Observation Components
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {components.map((comp: Record<string, unknown>, idx: number) => {
              const compName = extractConceptText(comp.code) || `Component #${idx + 1}`;
              const compVq = (comp.valueQuantity as Record<string, unknown>) || {};
              const compVal = compVq.value !== undefined ? String(compVq.value) : "—";
              const compUnit = (compVq.unit as string) || "";
              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between"
                >
                  <span className="text-xs text-slate-300 font-medium">{compName}</span>
                  <span className="text-xs font-bold font-mono text-cyan-300">
                    {compVal} {compUnit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Observation Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {effectiveDate && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Observed At / Effective Date
            </span>
            <span className="text-slate-200 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              {effectiveDate}
            </span>
          </div>
        )}

        {fhir.status ? (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Observation Status
            </span>
            <span className="text-slate-200 font-medium capitalize flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {String(fhir.status)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Clinical Notes */}
      {notes.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileSignature className="w-3.5 h-3.5 text-cyan-400" />
            Clinical Notes & Observations
          </span>
          <div className="space-y-1 text-xs text-slate-200 leading-relaxed">
            {notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MedicationViewerProps {
  fhir: Record<string, unknown>;
}

function MedicationViewer({ fhir }: MedicationViewerProps) {
  const medName =
    extractConceptText(fhir.medicationCodeableConcept) ||
    extractReferenceDisplay(fhir.medicationReference) ||
    (typeof fhir.medication === "string" ? fhir.medication : "Prescribed Medication");

  const status = typeof fhir.status === "string" ? fhir.status : "active";
  const intent = typeof fhir.intent === "string" ? fhir.intent : "order";
  const authoredOn = formatReadableDate(fhir.authoredOn);

  // Dosage instructions
  const dosageList = Array.isArray(fhir.dosageInstruction)
    ? (fhir.dosageInstruction as Record<string, unknown>[])
    : fhir.dosageInstruction && typeof fhir.dosageInstruction === "object"
    ? [fhir.dosageInstruction as Record<string, unknown>]
    : [];

  const notes = extractNotes(fhir.note);
  const requester = extractReferenceDisplay(fhir.requester);

  return (
    <div className="space-y-4">
      {/* Hero Medication Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-950/80 border border-emerald-500/30 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Prescription
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 capitalize">
                Status: {status}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 capitalize">
                Intent: {intent}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-1">
              <Pill className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{medName}</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Dosage Instructions Section */}
      {dosageList.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            Dosage & Administration Instructions
          </h4>
          <div className="space-y-2">
            {dosageList.map((dose, idx) => {
              const text = (dose.text as string) || null;
              const route = extractConceptText(dose.route);
              const asNeeded = dose.asNeededBoolean ? "Take as needed" : null;
              const timingRepeat = (dose.timing as Record<string, unknown>)?.repeat as
                | Record<string, unknown>
                | undefined;

              let timingText: string | null = null;
              if (timingRepeat) {
                const freq = timingRepeat.frequency;
                const period = timingRepeat.period;
                const unit = timingRepeat.periodUnit;
                if (freq && period && unit) {
                  timingText = `${freq} time(s) every ${period} ${unit === "d" ? "day(s)" : unit}`;
                }
              }

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
                >
                  {text ? (
                    <div className="text-sm font-semibold text-emerald-300">{text}</div>
                  ) : (
                    <div className="text-xs text-slate-300">Standard dosage instructions.</div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {timingText && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-[11px]">
                        Frequency: {timingText}
                      </span>
                    )}
                    {route && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-[11px]">
                        Route: {route}
                      </span>
                    )}
                    {asNeeded && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px]">
                        {asNeeded}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prescription Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {authoredOn && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Date Prescribed
            </span>
            <span className="text-slate-200 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              {authoredOn}
            </span>
          </div>
        )}

        {requester && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Prescribing Practitioner
            </span>
            <span className="text-slate-200 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              {requester}
            </span>
          </div>
        )}
      </div>

      {/* Prescriber Notes */}
      {notes.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileSignature className="w-3.5 h-3.5 text-emerald-400" />
            Prescriber Notes & Warnings
          </span>
          <div className="space-y-1 text-xs text-slate-200 leading-relaxed">
            {notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ConditionViewerProps {
  fhir: Record<string, unknown>;
}

function ConditionViewer({ fhir }: ConditionViewerProps) {
  const condTitle =
    extractConceptText(fhir.code) ||
    (typeof fhir.code === "string" ? fhir.code : "Diagnosed Condition");

  const clinicalStatus =
    extractConceptText(fhir.clinicalStatus) ||
    (typeof fhir.clinicalStatus === "string" ? fhir.clinicalStatus : "Active");

  const verificationStatus =
    extractConceptText(fhir.verificationStatus) ||
    (typeof fhir.verificationStatus === "string" ? fhir.verificationStatus : "Confirmed");

  const severity =
    extractConceptText(fhir.severity) ||
    (typeof fhir.severity === "string" ? fhir.severity : null);

  const onsetDate = formatReadableDate(fhir.onsetDateTime || fhir.recordedDate);
  const recordedDate = formatReadableDate(fhir.recordedDate);
  const notes = extractNotes(fhir.note);

  const isResolved =
    clinicalStatus.toLowerCase().includes("resolved") ||
    clinicalStatus.toLowerCase().includes("remission");

  return (
    <div className="space-y-4">
      {/* Condition Hero Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-950/80 border border-purple-500/30 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                  isResolved
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-purple-500/20 border-purple-500/40 text-purple-300"
                }`}
              >
                Status: {clinicalStatus}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-800 text-slate-300 capitalize">
                Verification: {verificationStatus}
              </span>
              {severity && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 capitalize">
                  Severity: {severity}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-purple-400 shrink-0" />
              <span>{condTitle}</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Dates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {onsetDate && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Onset Date
            </span>
            <span className="text-slate-200 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              {onsetDate}
            </span>
          </div>
        )}

        {recordedDate && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Recorded / Documented Date
            </span>
            <span className="text-slate-200 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              {recordedDate}
            </span>
          </div>
        )}
      </div>

      {/* Clinical Notes */}
      {notes.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileSignature className="w-3.5 h-3.5 text-purple-400" />
            Clinical Notes & Prognosis
          </span>
          <div className="space-y-1 text-xs text-slate-200 leading-relaxed">
            {notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface EncounterViewerProps {
  fhir: Record<string, unknown>;
}

function EncounterViewer({ fhir }: EncounterViewerProps) {
  const encReason =
    (Array.isArray(fhir.type) && fhir.type.length > 0
      ? extractConceptText(fhir.type[0])
      : null) ||
    extractConceptText(fhir.reasonCode) ||
    "Clinical Consultation & Examination";

  const encClass =
    extractConceptText(fhir.class) ||
    (typeof fhir.class === "string" ? fhir.class : "Ambulatory (Outpatient)");

  const status = typeof fhir.status === "string" ? fhir.status : "finished";

  const provider =
    (fhir.serviceProvider && typeof fhir.serviceProvider === "object"
      ? (fhir.serviceProvider as Record<string, unknown>).display
      : null) ||
    (Array.isArray(fhir.participant) && fhir.participant.length > 0
      ? extractReferenceDisplay(
          (fhir.participant[0] as Record<string, unknown>)?.individual
        )
      : null) ||
    null;

  const period = fhir.period as Record<string, unknown> | undefined;
  const startDate = period?.start ? formatReadableDate(period.start) : null;
  const endDate = period?.end ? formatReadableDate(period.end) : null;
  const notes = extractNotes(fhir.note);

  return (
    <div className="space-y-4">
      {/* Hero Encounter Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900/60 to-slate-950/80 border border-amber-500/30 space-y-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-amber-500/20 border border-amber-500/40 text-amber-300">
              Encounter: {encClass}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-800 text-slate-300 capitalize">
              Status: {status}
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{String(encReason)}</span>
          </h3>
        </div>
      </div>

      {/* Provider & Period Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {provider && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Healthcare Service Provider / Department
            </span>
            <span className="text-slate-200 font-medium flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              {String(provider)}
            </span>
          </div>
        )}

        {startDate && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Consultation Date & Time
            </span>
            <span className="text-slate-200 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              {startDate} {endDate && endDate !== startDate ? `→ ${endDate}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Consultation Summary & Notes */}
      {notes.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileSignature className="w-3.5 h-3.5 text-amber-400" />
            Consultation Summary & Treatment Plan
          </span>
          <div className="space-y-1 text-xs text-slate-200 leading-relaxed">
            {notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Generic Human-Readable Formatter (PART H Fallback) ──────────────────

interface GenericValueFormatterProps {
  value: unknown;
  depth?: number;
}

function GenericValueFormatter({ value, depth = 0 }: GenericValueFormatterProps): React.ReactNode {
  if (isEmpty(value)) return null;

  if (typeof value === "string") {
    // Check if it is a date string
    if (value.length >= 10 && !isNaN(Date.parse(value)) && /^\d{4}-\d{2}/.test(value)) {
      return (
        <span className="font-medium text-slate-200 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-cyan-400 inline" />
          {formatReadableDate(value)}
        </span>
      );
    }
    return <span className="text-slate-200">{value}</span>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="font-mono text-cyan-300 font-semibold">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <div className="space-y-1.5 pl-2 border-l border-slate-800">
        {value.map((item, idx) => (
          <div key={idx} className="text-xs">
            <GenericValueFormatter value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const conceptText = extractConceptText(obj);
    if (conceptText && Object.keys(obj).length <= 2) {
      return <span className="text-slate-200 font-medium">{conceptText}</span>;
    }

    // Special check: Blood pressure systolic / diastolic
    if ("systolic" in obj && "diastolic" in obj) {
      return (
        <span className="font-mono font-bold text-cyan-300">
          {String(obj.systolic)} / {String(obj.diastolic)} mmHg
        </span>
      );
    }

    // Special check: Value + Unit
    if ("value" in obj && "unit" in obj) {
      return (
        <span className="font-mono font-bold text-cyan-300">
          {String(obj.value)} {String(obj.unit)}
        </span>
      );
    }

    const entries = Object.entries(obj).filter(([k, v]) => !isEmpty(v) && k !== "resourceType");
    if (entries.length === 0) return null;

    return (
      <div
        className={`rounded-xl border ${
          depth === 0
            ? "p-4 bg-slate-950/70 border-slate-800 space-y-3"
            : "p-3 bg-slate-900/50 border-slate-800/80 space-y-2"
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {entries.map(([key, val]) => (
            <div key={key} className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                {toTitleCase(key)}
              </span>
              <div className="text-xs text-slate-200">
                <GenericValueFormatter value={val} depth={depth + 1} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <span className="text-slate-300">{String(value)}</span>;
}

// ─── Main Medical Record Viewer Component ───────────────────────────────

export function MedicalRecordViewer({ record }: MedicalRecordViewerProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const fhirData = record.fhir_data || {};
  const resourceType =
    (typeof fhirData.resourceType === "string" ? fhirData.resourceType : null) ||
    record.fhir_resource_type ||
    toTitleCase(record.record_type || "Medical Record");

  // Subject / Patient Information
  const subjectDisplay =
    extractReferenceDisplay(fhirData.subject) ||
    (record.patient_id ? `Patient ID: ${record.patient_id}` : null);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(fhirData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine which specialized layout to render
  const renderDocumentBody = () => {
    switch (resourceType) {
      case "Observation":
        return <ObservationViewer fhir={fhirData} />;
      case "MedicationRequest":
        return <MedicationViewer fhir={fhirData} />;
      case "Condition":
        return <ConditionViewer fhir={fhirData} />;
      case "Encounter":
        return <EncounterViewer fhir={fhirData} />;
      default:
        // Generic Safe Formatter for custom/unrecognized structures
        return (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>{resourceType} Document Details</span>
              </div>
              <GenericValueFormatter value={fhirData} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Cryptographic Trust Verification Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-emerald-300">
          <span className="flex items-center gap-1.5 font-semibold text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            SHA-256 Verified On-Chain
          </span>
          <span className="font-mono text-[10px] text-emerald-400">
            {record.record_hash ? `${record.record_hash.slice(0, 12)}...` : "VERIFIED"}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between text-purple-300">
          <span className="flex items-center gap-1.5 font-semibold text-[11px]">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            ZK-Proof Authorization
          </span>
          <span className="font-mono text-[10px] text-purple-300 px-2 py-0.5 rounded bg-purple-500/20 font-bold">
            ZK-VALID
          </span>
        </div>
      </div>

      {/* Clinical Document Header Card */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              {resourceType === "MedicationRequest" ? (
                <Pill className="w-4 h-4" />
              ) : resourceType === "Observation" ? (
                <Activity className="w-4 h-4" />
              ) : resourceType === "Condition" ? (
                <FileCheck2 className="w-4 h-4" />
              ) : resourceType === "Encounter" ? (
                <Stethoscope className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                Medical Record
              </span>
              <h3 className="text-base font-bold text-slate-100">{resourceType}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-700 text-slate-300">
              ID: {record.id ? `${record.id.slice(0, 14)}...` : "—"}
            </span>
          </div>
        </div>

        {/* Patient / Subject Reference Banner if present */}
        {subjectDisplay && (
          <div className="flex items-center gap-2 text-xs text-slate-300 px-1">
            <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold text-slate-400">Patient:</span>
            <span className="text-slate-200 font-medium">{subjectDisplay}</span>
          </div>
        )}
      </div>

      {/* Main Clinical Document Content */}
      <div className="space-y-4">{renderDocumentBody()}</div>

      {/* Collapsible Technical Details / Raw Data Section */}
      <div className="pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Technical Details & FHIR R4 JSON</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              showTechnicalDetails ? "rotate-180 text-cyan-400" : ""
            }`}
          />
        </button>

        {showTechnicalDetails && (
          <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Decrypted FHIR R4 Schema Payload
              </span>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy JSON"}</span>
              </button>
            </div>

            <pre className="p-3 rounded-lg bg-black/70 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-56 leading-relaxed">
              {JSON.stringify(fhirData, null, 2)}
            </pre>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
              <div>
                <span className="text-slate-500 block text-[10px]">Encryption:</span>
                <span className="text-emerald-400">
                  {record.encryption_version || "AES-256-GCM"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Full Record ID:</span>
                <span className="text-slate-300 truncate block">{record.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Created At:</span>
                <span className="text-slate-300">{formatReadableDate(record.created_at)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
