import assert from "node:assert/strict";
import test from "node:test";
import type { LogEntry } from "../components/ui/TerminalStream";
import {
  decideProxy,
  hashPayload,
  passesLuhn,
  redactText,
  runPrivacyEngine,
  scanText,
  type PrivacyRunInput,
} from "../lib/privacy/engine";
import {
  BULK_FINDING_THRESHOLD,
  SAMPLE_SCENARIOS,
  type PrivacyReceipt,
} from "../lib/privacy/types";

process.env.PRIVACY_TEST_FAST = "1";

async function collect(input: PrivacyRunInput): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];
  for await (const entry of runPrivacyEngine(input)) logs.push(entry);
  return logs;
}

function receiptFrom(logs: LogEntry[]): PrivacyReceipt | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const receipt = logs[i].data?.receipt;
    if (receipt && typeof receipt === "object") {
      return receipt as PrivacyReceipt;
    }
  }
  return null;
}

test("hashPayload is deterministic", () => {
  assert.equal(hashPayload("abc"), hashPayload("abc"));
  assert.notEqual(hashPayload("abc"), hashPayload("abd"));
});

test("passesLuhn accepts Visa test PAN", () => {
  assert.equal(passesLuhn("4111111111111111"), true);
  assert.equal(passesLuhn("4111111111111112"), false);
});

test("clean scenario passes with zero findings", async () => {
  const findings = scanText(SAMPLE_SCENARIOS.clean.sourceText);
  assert.equal(findings.length, 0);
  assert.equal(decideProxy(findings, "clean").decision, "passed");

  const logs = await collect({ scenarioKey: "clean" });
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_CLEARED"));
  assert.equal(
    logs.some((entry) => entry.data?.action === "PAYLOAD_BLOCKED"),
    false
  );
  const receipt = receiptFrom(logs);
  assert.ok(receipt);
  assert.equal(receipt?.decision, "passed");
  assert.equal(receipt?.findingCount, 0);
});

test("embedded PII sanitizes tokens before transit", async () => {
  const source = SAMPLE_SCENARIOS.embedded_pii.sourceText;
  const findings = scanText(source);
  assert.ok(findings.length >= 3);
  assert.equal(decideProxy(findings, "embedded_pii").decision, "sanitized");

  const sanitized = redactText(source, findings);
  assert.match(sanitized, /\[REDACTED_/);
  assert.doesNotMatch(sanitized, /078-05-1120/);
  assert.doesNotMatch(sanitized, /4111-1111-1111-1111/);

  const logs = await collect({ scenarioKey: "embedded_pii" });
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_SANITIZED"));
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_CLEARED"));
  const cleared = logs.find((entry) => entry.data?.action === "PAYLOAD_CLEARED");
  assert.equal(cleared?.data?.decision, "sanitized");
  const receipt = receiptFrom(logs);
  assert.equal(receipt?.decision, "sanitized");
  assert.ok((receipt?.findingCount ?? 0) > 0);
});

test("bulk scenario blocks pre-transit", async () => {
  const findings = scanText(SAMPLE_SCENARIOS.bulk_block.sourceText);
  assert.ok(findings.length >= BULK_FINDING_THRESHOLD);
  assert.equal(decideProxy(findings, "bulk_block").decision, "blocked");

  const logs = await collect({ scenarioKey: "bulk_block" });
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_BLOCKED"));
  assert.equal(
    logs.some((entry) => entry.data?.action === "PAYLOAD_CLEARED"),
    false
  );
  const blocked = logs.find((entry) => entry.data?.action === "PAYLOAD_BLOCKED");
  assert.equal(blocked?.data?.exceptionCode, "PRIV-BULK-RESTRICTED");
  const receipt = receiptFrom(logs);
  assert.equal(receipt?.decision, "blocked");
});
