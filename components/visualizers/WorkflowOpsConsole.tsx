"use client";

import React, { useMemo } from "react";
import {
  CompactEventLog,
  OpsConsoleShell,
} from "@/components/ui/OpsConsole";
import { DemoPanelTabs } from "@/components/ui/CodeViewer";
import type { LogEntry } from "@/components/ui/TerminalStream";
import {
  FINANCIAL_THRESHOLD_USD,
  type WorkflowNodeId,
} from "@/lib/workflow/types";
import { WORKFLOW_SOURCE_FILES } from "@/lib/portfolio/source-excerpts";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";

const STEPS: Array<{ id: WorkflowNodeId; label: string }> = [
  { id: "intake", label: "Intake" },
  { id: "compliance_check", label: "Compliance Check" },
  { id: "financial_threshold", label: "Budget Approval" },
  { id: "final_execution", label: "Final Execution" },
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

function StepNode({
  label,
  state,
}: {
  label: string;
  state: "pending" | "active" | "done" | "paused" | "rejected";
}) {
  const ring =
    state === "paused"
      ? "border-amber-400 bg-amber-500/20 text-amber-100 ring-2 ring-amber-400/40"
      : state === "active"
        ? "border-violet-400 bg-violet-500/20 text-violet-100"
        : state === "done"
          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
          : state === "rejected"
            ? "border-rose-400/60 bg-rose-500/15 text-rose-100"
            : "border-slate-500/50 bg-slate-800/60 text-slate-400";

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
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
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        )}
      </div>
      <span className="text-center text-[10px] font-semibold leading-tight text-slate-200 sm:text-[11px]">
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
  onApprove,
  onReject,
  onClear,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  amount: number | null;
  deciding?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onClear?: () => void;
}) {
  const graph = useMemo(() => deriveWorkflowGraph(logs), [logs]);
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
    ? "Live - ready for workflow"
    : graph.paused
      ? "Frozen - manager review"
      : graph.rejected
        ? "Rejected"
        : graph.done
          ? "Completed"
          : isRunning
            ? "Live - running steps"
            : "Idle";

  return (
    <DemoPanelTabs
      sourceFiles={WORKFLOW_SOURCE_FILES}
      live={
        <OpsConsoleShell
          title="Live Visual Console"
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRunning={(idle || isRunning) && !graph.paused}
          eventCount={logs.length}
          onClear={onClear}
        >
          <div className="rounded-xl border border-slate-500/50 bg-slate-950/35 px-3.5 py-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Interactive flowchart / state machine
            </p>
            <p className="mt-1 text-[13px] text-slate-300">
              Intake - Compliance Check - Budget Approval - Final Execution
            </p>
          </div>

          <div
            className={`rounded-xl border px-3 py-4 ${
              graph.paused
                ? "border-amber-400/50 bg-amber-950/20"
                : "border-slate-500/50 bg-slate-950/35"
            }`}
          >
            <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Process steps
            </p>
            <div className="flex items-start gap-0.5 sm:gap-1">
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
                      <div className="mt-5 flex flex-col items-center px-0.5">
                        <span
                          className={`text-[10px] font-semibold ${
                            graph.completed.has(step.id) ||
                            (graph.current === step.id &&
                              graph.completed.has(STEPS[index - 1].id))
                              ? "text-emerald-400"
                              : "text-slate-500"
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
              <p className="mt-4 text-center text-[12px] text-slate-400">
                Hit Start workflow on the left. Active nodes spin while they
                run; high-dollar payouts freeze at Budget Approval.
              </p>
            ) : null}
          </div>

          {graph.paused ? (
            <div
              role="dialog"
              aria-label="Manager review required"
              className="rounded-xl border-2 border-amber-400/60 bg-amber-950/45 p-4 space-y-3 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-amber-50">
                    Manager review required
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-amber-100/90">
                    Amount{" "}
                    <span className="font-semibold text-white">
                      ${(displayAmount ?? 0).toLocaleString()}
                    </span>{" "}
                    exceeds the automatic limit of $
                    {FINANCIAL_THRESHOLD_USD.toLocaleString()}. The flowchart is
                    frozen at Budget Approval until a manager signs off.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={deciding || !onApprove}
                  onClick={onApprove}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Approve payout
                </button>
                <button
                  type="button"
                  disabled={deciding || !onReject}
                  onClick={onReject}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Flag for audit
                </button>
              </div>
            </div>
          ) : null}

          {graph.done ? (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/30 px-3.5 py-3 text-[13px] text-emerald-100">
              Workflow finished - all steps cleared through Final Execution.
            </div>
          ) : null}

          {graph.rejected ? (
            <div className="rounded-xl border border-rose-400/40 bg-rose-950/30 px-3.5 py-3 text-[13px] text-rose-100">
              Manager flagged the request for audit. Downstream steps did not
              run.
            </div>
          ) : null}

          <CompactEventLog
            logs={logs}
            isRunning={isRunning && !graph.paused}
          />
          {idle ? (
            <div className="rounded-xl border border-slate-500/50 bg-slate-950/40 px-3 py-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Activity log
              </p>
              <p className="mt-2 text-[12px] text-slate-500">
                Step transitions will stream here while the workflow runs.
              </p>
            </div>
          ) : null}
        </OpsConsoleShell>
      }
    />
  );
}
