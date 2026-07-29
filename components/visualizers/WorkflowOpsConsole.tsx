"use client";

import React, { useMemo, useState } from "react";
import {
  CompactEventLog,
  OpsConsoleShell,
} from "@/components/ui/OpsConsole";
import { DemoPanelTabs } from "@/components/ui/CodeViewer";
import type { LogEntry } from "@/components/ui/TerminalStream";
import {
  FINANCIAL_THRESHOLD_USD,
  WORKFLOW_REVIEWER_ROLE,
  type WorkflowNodeId,
} from "@/lib/workflow/types";
import { deriveWorkflowRunStatus } from "@/lib/workflow/run-status";
import { WORKFLOW_SOURCE_FILES } from "@/lib/portfolio/source-excerpts";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";

const STEPS: Array<{ id: WorkflowNodeId; label: string }> = [
  { id: "intake", label: "Intake" },
  { id: "compliance_check", label: "Compliance" },
  { id: "financial_threshold", label: "Threshold" },
  { id: "final_execution", label: "Final execution" },
];

function deriveWorkflowGraph(logs: LogEntry[]) {
  const completed = new Set<string>();
  let current: string | null = null;
  let paused = false;
  let rejected = false;
  let done = false;
  let amount: number | null = null;
  let sessionId: string | null = null;

  for (const log of logs) {
    const data = log.data ?? {};
    const node = typeof data.node === "string" ? data.node : null;
    if (typeof data.sessionId === "string") sessionId = data.sessionId;
    if (typeof data.amount === "number") amount = data.amount;

    if (node === "awaiting_approval" || data.action === "AWAITING_APPROVAL") {
      paused = true;
      current = "financial_threshold";
      completed.add("intake");
      completed.add("compliance_check");
    }

    if (data.action === "REJECTED" || node === "rejected") {
      rejected = true;
      paused = false;
      current = "financial_threshold";
    }

    if (data.action === "APPROVED") {
      paused = false;
      completed.add("financial_threshold");
      current = "final_execution";
    }

    if (data.action === "COMPLETED" || node === "completed") {
      done = true;
      paused = false;
      completed.add("intake");
      completed.add("compliance_check");
      completed.add("financial_threshold");
      completed.add("final_execution");
      current = null;
    }

    if (node && !paused && !rejected && !done) {
      if (node === "intake") current = "intake";
      if (node === "compliance_check") {
        completed.add("intake");
        current = "compliance_check";
      }
      if (node === "financial_threshold") {
        completed.add("intake");
        completed.add("compliance_check");
        current = "financial_threshold";
      }
      if (node === "final_execution") {
        completed.add("intake");
        completed.add("compliance_check");
        completed.add("financial_threshold");
        current = "final_execution";
      }
      if (log.level === "success" || data.status === "ok") {
        if (node === "intake") completed.add("intake");
        if (node === "compliance_check") completed.add("compliance_check");
        if (node === "financial_threshold") completed.add("financial_threshold");
        if (node === "final_execution") completed.add("final_execution");
      }
    }
  }

  return { completed, current, paused, rejected, done, amount, sessionId };
}

function formatAuditTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("en-US", { hour12: false });
}

function StepNode({
  label,
  state,
}: {
  label: string;
  state: "pending" | "active" | "done" | "paused" | "rejected";
}) {
  const ring =
    state === "paused"
      ? "border-warn bg-warn-soft text-warn ring-2 ring-warn/25"
      : state === "active"
        ? "border-accent bg-accent-soft text-accent-deep"
        : state === "done"
          ? "border-ok/50 bg-ok-soft text-ok"
          : state === "rejected"
            ? "border-danger/50 bg-danger-soft text-danger"
            : "border-line bg-console-panel text-opal-mist";

  return (
    <div className="flex min-w-[4.5rem] flex-1 flex-col items-center gap-1.5 sm:min-w-0">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${ring} ${
          state === "active" || state === "paused" ? "animate-pulse-line" : ""
        }`}
      >
        {state === "active" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "done" ? (
          <Check className="h-4 w-4" />
        ) : state === "rejected" ? (
          <X className="h-4 w-4" />
        ) : state === "paused" ? (
          <ShieldAlert className="h-4 w-4" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-opal-mist" />
        )}
      </div>
      <span className="text-center text-xs font-semibold leading-tight text-opal-main">
        {label}
      </span>
    </div>
  );
}

export function WorkflowOpsConsole({
  logs,
  isRunning,
  amount,
  deciding,
  liveLabel,
  onApprove,
  onReject,
  onClear,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  amount: number | null;
  deciding?: boolean;
  liveLabel?: string;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onClear?: () => void;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const graph = useMemo(() => deriveWorkflowGraph(logs), [logs]);
  const run = useMemo(() => deriveWorkflowRunStatus(logs), [logs]);
  const idle = logs.length === 0 && !isRunning;
  const displayAmount = graph.amount ?? amount;

  const statusTone =
    idle || (isRunning && !graph.paused)
      ? "live"
      : graph.paused
        ? "warn"
        : graph.rejected
          ? "danger"
          : graph.done
            ? "ok"
            : "idle";

  const statusLabel = idle
    ? "Ready for workflow"
    : graph.paused
      ? "Frozen - awaiting approval"
      : graph.rejected
        ? "Rejected - stopped"
        : graph.done
          ? "Completed"
          : isRunning
            ? "Running steps"
            : "Idle";

  const thresholdLabel =
    run.thresholdResult === "over"
      ? "Over threshold"
      : run.thresholdResult === "under"
        ? "Under threshold"
        : run.thresholdResult === "skipped"
          ? "Skipped (no cash)"
          : run.thresholdResult === "pending"
            ? "Pending"
            : "n/a";

  const decisionLabel =
    run.managerDecision === "awaiting"
      ? "Awaiting"
      : run.managerDecision === "approved"
        ? "Approved"
        : run.managerDecision === "rejected"
          ? "Rejected"
          : "None";

  return (
    <DemoPanelTabs
      liveLabel={liveLabel}
      sourceFiles={WORKFLOW_SOURCE_FILES}
      live={
        <OpsConsoleShell
          title="Operations console"
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRunning={(idle || isRunning) && !graph.paused}
          eventCount={logs.length}
          onClear={onClear}
        >
          <div className="console-panel px-3.5 py-3">
            <p className="label-console">Run status</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                  State
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-opal-main">
                  {run.currentState}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                  Threshold
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-opal-main">
                  {thresholdLabel}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                  Manager
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-opal-main">
                  {decisionLabel}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                  Final
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-opal-main">
                  {run.finalStatus}
                </dd>
              </div>
            </dl>
          </div>

          <div className="console-panel px-3.5 py-3">
            <p className="label-console">Workflow path</p>
            <p className="mt-1 text-sm text-opal-muted">
              Intake - Compliance - Threshold - Final execution
            </p>
          </div>

          <div
            className={`rounded-xl border px-3 py-4 ${
              graph.paused
                ? "border-warn/30 bg-warn-soft"
                : "border-console-border bg-console-panel"
            }`}
          >
            <p className="label-console mb-4">Process steps</p>
            <div className="flex flex-wrap items-start justify-between gap-y-4 sm:flex-nowrap sm:gap-0.5">
              {STEPS.map((step, index) => {
                let state:
                  | "pending"
                  | "active"
                  | "done"
                  | "paused"
                  | "rejected" = "pending";
                if (graph.completed.has(step.id)) state = "done";
                if (graph.current === step.id) {
                  if (graph.paused && step.id === "financial_threshold") {
                    state = "paused";
                  } else if (
                    graph.rejected &&
                    step.id === "financial_threshold"
                  ) {
                    state = "rejected";
                  } else if (!idle) {
                    state = "active";
                  }
                }
                return (
                  <React.Fragment key={step.id}>
                    {index > 0 ? (
                      <div className="mt-5 hidden flex-col items-center px-0.5 sm:flex">
                        <span
                          className={`text-[11px] font-semibold ${
                            graph.completed.has(step.id) ||
                            (graph.current === step.id &&
                              graph.completed.has(STEPS[index - 1].id))
                              ? "text-ok"
                              : "text-opal-mist"
                          }`}
                          aria-hidden
                        >
                          -&gt;
                        </span>
                      </div>
                    ) : null}
                    <StepNode label={step.label} state={state} />
                  </React.Fragment>
                );
              })}
            </div>
            {idle ? (
              <p className="mt-4 text-center text-sm text-opal-muted">
                Default scenario is over $
                {FINANCIAL_THRESHOLD_USD.toLocaleString()}. Start workflow to
                watch the run freeze at the threshold gate.
              </p>
            ) : null}
          </div>

          {graph.paused ? (
            <div
              className="space-y-3 rounded-xl border border-warn/30 bg-warn-soft p-4"
              aria-label="Operations manager review required"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-opal-main">
                    Frozen at threshold - {WORKFLOW_REVIEWER_ROLE} review
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-warn/20 bg-white px-3 py-2.5">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-warn">
                        Amount
                      </dt>
                      <dd className="mt-0.5 font-mono text-base font-semibold text-opal-main">
                        ${(displayAmount ?? 0).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-warn">
                        Threshold
                      </dt>
                      <dd className="mt-0.5 font-mono text-base font-semibold text-opal-main">
                        ${FINANCIAL_THRESHOLD_USD.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-sm leading-relaxed text-opal-muted">
                    Amount exceeds the automatic limit. Downstream execution is
                    stopped until Approve or Reject.
                  </p>
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-opal-label">
                  Reject reason (optional)
                </span>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="Why this request should stop..."
                  className="w-full rounded-lg border border-warn/30 bg-white px-3 py-2 text-sm text-opal-main placeholder:text-opal-mist focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={deciding || !onApprove}
                  onClick={onApprove}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ok px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={deciding || !onReject}
                  onClick={() => onReject?.(rejectReason)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-danger px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          ) : null}

          {graph.done ? (
            <div className="rounded-xl border border-ok/25 bg-ok-soft px-3.5 py-3 text-sm text-ok">
              Workflow finished - all steps cleared through final execution.
            </div>
          ) : null}

          {graph.rejected ? (
            <div className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger">
              <p>
                {WORKFLOW_REVIEWER_ROLE} rejected the request. Downstream steps
                did not run.
              </p>
              {run.rejectReason ? (
                <p className="mt-1.5 text-sm text-danger/90">
                  Reason: {run.rejectReason}
                </p>
              ) : null}
            </div>
          ) : null}

          {run.auditTrail.length > 0 ? (
            <div className="console-panel px-3.5 py-3">
              <p className="label-console">Session audit trail</p>
              <p className="mt-1 text-xs text-opal-mist">
                In-memory demo trail for this run - not an immutable store.
              </p>
              <ol className="m-0 mt-2.5 list-none space-y-2 p-0">
                {run.auditTrail.map((entry, index) => (
                  <li
                    key={`${entry.at}-${entry.node}-${index}`}
                    className="rounded-lg border border-line bg-white px-3 py-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="font-mono text-xs font-semibold text-opal-main">
                        {entry.node}
                      </span>
                      <span className="font-mono text-[11px] text-opal-mist">
                        {formatAuditTime(entry.at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-opal-muted">
                      {entry.detail}
                    </p>
                    {entry.actor || entry.decision || entry.reason ? (
                      <p className="mt-1 text-xs text-opal-mist">
                        {[
                          entry.actor ? `Actor: ${entry.actor}` : null,
                          entry.decision ? `Decision: ${entry.decision}` : null,
                          entry.reason ? `Reason: ${entry.reason}` : null,
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <CompactEventLog
            logs={logs}
            isRunning={isRunning && !graph.paused}
          />
          {idle ? (
            <div className="console-panel px-3 py-3">
              <p className="label-console">Activity log</p>
              <p className="mt-2 text-sm text-opal-muted">
                Step transitions and the session audit trail appear here while
                the workflow runs.
              </p>
            </div>
          ) : null}
        </OpsConsoleShell>
      }
    />
  );
}
