"use client";

import React, { useMemo, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { PrivacyOpsConsole } from "@/components/visualizers/PrivacyOpsConsole";
import { PrivacyArchitectureFlow } from "@/components/visualizers/PrivacyArchitectureFlow";
import { PrivacyExceptionRecovery } from "@/components/visualizers/PrivacyExceptionRecovery";
import { Badge } from "@/components/ui/Badge";
import {
  DemoPrimaryButton,
  DetailList,
  ResultRow,
  ResultStrip,
  ScenarioList,
  ScenarioOption,
} from "@/components/ui/DemoControls";
import {
  BULK_FINDING_THRESHOLD,
  MAX_PAYLOAD_CHARS,
  PRIVACY_REVIEWER_ROLE,
  SAMPLE_SCENARIOS,
  type FindingKind,
  type PrivacyReceipt,
  type PrivacyScenarioKey,
  type ProxyDecision,
} from "@/lib/privacy/types";
import { PRIVACY_FRAMING } from "@/lib/privacy/runtime";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LogEntry } from "@/components/ui/TerminalStream";

const PRESETS: Array<{
  key: Exclude<PrivacyScenarioKey, "custom">;
  label: string;
  detail: string;
  tone: "default" | "danger";
}> = [
  {
    key: "clean",
    label: SAMPLE_SCENARIOS.clean.label,
    detail: SAMPLE_SCENARIOS.clean.detail,
    tone: "default",
  },
  {
    key: "embedded_pii",
    label: SAMPLE_SCENARIOS.embedded_pii.label,
    detail: SAMPLE_SCENARIOS.embedded_pii.detail,
    tone: "danger",
  },
  {
    key: "bulk_block",
    label: SAMPLE_SCENARIOS.bulk_block.label,
    detail: SAMPLE_SCENARIOS.bulk_block.detail,
    tone: "danger",
  },
];

function decisionTone(decision: ProxyDecision | null): BadgeTone {
  if (decision === "passed") return "ok";
  if (decision === "sanitized") return "warn";
  if (decision === "blocked") return "danger";
  return "neutral";
}

function deriveRun(logs: LogEntry[]) {
  let decision: ProxyDecision | null = null;
  let findingCount = 0;
  let receipt: PrivacyReceipt | null = null;
  let reviewCaseId: string | null = null;

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.decision === "string") {
      decision = data.decision as ProxyDecision;
    }
    if (typeof data.findingCount === "number") findingCount = data.findingCount;
    if (data.receipt && typeof data.receipt === "object") {
      receipt = data.receipt as PrivacyReceipt;
      if (receipt.securityReview?.caseId) {
        reviewCaseId = receipt.securityReview.caseId;
      }
    }
    const review = data.review;
    if (review && typeof review === "object" && "caseId" in review) {
      const caseId = (review as { caseId?: unknown }).caseId;
      if (typeof caseId === "string") reviewCaseId = caseId;
    }
  }

  return { decision, findingCount, receipt, reviewCaseId };
}

async function readSse(
  response: Response,
  onEntry: (entry: LogEntry) => void
) {
  if (!response.ok || !response.body) {
    throw new Error("Failed to connect to /api/privacy stream.");
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
          onEntry(JSON.parse(trimmed.substring(6)) as LogEntry);
        } catch (err) {
          console.error("Error parsing privacy SSE:", err);
        }
      }
    }
  }
}

export default function PrivacyPage() {
  const [selected, setSelected] =
    useState<PrivacyScenarioKey>("embedded_pii");
  const [customText, setCustomText] = useState(
    "Please call back at 415-555-0134 about PO-4412. No card or SSN in this note."
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const inboundText =
    selected === "custom"
      ? customText
      : SAMPLE_SCENARIOS[selected].sourceText;
  const run = useMemo(() => deriveRun(logs), [logs]);
  const showImpact = logs.length > 0 || isRunning;
  const charCount = inboundText.length;

  const handleSelect = (key: PrivacyScenarioKey) => {
    if (isRunning) return;
    setSelected(key);
    setLogs([]);
  };

  const runProxy = async (options?: {
    suppressKinds?: FindingKind[];
    overrideReason?: string;
  }) => {
    setIsRunning(true);
    setLogs([]);

    try {
      const response = await fetch("/api/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioKey: selected,
          sourceText: selected === "custom" ? customText : undefined,
          suppressKinds: options?.suppressKinds,
          overrideReason: options?.overrideReason,
          actor: PRIVACY_REVIEWER_ROLE,
        }),
      });
      await readSse(response, (entry) => {
        setLogs((prev) => [...prev, entry]);
      });
    } catch (err) {
      console.error("Privacy stream error:", err);
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          source: "client:privacy",
          message: "Connection lost or stream interrupted during privacy scan.",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReleaseFalsePositive = async (kind: FindingKind) => {
    await runProxy({
      suppressKinds: [kind],
      overrideReason:
        "Support workflow needs this field - false-positive release for this run only.",
    });
  };

  const handleAcknowledgeReview = () => {
    if (!run.reviewCaseId) return;
    setLogs((prev) => [
      ...prev,
      {
        id: `ack-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        level: "success",
        source: "privacy:review",
        message: `Security review case ${run.reviewCaseId} acknowledged.`,
        data: {
          action: "SECURITY_REVIEW_ACKNOWLEDGED",
          caseId: run.reviewCaseId,
          actor: PRIVACY_REVIEWER_ROLE,
          acknowledgedAt: new Date().toISOString(),
        },
      },
    ]);
  };

  return (
    <main className="min-h-screen">
      <GlassBox
        title="Sensitive Data Redaction Gateway"
        framing={PRIVACY_FRAMING}
        badge="Project 4"
        purpose="A governed gateway that stops sensitive operational text before it reaches AI tools, external APIs, or downstream logs."
        valueLine="Known PII is detected, masked, or blocked before transit, with operator recovery and a hash-linked receipt for every decision."
        controlStatement="Raw inbound text remains client-owned. The event stream returns only safe output, finding metadata, and decision evidence."
        challenge="Operational teams need AI and automation on tickets, notes, and support text, but one pasted SSN, card number, or API key can create an uncontrolled disclosure."
        solution="A bounded redaction gateway scans five common sensitive formats, replaces known tokens before transit, fails closed on bulk-restricted payloads, and gives operators auditable recovery paths for blocks and over-masking."
        impact="Five sensitive-data formats are checked before transit. Embedded PII is replaced, bulk payloads stop at 8+ findings, and raw inbound text is never echoed in SSE events."
        guardrails={{
          objective:
            "Prevent known sensitive formats from reaching downstream processors in clear text.",
          access:
            "Processes bounded text in memory. Raw input stays client-owned and is excluded from the event stream.",
          failure:
            "Bulk-restricted payloads stop before transit, receive an exception code, and open an operator-owned security review case.",
        }}
        exceptionLabel="Exception and recovery model"
        exceptionKicker="How detection gaps, over-masking, bulk restrictions, and oversized payloads are contained and resolved."
        exceptionMode="expanded"
        whenWrong={<PrivacyExceptionRecovery />}
        architectureLabel="System design and decisions"
        architectureKicker="Control flow, data boundaries, and the engineering choices behind safe downstream transit."
        architectureMode="expanded"
        architectureVisual={<PrivacyArchitectureFlow />}
        stack="TypeScript, Next.js, SSE"
        isRunning={isRunning}
        controlLabel="Scenario"
        controlPanel={
          <div className="flex flex-col gap-6">
            <ScenarioList label="Pick a payload">
              {PRESETS.map((preset) => (
                <ScenarioOption
                  key={preset.key}
                  label={preset.label}
                  detail={preset.detail}
                  active={selected === preset.key}
                  disabled={isRunning}
                  onClick={() => handleSelect(preset.key)}
                  tone={preset.tone}
                />
              ))}
              <ScenarioOption
                label="Custom payload"
                detail="Paste synthetic text to scan - receipt scenario is custom"
                active={selected === "custom"}
                disabled={isRunning}
                onClick={() => handleSelect("custom")}
                tone="default"
              />
            </ScenarioList>

            <div>
              <p className="label-opal mb-3">
                {selected === "custom" ? "Custom text" : "Payload preview"}
              </p>
              <DetailList
                rows={[
                  {
                    label: "Scenario",
                    value:
                      selected === "custom"
                        ? "Custom payload"
                        : SAMPLE_SCENARIOS[selected].label,
                  },
                  {
                    label: "Length",
                    value: `${charCount} / ${MAX_PAYLOAD_CHARS} chars`,
                  },
                  {
                    label: "Bulk gate",
                    value: `${BULK_FINDING_THRESHOLD}+ findings`,
                  },
                ]}
              />
              {selected === "custom" ? (
                <textarea
                  value={customText}
                  disabled={isRunning}
                  onChange={(event) => {
                    setCustomText(event.target.value);
                    setLogs([]);
                  }}
                  rows={7}
                  className="mt-3 w-full rounded-xl border border-line bg-console-panel px-3 py-2.5 font-mono text-[11px] leading-relaxed text-opal-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                  placeholder="Paste synthetic operational text..."
                />
              ) : (
                <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-console-panel px-3 py-2.5 font-mono text-[11px] leading-relaxed text-opal-muted">
                  {inboundText}
                </pre>
              )}
              {charCount > MAX_PAYLOAD_CHARS ? (
                <p className="mt-2 text-sm text-danger">
                  Payload exceeds the {MAX_PAYLOAD_CHARS}-char proxy limit.
                </p>
              ) : null}
            </div>

            {showImpact ? (
              <ResultStrip>
                <p className="label-opal mb-1">Run status</p>
                <ResultRow
                  label="Findings"
                  value={
                    <span className="font-mono text-xs">
                      {run.findingCount}
                    </span>
                  }
                />
                <ResultRow
                  label="Decision"
                  value={
                    <Badge tone={decisionTone(run.decision)}>
                      {run.decision ?? (isRunning ? "scanning" : "pending")}
                    </Badge>
                  }
                />
                <ResultRow
                  label="Receipt"
                  value={
                    <span className="font-mono text-xs">
                      {run.receipt?.receiptId ?? "n/a"}
                    </span>
                  }
                />
              </ResultStrip>
            ) : null}

            <DemoPrimaryButton
              label="Run redaction gateway"
              busyLabel="Scanning payload..."
              isRunning={isRunning}
              onClick={() => runProxy()}
            />
          </div>
        }
        streamPanel={
          <PrivacyOpsConsole
            logs={logs}
            isRunning={isRunning}
            liveLabel={PRIVACY_FRAMING}
            inboundText={inboundText}
            onClear={() => setLogs([])}
            onReleaseFalsePositive={handleReleaseFalsePositive}
            onAcknowledgeReview={handleAcknowledgeReview}
          />
        }
      />
    </main>
  );
}
