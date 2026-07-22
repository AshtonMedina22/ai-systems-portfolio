"use client";

import { useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { TerminalStream } from "@/components/ui/TerminalStream";
import { CreditCard, FileLock2, IdCard } from "lucide-react";

const SCENARIOS = [
  {
    key: "ssn",
    label: "SSN in prompt payload",
    detail: "Redacts Social Security numbers before the model sees them",
    icon: <IdCard className="h-4 w-4 text-rose-700" />,
  },
  {
    key: "card",
    label: "Credit card in chat input",
    detail: "Strips PAN data and flags a compliance event",
    icon: <CreditCard className="h-4 w-4 text-amber-700" />,
  },
  {
    key: "record",
    label: "Confidential record leak test",
    detail: "Redacts confidential fields before they leave the trust boundary",
    icon: <FileLock2 className="h-4 w-4 text-emerald-700" />,
  },
] as const;

export default function GuardrailsPage() {
  const [selected, setSelected] = useState<(typeof SCENARIOS)[number]["key"]>(
    "ssn"
  );

  return (
    <GlassBox
      title="Enterprise Guardrails"
      badge="Project 3 - Evals - Data Privacy & Safety Suite"
      description="Automated PII redaction and AI quality inspection. Sensitive fields can be stripped before inputs reach LLMs to help reduce data-exposure risk."
      controlLabel="Business overview"
      controlHint="Scenario input"
      controlPanel={
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-violet-50/60 px-4 py-3.5 space-y-2">
            <p className="label-opal">Business impact</p>
            <p className="text-sm leading-relaxed text-opal-muted">
              Helps lower compliance and data-leak risk by redacting SSNs,
              cards, and other sensitive fields before model calls.
            </p>
          </div>

          <div>
            <label className="label-opal mb-2.5 block">Select scenario</label>
            <div className="grid grid-cols-1 gap-2.5">
              {SCENARIOS.map((scenario) => {
                const active = selected === scenario.key;
                return (
                  <button
                    key={scenario.key}
                    type="button"
                    onClick={() => setSelected(scenario.key)}
                    className={`flex items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-all ${
                      active
                        ? "border-violet-400 bg-violet-50 text-opal-main shadow-sm ring-1 ring-violet-200"
                        : "border-slate-200/80 bg-white text-opal-muted hover:border-violet-300 hover:bg-violet-50/40"
                    }`}
                  >
                    <span className="mt-0.5">{scenario.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold text-opal-main">
                        {scenario.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-opal-muted">
                        {scenario.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
            <p className="label-opal mb-2">Enterprise connectors</p>
            <p className="text-sm leading-relaxed text-opal-muted">
              Promptfoo evals - Real-time PII sanitizer - HIPAA and GDPR
              compliance checks
            </p>
          </div>

          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-opal-purple/70 px-4 py-3.5 text-sm font-semibold text-white opacity-70 cursor-not-allowed"
          >
            Run guardrails demo (coming next)
          </button>
        </div>
      }
      streamPanel={
        <TerminalStream
          logs={[]}
          title="Technical execution"
          emptyMessage={
            <p>
              Live evaluation outputs and PII redaction traces will stream here
              once Project 3 is wired.
            </p>
          }
        />
      }
    />
  );
}
