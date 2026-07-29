import type { SourceFile } from "@/components/ui/CodeViewer";

/** Excerpts shown in How it works for PayFlow. */
export const PAYFLOW_SOURCE_FILES: SourceFile[] = [
  {
    name: "erp_registry.py",
    language: "python",
    kind: "runtime",
    code: `# mcp-server/erp_registry.py - evidence-gated ledger posting
EVIDENCE_TTL_SECONDS = 300

def verify_vendor_entity(vendor_name, tax_id):
    # On MATCH_FOUND, issues single-use vendor evidence bound to name/tax/vendorId
    ...

def check_bank_routing(vendor_id, routing_number, account_number):
    # On match, issues single-use bank evidence bound to vendor/routing/account
    # On mismatch, no evidence token is issued
    ...

def post_erp_ledger(invoice_id, vendor_id, amount, currency="USD", *,
                    vendor_evidence_token=None, bank_evidence_token=None,
                    vendor_name=None, tax_id=None,
                    routing_number=None, account_number=None):
    # Rejects absent, stale, replayed, mismatched, or failed-check evidence.
    # Consumes both tokens before appending the ledger row.
    ...
`,
  },
  {
    name: "payflow_server.py",
    language: "python",
    kind: "runtime",
    code: `# mcp-server/payflow_server.py - FastMCP tool surface
@mcp.tool(name="post_erp_ledger")
def tool_post_erp_ledger(
    invoiceId: str, vendorId: str, amount: float, currency: str = "USD",
    vendorEvidenceToken: str = "", bankEvidenceToken: str = "",
    vendorName: str = "", taxId: str = "",
    routingNumber: str = "", accountNumber: str = "",
) -> dict:
    result = post_erp_ledger(
        invoiceId, vendorId, amount, currency,
        vendor_evidence_token=vendorEvidenceToken or None,
        bank_evidence_token=bankEvidenceToken or None,
        vendor_name=vendorName or None, tax_id=taxId or None,
        routing_number=routingNumber or None,
        account_number=accountNumber or None,
    )
    if result.get("error"):
        raise ValueError(result["message"])
    return result
`,
  },
  {
    name: "api/payflow/route.ts",
    language: "typescript",
    kind: "runtime",
    code: `// app/api/payflow/route.ts - run checks, or AP manager hold actions
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action ?? "run";

  if (action === "reject_hold") {
    return Response.json(rejectPayFlowHold(body.holdId, body.reason));
  }
  if (action === "release_hold") {
    // Requires corrected approved routing; re-runs both checks; posts with fresh evidence
    return sseResponse(releasePayFlowHold({
      holdId: body.holdId,
      reason: body.reason,
      correctedRouting: body.correctedRouting,
      correctedAccount: body.correctedAccount,
    }));
  }
  return sseResponse(runPayFlowAgentEngine(body.invoice));
}
`,
  },
];

/** Migrate: mockup runtime first, then prod config sample. */
export const MIGRATE_SOURCE_FILES: SourceFile[] = [
  {
    name: "engine.ts",
    language: "typescript",
    kind: "runtime",
    code: `// lib/migrate/engine.ts
export async function* runMigrationEngine(input = { datasetKey: "clean" }) {
  const profile = resolveProfile(input);
  const tenantSchema = DEMO_TENANT_SCHEMA;

  yield createLogEntry("info", "pipeline:migrate",
    \`Starting onboarding for \${profile.clientName}\`,
    {
      demoMode: "mockup",
      stack: ["TypeScript", "Next.js", "SSE"],
      rowCount: profile.rowCount,
    });

  const { mapping, unmapped } = mapColumns(profile.sourceColumns);
  // validate primary keys, sanitize zip/state/tax_id, then...

  yield createLogEntry("tool_call", "tenant:schema",
    \`Preparing isolated tenant space \${tenantSchema} (simulated)...\`,
    { method: "simulate_tenant_schema", tenantSchema });

  // Cutover complete or CUTOVER_BLOCKED based on remaining issues
}
`,
  },
  {
    name: "adapter.ts",
    language: "typescript",
    kind: "runtime",
    code: `// lib/migrate/adapter.ts - site calls getMigrationEngine().run(...)
import { DEMO_MODE } from "./runtime";
import { runMigrationEngine } from "./engine";
import { runLiveMigrationStub } from "./live-stub";

export function getMigrationEngine() {
  // DEMO_MODE is "mockup" on the public site
  return DEMO_MODE === "live"
    ? { mode: "live", run: runLiveMigrationStub }
    : { mode: "mockup", run: runMigrationEngine };
}
`,
  },
  {
    name: "config.ts",
    language: "typescript",
    kind: "config",
    code: `// lib/migrate/config.ts
// Prod shape - unused while DEMO_MODE === "mockup"
export const migrateProductionConfig = {
  databaseUrlEnv: "MIGRATE_DATABASE_URL",
  exampleDatabaseUrl: "postgres://migrate_user:SECRET@db.example:5432/saas_ops",
  tenantIsolation: "schema-per-tenant",
  defaultTenantSchema: "tenant_id_992",
  etlEntrypoint: "mcp-server/migrate_pipeline.py",
  batchSize: 500,
  targetTable: "locations",
} as const;
`,
  },
];

/** Workflow: mockup runtime first, then prod config sample. */
export const WORKFLOW_SOURCE_FILES: SourceFile[] = [
  {
    name: "state-machine.ts",
    language: "typescript",
    kind: "runtime",
    code: `// lib/workflow/state-machine.ts
// Public runtime: TypeScript state machine with in-memory checkpoint.

// --- Intake ---
yield nodeTransition(
  "intake",
  "intake",
  \`Intake recorded for \${request.subject} at \${request.site}.\`,
  trail
);

// --- Compliance Check ---
yield nodeTransition(
  "intake",
  "compliance_check",
  "Compliance check started - confirming site policy and required fields.",
  trail
);

// --- Financial Threshold ---
yield nodeTransition(
  "compliance_check",
  "financial_threshold",
  \`Checking financial threshold (pause if amount > $\${FINANCIAL_THRESHOLD_USD.toLocaleString()}).\`,
  trail
);

const amount = request.amount;
const overThreshold =
  typeof amount === "number" && amount > FINANCIAL_THRESHOLD_USD;

if (overThreshold) {
  yield createLogEntry(
    "warning",
    "node:awaiting_approval",
    \`Workflow paused. \${WORKFLOW_REVIEWER_ROLE} sign-off needed before the $\${amount!.toLocaleString()} payout can run.\`,
    {
      action: "AWAITING_APPROVAL",
      sessionId: id,
      amount,
      threshold: FINANCIAL_THRESHOLD_USD,
      overThreshold: true,
      checkpoint: true,
      node: "awaiting_approval",
      reviewerRole: WORKFLOW_REVIEWER_ROLE,
      auditTrail: [...trail],
    }
  );

  const decisionResult = await waitForDecision(session);
  if (decisionResult.decision === "reject") {
    markSessionRejected(session);
    const rejectDetail = decisionResult.reason
      ? \`\${WORKFLOW_REVIEWER_ROLE} rejected the payout. Reason: \${decisionResult.reason}\`
      : \`\${WORKFLOW_REVIEWER_ROLE} rejected the payout. Workflow stopped.\`;
    audit(trail, "rejected", rejectDetail, {
      actor: decisionResult.actor,
      decision: "reject",
      reason: decisionResult.reason,
    });
    yield createLogEntry(
      "error",
      "workflow:checkpoint",
      \`\${WORKFLOW_REVIEWER_ROLE} rejected \${request.requestId}. Downstream steps did not run.\`,
      {
        action: "REJECTED",
        sessionId: id,
        node: "rejected",
        actor: decisionResult.actor,
        decidedAt: decisionResult.at,
        reason: decisionResult.reason,
        auditTrail: [...trail],
      }
    );
    return;
  }

  audit(
    trail,
    "financial_threshold",
    \`\${WORKFLOW_REVIEWER_ROLE} approved. Resuming toward final execution.\`,
    {
      actor: decisionResult.actor,
      decision: "approve",
    }
  );

  yield createLogEntry(
    "success",
    "workflow:checkpoint",
    \`\${WORKFLOW_REVIEWER_ROLE} approved. Resuming from checkpoint toward final execution.\`,
    {
      action: "APPROVED",
      sessionId: id,
      node: "financial_threshold",
      actor: decisionResult.actor,
      decidedAt: decisionResult.at,
      auditTrail: [...trail],
    }
  );
}

// --- Final Execution ---
yield nodeTransition(
  overThreshold ? "awaiting_approval" : "financial_threshold",
  "final_execution",
  "Final execution node started.",
  trail
);
`,
  },
  {
    name: "sessions.ts",
    language: "typescript",
    kind: "runtime",
    code: `// lib/workflow/sessions.ts - Approve / Reject checkpoint (mockup)
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
  if (!session || session.status !== "paused" || !session.resume) {
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
`,
  },
  {
    name: "config.ts",
    language: "typescript",
    kind: "config",
    code: `// lib/workflow/config.ts
// Reference config - unused while DEMO_MODE === "mockup"
export const workflowProductionConfig = {
  graphEntrypoint: "mcp-server/workflow_graph.py",
  checkpointBackend: "postgres",
  checkpointUrlEnv: "WORKFLOW_CHECKPOINT_URL",
  interruptThresholdUsd: 10_000,
  approvalTimeoutMs: 15 * 60 * 1000,
} as const;
`,
  },
];
