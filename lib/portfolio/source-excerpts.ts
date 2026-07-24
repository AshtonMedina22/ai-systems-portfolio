import type { SourceFile } from "@/components/ui/CodeViewer";

/** Excerpts shown in How it works for PayFlow. */
export const PAYFLOW_SOURCE_FILES: SourceFile[] = [
  {
    name: "erp_registry.py",
    language: "python",
    kind: "runtime",
    code: `# mcp-server/erp_registry.py - vendor match + bank routing checks
from difflib import SequenceMatcher

FUZZY_NAME_THRESHOLD = 0.82

def fuzzy_name_score(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()

def verify_vendor_entity(vendor_name: str, tax_id: str) -> dict:
    """Exact tax-ID match or fuzzy official-name match."""
    tax_match = next((v for v in ERP_VENDOR_REGISTRY if v.tax_id == tax_id), None)
    if tax_match:
        name_score = fuzzy_name_score(vendor_name, tax_match.official_name)
        return {
            "status": "MATCH_FOUND",
            "vendorId": tax_match.vendor_id,
            "officialName": tax_match.official_name,
            "nameSimilarity": round(name_score, 3),
            "matchMethod": "TAX_ID_EXACT",
        }

    scored = [
        (v, fuzzy_name_score(vendor_name, v.official_name))
        for v in ERP_VENDOR_REGISTRY
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    best, score = scored[0]

    if score >= FUZZY_NAME_THRESHOLD:
        return {
            "status": "MATCH_FOUND",
            "vendorId": best.vendor_id,
            "nameSimilarity": round(score, 3),
            "matchMethod": "FUZZY_NAME",
        }

    return {
        "status": "UNREGISTERED_ENTITY",
        "recommendation": "REJECT_PAYMENT_AND_FLAG",
        "closestCandidate": best.official_name,
    }

def check_bank_routing(vendor_id: str, routing_number: str, account_number: str) -> dict:
    record = next(v for v in ERP_VENDOR_REGISTRY if v.vendor_id == vendor_id)
    if record.approved_routing_number != routing_number:
        return {
            "isMatch": False,
            "riskLevel": "CRITICAL_FRAUD_ALERT",
            "expectedRouting": record.approved_routing_number,
            "message": "Routing does not match the approved payment profile.",
        }
    return {"isMatch": True, "riskLevel": "LOW", "riskScore": 0.02}
`,
  },
  {
    name: "payflow_server.py",
    language: "python",
    kind: "runtime",
    code: `# mcp-server/payflow_server.py - FastMCP tool surface
from fastmcp import FastMCP
from erp_registry import (
    check_bank_routing,
    post_erp_ledger,
    verify_vendor_entity,
)

mcp = FastMCP(
    name="payflow-ap-agent",
    instructions="Use tools/list, then verify_vendor_entity, check_bank_routing, post_erp_ledger.",
)

@mcp.tool(name="verify_vendor_entity")
def tool_verify_vendor_entity(vendorName: str, taxId: str) -> dict:
    return verify_vendor_entity(vendorName, taxId)

@mcp.tool(name="check_bank_routing")
def tool_check_bank_routing(
    vendorId: str, routingNumber: str, accountNumber: str
) -> dict:
    return check_bank_routing(vendorId, routingNumber, accountNumber)

@mcp.tool(name="post_erp_ledger")
def tool_post_erp_ledger(
    invoiceId: str, vendorId: str, amount: float, currency: str = "USD"
) -> dict:
    return post_erp_ledger(invoiceId, vendorId, amount, currency)

if __name__ == "__main__":
    mcp.run(transport="http", host="127.0.0.1", port=8000)
`,
  },
  {
    name: "api/payflow/route.ts",
    language: "typescript",
    kind: "runtime",
    code: `// app/api/payflow/route.ts - SSE stream into the Live console
import { NextRequest } from "next/server";
import { runPayFlowAgentEngine } from "@/lib/payflow/agent-engine";

export async function POST(req: NextRequest) {
  const { invoice } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for await (const logEntry of runPayFlowAgentEngine(invoice)) {
        controller.enqueue(
          encoder.encode(\`data: \${JSON.stringify(logEntry)}\\n\\n\`)
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
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
export async function* runWorkflowEngine(scenarioKey, sessionId?) {
  const request = SAMPLE_WORKFLOWS[scenarioKey];
  const session = createSession(sessionId ?? \`wf-\${Date.now()}\`);

  // Intake -> Compliance Check -> Financial Threshold -> Final Execution
  yield createLogEntry("info", "workflow:session",
    \`Started workflow \${request.requestId}\`,
    {
      demoMode: "mockup",
      runtime: "in-process",
      note: "TypeScript state machine",
    });

  const overThreshold =
    typeof request.amount === "number" &&
    request.amount > FINANCIAL_THRESHOLD_USD;

  if (overThreshold) {
    yield createLogEntry("warning", "node:awaiting_approval",
      "Workflow paused. Manager sign-off needed.",
      { action: "AWAITING_APPROVAL", sessionId: session.id });

    const decision = await waitForDecision(session);
    if (decision === "reject") return;
  }

  // Final execution, then COMPLETED
}
`,
  },
  {
    name: "sessions.ts",
    language: "typescript",
    kind: "runtime",
    code: `// lib/workflow/sessions.ts - Approve / Reject checkpoint (mockup)
export function waitForDecision(session: WorkflowSession) {
  session.status = "paused";
  return new Promise((resolve) => {
    session.resume = (decision) => {
      session.decision = decision;
      session.status = decision === "approve" ? "running" : "rejected";
      session.resume = undefined;
      resolve(decision);
    };
  });
}

export function submitDecision(sessionId: string, decision: WorkflowDecision) {
  const session = getSession(sessionId);
  if (!session || session.status !== "paused" || !session.resume) {
    return { ok: false, error: "Not waiting for manager sign-off." };
  }
  session.resume(decision);
  return { ok: true };
}
`,
  },
  {
    name: "config.ts",
    language: "typescript",
    kind: "config",
    code: `// lib/workflow/config.ts
// Prod shape - unused while DEMO_MODE === "mockup"
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
