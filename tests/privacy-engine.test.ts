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
  MAX_PAYLOAD_CHARS,
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

function assertNoRawSourceText(logs: LogEntry[]) {
  for (const entry of logs) {
    assert.equal(
      entry.data?.sourceText,
      undefined,
      `${entry.data?.action ?? entry.message} must not include sourceText`
    );
  }
}

test("hashPayload is deterministic", () => {
  assert.equal(hashPayload("abc"), hashPayload("abc"));
  assert.notEqual(hashPayload("abc"), hashPayload("abd"));
});

test("passesLuhn accepts Visa test PAN", () => {
  assert.equal(passesLuhn("4111111111111111"), true);
  assert.equal(passesLuhn("4111111111111112"), false);
});

test("detector suite catches each sensitive format", () => {
  const ssn = scanText("SSN 078-05-1120 on file");
  assert.equal(ssn.length, 1);
  assert.equal(ssn[0].kind, "ssn");

  const card = scanText("Card 4111-1111-1111-1111");
  assert.equal(card.length, 1);
  assert.equal(card[0].kind, "credit_card");

  const email = scanText("Write ops@example.com for help");
  assert.equal(email.length, 1);
  assert.equal(email[0].kind, "email");

  const key = scanText("Key sk_test_PortfolioDemoKeyAAA001 leaked");
  assert.equal(key.length, 1);
  assert.equal(key[0].kind, "api_key");

  const phone = scanText("Callback 415-555-0134 please");
  assert.equal(phone.length, 1);
  assert.equal(phone[0].kind, "phone");
});

test("scanText ignores non-Luhn digit strings as cards", () => {
  const findings = scanText("Reference 4111-1111-1111-1112 is not a card");
  assert.equal(
    findings.some((finding) => finding.kind === "credit_card"),
    false
  );
});

test("clean scenario passes with zero findings", async () => {
  const findings = scanText(SAMPLE_SCENARIOS.clean.sourceText);
  assert.equal(findings.length, 0);
  assert.equal(decideProxy(findings, "clean").decision, "passed");

  const logs = await collect({ scenarioKey: "clean" });
  assertNoRawSourceText(logs);
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_CLEARED"));
  assert.equal(
    logs.some((entry) => entry.data?.action === "PAYLOAD_BLOCKED"),
    false
  );
  const receipt = receiptFrom(logs);
  assert.ok(receipt);
  assert.equal(receipt?.decision, "passed");
  assert.equal(receipt?.findingCount, 0);
  assert.equal(receipt?.securityReview, null);
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
  assertNoRawSourceText(logs);
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_SANITIZED"));
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_CLEARED"));
  const cleared = logs.find((entry) => entry.data?.action === "PAYLOAD_CLEARED");
  assert.equal(cleared?.data?.decision, "sanitized");
  assert.match(String(cleared?.data?.sanitizedText ?? ""), /\[REDACTED_/);
  const receipt = receiptFrom(logs);
  assert.equal(receipt?.decision, "sanitized");
  assert.ok((receipt?.findingCount ?? 0) > 0);
});

test("false-positive override suppresses a finding kind and records receipt", async () => {
  const logs = await collect({
    scenarioKey: "embedded_pii",
    suppressKinds: ["email"],
    overrideReason: "Need callback email for support handoff.",
    actor: "Security reviewer",
  });
  assertNoRawSourceText(logs);
  assert.ok(logs.some((entry) => entry.data?.action === "OVERRIDE_APPLIED"));
  const receipt = receiptFrom(logs);
  assert.ok(receipt);
  assert.equal(receipt?.override?.suppressedKinds.includes("email"), true);
  assert.equal(receipt?.kinds.includes("email"), false);
  assert.ok((receipt?.findingCount ?? 0) >= 2);
});

test("bulk scenario blocks and opens a security review case", async () => {
  const findings = scanText(SAMPLE_SCENARIOS.bulk_block.sourceText);
  assert.ok(findings.length >= BULK_FINDING_THRESHOLD);
  assert.equal(decideProxy(findings, "bulk_block").decision, "blocked");

  const logs = await collect({ scenarioKey: "bulk_block" });
  assertNoRawSourceText(logs);
  assert.ok(
    logs.some((entry) => entry.data?.action === "SECURITY_REVIEW_OPENED")
  );
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_BLOCKED"));
  assert.equal(
    logs.some((entry) => entry.data?.action === "PAYLOAD_CLEARED"),
    false
  );
  const blocked = logs.find((entry) => entry.data?.action === "PAYLOAD_BLOCKED");
  assert.equal(blocked?.data?.exceptionCode, "PRIV-BULK-RESTRICTED");
  const receipt = receiptFrom(logs);
  assert.equal(receipt?.decision, "blocked");
  assert.ok(receipt?.securityReview?.caseId);
  assert.equal(receipt?.securityReview?.status, "opened");
});

test("custom payload uses custom scenario on the receipt", async () => {
  const logs = await collect({
    scenarioKey: "custom",
    sourceText: "Summarize cooler delivery for Dallas. No sensitive tokens.",
  });
  assertNoRawSourceText(logs);
  const receipt = receiptFrom(logs);
  assert.equal(receipt?.scenario, "custom");
  assert.equal(receipt?.decision, "passed");
});

test("oversized payload is rejected before scan", async () => {
  const logs = await collect({
    scenarioKey: "custom",
    sourceText: "x".repeat(MAX_PAYLOAD_CHARS + 1),
  });
  assert.ok(logs.some((entry) => entry.data?.action === "PAYLOAD_TOO_LARGE"));
  assert.equal(
    logs.some((entry) => entry.data?.action === "SCAN_COMPLETE"),
    false
  );
});

test("override without reason is rejected", async () => {
  const logs = await collect({
    scenarioKey: "embedded_pii",
    suppressKinds: ["email"],
  });
  assert.ok(logs.some((entry) => entry.level === "error"));
  assert.equal(receiptFrom(logs), null);
});
