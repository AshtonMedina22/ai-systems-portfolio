import assert from "node:assert/strict";
import test from "node:test";
import type { LogEntry } from "../components/ui/TerminalStream";
import { submitDecision } from "../lib/workflow/sessions";
import {
  hashPayload,
  runWorkflowEngine,
} from "../lib/workflow/state-machine";
import type { GovernanceReceipt } from "../lib/workflow/types";

process.env.WORKFLOW_TEST_FAST = "1";

function receiptFrom(logs: LogEntry[]): GovernanceReceipt | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const receipt = logs[i].data?.receipt;
    if (receipt && typeof receipt === "object") {
      return receipt as GovernanceReceipt;
    }
  }
  return null;
}

test("hashPayload is deterministic", () => {
  assert.equal(hashPayload("abc"), hashPayload("abc"));
  assert.notEqual(hashPayload("abc"), hashPayload("abd"));
});

test("inventory completes without pause and emits policy plus receipt", async () => {
  const logs: LogEntry[] = [];
  for await (const entry of runWorkflowEngine("inventory_realloc")) {
    logs.push(entry);
  }

  assert.equal(
    logs.some((entry) => entry.data?.action === "AWAITING_APPROVAL"),
    false
  );
  assert.ok(logs.some((entry) => entry.data?.action === "POLICY_OK"));
  const completed = logs.find((entry) => entry.data?.action === "COMPLETED");
  assert.ok(completed);
  const receipt = completed?.data?.receipt as GovernanceReceipt;
  assert.equal(receipt.transaction, "committed");
  assert.ok(receipt.trailHash);
  assert.ok(receipt.policyId);
});

test("contract payout places hold and pauses for intervention", async () => {
  const logs: LogEntry[] = [];
  const iterator = runWorkflowEngine("contract_payout");
  const pump = (async () => {
    for await (const entry of iterator) {
      logs.push(entry);
      if (entry.data?.action === "AWAITING_APPROVAL" && entry.data.sessionId) {
        assert.ok(logs.some((item) => item.data?.action === "POLICY_OK"));
        assert.ok(logs.some((item) => item.data?.action === "HOLD_PLACED"));
        assert.equal(entry.data?.holdStatus, "reserved");
        submitDecision(String(entry.data.sessionId), "reject", {
          reason: "pause-check cleanup",
        });
      }
    }
  })();
  await pump;
  assert.ok(logs.some((entry) => entry.data?.action === "AWAITING_APPROVAL"));
});

test("approve path commits after intervention", async () => {
  const logs: LogEntry[] = [];
  const iterator = runWorkflowEngine("contract_payout");
  const pump = (async () => {
    for await (const entry of iterator) {
      logs.push(entry);
      if (entry.data?.action === "AWAITING_APPROVAL" && entry.data.sessionId) {
        submitDecision(String(entry.data.sessionId), "approve");
      }
    }
  })();
  await pump;

  assert.ok(logs.some((entry) => entry.data?.action === "HOLD_PLACED"));
  assert.ok(logs.some((entry) => entry.data?.action === "APPROVED"));
  assert.ok(
    logs.some((entry) => entry.data?.action === "HOLD_RELEASED_TO_EXECUTE")
  );
  const completed = logs.find((entry) => entry.data?.action === "COMPLETED");
  assert.ok(completed);
  assert.equal(
    (completed?.data?.receipt as GovernanceReceipt).transaction,
    "committed"
  );
  assert.equal(
    logs.some((entry) => entry.data?.action === "REJECTED"),
    false
  );
});

test("reject rolls back hold and never completes", async () => {
  const logs: LogEntry[] = [];
  const iterator = runWorkflowEngine("contract_payout");
  const pump = (async () => {
    for await (const entry of iterator) {
      logs.push(entry);
      if (entry.data?.action === "AWAITING_APPROVAL" && entry.data.sessionId) {
        submitDecision(String(entry.data.sessionId), "reject", {
          reason: "Outside approved vendor terms",
        });
      }
    }
  })();
  await pump;

  assert.ok(logs.some((entry) => entry.data?.action === "HOLD_PLACED"));
  assert.ok(logs.some((entry) => entry.data?.action === "ROLLED_BACK"));
  const rejected = logs.find((entry) => entry.data?.action === "REJECTED");
  assert.ok(rejected);
  assert.equal(rejected?.data?.holdStatus, "rolled_back");
  const receipt = receiptFrom(logs);
  assert.ok(receipt);
  assert.equal(receipt?.transaction, "rolled_back");
  assert.equal(receipt?.decision, "reject");
  assert.equal(
    logs.some((entry) => entry.data?.action === "COMPLETED"),
    false
  );
});
