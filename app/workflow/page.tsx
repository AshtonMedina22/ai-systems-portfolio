"use client";

import React, { useMemo, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { WorkflowOpsConsole } from "@/components/visualizers/WorkflowOpsConsole";
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
  type WorkflowScenarioKey,
} from "@/lib/workflow/types";
import { Check, X } from "lucide-react";
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

type FlowStatus = "idle" | "running" | "paused" | "done" | "rejected";

function deriveFlowState(logs: LogEntry[]): {
  status: FlowStatus;
  statusLabel: string;
  tone: BadgeTone;
  sessionId: string | null;
  lastNode: string | null;
} {
  let status: FlowStatus = logs.length ? "running" : "idle";
  let statusLabel = logs.length ? "Running..." : "Idle";
  let tone: BadgeTone = "neutral";
  let sessionId: string | null = null;
  let lastNode: string | null = null;

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.sessionId === "string") sessionId = data.sessionId;
    if (typeof data.node === "string") lastNode = data.node;

    if (data.action === "AWAITING_APPROVAL") {
      status = "paused";
      statusLabel = "Waiting on manager";
      tone = "warn";
    }
    if (data.action === "APPROVED") {
      status = "running";
      statusLabel = "Approved - finishing";
      tone = "ok";
    }
    if (data.action === "REJECTED") {
      status = "rejected";
      statusLabel = "Rejected";
      tone = "danger";
    }
    if (
      data.action === "COMPLETED" ||
      data.node === "completed" ||
      (log.level === "success" &&
        typeof data.action === "string" &&
        data.action !== "APPROVED")
    ) {
      if (status !== "rejected") {
        status = "done";
        statusLabel = "Completed";
        tone = "ok";
      }
    }
  }

  return { status, statusLabel, tone, sessionId, lastNode };
}

export default function WorkflowPage() {
  const [selected, setSelected] =
    useState<WorkflowScenarioKey>("contract_payout");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const request = SAMPLE_WORKFLOWS[selected];
  const flow = useMemo(() => deriveFlowState(logs), [logs]);
  const showImpact = logs.length > 0 || isRunning;
  const needsApproval = flow.status === "paused" && !!flow.sessionId;

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

  const handleDecision = async (action: "approve" | "reject") => {
    if (!flow.sessionId || deciding) return;
    setDeciding(true);

    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId: flow.sessionId }),
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
                : "Could not submit manager decision.",
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
          message: "Failed to reach the workflow API for Approve / Reject.",
        },
      ]);
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="min-h-screen">
      <GlassBox
        title="Workflow & Approvals"
        badge="Project 3"
        purpose="Sequential process runner with a hard manager gate above financial thresholds."
        problem="Multi-site workflows stall in email chains, and high-value steps can run without an explicit manager sign-off."
        built={`A state-machine runner that automates routine steps, then pauses when a request crosses $${FINANCIAL_THRESHOLD_USD.toLocaleString()} until a manager approves or rejects.`}
        stack="TypeScript · Next.js · Checkpoints · SSE"
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
                      <span className="font-mono text-[12px]">
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
                ]}
              />
            </div>

            {needsApproval ? (
              <div className="border-t border-amber-200 pt-4 space-y-3">
                <p className="label-opal">Manager review</p>
                <p className="text-sm leading-relaxed text-opal-muted">
                  Payout exceeds $
                  {FINANCIAL_THRESHOLD_USD.toLocaleString()}. Approve to resume
                  from the checkpoint, or Reject to stop.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={deciding}
                    onClick={() => handleDecision("approve")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={deciding}
                    onClick={() => handleDecision("reject")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            ) : null}

            {showImpact && !needsApproval ? (
              <ResultStrip>
                <p className="label-opal mb-1">Result</p>
                <ResultRow
                  label="Status"
                  value={<Badge tone={flow.tone}>{flow.statusLabel}</Badge>}
                />
                {flow.lastNode ? (
                  <ResultRow label="Step" value={flow.lastNode} />
                ) : null}
              </ResultStrip>
            ) : null}

            <DemoPrimaryButton
              label="Start workflow"
              busyLabel={
                needsApproval ? "Waiting for manager..." : "Running workflow..."
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
            onApprove={() => handleDecision("approve")}
            onReject={() => handleDecision("reject")}
            onClear={() => setLogs([])}
          />
        }
      />
    </div>
  );
}
