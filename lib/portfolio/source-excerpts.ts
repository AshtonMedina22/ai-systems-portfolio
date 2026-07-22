import type { SourceFile } from "@/components/ui/CodeViewer";

/** Curated excerpts from the real PayFlow FastMCP / registry / SSE route. */
export const PAYFLOW_SOURCE_FILES: SourceFile[] = [
  {
    name: "erp_registry.py",
    language: "python",
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

/** Migration pipeline excerpts - TypeScript engine + SQL isolation pattern. */
export const MIGRATE_SOURCE_FILES: SourceFile[] = [
  {
    name: "etl_pipeline.py",
    language: "python",
    code: `# etl_pipeline.py - multi-tenant SaaS onboarding (Python / Pandas / PostgreSQL)
import pandas as pd
from sqlalchemy import text

def execute_tenant_migration(tenant_id: str, raw_csv_path: str, engine):
    schema_name = f"tenant_id_{tenant_id}"

    # Enforce isolated database schema per client
    with engine.begin() as conn:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name};"))
        conn.execute(text(f"GRANT USAGE ON SCHEMA {schema_name} TO app_tenant;"))

    # Ingest and sanitize legacy spreadsheets
    df = pd.read_csv(raw_csv_path)
    clean_df = (
        df.dropna(subset=["location_id"])
        .assign(
            zip=lambda d: d["zip"]
            .astype(str)
            .str.replace(r"\\D", "", regex=True)
            .str[:5]
        )
        .fillna({"zip": "00000", "status": "PENDING"})
    )

    # Bulk write into the client-isolated schema
    clean_df.to_sql(
        "locations",
        con=engine,
        schema=schema_name,
        if_exists="append",
        index=False,
    )
    return {
        "status": "SUCCESS",
        "rows_written": len(clean_df),
        "schema": schema_name,
        "auto_sanitized_warnings": int((df["zip"].isna()).sum()),
    }
`,
  },
  {
    name: "migrate/engine.ts",
    language: "typescript",
    code: `// lib/migrate/engine.ts - sanitize fields, then provision tenant schema
yield createLogEntry(
  "tool_call",
  "sanitize:fields",
  "Running type checks and filling or flagging missing required fields...",
  { method: "sanitize", checks: ["zip", "state", "tax_id", "contact_email"] }
);

if (zipNormalized > 0) {
  yield createLogEntry(
    "warning",
    "sanitize:zip",
    \`ZIP warning: auto-normalized \${zipNormalized} sample patterns\`,
    { status: "ZIP_NORMALIZED", autoSanitized: 2, rowCount: volume }
  );
}

yield createLogEntry(
  "tool_call",
  "tenant:postgres",
  \`Provisioning isolated PostgreSQL schema \${tenantSchema}...\`,
  {
    method: "CREATE SCHEMA",
    tenantSchema,
    rls: "least-privilege role scoped to tenant schema",
  }
);

if (blockingMissing >= 2 && profile.key === "corrupted") {
  yield createLogEntry(
    "error",
    "cutover",
    "Cutover held - fix flagged rows before writing to production tenant space.",
    {
      action: "CUTOVER_BLOCKED",
      rowCount: volume,
      autoSanitized: 2,
      validRecords: volume - 2,
    }
  );
  return;
}

yield createLogEntry(
  "success",
  "cutover",
  \`Cutover complete for \${profile.clientName} into \${tenantSchema}.\`,
  {
    action: "CUTOVER_COMPLETE",
    tenantSchema,
    rowCount: volume,
    validRecords: volume,
  }
);
`,
  },
  {
    name: "tenant_rls.sql",
    language: "sql",
    code: `-- Multi-tenant isolation pattern used in the cutover step
CREATE SCHEMA IF NOT EXISTS tenant_id_992;

CREATE TABLE tenant_id_992.locations (
  location_id   text PRIMARY KEY,
  location_name text NOT NULL,
  address       text,
  city          text,
  state         char(2),
  zip           char(5),
  tax_id        text,
  contact_email text
);

GRANT USAGE ON SCHEMA tenant_id_992 TO app_tenant_992;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tenant_id_992 TO app_tenant_992;
`,
  },
];

/** Workflow state machine + manager checkpoint excerpts. */
export const WORKFLOW_SOURCE_FILES: SourceFile[] = [
  {
    name: "state_machine.py",
    language: "python",
    code: `# state_machine.py - LangGraph-style durable workflow with manager checkpoint
from typing import TypedDict
from langgraph.types import Command, interrupt
from langgraph.graph import StateGraph, START, END

class WorkflowState(TypedDict):
    request_amount: float
    vendor_id: str
    status: str

def evaluate_financial_threshold(state: WorkflowState) -> Command:
    """Freeze at Budget Approval when payout clears the $10k limit."""
    if state["request_amount"] > 10_000.00:
        # Persist graph state until a manager Approves or Flags for audit
        decision = interrupt({
            "reason": "Financial threshold exceeded. Manager authorization required.",
            "current_node": "evaluate_financial_threshold",
            "amount": state["request_amount"],
            "limit": 10_000.00,
        })
        if decision == "reject":
            return Command(goto=END, update={"status": "REJECTED"})
        return Command(goto="execute_automated_payout", update={"status": "APPROVED"})

    return Command(goto="execute_automated_payout")

def build_workflow():
    graph = StateGraph(WorkflowState)
    graph.add_node("intake", lambda s: s)
    graph.add_node("compliance_check", lambda s: s)
    graph.add_node("evaluate_financial_threshold", evaluate_financial_threshold)
    graph.add_node("execute_automated_payout", lambda s: {**s, "status": "DONE"})

    graph.add_edge(START, "intake")
    graph.add_edge("intake", "compliance_check")
    graph.add_edge("compliance_check", "evaluate_financial_threshold")
    graph.add_edge("execute_automated_payout", END)
    return graph.compile(checkpointer=True)
`,
  },
  {
    name: "state-machine.ts",
    language: "typescript",
    code: `// lib/workflow/state-machine.ts - demo checkpoint used by the Live Visual Console
const overThreshold =
  typeof amount === "number" && amount > FINANCIAL_THRESHOLD_USD;

if (overThreshold) {
  yield createLogEntry(
    "warning",
    "node:awaiting_approval",
    \`Workflow paused. Manager sign-off needed before the $\${amount.toLocaleString()} payout can run.\`,
    {
      action: "AWAITING_APPROVAL",
      sessionId: id,
      amount,
      threshold: FINANCIAL_THRESHOLD_USD,
      checkpoint: true,
      node: "awaiting_approval",
    }
  );

  const decision = await waitForDecision(session);

  if (decision === "reject") {
    markSessionRejected(session);
    yield createLogEntry(
      "error",
      "workflow:checkpoint",
      \`Manager rejected \${request.requestId}. Payout did not run.\`,
      { action: "REJECTED", sessionId: id, node: "rejected" }
    );
    return;
  }

  yield createLogEntry(
    "success",
    "workflow:checkpoint",
    "Manager approved. Resuming from checkpoint toward final execution.",
    { action: "APPROVED", sessionId: id, node: "financial_threshold" }
  );
}
`,
  },
  {
    name: "sessions.ts",
    language: "typescript",
    code: `// lib/workflow/sessions.ts - in-memory checkpoint for Approve / Flag for audit
type Decision = "approve" | "reject";

const sessions = new Map<string, {
  resolve: (decision: Decision) => void;
  status: "open" | "done" | "rejected";
}>();

export function createSession(id: string) {
  let resolve!: (decision: Decision) => void;
  const ready = new Promise<Decision>((r) => {
    resolve = r;
  });
  sessions.set(id, { resolve, status: "open" });
  return { id, ready };
}

export function waitForDecision(session: { id: string; ready: Promise<Decision> }) {
  return session.ready;
}

export function submitDecision(sessionId: string, decision: Decision) {
  const entry = sessions.get(sessionId);
  if (!entry || entry.status !== "open") return false;
  entry.status = decision === "approve" ? "done" : "rejected";
  entry.resolve(decision);
  return true;
}
`,
  },
];
