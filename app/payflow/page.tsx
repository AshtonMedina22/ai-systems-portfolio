"use client";

import React, { useMemo, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { PayFlowOpsConsole } from "@/components/visualizers/PayFlowOpsConsole";
import { PayFlowArchitectureFlow } from "@/components/visualizers/PayFlowArchitectureFlow";
import { Badge } from "@/components/ui/Badge";
import {
  DemoPrimaryButton,
  DetailList,
  ResultRow,
  ResultStrip,
  ScenarioList,
  ScenarioOption,
} from "@/components/ui/DemoControls";
import { SAMPLE_INVOICES, InvoicePayload } from "@/lib/payflow/types";
import { PAYFLOW_FRAMING } from "@/lib/payflow/runtime";
import {
  deriveExecutiveKpis,
  RiskTone,
} from "@/lib/payflow/executive-summary";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LogEntry } from "@/components/ui/TerminalStream";

type PresetKey = "clean" | "spoofed_bank" | "unknown_vendor";

const PRESETS: Array<{
  key: PresetKey;
  label: string;
  detail: string;
  tone: "default" | "danger" | "warn";
}> = [
  {
    key: "clean",
    label: "Normal invoice",
    detail: "Vendor and bank details match the registry",
    tone: "default",
  },
  {
    key: "spoofed_bank",
    label: "Suspicious invoice",
    detail: "Vendor-name typo and mismatched routing number",
    tone: "danger",
  },
  {
    key: "unknown_vendor",
    label: "Unknown vendor",
    detail: "Not in the company registry - payment should stop",
    tone: "warn",
  },
];

const RISK_BADGE: Record<RiskTone, BadgeTone> = {
  pending: "neutral",
  low: "ok",
  high: "danger",
  blocked: "danger",
};

export default function PayFlowPage() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("clean");
  const [activeInvoice, setActiveInvoice] = useState<InvoicePayload>(
    SAMPLE_INVOICES.clean
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const kpis = useMemo(() => deriveExecutiveKpis(logs), [logs]);
  const showImpact = logs.length > 0 || isRunning;

  const handleSelectPreset = (key: PresetKey) => {
    setSelectedPreset(key);
    setActiveInvoice(SAMPLE_INVOICES[key]);
    setLogs([]);
  };

  const handleRunAgent = async () => {
    setIsRunning(true);
    setLogs([]);

    try {
      const response = await fetch("/api/payflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice: activeInvoice }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to /api/payflow stream endpoint.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const logEntry: LogEntry = JSON.parse(trimmed.substring(6));
              setLogs((prev) => [...prev, logEntry]);
            } catch (err) {
              console.error("Error parsing SSE log payload:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Stream reader error:", err);
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          source: "client:payflow",
          message:
            "Connection lost or stream interrupted while processing the AP workflow.",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen">
      <GlassBox
        title="PayFlow"
        framing={PAYFLOW_FRAMING}
        badge="Project 1"
        purpose="Invoice verification that flags mismatched vendor bank details before payout."
        valueLine="Replaces manual keying of every invoice, and stops bad vendor or routing before money moves."
        controlStatement="Nothing posts to the ledger without passing both checks - vendor match against the registry, and bank routing against the approved profile."
        challenge="Manual invoice checks take hours, and a slightly altered routing number can send money to the wrong account before anyone catches it."
        solution="An invoice verification path that matches vendors to the registry, checks bank routing against approved profiles, and holds mismatched payouts."
        impact="Bad vendor or routing is held before money moves, with a clear path for AP review instead of hoping someone notices."
        whenWrong={
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5 sm:py-5">
            <p className="label-opal">What happens when it is wrong</p>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Mismatch path
                </dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-opal-muted sm:text-[15px]">
                  A mistyped vendor name or routing that does not match the
                  registry fails the gate. The run intercepts before any ledger
                  post.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Payment held
                </dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-opal-muted sm:text-[15px]">
                  The payout is flagged and held. Ops console status moves to
                  intercepted or blocked - nothing clears for payment.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Who reviews
                </dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-opal-muted sm:text-[15px]">
                  AP or a manager reviews the escalation notice the live run
                  surfaces in the ops console.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  How it is released
                </dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-opal-muted sm:text-[15px]">
                  A person resolves the hold after review. This demo stops at
                  intercept and notice - it does not auto-clear the payment.
                </dd>
              </div>
            </dl>
          </div>
        }
        architectureVisual={<PayFlowArchitectureFlow />}
        architecture="Each step streams into the ops console over SSE. Pass posts to the ledger; fail holds the payment and raises the escalation notice you see in the live run."
        tradeoffs={[
          "Live MCP on Vercel means cold starts and env wiring - slower first run than a pure mock, but the tool path is real.",
          "Deterministic tool sequence over an open-ended LLM agent - clearer demos and safer money decisions, less agent theater.",
          "Embedded MCP fallback when HTTP MCP is down keeps the portfolio demo up; local FastMCP is the fuller integration story.",
        ]}
        stack="Python, FastMCP, Next.js, SSE"
        isRunning={isRunning}
        controlLabel="Scenario"
        controlPanel={
          <div className="flex flex-col gap-6">
            <ScenarioList label="Pick an invoice">
              {PRESETS.map((preset) => (
                <ScenarioOption
                  key={preset.key}
                  label={preset.label}
                  detail={preset.detail}
                  active={selectedPreset === preset.key}
                  onClick={() => handleSelectPreset(preset.key)}
                  tone={preset.tone}
                />
              ))}
            </ScenarioList>

            <div>
              <p className="label-opal mb-3">Selected</p>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="font-mono text-[12px] font-semibold text-opal-label">
                  {activeInvoice.invoiceId}
                </span>
                <span className="font-display text-xl font-medium text-opal-violet">
                  ${activeInvoice.invoiceAmount.toLocaleString()}
                </span>
              </div>
              <DetailList
                rows={[
                  {
                    label: "Vendor",
                    value: (
                      <span
                        className={
                          selectedPreset === "spoofed_bank"
                            ? "text-rose-700"
                            : selectedPreset === "unknown_vendor"
                              ? "text-amber-700"
                              : undefined
                        }
                      >
                        {activeInvoice.vendorName}
                      </span>
                    ),
                  },
                  {
                    label: "Tax ID",
                    value: (
                      <span className="font-mono text-[12px]">
                        {activeInvoice.vendorTaxId}
                      </span>
                    ),
                  },
                  {
                    label: "Routing",
                    value: (
                      <span
                        className={`font-mono text-[12px] ${
                          selectedPreset === "spoofed_bank"
                            ? "text-rose-700"
                            : ""
                        }`}
                      >
                        {activeInvoice.bankDetails.routingNumber}
                      </span>
                    ),
                  },
                ]}
              />
            </div>

            {showImpact ? (
              <ResultStrip>
                <p className="label-opal mb-1">Result</p>
                <ResultRow
                  label="Risk"
                  value={
                    <Badge tone={RISK_BADGE[kpis.riskLevel]}>
                      {kpis.riskLabel}
                    </Badge>
                  }
                />
                <ResultRow
                  label="Action"
                  value={
                    kpis.actionLabel ??
                    (isRunning ? "Running checks..." : "-")
                  }
                />
                {kpis.timeSavedMinutes != null ? (
                  <ResultRow
                    label="Time saved"
                    value={`About ${kpis.timeSavedMinutes} min`}
                  />
                ) : null}
              </ResultStrip>
            ) : null}

            <DemoPrimaryButton
              label="Run invoice check"
              busyLabel="Checking invoice..."
              isRunning={isRunning}
              onClick={handleRunAgent}
            />
          </div>
        }
        streamPanel={
          <PayFlowOpsConsole
            logs={logs}
            isRunning={isRunning}
            invoice={activeInvoice}
            liveLabel={PAYFLOW_FRAMING}
            onClear={() => setLogs([])}
          />
        }
      />
    </div>
  );
}
