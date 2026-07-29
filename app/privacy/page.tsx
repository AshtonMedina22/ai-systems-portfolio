"use client";

import React, { useMemo, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { PrivacyOpsConsole } from "@/components/visualizers/PrivacyOpsConsole";
import { PrivacyArchitectureFlow } from "@/components/visualizers/PrivacyArchitectureFlow";
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
  SAMPLE_SCENARIOS,
  type PrivacyReceipt,
  type PrivacyScenarioKey,
  type ProxyDecision,
} from "@/lib/privacy/types";
import { PRIVACY_FRAMING } from "@/lib/privacy/runtime";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LogEntry } from "@/components/ui/TerminalStream";

const PRESETS: Array<{
  key: PrivacyScenarioKey;
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

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.decision === "string") {
      decision = data.decision as ProxyDecision;
    }
    if (typeof data.findingCount === "number") findingCount = data.findingCount;
    if (data.receipt && typeof data.receipt === "object") {
      receipt = data.receipt as PrivacyReceipt;
    }
  }

  return { decision, findingCount, receipt };
}

export default function PrivacyPage() {
  const [selected, setSelected] = useState<PrivacyScenarioKey>("clean");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const scenario = SAMPLE_SCENARIOS[selected];
  const run = useMemo(() => deriveRun(logs), [logs]);
  const showImpact = logs.length > 0 || isRunning;

  const handleSelect = (key: PrivacyScenarioKey) => {
    if (isRunning) return;
    setSelected(key);
    setLogs([]);
  };

  const handleRun = async () => {
    setIsRunning(true);
    setLogs([]);

    try {
      const response = await fetch("/api/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioKey: selected }),
      });

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
              const logEntry: LogEntry = JSON.parse(trimmed.substring(6));
              setLogs((prev) => [...prev, logEntry]);
            } catch (err) {
              console.error("Error parsing privacy SSE:", err);
            }
          }
        }
      }
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

  return (
    <main className="min-h-screen">
      <GlassBox
        title="Data Privacy & Safety Suite"
        framing={PRIVACY_FRAMING}
        badge="Project 4"
        purpose="A lightweight redaction proxy between internal apps and downstream processors or AI endpoints."
        valueLine="Inbound text is scanned for known sensitive formats, scrubbed or blocked before transit, and logged with a privacy receipt."
        controlStatement="Sensitive tokens do not leave the proxy unmasked on the sanitize path. Bulk restricted payloads are not forwarded at all."
        challenge="Teams want AI and automation on operational text, but one pasted SSN, card number, or API key in a ticket can land in prompt logs or a third-party API."
        solution="A deterministic in-process proxy that pattern-checks inbound payloads, replaces known sensitive tokens with placeholders, blocks bulk restricted dumps, and emits a receipt for the decision."
        impact="Clean tickets pass. Embedded PII is sanitized before transit. Bulk restricted exports are stopped pre-transit with an exception code for security review."
        guardrails={{
          objective:
            "Intercept inbound text and scrub sensitive tokens before downstream processing or external API transit.",
          access:
            "Stateless in-memory proxy. Processes strings on the fly; does not keep raw unmasked text as durable storage.",
          failure:
            "High-risk or bulk restricted payloads are blocked, logged with an exception code, and held for security review.",
        }}
        whenWrong={
          <div className="rounded-xl border border-line bg-console-panel px-4 py-4 sm:px-5 sm:py-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Pattern coverage is finite
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Checks cover common SSN, payment card (Luhn), email, API key,
                  and phone formats. Novel encodings and free-form secrets can
                  still slip through.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Bulk path stops transit
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  At {BULK_FINDING_THRESHOLD}+ findings (or the bulk scenario),
                  the proxy blocks forwarding instead of attempting a partial
                  sanitize of a restricted dump.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Synthetic demo data
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Scenarios use fake identifiers only. Nothing here is a live
                  customer record or a compliance certification.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Receipt limit
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  The privacy receipt is a run artifact with a trail hash - not a
                  durable WORM compliance archive.
                </dd>
              </div>
            </dl>
          </div>
        }
        architectureVisual={<PrivacyArchitectureFlow />}
        architecture="UI starts a scenario. /api/privacy runs a TypeScript in-process proxy: deterministic scan, sanitize or block, then a privacy receipt over SSE. Edge middleware and durable audit stores can sit in front of production AI gateways; config in the repo is reference only for this hosted demo."
        tradeoffs={[
          "Deterministic patterns are explainable and fast - they are not a claim of full GDPR, SOC 2, or HIPAA certification.",
          "In-memory demo scans keep the public site simple; production would typically place the proxy at an edge or API gateway with separate audit shipping.",
          "Bulk block prefers fail-closed over aggressive partial redaction when finding density looks like a restricted export.",
        ]}
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
            </ScenarioList>

            <div>
              <p className="label-opal mb-3">Payload preview</p>
              <DetailList
                rows={[
                  { label: "Scenario", value: scenario.label },
                  {
                    label: "Length",
                    value: `${scenario.sourceText.length} chars`,
                  },
                  {
                    label: "Bulk gate",
                    value: `${BULK_FINDING_THRESHOLD}+ findings`,
                  },
                ]}
              />
              <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-console-panel px-3 py-2.5 font-mono text-[11px] leading-relaxed text-opal-muted">
                {scenario.sourceText}
              </pre>
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
              label="Run privacy proxy"
              busyLabel="Scanning payload..."
              isRunning={isRunning}
              onClick={handleRun}
            />
          </div>
        }
        streamPanel={
          <PrivacyOpsConsole
            logs={logs}
            isRunning={isRunning}
            liveLabel={PRIVACY_FRAMING}
            onClear={() => setLogs([])}
          />
        }
      />
    </main>
  );
}
