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
  type WorkflowAuditEntry,
  type WorkflowNodeId,
  type WorkflowRequest,
  type WorkflowScenarioKey,
} from "./types";

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function audit(
  trail: WorkflowAuditEntry[],
  node: WorkflowNodeId,
  detail: string
): WorkflowAuditEntry {
  const entry: WorkflowAuditEntry = {
    node,
    at: new Date().toISOString(),
    detail,
  };
  trail.push(entry);
  return entry;
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
    pattern: "langgraph-style-checkpoint",
  });
}

/**
 * In-process state machine that mirrors a LangGraph durable graph:
 * Intake -> Compliance Check -> Financial Threshold -> Final Execution
 * with optional pause/checkpoint when amount exceeds the threshold.
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
      runtime: "in-process",
      note: "TypeScript state machine simulating LangGraph checkpointing for hosted demos.",
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
      method: "graph.invoke",
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
    "Intake complete. Handing off to compliance check.",
    { node: "intake", status: "ok" }
  );

  await sleep(300);

  // --- Compliance Check ---
  yield nodeTransition(
    "intake",
    "compliance_check",
    "Compliance check started - confirming site policy and required fields.",
    trail
  );
  yield createLogEntry(
    "tool_call",
    "node:compliance_check",
    "Running compliance checklist for this request type...",
    {
      method: "graph.invoke",
      node: "compliance_check",
      checks: ["site_policy", "required_fields", "vendor_or_sku_present"],
    }
  );
  await sleep(500);

  if (scenarioKey === "inventory_realloc") {
    yield createLogEntry(
      "tool_result",
      "node:compliance_check",
      "Inventory move is within site transfer policy. No blocked items.",
      { node: "compliance_check", status: "ok", policy: "auto_transfer" }
    );
  } else {
    yield createLogEntry(
      "tool_result",
      "node:compliance_check",
      "Vendor contract packet looks complete. Compliance fields passed.",
      { node: "compliance_check", status: "ok", policy: "vendor_contract" }
    );
  }

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
      ? `Amount $${amount.toLocaleString()} is over $${FINANCIAL_THRESHOLD_USD.toLocaleString()} - checkpoint required.`
      : amount == null
        ? "No cash payout on this path - threshold check skipped."
        : `Amount $${amount.toLocaleString()} is under the $${FINANCIAL_THRESHOLD_USD.toLocaleString()} limit.`,
    {
      method: "graph.invoke",
      node: "financial_threshold",
      amount,
      threshold: FINANCIAL_THRESHOLD_USD,
      overThreshold,
    }
  );

  await sleep(450);

  if (overThreshold) {
    audit(
      trail,
      "awaiting_approval",
      `Paused for manager sign-off on $${amount!.toLocaleString()} payout.`
    );

    yield createLogEntry(
      "warning",
      "node:awaiting_approval",
      `Workflow paused. Manager sign-off needed before the $${amount!.toLocaleString()} payout can run.`,
      {
        action: "AWAITING_APPROVAL",
        sessionId: id,
        amount,
        threshold: FINANCIAL_THRESHOLD_USD,
        checkpoint: true,
        node: "awaiting_approval",
        auditTrail: trail,
      }
    );

    const decision = await waitForDecision(session);

    if (decision === "reject") {
      markSessionRejected(session);
      audit(
        trail,
        "rejected",
        "Manager rejected the payout. Workflow stopped."
      );
      yield createLogEntry(
        "error",
        "workflow:checkpoint",
        `Manager rejected ${request.requestId}. Payout did not run.`,
        {
          action: "REJECTED",
          sessionId: id,
          node: "rejected",
          auditTrail: trail,
        }
      );
      return;
    }

    yield createLogEntry(
      "success",
      "workflow:checkpoint",
      "Manager approved. Resuming from checkpoint toward final execution.",
      {
        action: "APPROVED",
        sessionId: id,
        node: "financial_threshold",
      }
    );
    await sleep(350);
  } else {
    yield createLogEntry(
      "tool_result",
      "node:financial_threshold",
      "Threshold clear - no manager pause on this path.",
      {
        node: "financial_threshold",
        status: "ok",
        amount,
        threshold: FINANCIAL_THRESHOLD_USD,
      }
    );
  }

  await sleep(300);

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
        method: "graph.invoke",
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
        method: "graph.invoke",
        node: "final_execution",
        operation: "contract_payout",
        amount,
        vendor: request.subject,
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
      }
    );
  }

  await sleep(300);

  audit(trail, "completed", "Workflow finished successfully.");
  markSessionComplete(session);

  yield createLogEntry(
    "success",
    "workflow:engine",
    scenarioKey === "inventory_realloc"
      ? `Inventory re-allocation ${request.requestId} finished. Handoffs stayed visible end to end.`
      : `Vendor contract payout ${request.requestId} finished after manager sign-off.`,
    {
      action: "COMPLETED",
      sessionId: id,
      node: "completed",
      auditTrail: trail,
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
