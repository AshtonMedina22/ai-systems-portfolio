/**
 * MigrationEngine adapter: mockup (engine.ts) vs live stub.
 */

import type { LogEntry } from "@/components/ui/TerminalStream";
import { DEMO_MODE } from "./runtime";
import { runMigrationEngine, type MigrationRunInput } from "./engine";
import { runLiveMigrationStub } from "./live-stub";

export interface MigrationEngine {
  readonly mode: "mockup" | "live";
  run(input?: MigrationRunInput): AsyncGenerator<LogEntry, void, unknown>;
}

const mockupEngine: MigrationEngine = {
  mode: "mockup",
  run: (input) => runMigrationEngine(input),
};

const liveEngine: MigrationEngine = {
  mode: "live",
  run: (input) => runLiveMigrationStub(input),
};

export function getMigrationEngine(): MigrationEngine {
  return DEMO_MODE === "live" ? liveEngine : mockupEngine;
}

export type { MigrationRunInput };
