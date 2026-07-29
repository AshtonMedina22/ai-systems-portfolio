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
        title="Workflow Governance & Control"
        framing={WORKFLOW_FRAMING}
        badge="Project 3"
        purpose="Three-layer governance for automated work: policy permissions before action, human intervention during high-value steps, and a hash-chained audit receipt after."
        valueLine="Routine paths continue under policy. Requests over $10,000 place an authorization hold, pause for operations manager intervention, and either execute or roll the hold back."
        controlStatement={`Nothing above $${FINANCIAL_THRESHOLD_USD.toLocaleString()} executes without an explicit operations manager Approve or Reject. Reject releases the authorization hold and records a rolled-back receipt.`}
        challenge="Teams often collapse permissions, live intervention, and audit into one layer - so high-value automation can move without a clear stop, and logs only explain harm after it happens."
        solution={`A governed step runner that checks policy before action, pauses above $${FINANCIAL_THRESHOLD_USD.toLocaleString()} for operations manager intervention, and emits a hash-chained session receipt for who decided, when, on what amount, and under which policy.`}
        impact="Routine work proceeds under policy bounds; high-risk spend cannot complete without an explicit human decision, and reject rolls back the reserved authorization hold instead of leaving a dangling intent."
        guardrails={{
          objective:
            "Replace un-auditable email approvals with a strict state machine that enforces manager sign-off on requests over $10,000.",
          access:
            "Read/write access restricted to internal request records, communication routing, and the central policy engine.",
          failure:
            "Rejected requests trigger a state rollback of the authorization hold and log the exact failure reason for compliance auditing.",
        }}
        whenWrong={
          <div className="rounded-xl border border-line bg-console-panel px-4 py-4 sm:px-5 sm:py-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Policy before action
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Permissions and spend bounds are evaluated before the run
                  attempts final execution - not only after a pause.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Reject rolls back the hold
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Over-threshold runs reserve an authorization hold. Reject
                  releases that hold (compensating rollback) and blocks
                  downstream execution. This is an in-process demo hold, not a
                  live ledger undo.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Who reviews
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Operations manager decides in the governance console, with
                  actor, timestamp, optional reject reason, policy id, and hold
                  status on the session receipt.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-opal-main">
                  Audit receipt limit
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-opal-muted">
                  Entries are hash-chained for this session receipt. That proves
                  reconstruction for the demo run - it is not a durable WORM
                  store.
                </dd>
              </div>
            </dl>
          </div>
        }
        architectureVisual={<WorkflowArchitectureFlow />}
        architecture="UI starts a scenario. /api/workflow runs a TypeScript in-process state machine: policy check, optional authorization hold, intervention checkpoint, then execute or rollback. Approve / Reject resumes or rolls back the hold and emits a governance receipt. LangGraph and Postgres checkpoint config in the repo is reference only for this hosted demo."
        tradeoffs={[
          "Deterministic TypeScript routing fits this fixed money gate - clearer than an open-ended planner for a single threshold interrupt.",
          "In-memory demo checkpoints and hash-chained receipts - fine for a portfolio run, not durable across deploys or multiple instances.",
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
                <p className="label-opal">Intervention required</p>
                <div className="rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-3">
                  <p className="text-sm font-semibold text-opal-main">
                    Frozen - authorization hold reserved
                  </p>
                  <p className="mt-1.5 font-mono text-sm text-opal-main">
                    ${(request.amount ?? 0).toLocaleString()} &gt; $
                    {FINANCIAL_THRESHOLD_USD.toLocaleString()}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-opal-muted">
                    Use Approve / Reject in the governance console on the right
                    to release the hold to execute or roll it back.
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
