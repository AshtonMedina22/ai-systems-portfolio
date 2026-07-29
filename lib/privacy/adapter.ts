/**
 * PrivacyEngine adapter: mockup (engine.ts) vs live stub.
 */

import type { LogEntry } from "@/components/ui/TerminalStream";
import { DEMO_MODE } from "./runtime";
import { runPrivacyEngine, type PrivacyRunInput } from "./engine";
import { runLivePrivacyStub } from "./live-stub";

export interface PrivacyEngine {
  readonly mode: "mockup" | "live";
  run(input?: PrivacyRunInput): AsyncGenerator<LogEntry, void, unknown>;
}

const mockupEngine: PrivacyEngine = {
  mode: "mockup",
  run: (input) => runPrivacyEngine(input),
};

const liveEngine: PrivacyEngine = {
  mode: "live",
  run: (input) => runLivePrivacyStub(input),
};

export function getPrivacyEngine(): PrivacyEngine {
  return DEMO_MODE === "live" ? liveEngine : mockupEngine;
}

export type { PrivacyRunInput };
