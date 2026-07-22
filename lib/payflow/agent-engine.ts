import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InvoicePayload } from "./types";
import { LogEntry } from "@/components/ui/TerminalStream";
import { DEFAULT_MCP_URL, isMcpServerReachable } from "./mcp-client";
import {
  DEMO_MCP_TOOLS,
  toolCheckBankRouting,
  toolPostErpLedger,
  toolVerifyVendorEntity,
} from "./mcp-tools";

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
      });
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
      "Payment stopped. Unknown vendor needs a person to review before any payout."
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

    yield createLogEntry(
      "error",
      source,
      `Payment of $${invoice.invoiceAmount.toLocaleString()} held. Routing change flagged for manager review.`,
      {
        action: "ESCALATE_TO_COMPLIANCE",
        flaggedReason: "UNAUTHORIZED_BANK_ROUTING_CHANGE",
        riskScore: bankResultContent.riskScore,
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

  const ledgerArgs = {
    invoiceId: invoice.invoiceId,
    vendorId: String(vendorResultContent.vendorId),
    amount: invoice.invoiceAmount,
    currency: "USD",
  };

  yield createLogEntry(
    "tool_call",
    transportLabel,
    `Posting invoice ${ledgerArgs.invoiceId} to the AP ledger...`,
    {
      method: "tools/call",
      tool: "post_erp_ledger",
      arguments: ledgerArgs,
      jsonrpc: "2.0",
    }
  );

  await sleep(500);

  const ledgerResult = await callTool("post_erp_ledger", ledgerArgs);

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
