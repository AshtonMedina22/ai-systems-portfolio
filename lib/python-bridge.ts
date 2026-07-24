/**
 * Python NDJSON subprocess helper for a future live Migrate / Workflow adapter.
 *
 * NOT used by the public site while DEMO_MODE=mockup (default).
 * Site paths: lib/migrate/engine.ts and lib/workflow/state-machine.ts.
 * See lib/*/live-stub.ts and ARCHITECTURE.md.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import type { LogEntry } from "@/components/ui/TerminalStream";

const MCP_SERVER_DIR = path.join(process.cwd(), "mcp-server");

export function resolvePythonBin(): string {
  return (
    process.env.PORTFOLIO_PYTHON ||
    process.env.PYTHON ||
    (process.platform === "win32" ? "python" : "python3")
  );
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

function parseNdjsonLine(line: string): LogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as LogEntry;
    if (!parsed || typeof parsed !== "object" || !parsed.message) return null;
    return {
      id: parsed.id || `log-${Date.now()}`,
      timestamp:
        parsed.timestamp ||
        new Date().toLocaleTimeString("en-US", { hour12: false }),
      level: parsed.level || "info",
      source: parsed.source || "python",
      message: parsed.message,
      data: parsed.data,
    };
  } catch {
    return null;
  }
}

export interface PythonNdjsonHandle {
  child: ChildProcessWithoutNullStreams;
  /** Write a JSON line to the child stdin (workflow decisions). */
  writeStdin: (payload: unknown) => void;
  /** Async iterator of parsed LogEntry events. */
  events: AsyncGenerator<LogEntry, void, unknown>;
  /** Promise that resolves when the process exits. */
  exit: Promise<{ code: number | null; stderr: string }>;
}

/**
 * Spawn `mcp-server/<script>` and stream NDJSON LogEntry lines from stdout.
 */
export function spawnPythonNdjson(
  scriptName: string,
  args: string[],
  options?: {
    stdinJson?: unknown;
    env?: NodeJS.ProcessEnv;
  }
): PythonNdjsonHandle {
  const python = resolvePythonBin();
  const scriptPath = path.join(MCP_SERVER_DIR, scriptName);
  const child = spawn(python, [scriptPath, ...args], {
    cwd: MCP_SERVER_DIR,
    env: { ...process.env, ...options?.env, PYTHONUNBUFFERED: "1" },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  if (options?.stdinJson !== undefined) {
    child.stdin.write(JSON.stringify(options.stdinJson));
    // Leave stdin open for workflow; migrate closes after payload.
    if (scriptName === "migrate_pipeline.py") {
      child.stdin.end();
    }
  }

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const exit = new Promise<{ code: number | null; stderr: string }>(
    (resolve) => {
      child.on("close", (code) => resolve({ code, stderr }));
      child.on("error", (err) => {
        stderr += `\n${err.message}`;
        resolve({ code: 1, stderr });
      });
    }
  );

  async function* readEvents(): AsyncGenerator<LogEntry, void, unknown> {
    let buffer = "";
    const stream = child.stdout;

    for await (const chunk of stream) {
      buffer += chunk.toString("utf8");
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const entry = parseNdjsonLine(part);
        if (entry) yield entry;
      }
    }
    if (buffer.trim()) {
      const entry = parseNdjsonLine(buffer);
      if (entry) yield entry;
    }

    const result = await exit;
    if (result.code && result.code !== 0) {
      const detail = (result.stderr || "").trim().slice(0, 800);
      yield createLogEntry(
        "error",
        "python:bridge",
        detail
          ? `Python process exited with code ${result.code}: ${detail}`
          : `Python process exited with code ${result.code}.`,
        {
          code: result.code,
          script: scriptName,
          hint:
            "Install deps: pip install -r mcp-server/requirements.txt. " +
            "Hosted Vercel demos need a Python runtime or sidecar - local npm run dev uses subprocess.",
        }
      );
    }
  }

  return {
    child,
    writeStdin: (payload: unknown) => {
      child.stdin.write(`${JSON.stringify(payload)}\n`);
    },
    events: readEvents(),
    exit,
  };
}

export function pythonMissingEntry(scriptName: string, err: unknown): LogEntry {
  const message = err instanceof Error ? err.message : String(err);
  return createLogEntry(
    "error",
    "python:bridge",
    `Could not start Python (${scriptName}): ${message}`,
    {
      script: scriptName,
      hint:
        "Ensure Python 3.11+ is on PATH and run: pip install -r mcp-server/requirements.txt",
      vercelNote:
        "Vercel Node serverless cannot run this Python ETL/graph in-process. Use local dev, a Python sidecar, or keep PayFlow embedded mode for hosted-only demos.",
    }
  );
}

export { createLogEntry };
