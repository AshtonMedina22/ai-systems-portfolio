import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InvoicePayload } from "./types";
import { LogEntry } from "@/components/ui/TerminalStream";
import { DEFAULT_MCP_URL, isMcpServerReachable } from "./mcp-client";
import {
  toolCheckBankRouting,
  toolPostErpLedger,
  toolVerifyVendorEntity,
} from "./mcp-tools";

export interface AgentExecutionOptions {
  mcpUrl?: string;
  /** Use local TS tools if the MCP server is unreachable. */
  allowLocalFallback?: boolean;
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
    "Executing MCP tools/call: verify_vendor_entity()",
    {
      method: "tools/call",
      tool: "verify_vendor_entity",
      arguments: verifyArgs,
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
      `Alert: vendor '${invoice.vendorName}' is not registered in the enterprise vendor registry.`,
      vendorResultContent
    );
    yield createLogEntry(
      "warning",
      source,
      "Workflow halted: payment blocked due to unknown vendor."
    );
    return;
  }

  const confidencePct =
    Number(vendorResultContent.confidenceScore ?? 0) * 100;

  yield createLogEntry(
    "tool_result",
    "mcp:registry_check",
    `Enterprise registry match confirmed: Vendor ID ${vendorResultContent.vendorId} (${confidencePct}% confidence)`,
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
    "Executing MCP tools/call: check_bank_routing()",
    {
      method: "tools/call",
      tool: "check_bank_routing",
      arguments: bankArgs,
    }
  );

  await sleep(500);

  const bankResultContent = await callTool("check_bank_routing", bankArgs);

  if (!bankResultContent.isMatch) {
    yield createLogEntry(
      "warning",
      "mcp:anti_fraud_rules",
      `Fraud alert: ${bankResultContent.message}`,
      bankResultContent
    );

    await sleep(350);

    yield createLogEntry(
      "error",
      source,
      `Escalated: payout of $${invoice.invoiceAmount.toLocaleString()} blocked. Flagged for manual review.`,
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
    "Bank routing check passed: Account details match the approved enterprise payment profile.",
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
    "Executing MCP tools/call: post_erp_ledger()",
    {
      method: "tools/call",
      tool: "post_erp_ledger",
      arguments: ledgerArgs,
    }
  );

  await sleep(500);

  const ledgerResult = await callTool("post_erp_ledger", ledgerArgs);

  yield createLogEntry(
    "tool_result",
    "mcp:erp_ledger",
    `Ledger entry ${ledgerResult.ledgerEntryId} posted for invoice #${invoice.invoiceId}`,
    ledgerResult
  );

  await sleep(250);

  yield createLogEntry(
    "success",
    source,
    `SUCCESS: Invoice #${invoice.invoiceId} approved and posted to the enterprise AP ledger.`,
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
 * Prefers the live FastMCP HTTP server; optional local fallback is labeled in the stream.
 */
export async function* runPayFlowAgentEngine(
  invoice: InvoicePayload,
  options: AgentExecutionOptions = {}
): AsyncGenerator<LogEntry, void, unknown> {
  const mcpUrl = options.mcpUrl ?? DEFAULT_MCP_URL;
  const allowLocalFallback =
    options.allowLocalFallback ??
    process.env.PAYFLOW_ALLOW_LOCAL_FALLBACK === "1";

  const source = "agent:payflow";

  yield createLogEntry(
    "info",
    source,
    `Ingested Invoice Payload #${invoice.invoiceId} for ${invoice.vendorName}`,
    {
      invoiceAmount: `$${invoice.invoiceAmount.toLocaleString()}`,
      vendorTaxId: invoice.vendorTaxId,
      submittedBank: invoice.bankDetails.bankName,
      scenario: invoice.metadata?.isTestScenario ?? "custom",
    }
  );

  await sleep(400);

  const reachable = await isMcpServerReachable(mcpUrl);

  if (!reachable) {
    if (!allowLocalFallback) {
      yield createLogEntry(
        "error",
        "mcp:session",
        `FastMCP server unreachable at ${mcpUrl}. Start it with: npm run dev:mcp`,
        { mcpUrl, allowLocalFallback: false }
      );
      return;
    }

    yield createLogEntry(
      "warning",
      "mcp:session",
      `FastMCP server unreachable at ${mcpUrl}. Using LOCAL FALLBACK tool implementations (not live MCP).`,
      { hint: "Run: npm run dev:mcp", allowLocalFallback: true }
    );

    yield* runWorkflow(
      invoice,
      createLocalToolRunner(),
      "local:fallback_tools",
      source
    );
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
      { transport: "streamable-http" }
    );

    await sleep(250);

    const listed = await client.listTools();

    yield createLogEntry(
      "tool_call",
      "mcp:fastmcp_server",
      "MCP tools/list: discovering available tools",
      {
        method: "tools/list",
        tools: listed.tools.map((t) => t.name),
      }
    );

    yield createLogEntry(
      "tool_result",
      "mcp:fastmcp_server",
      `Discovered ${listed.tools.length} tools from payflow-ap-agent`,
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
    yield createLogEntry(
      "error",
      "mcp:session",
      err instanceof Error
        ? `MCP session failed: ${err.message}`
        : "MCP session failed with an unknown error.",
      { mcpUrl }
    );
  } finally {
    try {
      await client.close();
    } catch {
      // ignore teardown errors
    }
  }
}
