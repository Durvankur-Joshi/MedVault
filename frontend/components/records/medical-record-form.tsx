"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Pill,
  FileCheck2,
  Stethoscope,
  ChevronDown,
  Code2,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  User as UserIcon,
} from "lucide-react";
import { createRecord } from "@/services/records";
import { searchPatients } from "@/services/patients";
import { useAuth } from "@/hooks/use-auth";
import type { CreateRecordPayload, PatientSearchResult, MedicalRecord } from "@/types";

interface MedicalRecordFormProps {
  onSuccess: (record: MedicalRecord) => void;
  onCancel: () => void;
}

type FHIRType = "Observation" | "MedicationRequest" | "Condition" | "Encounter";

export function MedicalRecordForm({ onSuccess, onCancel }: MedicalRecordFormProps) {
  const { user } = useAuth();
  const isDoctor = user?.role === "doctor" || user?.role === "hospital_admin";

  const [resourceType, setResourceType] = useState<FHIRType>("Observation");
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Doctor Patient Selection
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Observation Fields
  const [obsName, setObsName] = useState("Systolic Blood Pressure");
  const [obsCategory, setObsCategory] = useState("vital-signs");
  const [obsStatus, setObsStatus] = useState("final");
  const [obsValue, setObsValue] = useState("120");
  const [obsUnit, setObsUnit] = useState("mmHg");
  const [obsInterpretation, setObsInterpretation] = useState("Normal");
  const [obsNotes, setObsNotes] = useState("Routine vitals checkup.");

  // MedicationRequest Fields
  const [medName, setMedName] = useState("Amoxicillin 500mg Tablet");
  const [medStatus, setMedStatus] = useState("active");
  const [medIntent, setMedIntent] = useState("order");
  const [medDosage, setMedDosage] = useState("Take 1 tablet by mouth twice daily with food");
  const [medDuration, setMedDuration] = useState("5 days");
  const [medNotes, setMedNotes] = useState("Finish full course as prescribed.");

  // Condition Fields
  const [condTitle, setCondTitle] = useState("Essential (Primary) Hypertension");
  const [condClinicalStatus, setCondClinicalStatus] = useState("active");
  const [condVerStatus, setCondVerStatus] = useState("confirmed");
  const [condSeverity, setCondSeverity] = useState("moderate");
  const [condOnsetDate, setCondOnsetDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [condNotes, setCondNotes] = useState("Stage 1 hypertension, lifestyle changes recommended.");

  // Encounter Fields
  const [encReason, setEncReason] = useState("Annual Preventive Cardiology Follow-up");
  const [encStatus, setEncStatus] = useState("finished");
  const [encClass, setEncClass] = useState("AMB");
  const [encProvider, setEncProvider] = useState("Department of Cardiology");
  const [encNotes, setEncNotes] = useState("Patient is asymptomatic. ECG normal.");

  // Debounced Patient Search
  useEffect(() => {
    if (!isDoctor || !patientQuery || patientQuery.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingPatients(true);
      try {
        const results = await searchPatients(patientQuery.trim());
        setPatientResults(results);
      } catch {
        setPatientResults([]);
      } finally {
        setSearchingPatients(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery, isDoctor]);

  // Construct standard FHIR R4 JSON object
  const buildFHIRData = (): Record<string, unknown> => {
    switch (resourceType) {
      case "Observation":
        return {
          resourceType: "Observation",
          status: obsStatus,
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: obsCategory,
                  display: obsCategory,
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "8480-6",
                display: obsName,
              },
            ],
            text: obsName,
          },
          valueQuantity: {
            value: isNaN(parseFloat(obsValue)) ? obsValue : parseFloat(obsValue),
            unit: obsUnit,
          },
          interpretation: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                  code: obsInterpretation.toUpperCase(),
                  display: obsInterpretation,
                },
              ],
            },
          ],
          note: obsNotes ? [{ text: obsNotes }] : [],
          subject: { reference: selectedPatient ? `Patient/${selectedPatient.id}` : "Patient/self" },
          effectiveDateTime: new Date().toISOString(),
        };

      case "MedicationRequest":
        return {
          resourceType: "MedicationRequest",
          status: medStatus,
          intent: medIntent,
          medicationCodeableConcept: {
            coding: [
              {
                system: "http://www.nlm.nih.gov/research/umls/rxnorm",
                code: "197361",
                display: medName,
              },
            ],
            text: medName,
          },
          subject: { reference: selectedPatient ? `Patient/${selectedPatient.id}` : "Patient/self" },
          authoredOn: new Date().toISOString(),
          dosageInstruction: [
            {
              text: `${medDosage} (Duration: ${medDuration})`,
              timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } },
            },
          ],
          note: medNotes ? [{ text: medNotes }] : [],
        };

      case "Condition":
        return {
          resourceType: "Condition",
          clinicalStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
                code: condClinicalStatus,
                display: condClinicalStatus,
              },
            ],
          },
          verificationStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                code: condVerStatus,
                display: condVerStatus,
              },
            ],
          },
          severity: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: condSeverity,
                display: condSeverity,
              },
            ],
          },
          code: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "38341003",
                display: condTitle,
              },
            ],
            text: condTitle,
          },
          subject: { reference: selectedPatient ? `Patient/${selectedPatient.id}` : "Patient/self" },
          recordedDate: condOnsetDate || new Date().toISOString().split("T")[0],
          note: condNotes ? [{ text: condNotes }] : [],
        };

      case "Encounter":
        return {
          resourceType: "Encounter",
          status: encStatus,
          class: {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            code: encClass,
            display: encClass === "AMB" ? "Ambulatory" : encClass === "EMER" ? "Emergency" : "Inpatient",
          },
          type: [{ text: encReason }],
          subject: { reference: selectedPatient ? `Patient/${selectedPatient.id}` : "Patient/self" },
          period: { start: new Date().toISOString() },
          serviceProvider: { display: encProvider },
          note: encNotes ? [{ text: encNotes }] : [],
        };
    }
  };

  const mapToRecordType = (fType: FHIRType): string => {
    switch (fType) {
      case "Observation":
        return "observation";
      case "MedicationRequest":
        return "medication_request";
      case "Condition":
        return "condition";
      case "Encounter":
        return "encounter";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isDoctor && !selectedPatient) {
      setError("Doctor must select a target patient to create a clinical record.");
      return;
    }

    setSubmitting(true);
    try {
      const fhirData = buildFHIRData();
      const payload: CreateRecordPayload = {
        record_type: mapToRecordType(resourceType),
        fhir_resource_type: resourceType,
        fhir_data: fhirData,
        patient_id: selectedPatient ? selectedPatient.id : undefined,
      };

      const record = await createRecord(payload);
      onSuccess(record);
    } catch (err: any) {
      setError(err.message || "Failed to create encrypted medical record.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeFhirData = buildFHIRData();

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
      {/* Resource Type Selector Tabs */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Medical Record Category
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setResourceType("Observation")}
            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
              resourceType === "Observation"
                ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-200 shadow-md shadow-cyan-950/40"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs font-bold">Observation</div>
              <div className="text-[10px] text-slate-400">Vitals & Labs</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setResourceType("MedicationRequest")}
            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
              resourceType === "MedicationRequest"
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-200 shadow-md shadow-emerald-950/40"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Pill className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold">Medication</div>
              <div className="text-[10px] text-slate-400">Prescriptions</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setResourceType("Condition")}
            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
              resourceType === "Condition"
                ? "bg-purple-500/15 border-purple-500/50 text-purple-200 shadow-md shadow-purple-950/40"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-xs font-bold">Condition</div>
              <div className="text-[10px] text-slate-400">Diagnosis & Problems</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setResourceType("Encounter")}
            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
              resourceType === "Encounter"
                ? "bg-amber-500/15 border-amber-500/50 text-amber-200 shadow-md shadow-amber-950/40"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Stethoscope className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold">Encounter</div>
              <div className="text-[10px] text-slate-400">Consultation</div>
            </div>
          </button>
        </div>
      </div>

      {/* Doctor Patient Selector */}
      {isDoctor && (
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Target Patient <span className="text-red-400">*</span>
          </label>

          {selectedPatient ? (
            <div className="flex items-center justify-between p-2.5 bg-cyan-950/40 border border-cyan-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-200">
                  {selectedPatient.display_name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({selectedPatient.id.slice(0, 8)}...)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-800"
              >
                Change Patient
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Search patient by display name..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                {searchingPatients && (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin absolute right-3 top-3" />
                )}
              </div>

              {patientResults.length > 0 && (
                <div className="absolute left-0 right-0 top-11 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-800">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientQuery("");
                        setPatientResults([]);
                      }}
                      className="w-full p-2.5 text-left hover:bg-cyan-950/40 text-xs flex items-center justify-between text-slate-300 hover:text-cyan-200"
                    >
                      <span className="font-semibold">{p.display_name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {p.id.slice(0, 8)}...
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dynamic Form Content */}
      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-4">
        {/* OBSERVATION FORM */}
        {resourceType === "Observation" && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Observation Name</label>
                <input
                  type="text"
                  value={obsName}
                  onChange={(e) => setObsName(e.target.value)}
                  placeholder="e.g. Systolic Blood Pressure, Fasting Blood Glucose"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Category</label>
                <select
                  value={obsCategory}
                  onChange={(e) => setObsCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="vital-signs">Vital Signs</option>
                  <option value="laboratory">Laboratory / Pathology</option>
                  <option value="exam">Clinical Examination</option>
                  <option value="procedure">Procedure Finding</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Measured Value</label>
                <input
                  type="text"
                  value={obsValue}
                  onChange={(e) => setObsValue(e.target.value)}
                  placeholder="e.g. 120, 5.7, 98.6"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Unit of Measurement</label>
                <input
                  type="text"
                  value={obsUnit}
                  onChange={(e) => setObsUnit(e.target.value)}
                  placeholder="e.g. mmHg, mg/dL, °F, bpm"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Interpretation</label>
                <select
                  value={obsInterpretation}
                  onChange={(e) => setObsInterpretation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Clinical Notes & Observations</label>
              <textarea
                value={obsNotes}
                onChange={(e) => setObsNotes(e.target.value)}
                rows={2}
                placeholder="Additional findings, device calibration, or context..."
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* MEDICATION REQUEST FORM */}
        {resourceType === "MedicationRequest" && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Medication Name & Strength</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="e.g. Amoxicillin 500mg, Metformin 500mg"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Prescription Status</label>
                <select
                  value={medStatus}
                  onChange={(e) => setMedStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="active">Active (Ongoing)</option>
                  <option value="completed">Completed Course</option>
                  <option value="on-hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Dosage Instructions</label>
                <input
                  type="text"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  placeholder="e.g. 1 tablet twice daily after meals"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Duration</label>
                <input
                  type="text"
                  value={medDuration}
                  onChange={(e) => setMedDuration(e.target.value)}
                  placeholder="e.g. 5 days, 30 days, Chronic"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Prescriber Notes & Warnings</label>
              <textarea
                value={medNotes}
                onChange={(e) => setMedNotes(e.target.value)}
                rows={2}
                placeholder="Special precautions, food interactions, refill policies..."
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* CONDITION FORM */}
        {resourceType === "Condition" && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Diagnosis / Condition Title</label>
                <input
                  type="text"
                  value={condTitle}
                  onChange={(e) => setCondTitle(e.target.value)}
                  placeholder="e.g. Essential Hypertension, Type 2 Diabetes"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Clinical Status</label>
                <select
                  value={condClinicalStatus}
                  onChange={(e) => setCondClinicalStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="active">Active</option>
                  <option value="recurrence">Recurrence</option>
                  <option value="remission">In Remission</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Verification Status</label>
                <select
                  value={condVerStatus}
                  onChange={(e) => setCondVerStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="provisional">Provisional</option>
                  <option value="differential">Differential</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Severity</label>
                <select
                  value={condSeverity}
                  onChange={(e) => setCondSeverity(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Onset Date</label>
                <input
                  type="date"
                  value={condOnsetDate}
                  onChange={(e) => setCondOnsetDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Clinical Prognosis & Notes</label>
              <textarea
                value={condNotes}
                onChange={(e) => setCondNotes(e.target.value)}
                rows={2}
                placeholder="Diagnostic criteria, symptoms presented, management strategy..."
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* ENCOUNTER FORM */}
        {resourceType === "Encounter" && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Consultation Reason / Type</label>
                <input
                  type="text"
                  value={encReason}
                  onChange={(e) => setEncReason(e.target.value)}
                  placeholder="e.g. Annual Health Checkup, Cardiology Follow-up"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Encounter Class</label>
                <select
                  value={encClass}
                  onChange={(e) => setEncClass(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="AMB">Ambulatory (Outpatient Clinic)</option>
                  <option value="EMER">Emergency Room</option>
                  <option value="IMP">Inpatient Admission</option>
                  <option value="VR">Virtual / Telehealth</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Service Provider / Hospital Department</label>
              <input
                type="text"
                value={encProvider}
                onChange={(e) => setEncProvider(e.target.value)}
                placeholder="e.g. Department of Cardiology, ER Unit 2"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Consultation Summary & Treatment Plan</label>
              <textarea
                value={encNotes}
                onChange={(e) => setEncNotes(e.target.value)}
                rows={2}
                placeholder="Clinical evaluation findings, recommendations, follow-up advice..."
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Optional Advanced FHIR JSON Preview */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowAdvancedJson(!showAdvancedJson)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{showAdvancedJson ? "Hide" : "Show"} Advanced FHIR R4 JSON</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform ${showAdvancedJson ? "rotate-180" : ""}`}
          />
        </button>

        {showAdvancedJson && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-40 animate-fade-in">
            <pre>{JSON.stringify(activeFhirData, null, 2)}</pre>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/50 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Encrypting & Anchoring...</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Encrypt & Save Medical Record</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
