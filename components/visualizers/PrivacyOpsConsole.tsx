"use client";

import React, { useMemo } from "react";
import {
  CompactEventLog,
  OpsConsoleShell,
} from "@/components/ui/OpsConsole";
import { DemoPanelTabs } from "@/components/ui/CodeViewer";
import type { LogEntry } from "@/components/ui/TerminalStream";
import { PRIVACY_SOURCE_FILES } from "@/lib/portfolio/source-excerpts";
import {
  FINDING_LABELS,
  type FindingKind,
  type PrivacyReceipt,
  type ProxyDecision,
} from "@/lib/privacy/types";
import { EyeOff, FileText, ShieldAlert, ShieldCheck } from "lucide-react";

interface FindingPreview {
  kind: FindingKind;
  label?: string;
  preview: string;
  replacement: string;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function derivePrivacyConsole(logs: LogEntry[]) {
  let decision: ProxyDecision | null = null;
  let findingCount = 0;
  let findings: FindingPreview[] = [];
  let sourceText = "";
  let sanitizedText = "";
  let receipt: PrivacyReceipt | null = null;
  let exceptionCode: string | null = null;

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.findingCount === "number") findingCount = data.findingCount;
    if (typeof data.sourceText === "string") sourceText = data.sourceText;
    if (typeof data.sanitizedText === "string") sanitizedText = data.sanitizedText;
    if (typeof data.exceptionCode === "string") exceptionCode = data.exceptionCode;
    if (typeof data.decision === "string") {
      decision = data.decision as ProxyDecision;
    }
    if (Array.isArray(data.findings)) {
      findings = data.findings as FindingPreview[];
    }
    const eventReceipt = recordValue(data.receipt);
    if (eventReceipt) receipt = eventReceipt as unknown as PrivacyReceipt;
  }

  return {
    decision,
    findingCount,
    findings,
    sourceText,
    sanitizedText,
    receipt,
    exceptionCode,
  };
}

function decisionLabel(decision: ProxyDecision | null, idle: boolean): string {
  if (idle) return "Idle";
  if (decision === "passed") return "Cleared";
  if (decision === "sanitized") return "Sanitized";
  if (decision === "blocked") return "Blocked";
  return "Scanning";
}

function decisionTone(
  decision: ProxyDecision | null,
  isRunning: boolean,
  idle: boolean
): "idle" | "live" | "ok" | "warn" | "danger" {
  if (idle) return "idle";
  if (isRunning && !decision) return "live";
  if (decision === "passed") return "ok";
  if (decision === "sanitized") return "warn";
  if (decision === "blocked") return "danger";
  return "live";
}

export function PrivacyOpsConsole({
  logs,
  isRunning,
  liveLabel,
  onClear,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  liveLabel: string;
  onClear: () => void;
}) {
  const state = useMemo(() => derivePrivacyConsole(logs), [logs]);
  const idle = logs.length === 0 && !isRunning;
  const statusLabel = isRunning
    ? "Scanning"
    : decisionLabel(state.decision, idle);
  const statusTone = decisionTone(state.decision, isRunning, idle);

  return (
    <DemoPanelTabs
      liveLabel={liveLabel}
      sourceFiles={PRIVACY_SOURCE_FILES}
      live={
        <OpsConsoleShell
          title="Privacy proxy console"
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRunning={isRunning}
          eventCount={logs.length}
          onClear={onClear}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <div
              className={`rounded-xl border px-3 py-2.5 ${
                idle
                  ? "border-console-border bg-console-panel"
                  : state.decision === "blocked"
                    ? "border-danger/25 bg-danger-soft"
                    : "border-ok/20 bg-ok-soft"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-opal-label" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                  Scan
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-opal-main">
                {idle
                  ? "Waiting for payload"
                  : `${state.findingCount} finding${state.findingCount === 1 ? "" : "s"}`}
              </p>
            </div>
            <div
              className={`rounded-xl border px-3 py-2.5 ${
                state.decision === "sanitized"
                  ? "border-warn/25 bg-warn-soft"
                  : "border-console-border bg-console-panel"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <EyeOff className="h-3.5 w-3.5 text-opal-label" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                  Redact
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-opal-main">
                {state.decision === "sanitized"
                  ? "Placeholders applied"
                  : state.decision === "passed"
                    ? "No redaction needed"
                    : state.decision === "blocked"
                      ? "Skipped - blocked"
                      : "Idle"}
              </p>
            </div>
            <div
              className={`rounded-xl border px-3 py-2.5 ${
                state.decision === "blocked"
                  ? "border-danger/25 bg-danger-soft"
                  : state.receipt
                    ? "border-ok/20 bg-ok-soft"
                    : "border-console-border bg-console-panel"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {state.decision === "blocked" ? (
                  <ShieldAlert className="h-3.5 w-3.5 text-opal-label" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-opal-label" />
                )}
                <p className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                  Decision
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-opal-main">
                {idle
                  ? "Pass / sanitize / block"
                  : state.decision === "blocked"
                    ? state.exceptionCode ?? "Blocked"
                    : state.decision === "sanitized"
                      ? "Cleared after sanitize"
                      : state.decision === "passed"
                        ? "Cleared"
                        : "In progress"}
              </p>
            </div>
          </div>

          {idle ? (
            <div className="rounded-xl border border-console-border bg-console-panel px-3.5 py-4 text-center">
              <p className="text-sm text-opal-muted">
                Pick a scenario and run the proxy. Clean payloads pass; embedded
                PII is sanitized; bulk restricted payloads are blocked
                pre-transit.
              </p>
            </div>
          ) : null}

          {state.decision === "blocked" ? (
            <div
              className="rounded-xl border border-danger/30 bg-danger-soft p-4"
              aria-label="Payload blocked"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-semibold text-opal-main">
                    Transmission blocked
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-opal-muted">
                    Finding count crossed the bulk threshold. The original
                    payload was not forwarded. Exception{" "}
                    <span className="font-mono text-xs text-opal-main">
                      {state.exceptionCode ?? "PRIV-BULK-RESTRICTED"}
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {(state.sourceText || state.sanitizedText) &&
          state.decision !== "blocked" ? (
            <section
              className="console-panel p-4"
              aria-label="Before and after payload"
            >
              <p className="label-console">Before / after</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                    Inbound
                  </p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-console-border bg-white px-3 py-2.5 font-mono text-[11px] leading-relaxed text-opal-main">
                    {state.sourceText || "(empty)"}
                  </pre>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                    Downstream
                  </p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-ok/20 bg-ok-soft px-3 py-2.5 font-mono text-[11px] leading-relaxed text-opal-main">
                    {state.sanitizedText || "(empty)"}
                  </pre>
                </div>
              </div>
            </section>
          ) : null}

          {state.findings.length > 0 ? (
            <section className="console-panel p-4" aria-label="Findings">
              <p className="label-console">
                Findings ({state.findings.length})
              </p>
              <ul className="mt-3 space-y-2">
                {state.findings.map((finding, index) => (
                  <li
                    key={`${finding.kind}-${finding.preview}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-console-border bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-opal-main">
                        {finding.label ??
                          FINDING_LABELS[finding.kind] ??
                          finding.kind}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-opal-muted">
                        {finding.preview}
                      </p>
                    </div>
                    <span className="rounded-md bg-warn-soft px-2 py-1 font-mono text-[10px] font-semibold text-warn">
                      {finding.replacement}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {state.receipt ? (
            <section
              className={`rounded-xl border p-4 ${
                state.receipt.decision === "blocked"
                  ? "border-danger/25 bg-danger-soft"
                  : "border-accent/25 bg-accent-soft"
              }`}
              aria-label="Privacy receipt"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      state.receipt.decision === "blocked"
                        ? "text-danger"
                        : "text-accent-deep"
                    }`}
                  >
                    Privacy receipt
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-opal-muted">
                    Masking decision artifact for this run - kinds, count, and
                    trail hash. Synthetic demo data only.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold text-white ${
                    state.receipt.decision === "passed"
                      ? "bg-ok"
                      : state.receipt.decision === "sanitized"
                        ? "bg-warn"
                        : "bg-danger"
                  }`}
                >
                  {state.receipt.decision}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ["Receipt", state.receipt.receiptId],
                  ["Findings", String(state.receipt.findingCount)],
                  [
                    "Kinds",
                    state.receipt.kinds.length > 0
                      ? state.receipt.kinds.join(", ")
                      : "none",
                  ],
                  ["Exception", state.receipt.exceptionCode ?? "none"],
                  ["Trail hash", state.receipt.trailHash],
                  [
                    "At",
                    new Date(state.receipt.at).toLocaleTimeString("en-US", {
                      hour12: false,
                    }),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-console-border/60 bg-white/70 px-3 py-2"
                  >
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                      {label}
                    </dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-opal-main">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <CompactEventLog logs={logs} />
        </OpsConsoleShell>
      }
    />
  );
}
