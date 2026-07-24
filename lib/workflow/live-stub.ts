/**
 * Live WorkflowEngine stub. Returns NOT_WIRED until a real graph bridge exists.
 * See config.ts and mcp-server/workflow_graph.py.
 */

import type { LogEntry } from "@/components/ui/TerminalStream";
import { workflowProductionConfig } from "./config";
import type { WorkflowScenarioKey } from "./types";

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

export async function* runLiveWorkflowStub(
  _scenarioKey: WorkflowScenarioKey,
  _sessionId?: string
): AsyncGenerator<LogEntry, void, unknown> {
  // Future: spawnPythonNdjson(workflowProductionConfig.graphEntrypoint, ...)

  yield createLogEntry(
    "error",
    "workflow:live-stub",
    "Live workflow adapter is not connected. Site runs DEMO_MODE=mockup (TypeScript state machine).",
    {
      demoMode: "live",
      status: "NOT_WIRED",
      intendedEntrypoint: workflowProductionConfig.graphEntrypoint,
      config: {
        checkpointBackend: workflowProductionConfig.checkpointBackend,
        interruptThresholdUsd: workflowProductionConfig.interruptThresholdUsd,
        approvalTimeoutMs: workflowProductionConfig.approvalTimeoutMs,
        checkpointUrlEnv: workflowProductionConfig.checkpointUrlEnv,
      },
      hint: "Wire the graph bridge, then set DEMO_MODE=live in runtime.ts.",
    }
  );
}
