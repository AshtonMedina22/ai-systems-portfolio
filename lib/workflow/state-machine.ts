/**
 * TypeScript workflow demo for /workflow and /api/workflow (DEMO_MODE=mockup).
 * Live LangGraph path is not used here - see config.ts.
 *
 * Governance layers demonstrated:
 * 1) Policy permissions before action
 * 2) Intervention gate during high-value runs
 * 3) Hash-chained audit receipt after decision / completion
 */

import { LogEntry } from "@/components/ui/TerminalStream";
import {
  createSession,
  markSessionComplete,
  markSessionRejected,
  waitForDecision,
  type WorkflowSession,
} from "./sessions";
import {
  FINANCIAL_THRESHOLD_USD,
  SAMPLE_WORKFLOWS,
  WORKFLOW_REVIEWER_ROLE,
  type GovernanceReceipt,
  type HoldStatus,
  type WorkflowAuditEntry,
  type WorkflowNodeId,
  type WorkflowRequest,
  type WorkflowScenarioKey,
} from "./types";
import { DEMO_MODE } from "./runtime";

function createLogEntry(
  level: LogEntry["level"],
  source: string,
  message: string,
  data?: Record<string, unknown>
): LogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
    level,
    source,
    message,
    data,
  };
}

async function sleep(ms: number) {
  if (process.env.WORKFLOW_TEST_FAST === "1") return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Deterministic FNV-1a style hash for session receipt chaining. */
export function hashPayload(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function audit(
  trail: WorkflowAuditEntry[],
  node: WorkflowNodeId,
  detail: string,
  extra?: Partial<
    Pick<
      WorkflowAuditEntry,
      "actor" | "decision" | "reason" | "policyId"
    >
  >
): WorkflowAuditEntry {
  const prevHash = trail.length ? trail[trail.length - 1].hash ?? "GENESIS" : "GENESIS";
  const at = new Date().toISOString();
  const receiptId = `rcpt-${trail.length + 1}-${hashPayload(`${at}|${node}|${detail}`).slice(0, 6)}`;
  const hash = hashPayload(
    `${prevHash}|${receiptId}|${node}|${at}|${detail}|${extra?.actor ?? ""}|${extra?.decision ?? ""}|${extra?.reason ?? ""}|${extra?.policyId ?? ""}`
  );
  const entry: WorkflowAuditEntry = {
    node,
    at,
    detail,
    receiptId,
    prevHash,
    hash,
    ...extra,
  };
  trail.push(entry);
  return entry;
}

function buildReceipt(input: {
  trail: WorkflowAuditEntry[];
  sessionId: string;
  requestId: string;
  amount: number | null;
  policyId: string;
  holdId: string | null;
  holdStatus: HoldStatus;
  transaction: GovernanceReceipt["transaction"];
  actor?: string;
  decidedAt?: string;
  decision?: GovernanceReceipt["decision"];
}): GovernanceReceipt {
  const trailHash =
    input.trail.length > 0
      ? input.trail[input.trail.length - 1].hash ?? "GENESIS"
      : "GENESIS";
  return {
    receiptId: `receipt-${input.sessionId.slice(-8)}-${trailHash}`,
    sessionId: input.sessionId,
    requestId: input.requestId,
    transaction: input.transaction,
    actor: input.actor,
    decidedAt: input.decidedAt,
    decision: input.decision,
    amount: input.amount,
    policyId: input.policyId,
    holdId: input.holdId,
    holdStatus: input.holdStatus,
    trailHash,
    auditTrail: [...input.trail],
  };
}

function nodeTransition(
  from: WorkflowNodeId,
  to: WorkflowNodeId,
  detail: string,
  trail: WorkflowAuditEntry[]
): LogEntry {
  const entry = audit(trail, to, detail);
  return createLogEntry("info", `graph:${from}->${to}`, detail, {
    node: to,
    from,
    to,
    audit: entry,
    pattern: "checkpoint",
  });
}

function policyForScenario(scenarioKey: WorkflowScenarioKey): {
  policyId: string;
  checks: string[];
  allowedActions: string[];
} {
  if (scenarioKey === "inventory_realloc") {
    return {
      policyId: "policy.site_auto_transfer",
      checks: ["site_policy", "required_fields", "sku_present", "within_auto_transfer_limit"],
      allowedActions: ["queue_inventory_transfer"],
    };
  }
  return {
    policyId: "policy.vendor_contract_payout",
    checks: ["site_policy", "required_fields", "vendor_packet_complete", "spend_authority_bounds"],
    allowedActions: ["place_authorization_hold", "queue_contract_payout"],
  };
}

/**
 * Interactive workflow demo (TypeScript in-process state machine):
 * Intake -> Policy Check -> Financial Threshold -> (Hold + Intervention) -> Final Execution
 * DEMO_MODE is "mockup".
 */
export async function* runWorkflowEngine(
  scenarioKey: WorkflowScenarioKey,
  sessionId?: string
): AsyncGenerator<LogEntry, void, unknown> {
  const request: WorkflowRequest = SAMPLE_WORKFLOWS[scenarioKey];
  if (!request) {
    yield createLogEntry(
      "error",
      "workflow:engine",
      `Unknown scenario: ${scenarioKey}`
    );
    return;
  }

  const id =
    sessionId ??
    `wf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const session: WorkflowSession = createSession(id);
  const trail: WorkflowAuditEntry[] = [];
  const policy = policyForScenario(scenarioKey);
  let holdId: string | null = null;
  let holdStatus: HoldStatus = "none";

  yield createLogEntry(
    "info",
    "workflow:session",
    `Started workflow ${request.requestId} (${request.title}).`,
    {
      sessionId: id,
      scenario: scenarioKey,
      requestId: request.requestId,
      amount: request.amount,
      site: request.site,
      demoMode: DEMO_MODE,
      runtime: "in-process",
      note: "Interactive demo (mockup) - TypeScript state machine with in-memory checkpoint.",
    }
  );

  await sleep(350);

  // --- Intake ---
  yield nodeTransition(
    "intake",
    "intake",
    `Intake recorded for ${request.subject} at ${request.site}.`,
    trail
  );
  yield createLogEntry(
    "tool_call",
    "node:intake",
    "Pulling request packet and routing to the next step...",
    {
      method: "step",
      node: "intake",
      edges: ["compliance_check"],
      payload: {
        requestId: request.requestId,
        category: request.category,
      },
    }
  );
  await sleep(450);
  yield createLogEntry(
    "tool_result",
    "node:intake",
    "Intake complete. Handing off to policy check.",
    { node: "intake", status: "ok" }
  );

  await sleep(300);

  // --- Layer 1: Policy / permission check ---
  yield nodeTransition(
    "intake",
    "compliance_check",
    "Policy check started - confirming permissions before any action is attempted.",
    trail
  );
  yield createLogEntry(
    "tool_call",
    "node:compliance_check",
    "Evaluating policy permissions and spend authority bounds...",
    {
      method: "policy_check",
      node: "compliance_check",
      policyId: policy.policyId,
      checks: policy.checks,
      actorRoleRequired: WORKFLOW_REVIEWER_ROLE,
    }
  );
  await sleep(500);

  audit(
    trail,
    "compliance_check",
    `Policy ${policy.policyId} passed before action attempt.`,
    { policyId: policy.policyId }
  );

  yield createLogEntry(
    "tool_result",
    "node:compliance_check",
    scenarioKey === "inventory_realloc"
      ? "Policy check passed: inventory move is within auto-transfer permissions."
      : "Policy check passed: vendor payout is within compliance bounds pending threshold gate.",
    {
      action: "POLICY_OK",
      node: "compliance_check",
      status: "ok",
      policyId: policy.policyId,
      checks: policy.checks,
      allowedActions: policy.allowedActions,
      actorRoleRequired: WORKFLOW_REVIEWER_ROLE,
      layer: "permissions",
    }
  );

  await sleep(300);

  // --- Financial Threshold ---
  yield nodeTransition(
    "compliance_check",
    "financial_threshold",
    `Checking financial threshold (pause if amount > $${FINANCIAL_THRESHOLD_USD.toLocaleString()}).`,
    trail
  );

  const amount = request.amount;
  const overThreshold =
    typeof amount === "number" && amount > FINANCIAL_THRESHOLD_USD;

  yield createLogEntry(
    "tool_call",
    "node:financial_threshold",
    overThreshold
      ? `Amount $${amount.toLocaleString()} is over $${FINANCIAL_THRESHOLD_USD.toLocaleString()} - intervention required.`
      : amount == null
        ? "No cash payout on this path - threshold check skipped."
        : `Amount $${amount.toLocaleString()} is under the $${FINANCIAL_THRESHOLD_USD.toLocaleString()} limit.`,
    {
      method: "step",
      node: "financial_threshold",
      amount,
      threshold: FINANCIAL_THRESHOLD_USD,
      overThreshold,
    }
  );

  await sleep(450);

  if (overThreshold) {
    holdId = `hold-${id.slice(-8)}`;
    holdStatus = "reserved";
    audit(
      trail,
      "financial_threshold",
      `Authorization hold ${holdId} reserved for $${amount!.toLocaleString()}.`,
      { policyId: policy.policyId }
    );

    yield createLogEntry(
      "tool_result",
      "node:financial_threshold",
      `Authorization hold placed for $${amount!.toLocaleString()} before manager intervention.`,
      {
        action: "HOLD_PLACED",
        sessionId: id,
        node: "financial_threshold",
        holdId,
        amount,
        status: "reserved",
        holdStatus,
        policyId: policy.policyId,
      }
    );
    await sleep(300);

    audit(
      trail,
      "awaiting_approval",
      `Paused for ${WORKFLOW_REVIEWER_ROLE} intervention on $${amount!.toLocaleString()} payout.`
    );

    const pausedReceipt = buildReceipt({
      trail,
      sessionId: id,
      requestId: request.requestId,
      amount,
      policyId: policy.policyId,
      holdId,
      holdStatus,
      transaction: "paused",
    });

    // Register the pause before emitting so Approve/Reject can resolve immediately.
    const decisionPromise = waitForDecision(session);

    yield createLogEntry(
      "warning",
      "node:awaiting_approval",
      `Intervention gate open. ${WORKFLOW_REVIEWER_ROLE} sign-off needed before the $${amount!.toLocaleString()} payout can run.`,
      {
        action: "AWAITING_APPROVAL",
        sessionId: id,
        amount,
        threshold: FINANCIAL_THRESHOLD_USD,
        overThreshold: true,
        checkpoint: true,
        node: "awaiting_approval",
        reviewerRole: WORKFLOW_REVIEWER_ROLE,
        holdId,
        holdStatus,
        policyId: policy.policyId,
        layer: "intervention",
        auditTrail: [...trail],
        receipt: pausedReceipt,
      }
    );

    const decisionResult = await decisionPromise;

    if (decisionResult.decision === "reject") {
      markSessionRejected(session);
      holdStatus = "rolled_back";
      const rejectDetail = decisionResult.reason
        ? `${WORKFLOW_REVIEWER_ROLE} rejected the payout. Reason: ${decisionResult.reason}`
        : `${WORKFLOW_REVIEWER_ROLE} rejected the payout.`;
      audit(trail, "rejected", rejectDetail, {
        actor: decisionResult.actor,
        decision: "reject",
        reason: decisionResult.reason,
        policyId: policy.policyId,
      });

      yield createLogEntry(
        "warning",
        "workflow:rollback",
        `Compensating rollback: released authorization hold ${holdId}.`,
        {
          action: "ROLLED_BACK",
          sessionId: id,
          node: "rejected",
          holdId,
          holdStatus,
          compensation: "release_authorization_hold",
          amount,
          actor: decisionResult.actor,
          decidedAt: decisionResult.at,
          policyId: policy.policyId,
          layer: "intervention",
        }
      );

      const receipt = buildReceipt({
        trail,
        sessionId: id,
        requestId: request.requestId,
        amount,
        policyId: policy.policyId,
        holdId,
        holdStatus,
        transaction: "rolled_back",
        actor: decisionResult.actor,
        decidedAt: decisionResult.at,
        decision: "reject",
      });

      yield createLogEntry(
        "error",
        "workflow:checkpoint",
        `${WORKFLOW_REVIEWER_ROLE} rejected ${request.requestId}. Hold rolled back; downstream steps did not run.`,
        {
          action: "REJECTED",
          sessionId: id,
          node: "rejected",
          actor: decisionResult.actor,
          decidedAt: decisionResult.at,
          reason: decisionResult.reason,
          holdId,
          holdStatus,
          policyId: policy.policyId,
          auditTrail: [...trail],
          receipt,
          layer: "audit",
        }
      );
      return;
    }

    holdStatus = "released_to_execute";
    audit(
      trail,
      "financial_threshold",
      `${WORKFLOW_REVIEWER_ROLE} approved. Hold released to execute.`,
      {
        actor: decisionResult.actor,
        decision: "approve",
        policyId: policy.policyId,
      }
    );

    yield createLogEntry(
      "success",
      "workflow:checkpoint",
      `${WORKFLOW_REVIEWER_ROLE} approved. Resuming from checkpoint toward final execution.`,
      {
        action: "APPROVED",
        sessionId: id,
        node: "financial_threshold",
        actor: decisionResult.actor,
        decidedAt: decisionResult.at,
        holdId,
        holdStatus,
        policyId: policy.policyId,
        auditTrail: [...trail],
        layer: "intervention",
      }
    );

    yield createLogEntry(
      "tool_result",
      "workflow:hold",
      `Authorization hold ${holdId} released to execute.`,
      {
        action: "HOLD_RELEASED_TO_EXECUTE",
        sessionId: id,
        holdId,
        holdStatus,
        amount,
        policyId: policy.policyId,
      }
    );
    await sleep(350);
  } else {
    yield createLogEntry(
      "tool_result",
      "node:financial_threshold",
      "Threshold clear - no operations manager intervention on this path.",
      {
        node: "financial_threshold",
        status: "ok",
        amount,
        threshold: FINANCIAL_THRESHOLD_USD,
        overThreshold: false,
      }
    );
  }

  await sleep(300);

  // --- Pre-execution policy re-check (Layer 1 again) ---
  yield createLogEntry(
    "tool_call",
    "node:final_execution",
    "Re-checking policy permissions immediately before final execution...",
    {
      method: "policy_recheck",
      node: "final_execution",
      policyId: policy.policyId,
      checks: policy.checks,
    }
  );
  await sleep(300);

  yield createLogEntry(
    "tool_result",
    "node:final_execution",
    "Pre-execution policy check passed. Proceeding with allowed action.",
    {
      action: "POLICY_OK",
      node: "final_execution",
      status: "ok",
      policyId: policy.policyId,
      checks: policy.checks,
      allowedActions: policy.allowedActions,
      actorRoleRequired: WORKFLOW_REVIEWER_ROLE,
      layer: "permissions",
      phase: "pre_execution",
    }
  );

  // --- Final Execution ---
  yield nodeTransition(
    overThreshold ? "awaiting_approval" : "financial_threshold",
    "final_execution",
    "Final execution node started.",
    trail
  );

  if (scenarioKey === "inventory_realloc") {
    yield createLogEntry(
      "tool_call",
      "node:final_execution",
      "Scheduling inventory transfer between sites...",
      {
        method: "step",
        node: "final_execution",
        operation: "inventory_reallocation",
        subject: request.subject,
      }
    );
    await sleep(550);
    yield createLogEntry(
      "tool_result",
      "node:final_execution",
      "Transfer ticket opened. Stock move queued for warehouse pick.",
      {
        node: "final_execution",
        ticketId: `INV-XFER-${request.requestId.slice(-4)}`,
        status: "queued",
      }
    );
  } else {
    yield createLogEntry(
      "tool_call",
      "node:final_execution",
      `Releasing $${amount!.toLocaleString()} contract payout...`,
      {
        method: "step",
        node: "final_execution",
        operation: "contract_payout",
        amount,
        vendor: request.subject,
        holdId,
      }
    );
    await sleep(550);
    yield createLogEntry(
      "tool_result",
      "node:final_execution",
      "Payout instruction posted to the payment queue.",
      {
        node: "final_execution",
        paymentRef: `PAY-${request.requestId.slice(-4)}`,
        status: "queued",
        amount,
        holdId,
      }
    );
  }

  await sleep(300);

  audit(trail, "completed", "Workflow finished successfully.", {
    policyId: policy.policyId,
  });
  markSessionComplete(session);

  const receipt = buildReceipt({
    trail,
    sessionId: id,
    requestId: request.requestId,
    amount,
    policyId: policy.policyId,
    holdId,
    holdStatus,
    transaction: "committed",
  });

  yield createLogEntry(
    "success",
    "workflow:engine",
    scenarioKey === "inventory_realloc"
      ? `Inventory re-allocation ${request.requestId} finished. Policy, path, and audit receipt recorded.`
      : `Vendor contract payout ${request.requestId} finished after ${WORKFLOW_REVIEWER_ROLE} sign-off.`,
    {
      action: "COMPLETED",
      sessionId: id,
      node: "completed",
      policyId: policy.policyId,
      holdId,
      holdStatus,
      auditTrail: [...trail],
      receipt,
      layer: "audit",
      graph: [
        "intake",
        "compliance_check",
        "financial_threshold",
        ...(overThreshold ? ["awaiting_approval"] : []),
        "final_execution",
        "completed",
      ],
    }
  );
}
