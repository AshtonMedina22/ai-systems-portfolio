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
    detail: "Tax ID matches with name variation; routing does not match",
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
    <main className="min-h-screen">
      <GlassBox
        title="PayFlow"
        framing={PAYFLOW_FRAMING}
        badge="Project 1"
        purpose="Invoice verification that flags mismatched vendor bank details before payout."
        valueLine="Receives structured invoice data, runs automated vendor and bank verification, and blocks ledger posting until both checks pass."
        controlStatement="Nothing posts to the ledger without server-owned verification evidence from both checks - vendor match against the registry, and bank routing against the approved profile."
        challenge="A slightly altered routing number can send money to the wrong account before anyone catches it, especially when vendor checks are informal."
        solution="An invoice verification path that matches vendors to the registry, checks bank routing against approved profiles, and holds mismatched payouts for AP manager review."
        impact="Unknown vendors and routing mismatches are held before money moves, with an explicit AP manager release or reject path."
        guardrails={{
          objective:
            "Automate vendor verification against the ERP registry to catch routing mismatches before payouts are processed.",
          access:
            "Read-only query access to the vendor registry. Write access is restricted to flagging and holding records in the staging ledger.",
          failure:
            "Mismatches automatically halt the flow and route the invoice to an AP manager for manual review and release.",
        }}
        whenWrong={
          <div className="rounded-xl border border-line bg-console-panel px-4 py-4 sm:px-5 sm:py-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Mismatch path
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Unknown or low-confidence vendors fail the registry gate.
                  Exact tax-ID match can allow name variation; a routing
                  mismatch against the approved profile fails the bank check.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Payment held
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  A routing mismatch opens a persisted demo hold. Ops console
                  status moves to held - nothing posts without fresh evidence.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Who reviews
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  AP manager reviews the hold in the ops console, with reason
                  and audit trail on resolution.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  How it is released
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Release requires applying the approved profile routing,
                  re-running both checks, and posting with fresh evidence.
                  Reject closes the hold without posting.
                </dd>
              </div>
            </dl>
          </div>
        }
        architectureVisual={<PayFlowArchitectureFlow />}
        architecture="Each step streams into the ops console over SSE. Hosted FastMCP is preferred when reachable; otherwise the embedded tool runtime enforces the same evidence gate. Pass posts; fail opens an AP manager hold."
        tradeoffs={[
          "Demo/session hold storage is in-memory - fine for a portfolio run, not durable across serverless cold starts.",
          "Deterministic tool sequence over an open-ended LLM agent - clearer demos and safer money decisions.",
          "Embedded MCP fallback when HTTP MCP is down keeps the public demo accurate; local FastMCP is the fuller integration story.",
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
                <span className="font-display text-xl font-semibold text-accent-deep">
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
                            ? "text-danger"
                            : selectedPreset === "unknown_vendor"
                              ? "text-warn"
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
                      <span className="font-mono text-xs">
                        {activeInvoice.vendorTaxId}
                      </span>
                    ),
                  },
                  {
                    label: "Routing",
                    value: (
                      <span
                        className={`font-mono text-xs ${
                          selectedPreset === "spoofed_bank" ? "text-danger" : ""
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
            onAppendLogs={(entries) =>
              setLogs((prev) => [...prev, ...entries])
            }
          />
        }
      />
    </main>
  );
}
