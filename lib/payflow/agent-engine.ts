import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InvoicePayload } from "./types";
import { LogEntry } from "@/components/ui/TerminalStream";
import { DEFAULT_MCP_URL, isMcpServerReachable } from "./mcp-client";
import {
  DEMO_MCP_TOOLS,
  getVendorApprovedProfile,
  toolCheckBankRouting,
  toolPostErpLedger,
  toolVerifyVendorEntity,
} from "./mcp-tools";
import {
  createBankMismatchHold,
  getHold,
  markHoldReleased,
  rejectHold,
  type PayFlowHold,
} from "./holds";

export type PayflowMcpMode = "auto" | "embedded" | "http";

export interface AgentExecutionOptions {
  mcpUrl?: string;
  /**
   * auto (default): prefer live FastMCP if reachable, else embedded demo tools.
   * embedded: always use in-project tools (best for hosted demos / Vercel).
   * http: require live FastMCP HTTP server (fails if unreachable).
   */
  mode?: PayflowMcpMode;
  /** @deprecated Use mode. Kept for older callers. */
  allowLocalFallback?: boolean;
}

function resolveMode(options: AgentExecutionOptions): PayflowMcpMode {
  if (options.mode) return options.mode;
  const fromEnv = (process.env.PAYFLOW_MCP_MODE ?? "").toLowerCase();
  if (fromEnv === "embedded" || fromEnv === "http" || fromEnv === "auto") {
    return fromEnv;
  }
  if (process.env.PAYFLOW_REQUIRE_LIVE_MCP === "1") return "http";
  // Demo default: try live FastMCP when present, otherwise in-project tools
  return "auto";
}

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
  // Deterministic CI / golden SSE tests skip demo pacing delays.
  if (process.env.PAYFLOW_TEST_FAST === "1") {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseToolData(result: {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}): Record<string, unknown> {
  if (
    result.structuredContent &&
    typeof result.structuredContent === "object" &&
    !Array.isArray(result.structuredContent)
  ) {
    return result.structuredContent as Record<string, unknown>;
  }
  const textBlock = result.content?.find((c) => c.type === "text" && c.text);
  if (textBlock?.text) {
    try {
      return JSON.parse(textBlock.text) as Record<string, unknown>;
    } catch {
      return { text: textBlock.text };
    }
  }
  return {};
}

type ToolRunner = (
  name: string,
  args: Record<string, unknown>
) => Promise<Record<string, unknown>>;

function createLocalToolRunner(): ToolRunner {
  return async (name, args) => {
    if (name === "verify_vendor_entity") {
      const res = toolVerifyVendorEntity("local", {
        vendorName: String(args.vendorName),
        taxId: String(args.taxId),
      });
      return res.result?.content[0]?.json ?? {};
    }
    if (name === "check_bank_routing") {
      const res = toolCheckBankRouting("local", {
        vendorId: String(args.vendorId),
        routingNumber: String(args.routingNumber),
        accountNumber: String(args.accountNumber),
      });
      if (res.error) throw new Error(res.error.message);
      return res.result?.content[0]?.json ?? {};
    }
    if (name === "post_erp_ledger") {
      const res = toolPostErpLedger("local", {
        invoiceId: String(args.invoiceId),
        vendorId: String(args.vendorId),
        amount: Number(args.amount),
        currency:
          typeof args.currency === "string" ? args.currency : undefined,
        vendorEvidenceToken:
          typeof args.vendorEvidenceToken === "string"
            ? args.vendorEvidenceToken
            : undefined,
        bankEvidenceToken:
          typeof args.bankEvidenceToken === "string"
            ? args.bankEvidenceToken
            : undefined,
        vendorName:
          typeof args.vendorName === "string" ? args.vendorName : undefined,
        taxId: typeof args.taxId === "string" ? args.taxId : undefined,
        routingNumber:
          typeof args.routingNumber === "string"
            ? args.routingNumber
            : undefined,
        accountNumber:
          typeof args.accountNumber === "string"
            ? args.accountNumber
            : undefined,
      });
      if (res.error) throw new Error(res.error.message);
      return res.result?.content[0]?.json ?? {};
    }
    throw new Error(`Unknown local tool: ${name}`);
  };
}

function createMcpToolRunner(client: Client): ToolRunner {
  return async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    const parsed = parseToolData(
      result as {
        content?: Array<{ type: string; text?: string }>;
        structuredContent?: unknown;
        isError?: boolean;
      }
    );
    if ((result as { isError?: boolean }).isError) {
      throw new Error(
        typeof parsed.message === "string"
          ? parsed.message
          : typeof parsed.text === "string"
            ? parsed.text
            : `MCP tool ${name} returned isError`
      );
    }
    return parsed;
  };
}

async function* runEmbeddedDemoRuntime(
  invoice: InvoicePayload,
  source: string
): AsyncGenerator<LogEntry, void, unknown> {
  yield createLogEntry(
    "info",
    "mcp:session",
    "Starting invoice checks with the hosted demo tools.",
    {
      runtime: "embedded",
      note: "Optional live FastMCP: npm run dev:mcp + PAYFLOW_MCP_MODE=http",
    }
  );

  await sleep(250);

  yield createLogEntry(
    "tool_call",
    "mcp:embedded_demo",
    "Listing available tools...",
    {
      method: "tools/list",
      tools: DEMO_MCP_TOOLS.map((t) => t.name),
      jsonrpc: "2.0",
      transport: "in-process",
    }
  );

  yield createLogEntry(
    "tool_result",
    "mcp:embedded_demo",
    `Ready: ${DEMO_MCP_TOOLS.map((t) => t.name).join(", ")}`,
    {
      tools: DEMO_MCP_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    }
  );

  await sleep(300);

  yield* runWorkflow(
    invoice,
    createLocalToolRunner(),
    "mcp:embedded_demo",
    source
  );
}

async function* runWorkflow(
  invoice: InvoicePayload,
  callTool: ToolRunner,
  transportLabel: string,
  source: string
): AsyncGenerator<LogEntry, void, unknown> {
  const verifyArgs = {
    vendorName: invoice.vendorName,
    taxId: invoice.vendorTaxId,
  };

  yield createLogEntry(
    "tool_call",
    transportLabel,
    `Checking vendor registry for "${invoice.vendorName}"...`,
    {
      method: "tools/call",
      tool: "verify_vendor_entity",
      arguments: verifyArgs,
      jsonrpc: "2.0",
    }
  );

  await sleep(500);

  const vendorResultContent = await callTool(
    "verify_vendor_entity",
    verifyArgs
  );

  if (vendorResultContent.status === "UNREGISTERED_ENTITY") {
    yield createLogEntry(
      "error",
      "mcp:registry_check",
      `No match for "${invoice.vendorName}" in the company vendor list.`,
      vendorResultContent
    );
    yield createLogEntry(
      "warning",
      source,
      "Payment stopped. Unknown or low-confidence vendor needs AP manager review before any payout."
    );
    return;
  }

  const confidencePct = Number(vendorResultContent.confidenceScore ?? 0) * 100;
  const nameSimilarity = Number(vendorResultContent.nameSimilarity ?? 0) * 100;
  const matchMethod =
    typeof vendorResultContent.matchMethod === "string"
      ? vendorResultContent.matchMethod
      : "REGISTRY";

  yield createLogEntry(
    "tool_result",
    "mcp:fuzzy_match",
    `Vendor matched: ${nameSimilarity.toFixed(1)}% name similarity (${matchMethod}). ID ${vendorResultContent.vendorId}, ${confidencePct.toFixed(1)}% confidence.`,
    vendorResultContent
  );

  await sleep(400);

  const bankArgs = {
    vendorId: String(vendorResultContent.vendorId),
    routingNumber: invoice.bankDetails.routingNumber,
    accountNumber: invoice.bankDetails.accountNumber,
  };

  yield createLogEntry(
    "tool_call",
    transportLabel,
    `Checking bank details for vendor ${bankArgs.vendorId}...`,
    {
      method: "tools/call",
      tool: "check_bank_routing",
      arguments: bankArgs,
      jsonrpc: "2.0",
    }
  );

  await sleep(500);

  const bankResultContent = await callTool("check_bank_routing", bankArgs);

  if (!bankResultContent.isMatch) {
    yield createLogEntry(
      "warning",
      "mcp:anti_fraud_rules",
      "Bank routing does not match the approved payment profile on file.",
      bankResultContent
    );

    await sleep(350);

    const profile = getVendorApprovedProfile(String(vendorResultContent.vendorId));
    const hold = createBankMismatchHold({
      invoice,
      vendorId: String(vendorResultContent.vendorId),
      officialName:
        typeof vendorResultContent.officialName === "string"
          ? vendorResultContent.officialName
          : profile?.officialName ?? "Unknown",
      expectedRouting:
        typeof bankResultContent.expectedRouting === "string"
          ? bankResultContent.expectedRouting
          : profile?.approvedRoutingNumber ?? "",
      expectedAccount:
        typeof bankResultContent.expectedAccount === "string"
          ? bankResultContent.expectedAccount
          : profile?.approvedAccountNumber ?? "",
    });

    yield createLogEntry(
      "error",
      source,
      `Payment of $${invoice.invoiceAmount.toLocaleString()} held. Routing change flagged for AP manager review.`,
      {
        action: "HOLD_OPENED",
        holdId: hold.id,
        reviewerRole: "AP manager",
        flaggedReason: "UNAUTHORIZED_BANK_ROUTING_CHANGE",
        riskScore: bankResultContent.riskScore,
        expectedRouting: hold.expectedRouting,
        expectedAccount: hold.expectedAccount,
        storageNote: hold.storageNote,
      }
    );
    return;
  }

  yield createLogEntry(
    "tool_result",
    "mcp:anti_fraud_rules",
    "Bank details match the approved payment profile.",
    bankResultContent
  );

  await sleep(400);

  const vendorEvidenceToken =
    typeof vendorResultContent.evidenceToken === "string"
      ? vendorResultContent.evidenceToken
      : "";
  const bankEvidenceToken =
    typeof bankResultContent.evidenceToken === "string"
      ? bankResultContent.evidenceToken
      : "";

  const ledgerArgs = {
    invoiceId: invoice.invoiceId,
    vendorId: String(vendorResultContent.vendorId),
    amount: invoice.invoiceAmount,
    currency: "USD",
    vendorEvidenceToken,
    bankEvidenceToken,
    vendorName: invoice.vendorName,
    taxId: invoice.vendorTaxId,
    routingNumber: invoice.bankDetails.routingNumber,
    accountNumber: invoice.bankDetails.accountNumber,
  };

  yield createLogEntry(
    "tool_call",
    transportLabel,
    `Posting invoice ${ledgerArgs.invoiceId} to the AP ledger (evidence-gated)...`,
    {
      method: "tools/call",
      tool: "post_erp_ledger",
      arguments: {
        invoiceId: ledgerArgs.invoiceId,
        vendorId: ledgerArgs.vendorId,
        amount: ledgerArgs.amount,
        hasVendorEvidence: Boolean(vendorEvidenceToken),
        hasBankEvidence: Boolean(bankEvidenceToken),
      },
      jsonrpc: "2.0",
    }
  );

  await sleep(500);

  let ledgerResult: Record<string, unknown>;
  try {
    ledgerResult = await callTool("post_erp_ledger", ledgerArgs);
  } catch (err) {
    yield createLogEntry(
      "error",
      "mcp:erp_ledger",
      err instanceof Error
        ? err.message
        : "Ledger post rejected by evidence gate.",
      { action: "POST_REJECTED" }
    );
    return;
  }

  if (ledgerResult.posted === false || ledgerResult.error) {
    yield createLogEntry(
      "error",
      "mcp:erp_ledger",
      typeof ledgerResult.message === "string"
        ? ledgerResult.message
        : "Ledger post rejected by evidence gate.",
      ledgerResult
    );
    return;
  }

  yield createLogEntry(
    "tool_result",
    "mcp:erp_ledger",
    `Posted ledger entry ${ledgerResult.ledgerEntryId} for invoice #${invoice.invoiceId}`,
    ledgerResult
  );

  await sleep(250);

  yield createLogEntry(
    "success",
    source,
    `Invoice #${invoice.invoiceId} cleared checks and was posted to the AP ledger.`,
    {
      action: "POST_TO_ERP_LEDGER",
      status: ledgerResult.status,
      payoutAmount: invoice.invoiceAmount,
      transport: transportLabel,
    }
  );
}

/**
 * PayFlow workflow: list tools, then verify vendor -> bank check -> ledger post.
 *
 * Modes (PAYFLOW_MCP_MODE):
 * - auto (default): live FastMCP if reachable, else in-project embedded tools
 * - embedded: always in-project tools (best for Vercel / public demos)
 * - http: require live FastMCP at MCP_SERVER_URL
 */
export async function* runPayFlowAgentEngine(
  invoice: InvoicePayload,
  options: AgentExecutionOptions = {}
): AsyncGenerator<LogEntry, void, unknown> {
  const mcpUrl = options.mcpUrl ?? DEFAULT_MCP_URL;
  const mode = resolveMode(options);
  const source = "agent:payflow";

  yield createLogEntry(
    "info",
    source,
    `Received invoice #${invoice.invoiceId} from ${invoice.vendorName}`,
    {
      invoiceAmount: `$${invoice.invoiceAmount.toLocaleString()}`,
      vendorTaxId: invoice.vendorTaxId,
      submittedBank: invoice.bankDetails.bankName,
      scenario: invoice.metadata?.isTestScenario ?? "custom",
      mcpMode: mode,
    }
  );

  await sleep(400);

  if (mode === "embedded") {
    yield* runEmbeddedDemoRuntime(invoice, source);
    return;
  }

  const reachable = await isMcpServerReachable(mcpUrl);

  if (!reachable) {
    if (mode === "http") {
      yield createLogEntry(
        "error",
        "mcp:session",
        `FastMCP server unreachable at ${mcpUrl}. Start it with: npm run dev:mcp`,
        { mcpUrl, mode }
      );
      return;
    }

    yield* runEmbeddedDemoRuntime(invoice, source);
    return;
  }

  const client = new Client({
    name: "payflow-nextjs-agent",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

  try {
    await client.connect(transport);

    yield createLogEntry(
      "info",
      "mcp:session",
      `Connected to FastMCP server at ${mcpUrl}`,
      { transport: "streamable-http", mode }
    );

    await sleep(250);

    const listed = await client.listTools();

    yield createLogEntry(
      "tool_call",
      "mcp:fastmcp_server",
      "Listing available tools...",
      {
        method: "tools/list",
        tools: listed.tools.map((t) => t.name),
        jsonrpc: "2.0",
      }
    );

    yield createLogEntry(
      "tool_result",
      "mcp:fastmcp_server",
      `Ready: ${listed.tools.map((t) => t.name).join(", ")}`,
      {
        tools: listed.tools.map((t) => ({
          name: t.name,
          description: t.description,
        })),
      }
    );

    await sleep(300);

    yield* runWorkflow(
      invoice,
      createMcpToolRunner(client),
      "mcp:fastmcp_http",
      source
    );
  } catch (err) {
    if (mode === "auto") {
      yield createLogEntry(
        "warning",
        "mcp:session",
        "Live tool server unavailable. Switching to the hosted demo tools.",
        {
          mcpUrl,
          error: err instanceof Error ? err.message : "unknown",
        }
      );
      yield* runEmbeddedDemoRuntime(invoice, source);
      return;
    }

    yield createLogEntry(
      "error",
      "mcp:session",
      err instanceof Error
        ? `MCP session failed: ${err.message}`
        : "MCP session failed with an unknown error.",
      { mcpUrl, mode }
    );
  } finally {
    try {
      await client.close();
    } catch {
      // ignore teardown errors
    }
  }
}

export type HoldRejectResult =
  | { ok: true; hold: PayFlowHold; logs: LogEntry[] }
  | { ok: false; error: string };

export function rejectPayFlowHold(
  holdId: string,
  reason: string
): HoldRejectResult {
  const result = rejectHold(holdId, reason);
  if (!result.ok) return result;

  const logs: LogEntry[] = [
    createLogEntry(
      "warning",
      "hold:ap_manager",
      `AP manager rejected hold ${holdId}. Payment will not post.`,
      {
        action: "HOLD_REJECTED",
        holdId,
        reviewerRole: "AP manager",
        reason: result.hold.resolutionReason,
        resolvedAt: result.hold.updatedAt,
        audit: result.hold.audit,
      }
    ),
  ];
  return { ok: true, hold: result.hold, logs };
}

export type HoldReleaseInput = {
  holdId: string;
  reason: string;
  /** Must match the approved profile routing for the held vendor. */
  correctedRouting: string;
  correctedAccount?: string;
};

/**
 * AP manager supplies corrected approved routing, both checks re-run,
 * fresh evidence is issued, then the ledger posts. Casual approve is not allowed.
 */
export async function* releasePayFlowHold(
  input: HoldReleaseInput,
  options: AgentExecutionOptions = {}
): AsyncGenerator<LogEntry, PayFlowHold | null, unknown> {
  const hold = getHold(input.holdId);
  if (!hold) {
    yield createLogEntry(
      "error",
      "hold:ap_manager",
      "Hold not found in demo/session storage.",
      { holdId: input.holdId }
    );
    return null;
  }
  if (hold.status !== "open") {
    yield createLogEntry(
      "error",
      "hold:ap_manager",
      `Hold is already ${hold.status}.`,
      { holdId: hold.id, status: hold.status }
    );
    return null;
  }

  const reason = input.reason.trim();
  if (!reason) {
    yield createLogEntry(
      "error",
      "hold:ap_manager",
      "A release reason is required.",
      { holdId: hold.id }
    );
    return null;
  }

  const profile = getVendorApprovedProfile(hold.vendorId);
  if (!profile) {
    yield createLogEntry(
      "error",
      "hold:ap_manager",
      "Vendor profile not found for this hold.",
      { vendorId: hold.vendorId }
    );
    return null;
  }

  const correctedRouting = input.correctedRouting.trim();
  const correctedAccount = (
    input.correctedAccount?.trim() || profile.approvedAccountNumber
  ).trim();

  if (correctedRouting !== profile.approvedRoutingNumber) {
    yield createLogEntry(
      "error",
      "hold:ap_manager",
      "Corrected routing must match the approved vendor payment profile. Casual approval cannot bypass the bank control.",
      {
        holdId: hold.id,
        submittedCorrection: correctedRouting,
        approvedRouting: profile.approvedRoutingNumber,
      }
    );
    return null;
  }

  if (correctedAccount !== profile.approvedAccountNumber) {
    yield createLogEntry(
      "error",
      "hold:ap_manager",
      "Corrected account must match the approved vendor payment profile.",
      {
        holdId: hold.id,
        approvedAccount: profile.approvedAccountNumber,
      }
    );
    return null;
  }

  yield createLogEntry(
    "info",
    "hold:ap_manager",
    "AP manager supplied corrected approved routing. Re-running vendor and bank checks before any ledger post.",
    {
      holdId: hold.id,
      correctedRouting,
      reviewerRole: "AP manager",
      reason,
    }
  );

  const correctedInvoice: InvoicePayload = {
    ...hold.invoice,
    bankDetails: {
      ...hold.invoice.bankDetails,
      routingNumber: correctedRouting,
      accountNumber: correctedAccount,
      bankName: hold.invoice.bankDetails.bankName,
    },
  };

  // Always use embedded tools for hold resolution so evidence lives in the
  // same process as the hold store (demo/session storage on Vercel).
  const callTool = createLocalToolRunner();
  const transportLabel = "mcp:embedded_demo";
  const source = "agent:payflow";

  void options;

  const verifyArgs = {
    vendorName: correctedInvoice.vendorName,
    taxId: correctedInvoice.vendorTaxId,
  };

  yield createLogEntry(
    "tool_call",
    transportLabel,
    `Re-checking vendor registry for "${correctedInvoice.vendorName}"...`,
    { tool: "verify_vendor_entity", arguments: verifyArgs }
  );

  await sleep(300);
  const vendorResult = await callTool("verify_vendor_entity", verifyArgs);

  if (vendorResult.status === "UNREGISTERED_ENTITY") {
    yield createLogEntry(
      "error",
      "mcp:registry_check",
      "Vendor re-check failed. Hold remains open.",
      vendorResult
    );
    return null;
  }

  yield createLogEntry(
    "tool_result",
    "mcp:fuzzy_match",
    `Vendor re-check passed for ${vendorResult.vendorId}.`,
    vendorResult
  );

  const bankArgs = {
    vendorId: String(vendorResult.vendorId),
    routingNumber: correctedRouting,
    accountNumber: correctedAccount,
  };

  yield createLogEntry(
    "tool_call",
    transportLabel,
    "Re-checking bank routing against approved profile...",
    { tool: "check_bank_routing", arguments: bankArgs }
  );

  await sleep(300);
  const bankResult = await callTool("check_bank_routing", bankArgs);

  if (!bankResult.isMatch) {
    yield createLogEntry(
      "error",
      "mcp:anti_fraud_rules",
      "Bank re-check failed. Hold remains open - control was not bypassed.",
      bankResult
    );
    return null;
  }

  yield createLogEntry(
    "tool_result",
    "mcp:anti_fraud_rules",
    "Bank re-check passed with corrected approved routing.",
    bankResult
  );

  const ledgerArgs = {
    invoiceId: correctedInvoice.invoiceId,
    vendorId: String(vendorResult.vendorId),
    amount: correctedInvoice.invoiceAmount,
    currency: "USD",
    vendorEvidenceToken: String(vendorResult.evidenceToken ?? ""),
    bankEvidenceToken: String(bankResult.evidenceToken ?? ""),
    vendorName: correctedInvoice.vendorName,
    taxId: correctedInvoice.vendorTaxId,
    routingNumber: correctedRouting,
    accountNumber: correctedAccount,
  };

  yield createLogEntry(
    "tool_call",
    transportLabel,
    "Posting with fresh verification evidence...",
    {
      tool: "post_erp_ledger",
      invoiceId: ledgerArgs.invoiceId,
      hasVendorEvidence: Boolean(ledgerArgs.vendorEvidenceToken),
      hasBankEvidence: Boolean(ledgerArgs.bankEvidenceToken),
    }
  );

  await sleep(300);

  let ledgerResult: Record<string, unknown>;
  try {
    ledgerResult = await callTool("post_erp_ledger", ledgerArgs);
  } catch (err) {
    yield createLogEntry(
      "error",
      "mcp:erp_ledger",
      err instanceof Error
        ? err.message
        : "Ledger post rejected after hold release attempt.",
      { action: "POST_REJECTED" }
    );
    return null;
  }

  if (ledgerResult.posted !== true) {
    yield createLogEntry(
      "error",
      "mcp:erp_ledger",
      typeof ledgerResult.message === "string"
        ? ledgerResult.message
        : "Ledger post rejected after hold release attempt.",
      ledgerResult
    );
    return null;
  }

  const released = markHoldReleased(hold.id, {
    reason,
    correctedRouting,
    correctedAccount,
    ledgerEntryId: String(ledgerResult.ledgerEntryId),
  });

  if (!released.ok) {
    yield createLogEntry("error", "hold:ap_manager", released.error, {
      holdId: hold.id,
    });
    return null;
  }

  yield createLogEntry(
    "tool_result",
    "mcp:erp_ledger",
    `Posted ledger entry ${ledgerResult.ledgerEntryId} for invoice #${correctedInvoice.invoiceId}`,
    ledgerResult
  );

  yield createLogEntry(
    "success",
    source,
    `Hold ${hold.id} released by AP manager after corrected routing re-check. Invoice posted.`,
    {
      action: "HOLD_RELEASED",
      holdId: hold.id,
      reviewerRole: "AP manager",
      reason,
      resolvedAt: released.hold.updatedAt,
      ledgerEntryId: ledgerResult.ledgerEntryId,
      audit: released.hold.audit,
    }
  );

  return released.hold;
}
