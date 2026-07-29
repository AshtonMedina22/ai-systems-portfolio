"use client";

import React, { useMemo, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { WorkflowOpsConsole } from "@/components/visualizers/WorkflowOpsConsole";
import { WorkflowArchitectureFlow } from "@/components/visualizers/WorkflowArchitectureFlow";
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
  FINANCIAL_THRESHOLD_USD,
  SAMPLE_WORKFLOWS,
  WORKFLOW_REVIEWER_ROLE,
  type WorkflowScenarioKey,
} from "@/lib/workflow/types";
import { WORKFLOW_FRAMING } from "@/lib/workflow/runtime";
import { deriveWorkflowRunStatus } from "@/lib/workflow/run-status";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LogEntry } from "@/components/ui/TerminalStream";

const PRESETS: Array<{
  key: WorkflowScenarioKey;
  label: string;
  detail: string;
  tone: "default" | "danger";
}> = [
  {
    key: "contract_payout",
    label: "Vendor contract payout",
    detail: SAMPLE_WORKFLOWS.contract_payout.summary,
    tone: "danger",
  },
  {
    key: "inventory_realloc",
    label: "Inventory re-allocation",
    detail: SAMPLE_WORKFLOWS.inventory_realloc.summary,
    tone: "default",
  },
];

function statusTone(finalStatus: string): BadgeTone {
  if (finalStatus === "paused") return "warn";
  if (finalStatus === "rejected") return "danger";
  if (finalStatus === "completed") return "ok";
  if (finalStatus === "running") return "neutral";
  return "neutral";
}

export default function WorkflowPage() {
  const [selected, setSelected] =
    useState<WorkflowScenarioKey>("contract_payout");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const request = SAMPLE_WORKFLOWS[selected];
  const run = useMemo(() => deriveWorkflowRunStatus(logs), [logs]);
  const showImpact = logs.length > 0 || isRunning;
  const needsApproval =
    run.finalStatus === "paused" && !!run.sessionId;

  const handleSelect = (key: WorkflowScenarioKey) => {
    if (isRunning) return;
    setSelected(key);
    setLogs([]);
  };

  const readSse = async (response: Response) => {
    if (!response.ok || !response.body) {
      throw new Error("Failed to connect to /api/workflow stream.");
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
            console.error("Error parsing workflow SSE:", err);
          }
        }
      }
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setLogs([]);

    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: selected }),
      });
      await readSse(response);
    } catch (err) {
      console.error("Workflow stream error:", err);
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          source: "client:workflow",
          message: "Connection lost or stream interrupted during workflow.",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleDecision = async (
    action: "approve" | "reject",
    reason?: string
  ) => {
    if (!run.sessionId || deciding) return;
    setDeciding(true);

    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sessionId: run.sessionId,
          actor: WORKFLOW_REVIEWER_ROLE,
          ...(action === "reject" && reason?.trim()
            ? { reason: reason.trim() }
            : action === "reject"
              ? { reason: "Rejected by operations manager." }
              : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: "error",
            source: "client:workflow",
            message:
              typeof body.error === "string"
                ? body.error
                : "Could not submit operations manager decision.",
          },
        ]);
      }
    } catch (err) {
      console.error("Decision error:", err);
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          source: "client:workflow",
          message:
            "Failed to reach the workflow API for Approve request / Reject request.",
        },
      ]);
    } finally {
      setDeciding(false);
    }
  };

  const thresholdDisplay =
    run.thresholdResult === "over"
      ? "Over"
      : run.thresholdResult === "under"
        ? "Under"
        : run.thresholdResult === "skipped"
          ? "Skipped"
          : run.thresholdResult === "pending"
            ? "Pending"
            : "n/a";

  const managerDisplay =
    run.managerDecision === "awaiting"
      ? "Awaiting"
      : run.managerDecision === "approved"
        ? "Approved"
        : run.managerDecision === "rejected"
          ? "Rejected"
          : "None";

  return (
    <main className="min-h-screen">
      <GlassBox
        title="Workflow & Approvals"
        framing={WORKFLOW_FRAMING}
        badge="Project 3"
        purpose="Process runner with an operations manager checkpoint above financial thresholds."
        valueLine="Routine paths continue. Requests over $10,000 pause for operations manager approval; reject stops downstream execution."
        controlStatement={`Nothing above $${FINANCIAL_THRESHOLD_USD.toLocaleString()} continues without an explicit operations manager Approve or Reject on the paused checkpoint.`}
        challenge="Multi-site requests stall in email, and high-value steps can move without a clear operations manager sign-off."
        solution={`A step runner that handles routine work, then pauses above $${FINANCIAL_THRESHOLD_USD.toLocaleString()} until an operations manager approves or rejects.`}
        impact="Routine work proceeds; high-risk spend stops for an explicit operations manager decision instead of dying in email."
        whenWrong={
          <div className="rounded-xl border border-line bg-console-panel px-4 py-4 sm:px-5 sm:py-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Over-threshold path
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Amounts above $
                  {FINANCIAL_THRESHOLD_USD.toLocaleString()} freeze at the
                  threshold gate. Final execution does not run until Approve.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Reject stops the run
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Reject ends the session. Downstream steps do not execute.
                  This demo does not roll back external side effects.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Who reviews
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Operations manager reviews in the ops console, with actor,
                  timestamp, and optional reject reason on the session audit
                  trail.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Audit trail limit
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Events are an in-memory demo trail for the current run - not
                  an immutable or durable store.
                </dd>
              </div>
            </dl>
          </div>
        }
        architectureVisual={<WorkflowArchitectureFlow />}
        architecture="UI starts a scenario. /api/workflow runs a TypeScript in-process state machine with an in-memory interrupt checkpoint; Approve request / Reject request resumes or stops the run. LangGraph and Postgres checkpoint config in the repo is reference only for this hosted demo."
        tradeoffs={[
          "Deterministic TypeScript routing fits this fixed money gate - clearer than an open-ended planner for a single threshold interrupt.",
          "In-memory demo checkpoints - fine for a portfolio run, not durable across deploys or multiple instances.",
          "A durable graph or checkpoint runtime (for example LangGraph with Postgres) can be added when approvals must survive restarts or span instances; that path is config/reference here, not the public runtime.",
        ]}
        stack="TypeScript, Next.js, SSE"
        isRunning={isRunning}
        controlLabel="Scenario"
        controlPanel={
          <div className="flex flex-col gap-6">
            <ScenarioList label="Pick a workflow">
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
              <p className="label-opal mb-3">Request</p>
              <DetailList
                rows={[
                  {
                    label: "ID",
                    value: (
                      <span className="font-mono text-xs">
                        {request.requestId}
                      </span>
                    ),
                  },
                  { label: "Site", value: request.site },
                  { label: "Subject", value: request.subject },
                  {
                    label: "Amount",
                    value:
                      request.amount != null
                        ? `$${request.amount.toLocaleString()}`
                        : "N/A",
                    emphasize: request.amount != null,
                  },
                  {
                    label: "Threshold",
                    value: `$${FINANCIAL_THRESHOLD_USD.toLocaleString()}`,
                  },
                ]}
              />
            </div>

            {needsApproval ? (
              <div className="space-y-3 border-t border-line pt-4">
                <p className="label-opal">Operations manager review</p>
                <div className="rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-3">
                  <p className="text-sm font-semibold text-opal-main">
                    Frozen - amount vs threshold
                  </p>
                  <p className="mt-1.5 font-mono text-sm text-opal-main">
                    ${(request.amount ?? 0).toLocaleString()} &gt; $
                    {FINANCIAL_THRESHOLD_USD.toLocaleString()}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-opal-muted">
                    Use Approve / Reject in the operations console on the right
                    to resume or stop the run.
                  </p>
                </div>
              </div>
            ) : null}

            {showImpact && !needsApproval ? (
              <ResultStrip>
                <p className="label-opal mb-1">Run status</p>
                <ResultRow
                  label="Current state"
                  value={
                    <span className="font-mono text-xs">
                      {run.currentState}
                    </span>
                  }
                />
                <ResultRow label="Threshold" value={thresholdDisplay} />
                <ResultRow label="Manager decision" value={managerDisplay} />
                <ResultRow
                  label="Final status"
                  value={
                    <Badge tone={statusTone(run.finalStatus)}>
                      {run.finalStatus}
                    </Badge>
                  }
                />
              </ResultStrip>
            ) : null}

            <DemoPrimaryButton
              label="Start workflow"
              busyLabel={
                needsApproval
                  ? "Waiting for operations manager..."
                  : "Running workflow..."
              }
              isRunning={isRunning}
              onClick={handleRun}
            />
          </div>
        }
        streamPanel={
          <WorkflowOpsConsole
            logs={logs}
            isRunning={isRunning}
            amount={request.amount}
            deciding={deciding}
            liveLabel={WORKFLOW_FRAMING}
            onApprove={() => handleDecision("approve")}
            onReject={(reason) => handleDecision("reject", reason)}
            onClear={() => setLogs([])}
          />
        }
      />
    </main>
  );
}
