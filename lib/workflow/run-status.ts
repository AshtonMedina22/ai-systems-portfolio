/**
 * Run-derived status for the Workflow demo UI.
 * Values come only from the current session event stream - no invented KPIs.
 */

import type { LogEntry } from "@/components/ui/TerminalStream";
import {
  FINANCIAL_THRESHOLD_USD,
  type WorkflowAuditEntry,
  type WorkflowDecision,
  type WorkflowNodeId,
} from "./types";

export type ThresholdResult =
  | "pending"
  | "under"
  | "over"
  | "skipped"
  | "n/a";

export type ManagerDecisionStatus =
  | "none"
  | "awaiting"
  | "approved"
  | "rejected";

export type FinalRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "rejected";

export interface WorkflowRunStatus {
  currentState: string;
  thresholdResult: ThresholdResult;
  managerDecision: ManagerDecisionStatus;
  finalStatus: FinalRunStatus;
  auditTrail: WorkflowAuditEntry[];
  sessionId: string | null;
  amount: number | null;
  threshold: number;
  rejectReason: string | null;
  decisionActor: string | null;
  decisionAt: string | null;
}

function isAuditEntry(value: unknown): value is WorkflowAuditEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.node === "string" && typeof entry.at === "string";
}

function collectAuditTrail(logs: LogEntry[]): WorkflowAuditEntry[] {
  let latest: WorkflowAuditEntry[] = [];
  const seen = new Map<string, WorkflowAuditEntry>();

  for (const log of logs) {
    const data = log.data ?? {};
    if (Array.isArray(data.auditTrail)) {
      const valid = data.auditTrail.filter(isAuditEntry);
      if (valid.length) latest = valid;
    }
    if (isAuditEntry(data.audit)) {
      const key = `${data.audit.at}|${data.audit.node}|${data.audit.detail}`;
      seen.set(key, data.audit);
    }
  }

  if (latest.length) return latest;
  return Array.from(seen.values()).sort((a, b) => a.at.localeCompare(b.at));
}

export function deriveWorkflowRunStatus(logs: LogEntry[]): WorkflowRunStatus {
  let sessionId: string | null = null;
  let amount: number | null = null;
  let lastNode: WorkflowNodeId | string | null = null;
  let thresholdResult: ThresholdResult = logs.length ? "pending" : "n/a";
  let managerDecision: ManagerDecisionStatus = "none";
  let finalStatus: FinalRunStatus = logs.length ? "running" : "idle";
  let rejectReason: string | null = null;
  let decisionActor: string | null = null;
  let decisionAt: string | null = null;

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.sessionId === "string") sessionId = data.sessionId;
    if (typeof data.amount === "number") amount = data.amount;
    if (typeof data.node === "string") lastNode = data.node;

    if (
      data.node === "financial_threshold" &&
      data.amount == null &&
      data.status === "ok"
    ) {
      thresholdResult = "skipped";
    } else if (typeof data.overThreshold === "boolean") {
      thresholdResult = data.overThreshold ? "over" : "under";
    }

    if (data.action === "AWAITING_APPROVAL") {
      finalStatus = "paused";
      managerDecision = "awaiting";
      thresholdResult = "over";
      lastNode = "awaiting_approval";
    }

    if (data.action === "APPROVED") {
      managerDecision = "approved";
      finalStatus = "running";
      decisionActor =
        typeof data.actor === "string" ? data.actor : decisionActor;
      decisionAt = typeof data.decidedAt === "string" ? data.decidedAt : decisionAt;
    }

    if (data.action === "REJECTED") {
      managerDecision = "rejected";
      finalStatus = "rejected";
      decisionActor =
        typeof data.actor === "string" ? data.actor : decisionActor;
      decisionAt = typeof data.decidedAt === "string" ? data.decidedAt : decisionAt;
      if (typeof data.reason === "string" && data.reason.trim()) {
        rejectReason = data.reason.trim();
      }
    }

    if (data.action === "COMPLETED" || data.node === "completed") {
      if (finalStatus !== "rejected") {
        finalStatus = "completed";
      }
      lastNode = "completed";
    }
  }

  const auditTrail = collectAuditTrail(logs);
  for (const entry of auditTrail) {
    if (entry.decision === "approve") {
      managerDecision = "approved";
      decisionActor = entry.actor ?? decisionActor;
      decisionAt = entry.at;
    }
    if (entry.decision === "reject") {
      managerDecision = "rejected";
      decisionActor = entry.actor ?? decisionActor;
      decisionAt = entry.at;
      if (entry.reason) rejectReason = entry.reason;
    }
  }

  const currentState =
    finalStatus === "idle"
      ? "idle"
      : finalStatus === "paused"
        ? "awaiting_approval"
        : finalStatus === "rejected"
          ? "rejected"
          : finalStatus === "completed"
            ? "completed"
            : lastNode ?? "running";

  return {
    currentState,
    thresholdResult,
    managerDecision,
    finalStatus,
    auditTrail,
    sessionId,
    amount,
    threshold: FINANCIAL_THRESHOLD_USD,
    rejectReason,
    decisionActor,
    decisionAt,
  };
}

export function decisionLabel(decision: WorkflowDecision): string {
  return decision === "approve" ? "Approved" : "Rejected";
}
