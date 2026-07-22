import type { WorkflowDecision } from "./types";

export type SessionStatus =
  | "running"
  | "paused"
  | "completed"
  | "rejected"
  | "cancelled";

export interface WorkflowSession {
  id: string;
  status: SessionStatus;
  createdAt: number;
  /** Resolves when a manager posts Approve or Reject. */
  resume?: (decision: WorkflowDecision) => void;
  decision?: WorkflowDecision;
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
): Promise<WorkflowDecision> {
  session.status = "paused";
  return new Promise<WorkflowDecision>((resolve) => {
    session.resume = (decision) => {
      session.decision = decision;
      session.status = decision === "approve" ? "running" : "rejected";
      session.resume = undefined;
      resolve(decision);
    };
  });
}

export function submitDecision(
  sessionId: string,
  decision: WorkflowDecision
): { ok: true } | { ok: false; error: string } {
  const session = getSession(sessionId);
  if (!session) {
    return { ok: false, error: "No active workflow session with that id." };
  }
  if (session.status !== "paused" || !session.resume) {
    return {
      ok: false,
      error: "This workflow is not waiting for manager sign-off.",
    };
  }
  session.resume(decision);
  return { ok: true };
}

export function markSessionComplete(session: WorkflowSession) {
  session.status = "completed";
  session.resume = undefined;
}

export function markSessionRejected(session: WorkflowSession) {
  session.status = "rejected";
  session.resume = undefined;
}
