/**
 * Live privacy path is not wired for the public demo.
 */

import type { LogEntry } from "@/components/ui/TerminalStream";
import type { PrivacyRunInput } from "./engine";

export async function* runLivePrivacyStub(
  _input: PrivacyRunInput = { scenarioKey: "clean" }
): AsyncGenerator<LogEntry, void, unknown> {
  yield {
    id: `log-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
    level: "warning",
    source: "privacy:live",
    message:
      "Live privacy proxy is not wired on this hosted demo. DEMO_MODE remains mockup.",
    data: { status: "NOT_WIRED" },
  };
}
