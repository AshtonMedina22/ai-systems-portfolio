import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const DEFAULT_MCP_URL =
  process.env.MCP_SERVER_URL ?? "http://127.0.0.1:8000/mcp";

export interface McpToolInfo {
  name: string;
  description?: string;
}

export interface McpCallResult {
  isError?: boolean;
  data: Record<string, unknown>;
  rawContent: unknown;
}

function parseToolPayload(result: {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}): McpCallResult {
  if (
    result.structuredContent &&
    typeof result.structuredContent === "object" &&
    !Array.isArray(result.structuredContent)
  ) {
    return {
      isError: Boolean(result.isError),
      data: result.structuredContent as Record<string, unknown>,
      rawContent: result.structuredContent,
    };
  }

  const textBlock = result.content?.find((c) => c.type === "text" && c.text);
  if (textBlock?.text) {
    try {
      const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;
      return {
        isError: Boolean(result.isError),
        data: parsed,
        rawContent: result.content,
      };
    } catch {
      return {
        isError: Boolean(result.isError),
        data: { text: textBlock.text },
        rawContent: result.content,
      };
    }
  }

  return {
    isError: Boolean(result.isError),
    data: {},
    rawContent: result.content ?? null,
  };
}

/**
 * Open an MCP session, run fn, then close.
 */
export async function withPayflowMcpClient<T>(
  fn: (client: Client) => Promise<T>,
  mcpUrl: string = DEFAULT_MCP_URL
): Promise<T> {
  const client = new Client({
    name: "payflow-nextjs-agent",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors during teardown
    }
  }
}

export async function mcpListTools(
  mcpUrl?: string
): Promise<McpToolInfo[]> {
  return withPayflowMcpClient(async (client) => {
    const listed = await client.listTools();
    return listed.tools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }, mcpUrl);
}

export async function mcpCallTool(
  name: string,
  args: Record<string, unknown>,
  mcpUrl?: string
): Promise<McpCallResult> {
  return withPayflowMcpClient(async (client) => {
    const result = await client.callTool({ name, arguments: args });
    return parseToolPayload(
      result as {
        content?: Array<{ type: string; text?: string }>;
        structuredContent?: unknown;
        isError?: boolean;
      }
    );
  }, mcpUrl);
}

export async function isMcpServerReachable(
  mcpUrl: string = DEFAULT_MCP_URL
): Promise<boolean> {
  try {
    const healthUrl = new URL(mcpUrl);
    healthUrl.pathname = "/health";
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
