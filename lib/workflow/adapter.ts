/**
 * WorkflowEngine adapter: mockup (state-machine.ts) vs live stub.
 */

import type { LogEntry } from "@/components/ui/TerminalStream";
import type { WorkflowScenarioKey } from "./types";
import { DEMO_MODE } from "./runtime";
import { runWorkflowEngine } from "./state-machine";
import { runLiveWorkflowStub } from "./live-stub";

export interface WorkflowEngine {
  readonly mode: "mockup" | "live";
  run(
    scenarioKey: WorkflowScenarioKey,
    sessionId?: string
  ): AsyncGenerator<LogEntry, void, unknown>;
}

const mockupEngine: WorkflowEngine = {
  mode: "mockup",
  run: (scenarioKey, sessionId) => runWorkflowEngine(scenarioKey, sessionId),
};

const liveEngine: WorkflowEngine = {
  mode: "live",
  run: (scenarioKey, sessionId) => runLiveWorkflowStub(scenarioKey, sessionId),
};

export function getWorkflowEngine(): WorkflowEngine {
  return DEMO_MODE === "live" ? liveEngine : mockupEngine;
}
