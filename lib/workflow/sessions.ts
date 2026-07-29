import type { WorkflowDecision } from "./types";
import { WORKFLOW_REVIEWER_ROLE } from "./types";

export type SessionStatus =
  | "running"
  | "paused"
  | "completed"
  | "rejected"
  | "cancelled";

export interface WorkflowDecisionResult {
  decision: WorkflowDecision;
  actor: string;
  at: string;
  reason?: string;
}

export interface WorkflowSession {
  id: string;
  status: SessionStatus;
  createdAt: number;
  /** Resolves when an operations manager posts Approve or Reject. */
  resume?: (result: WorkflowDecisionResult) => void;
  decision?: WorkflowDecision;
  decisionMeta?: WorkflowDecisionResult;
}

declare global {
  // eslint-disable-next-line no-var
  var __workflowSessions: Map<string, WorkflowSession> | undefined;
}

function getStore(): Map<string, WorkflowSession> {
  if (!globalThis.__workflowSessions) {
    globalThis.__workflowSessions = new Map();
  }
  return globalThis.__workflowSessions;
}

export function createSession(id: string): WorkflowSession {
  const session: WorkflowSession = {
    id,
    status: "running",
    createdAt: Date.now(),
  };
  getStore().set(id, session);
  return session;
}

export function getSession(id: string): WorkflowSession | undefined {
  return getStore().get(id);
}

export function waitForDecision(
  session: WorkflowSession
): Promise<WorkflowDecisionResult> {
  session.status = "paused";
  return new Promise<WorkflowDecisionResult>((resolve) => {
    session.resume = (result) => {
      session.decision = result.decision;
      session.decisionMeta = result;
      session.status = result.decision === "approve" ? "running" : "rejected";
      session.resume = undefined;
      resolve(result);
    };
  });
}

export function submitDecision(
  sessionId: string,
  decision: WorkflowDecision,
  options?: { reason?: string; actor?: string }
): { ok: true; result: WorkflowDecisionResult } | { ok: false; error: string } {
  const session = getSession(sessionId);
  if (!session) {
    return { ok: false, error: "No active workflow session with that id." };
  }
  if (session.status !== "paused" || !session.resume) {
    return {
      ok: false,
      error: "This workflow is not waiting for operations manager sign-off.",
    };
  }

  const trimmedReason =
    typeof options?.reason === "string" ? options.reason.trim() : "";
  const result: WorkflowDecisionResult = {
    decision,
    actor: options?.actor?.trim() || WORKFLOW_REVIEWER_ROLE,
    at: new Date().toISOString(),
    ...(decision === "reject" && trimmedReason
      ? { reason: trimmedReason }
      : decision === "reject"
        ? { reason: "Rejected by operations manager." }
        : {}),
  };

  session.resume(result);
  return { ok: true, result };
}

export function markSessionComplete(session: WorkflowSession) {
  session.status = "completed";
  session.resume = undefined;
}

export function markSessionRejected(session: WorkflowSession) {
  session.status = "rejected";
  session.resume = undefined;
}
