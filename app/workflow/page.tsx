"use client";

import React, { useMemo, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { WorkflowOpsConsole } from "@/components/visualizers/WorkflowOpsConsole";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import {
  FINANCIAL_THRESHOLD_USD,
  SAMPLE_WORKFLOWS,
  type WorkflowScenarioKey,
} from "@/lib/workflow/types";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Package,
  ShieldAlert,
  X,
} from "lucide-react";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LogEntry } from "@/components/ui/TerminalStream";

const PRESETS: Array<{
  key: WorkflowScenarioKey;
  label: string;
  detail: string;
  icon: React.ReactNode;
  activeClass: string;
}> = [
  {
    key: "contract_payout",
    label: "Approve Vendor Contract & Payout",
    detail: SAMPLE_WORKFLOWS.contract_payout.summary,
    icon: <ShieldAlert className="h-4 w-4 text-rose-700" />,
    activeClass:
      "border-rose-300 bg-rose-50 text-opal-main shadow-sm ring-1 ring-rose-200",
  },
  {
    key: "inventory_realloc",
    label: "Initiate Automated Inventory Re-allocation",
    detail: SAMPLE_WORKFLOWS.inventory_realloc.summary,
    icon: <Package className="h-4 w-4 text-emerald-700" />,
    activeClass:
      "border-violet-400 bg-violet-50 text-opal-main shadow-sm ring-1 ring-violet-200",
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

function HowThisWorks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card-opal rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-opal-main">
          What this is (in plain English)
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-opal-label transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-slate-300 px-4 py-3.5 text-sm leading-relaxed text-opal-muted space-y-3">
          <p>
            In growing multi-site operations, complex workflows - vendor
            contract approvals, high-value payouts, inventory moves - get stuck
            when emails get lost, approvals are missed, or someone runs a
            high-risk step without checking with a manager first.
          </p>
          <p>
            This demo runs a multi-step process in order. Routine work can
            finish on its own. The moment a request crosses a high-risk
            financial threshold ($
            {FINANCIAL_THRESHOLD_USD.toLocaleString()}+), execution pauses and
            a clear manager approval gate appears on screen. Nothing moves
            forward until a manager clicks approve. The right panel streams
            each step as it happens.
          </p>
          <p>
            Same pattern as large multi-step transaction engines used in
            multi-location event and rental ops.
          </p>
        </div>
      ) : null}
    </div>
  );
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
        title="Workflow & Approval Manager"
        badge="Project 3 - Multi-site process runner with manager sign-off"
        description="A step-by-step process runner that automates multi-department tasks while keeping people in control. If a financial transaction or system request exceeds safe thresholds, the workflow pauses and waits for explicit manager sign-off before proceeding."
        headerExtra={<HowThisWorks />}
        isRunning={isRunning}
        controlLabel="Try it"
        controlHint="Pick a workflow"
        controlPanel={
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label="Workflow status"
                value={<Badge tone={flow.tone}>{flow.statusLabel}</Badge>}
              />
              <StatCard
                label="Current step"
                value={flow.lastNode ?? (isRunning ? "Starting..." : "-")}
              />
              <StatCard
                label="Amount"
                value={
                  request.amount != null
                    ? `$${request.amount.toLocaleString()}`
                    : "N/A"
                }
              />
            </div>

            <div>
              <label className="label-opal mb-2.5 block">Pick a workflow</label>
              <div className="grid grid-cols-1 gap-2.5">
                {PRESETS.map((preset) => {
                  const active = selected === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleSelect(preset.key)}
                      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-all disabled:opacity-60 ${
                        active
                          ? preset.activeClass
                          : "border-slate-300 bg-white text-opal-muted hover:border-violet-300 hover:bg-violet-50/40"
                      }`}
                    >
                      <span className="mt-0.5">{preset.icon}</span>
                      <span>
                        <span className="block text-sm font-semibold text-opal-main">
                          {preset.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-opal-muted">
                          {preset.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm space-y-2">
              <p className="label-opal">Request</p>
              <div className="flex justify-between gap-3">
                <span className="text-opal-label">ID</span>
                <span className="font-mono text-xs font-semibold text-opal-main">
                  {request.requestId}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-opal-label">Site</span>
                <span className="text-right font-medium text-opal-main">
                  {request.site}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-opal-label">Subject</span>
                <span className="text-right font-medium text-opal-main">
                  {request.subject}
                </span>
              </div>
            </div>

            {needsApproval ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 space-y-3">
                <p className="label-opal">Manager review</p>
                <p className="text-sm leading-relaxed text-opal-muted">
                  This payout is over $
                  {FINANCIAL_THRESHOLD_USD.toLocaleString()}. Approve to resume
                  from the checkpoint, or Reject to stop the workflow.
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
              <div className="rounded-xl border border-slate-300 bg-violet-50/50 px-4 py-3.5 space-y-3">
                <p className="label-opal">What happened</p>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Status</span>
                  <Badge tone={flow.tone}>{flow.statusLabel}</Badge>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5">
              <p className="label-opal mb-2">Built with</p>
              <p className="text-sm leading-relaxed text-opal-muted">
                LangGraph-style state machine - durable checkpoints - manager
                sign-off - SSE streaming
              </p>
            </div>

            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning}
              className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-opal-purple px-4 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-opal-violet disabled:opacity-50"
            >
              <span>
                {isRunning
                  ? needsApproval
                    ? "Waiting for manager..."
                    : "Running workflow..."
                  : "Start workflow"}
              </span>
              {!isRunning ? (
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              ) : null}
            </button>
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
