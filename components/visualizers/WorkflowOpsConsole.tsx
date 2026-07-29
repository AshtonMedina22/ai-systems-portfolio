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
import { Check, FileText, Loader2, Lock, ShieldAlert, X } from "lucide-react";

const STEPS: Array<{ id: WorkflowNodeId; label: string }> = [
  { id: "intake", label: "Intake" },
  { id: "compliance_check", label: "Policy" },
  { id: "financial_threshold", label: "Threshold" },
  { id: "final_execution", label: "Final execution" },
];

function deriveWorkflowGraph(logs: LogEntry[]) {
  const completed = new Set<string>();
  let current: string | null = null;
  let paused = false;
  let rejected = false;
  let rolledBack = false;
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

    if (data.action === "ROLLED_BACK") {
      rolledBack = true;
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

  return {
    completed,
    current,
    paused,
    rejected,
    rolledBack,
    done,
    amount,
    sessionId,
  };
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

function LayerCard({
  title,
  icon,
  detail,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  detail: string;
  tone: "idle" | "ok" | "warn" | "danger";
}) {
  const border =
    tone === "ok"
      ? "border-ok/25 bg-ok-soft"
      : tone === "warn"
        ? "border-warn/25 bg-warn-soft"
        : tone === "danger"
          ? "border-danger/25 bg-danger-soft"
          : "border-console-border bg-console-panel";

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${border}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold text-opal-main">{title}</p>
      </div>
      <p className="mt-1 font-mono text-[11px] leading-snug text-opal-muted">
        {detail}
      </p>
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
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
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
    ? "Ready for governance run"
    : graph.paused
      ? "Frozen - awaiting intervention"
      : graph.rejected
        ? graph.rolledBack || run.rolledBack
          ? "Rejected - hold rolled back"
          : "Rejected - stopped"
        : graph.done
          ? "Completed"
          : isRunning
            ? "Running governance layers"
            : "Idle";

  const policyTone =
    run.policyStatus === "passed"
      ? "ok"
      : run.policyStatus === "denied"
        ? "danger"
        : "idle";
  const interventionTone =
    run.managerDecision === "awaiting"
      ? "warn"
      : run.managerDecision === "approved"
        ? "ok"
        : run.managerDecision === "rejected"
          ? "danger"
          : "idle";
  const auditTone = run.receipt
    ? run.receipt.transaction === "rolled_back"
      ? "danger"
      : "ok"
    : "idle";

  const interventionDetail =
    run.managerDecision === "awaiting"
      ? "Human oversight required above threshold"
      : run.managerDecision === "approved"
        ? `Approved by ${run.decisionActor ?? WORKFLOW_REVIEWER_ROLE}`
        : run.managerDecision === "rejected"
          ? run.rolledBack
            ? "Rejected - authorization hold released"
            : "Rejected - run stopped"
          : "Idle until threshold gate trips";

  return (
    <DemoPanelTabs
      liveLabel={liveLabel}
      sourceFiles={WORKFLOW_SOURCE_FILES}
      live={
        <OpsConsoleShell
          title="Governance control room"
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRunning={(idle || isRunning) && !graph.paused}
          eventCount={logs.length}
          onClear={onClear}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <LayerCard
              title="Layer 1: Policy"
              icon={<Lock className="h-3.5 w-3.5 text-opal-label" />}
              detail={
                idle
                  ? "Permissions checked before action"
                  : run.policyStatus === "passed"
                    ? run.policyId ?? "Policy check passed"
                    : "Waiting for policy evaluation"
              }
              tone={idle ? "idle" : policyTone}
            />
            <LayerCard
              title="Layer 2: Intervention"
              icon={<ShieldAlert className="h-3.5 w-3.5 text-opal-label" />}
              detail={interventionDetail}
              tone={idle ? "idle" : interventionTone}
            />
            <LayerCard
              title="Layer 3: Audit"
              icon={<FileText className="h-3.5 w-3.5 text-opal-label" />}
              detail={
                run.receipt
                  ? `${run.receipt.transaction} - ${run.receipt.trailHash}`
                  : "Hash-chained receipt after decision"
              }
              tone={idle ? "idle" : auditTone}
            />
          </div>

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
                  Hold
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-opal-main">
                  {run.holdStatus}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-opal-mist">
                  Manager
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-opal-main">
                  {run.managerDecision === "awaiting"
                    ? "Awaiting"
                    : run.managerDecision === "approved"
                      ? "Approved"
                      : run.managerDecision === "rejected"
                        ? "Rejected"
                        : "None"}
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
            <p className="label-console">Governance path</p>
            <p className="mt-1 text-sm text-opal-muted">
              Intake - Policy - Threshold - Final execution
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
                {FINANCIAL_THRESHOLD_USD.toLocaleString()}. Start the run to
                watch policy, intervention, and audit layers fire.
              </p>
            ) : null}
          </div>

          {graph.paused ? (
            <div
              className="space-y-3 rounded-xl border border-warn/30 bg-warn-soft p-4"
              aria-label="Operations manager intervention required"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-opal-main">
                    Intervention gate - {WORKFLOW_REVIEWER_ROLE} review
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
                    Authorization hold is reserved. Approve releases the hold to
                    execute; Reject rolls the hold back.
                  </p>
                  {run.holdId ? (
                    <p className="mt-1 font-mono text-[11px] text-opal-mist">
                      Hold: {run.holdId}
                    </p>
                  ) : null}
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
              Workflow finished - policy, intervention, and audit receipt
              recorded through final execution.
            </div>
          ) : null}

          {graph.rejected ? (
            <div className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger">
              <p>
                {WORKFLOW_REVIEWER_ROLE} rejected the request.
                {run.rolledBack || graph.rolledBack
                  ? " Authorization hold was released (compensating rollback)."
                  : " Downstream steps did not run."}
              </p>
              {run.holdId ? (
                <p className="mt-1 font-mono text-[11px] text-danger/80">
                  Hold {run.holdId} - {run.holdStatus}
                </p>
              ) : null}
              {run.rejectReason ? (
                <p className="mt-1.5 text-sm text-danger/90">
                  Reason: {run.rejectReason}
                </p>
              ) : null}
            </div>
          ) : null}

          {run.receipt ? (
            <section
              className="rounded-xl border border-accent/25 bg-accent-soft p-4"
              aria-label="Governance audit receipt"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-accent-deep">
                    Governance audit receipt
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-opal-muted">
                    Hash-chained session receipt for this run - who decided,
                    when, on what amount, under which policy. Not a durable WORM
                    store.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold text-white ${
                    run.receipt.transaction === "committed"
                      ? "bg-ok"
                      : run.receipt.transaction === "rolled_back"
                        ? "bg-danger"
                        : "bg-warn"
                  }`}
                >
                  {run.receipt.transaction}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ["Receipt", run.receipt.receiptId],
                  ["Policy", run.receipt.policyId],
                  [
                    "Amount",
                    run.receipt.amount != null
                      ? `$${run.receipt.amount.toLocaleString()}`
                      : "n/a",
                  ],
                  ["Trail hash", run.receipt.trailHash],
                  ["Actor", run.receipt.actor ?? "-"],
                  ["Hold", run.receipt.holdId ?? "none"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-console-border bg-white/70 px-3 py-2"
                  >
                    <dt className="text-[10px] uppercase tracking-wide text-opal-label">
                      {label}
                    </dt>
                    <dd className="mt-0.5 truncate font-mono text-xs font-semibold text-opal-main">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {run.receipt || run.auditTrail.length > 0 ? (
            <button
              type="button"
              aria-expanded={showTechnicalDetails}
              aria-controls="workflow-technical-details"
              onClick={() => setShowTechnicalDetails((current) => !current)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-console-panel px-3.5 py-3 text-left text-sm font-semibold text-opal-main sm:hidden"
            >
              <span>Technical details</span>
              <span className="font-mono text-xs text-opal-muted">
                {showTechnicalDetails ? "Hide" : "Show"}
              </span>
            </button>
          ) : null}

          <div
            id="workflow-technical-details"
            className={`${showTechnicalDetails ? "contents" : "hidden"} sm:contents`}
          >
          {run.auditTrail.length > 0 ? (
            <div className="console-panel px-3.5 py-3">
              <p className="label-console">Session audit trail</p>
              <p className="mt-1 text-xs text-opal-mist">
                Entries are hash-chained for this session receipt.
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
                    {entry.hash ? (
                      <p className="mt-1 font-mono text-[10px] text-opal-mist">
                        hash {entry.hash}
                        {entry.prevHash ? ` | prev ${entry.prevHash}` : ""}
                      </p>
                    ) : null}
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
                Policy checks, intervention events, and the hash-chained audit
                trail appear here while the workflow runs.
              </p>
            </div>
          ) : null}
          </div>
        </OpsConsoleShell>
      }
    />
  );
}
