"use client";

import React, { useMemo, useState } from "react";
import {
  CompactEventLog,
  OpsConsoleShell,
} from "@/components/ui/OpsConsole";
import { DemoPanelTabs } from "@/components/ui/CodeViewer";
import type { LogEntry } from "@/components/ui/TerminalStream";
import { PRIVACY_SOURCE_FILES } from "@/lib/portfolio/source-excerpts";
import {
  FINDING_LABELS,
  PRIVACY_REVIEWER_ROLE,
  type FindingKind,
  type PrivacyReceipt,
  type ProxyDecision,
  type SecurityReviewCase,
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
  let sanitizedText = "";
  let receipt: PrivacyReceipt | null = null;
  let exceptionCode: string | null = null;
  let review: SecurityReviewCase | null = null;
  let tooLarge = false;

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.findingCount === "number") findingCount = data.findingCount;
    if (typeof data.sanitizedText === "string") sanitizedText = data.sanitizedText;
    if (typeof data.exceptionCode === "string") exceptionCode = data.exceptionCode;
    if (typeof data.decision === "string") {
      decision = data.decision as ProxyDecision;
    }
    if (Array.isArray(data.findings)) {
      findings = data.findings as FindingPreview[];
    }
    if (data.action === "PAYLOAD_TOO_LARGE") tooLarge = true;

    const eventReview = recordValue(data.review);
    if (eventReview) review = eventReview as unknown as SecurityReviewCase;

    const eventReceipt = recordValue(data.receipt);
    if (eventReceipt) {
      receipt = eventReceipt as unknown as PrivacyReceipt;
      if (receipt.securityReview) review = receipt.securityReview;
    }

    if (data.action === "SECURITY_REVIEW_ACKNOWLEDGED" && review) {
      review = {
        ...review,
        status: "acknowledged",
        acknowledgedAt:
          typeof data.acknowledgedAt === "string"
            ? data.acknowledgedAt
            : new Date().toISOString(),
        actor:
          typeof data.actor === "string" ? data.actor : PRIVACY_REVIEWER_ROLE,
      };
    }
  }

  return {
    decision,
    findingCount,
    findings,
    sanitizedText,
    receipt,
    exceptionCode,
    review,
    tooLarge,
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
  inboundText,
  onClear,
  onReleaseFalsePositive,
  onAcknowledgeReview,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  liveLabel: string;
  /** Client-owned inbound text for before/after - never taken from SSE. */
  inboundText: string;
  onClear: () => void;
  onReleaseFalsePositive?: (kind: FindingKind) => void;
  onAcknowledgeReview?: () => void;
}) {
  const state = useMemo(() => derivePrivacyConsole(logs), [logs]);
  const [overrideReason, setOverrideReason] = useState(
    "Support ticket needs contact email for callback - treat as false positive for this run."
  );
  const idle = logs.length === 0 && !isRunning;
  const statusLabel = isRunning
    ? "Scanning"
    : decisionLabel(state.decision, idle);
  const statusTone = decisionTone(state.decision, isRunning, idle);
  const uniqueKinds = [...new Set(state.findings.map((f) => f.kind))];
  const showBeforeAfter =
    Boolean(inboundText) &&
    state.decision !== "blocked" &&
    !state.tooLarge &&
    (state.decision === "passed" ||
      state.decision === "sanitized" ||
      Boolean(state.sanitizedText));

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
                  : state.decision === "blocked" || state.tooLarge
                    ? "border-danger/25 bg-danger-soft"
                    : state.decision === "sanitized"
                      ? "border-warn/25 bg-warn-soft"
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
                  : state.tooLarge
                    ? "Rejected - too large"
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
                Pick a scenario or paste a custom payload. Clean payloads pass;
                embedded PII is sanitized; bulk restricted payloads are blocked
                and open a security review case.
              </p>
            </div>
          ) : null}

          {state.tooLarge ? (
            <div className="rounded-xl border border-danger/30 bg-danger-soft p-4">
              <p className="text-sm font-semibold text-opal-main">
                Payload rejected
              </p>
              <p className="mt-1 text-sm text-opal-muted">
                Inbound text exceeded the proxy size limit and was not scanned.
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
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-opal-main">
                    Transmission blocked
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-opal-muted">
                    Finding density crossed the bulk threshold. The original
                    payload was not forwarded. Exception{" "}
                    <span className="font-mono text-xs text-opal-main">
                      {state.exceptionCode ?? "PRIV-BULK-RESTRICTED"}
                    </span>
                    .
                  </p>
                  {state.review ? (
                    <div className="mt-3 rounded-lg border border-danger/20 bg-white px-3 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-danger">
                        Security review case
                      </p>
                      <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        <div>
                          <dt className="text-[11px] text-opal-mist">Case</dt>
                          <dd className="font-mono text-xs text-opal-main">
                            {state.review.caseId}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-opal-mist">Status</dt>
                          <dd className="font-mono text-xs text-opal-main">
                            {state.review.status}
                          </dd>
                        </div>
                      </dl>
                      {state.review.status === "opened" &&
                      onAcknowledgeReview ? (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={onAcknowledgeReview}
                          className="mt-3 inline-flex h-8 items-center rounded-lg bg-danger px-3 text-xs font-semibold text-white transition-colors hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-40"
                        >
                          Acknowledge review case
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {showBeforeAfter ? (
            <section
              className="console-panel p-4"
              aria-label="Before and after payload"
            >
              <p className="label-console">Before / after</p>
              <p className="mt-1 text-xs text-opal-muted">
                Inbound text stays client-side. The stream only returns
                sanitized downstream text and finding metadata.
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                    Inbound (client)
                  </p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-console-border bg-white px-3 py-2.5 font-mono text-[11px] leading-relaxed text-opal-main">
                    {inboundText || "(empty)"}
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

          {state.decision === "sanitized" &&
          onReleaseFalsePositive &&
          uniqueKinds.length > 0 ? (
            <section
              className="rounded-xl border border-warn/25 bg-warn-soft p-4"
              aria-label="False positive release"
            >
              <p className="text-sm font-semibold text-opal-main">
                Over-mask recovery
              </p>
              <p className="mt-1 text-sm leading-relaxed text-opal-muted">
                If regex mangling blocked useful support text, release one
                finding kind as a false positive and re-scan. Raw text still
                never leaves the client in the event stream.
              </p>
              <label className="mt-3 block">
                <span className="label-console">Override reason</span>
                <textarea
                  value={overrideReason}
                  disabled={isRunning}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-opal-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {uniqueKinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    disabled={isRunning || !overrideReason.trim()}
                    onClick={() => onReleaseFalsePositive(kind)}
                    className="inline-flex h-8 items-center rounded-lg border border-warn/30 bg-white px-3 text-xs font-semibold text-opal-main transition-colors hover:bg-warn-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warn disabled:opacity-40"
                  >
                    Release {FINDING_LABELS[kind]}
                  </button>
                ))}
              </div>
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
                  ["Scenario", state.receipt.scenario],
                  ["Findings", String(state.receipt.findingCount)],
                  [
                    "Kinds",
                    state.receipt.kinds.length > 0
                      ? state.receipt.kinds.join(", ")
                      : "none",
                  ],
                  ["Exception", state.receipt.exceptionCode ?? "none"],
                  [
                    "Review case",
                    state.receipt.securityReview?.caseId ?? "none",
                  ],
                  [
                    "Override",
                    state.receipt.override
                      ? state.receipt.override.suppressedKinds.join(", ")
                      : "none",
                  ],
                  ["Trail hash", state.receipt.trailHash],
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
