/**
 * Golden SSE tests for POST /api/payflow.
 * Exercises the real route handler + agent engine stream (embedded MCP mode).
 */
process.env.PAYFLOW_MCP_MODE = "embedded";
process.env.PAYFLOW_TEST_FAST = "1";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { SAMPLE_INVOICES } from "@/lib/payflow/types";

const LOG_LEVELS = new Set([
  "info",
  "tool_call",
  "tool_result",
  "warning",
  "error",
  "success",
]);

type SseLogEntry = {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  data?: Record<string, unknown>;
};

function assertLogSchema(entry: SseLogEntry, index: number) {
  assert.equal(typeof entry.id, "string", `event[${index}].id`);
  assert.ok(entry.id.length > 0, `event[${index}].id non-empty`);
  assert.equal(typeof entry.timestamp, "string", `event[${index}].timestamp`);
  assert.ok(entry.timestamp.length > 0, `event[${index}].timestamp non-empty`);
  assert.ok(LOG_LEVELS.has(entry.level), `event[${index}].level=${entry.level}`);
  assert.equal(typeof entry.source, "string", `event[${index}].source`);
  assert.ok(entry.source.length > 0, `event[${index}].source non-empty`);
  assert.equal(typeof entry.message, "string", `event[${index}].message`);
  assert.ok(entry.message.length > 0, `event[${index}].message non-empty`);
  if (entry.data !== undefined) {
    assert.equal(typeof entry.data, "object", `event[${index}].data`);
    assert.ok(entry.data !== null, `event[${index}].data not null`);
    assert.ok(!Array.isArray(entry.data), `event[${index}].data not array`);
  }
}

function parseSseLogEntries(body: string): SseLogEntry[] {
  const entries: SseLogEntry[] = [];
  for (const block of body.split("\n\n")) {
    const trimmed = block.trim();
    if (!trimmed.startsWith("data:")) continue;
    const json = trimmed.replace(/^data:\s*/, "");
    if (!json) continue;
    entries.push(JSON.parse(json) as SseLogEntry);
  }
  return entries;
}

function hasLedgerPostToolCall(events: SseLogEntry[]): boolean {
  return events.some(
    (e) =>
      e.level === "tool_call" &&
      e.data?.tool === "post_erp_ledger"
  );
}

function hasPostedLedgerResult(events: SseLogEntry[]): boolean {
  return events.some(
    (e) =>
      e.level === "tool_result" &&
      e.source === "mcp:erp_ledger" &&
      typeof e.data?.ledgerEntryId === "string" &&
      e.data.ledgerEntryId.length > 0
  );
}

function hasTerminalAction(
  events: SseLogEntry[],
  action: string
): boolean {
  return events.some((e) => e.data?.action === action);
}

async function runPayflowSse(
  invoice: (typeof SAMPLE_INVOICES)[keyof typeof SAMPLE_INVOICES]
): Promise<{ status: number; contentType: string; events: SseLogEntry[] }> {
  const { POST } = await import("@/app/api/payflow/route");
  const req = new NextRequest("http://localhost/api/payflow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "run", invoice }),
  });
  const res = await POST(req);
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  return {
    status: res.status,
    contentType,
    events: parseSseLogEntries(body),
  };
}

describe("/api/payflow golden SSE streams", () => {
  it("clean scenario posts to the ledger", async () => {
    const { status, contentType, events } = await runPayflowSse(
      SAMPLE_INVOICES.clean
    );

    assert.equal(status, 200);
    assert.match(contentType, /text\/event-stream/);
    assert.ok(events.length >= 5, `expected multiple events, got ${events.length}`);
    events.forEach(assertLogSchema);

    assert.ok(hasLedgerPostToolCall(events), "clean must call post_erp_ledger");
    assert.ok(hasPostedLedgerResult(events), "clean must yield ledgerEntryId");
    assert.ok(
      hasTerminalAction(events, "POST_TO_ERP_LEDGER"),
      "clean terminal action POST_TO_ERP_LEDGER"
    );
    assert.ok(
      events.some((e) => e.level === "success"),
      "clean ends with success"
    );
    assert.equal(
      hasTerminalAction(events, "HOLD_OPENED"),
      false,
      "clean must not open a hold"
    );
  });

  it("spoofed-bank scenario holds and does not post", async () => {
    const { status, contentType, events } = await runPayflowSse(
      SAMPLE_INVOICES.spoofed_bank
    );

    assert.equal(status, 200);
    assert.match(contentType, /text\/event-stream/);
    assert.ok(events.length >= 4, `expected multiple events, got ${events.length}`);
    events.forEach(assertLogSchema);

    assert.ok(
      hasTerminalAction(events, "HOLD_OPENED"),
      "spoofed terminal action HOLD_OPENED"
    );
    assert.equal(
      hasLedgerPostToolCall(events),
      false,
      "spoofed must not call post_erp_ledger"
    );
    assert.equal(
      hasPostedLedgerResult(events),
      false,
      "spoofed must not post a ledger entry"
    );
    assert.equal(
      hasTerminalAction(events, "POST_TO_ERP_LEDGER"),
      false,
      "spoofed must not POST_TO_ERP_LEDGER"
    );
    assert.ok(
      events.some((e) => e.level === "error"),
      "spoofed ends with error-level hold"
    );
  });

  it("unknown-vendor scenario stops and does not post", async () => {
    const { status, contentType, events } = await runPayflowSse(
      SAMPLE_INVOICES.unknown_vendor
    );

    assert.equal(status, 200);
    assert.match(contentType, /text\/event-stream/);
    assert.ok(events.length >= 3, `expected multiple events, got ${events.length}`);
    events.forEach(assertLogSchema);

    assert.ok(
      events.some(
        (e) =>
          e.level === "error" &&
          e.source === "mcp:registry_check"
      ),
      "unknown vendor must fail registry check"
    );
    assert.ok(
      events.some(
        (e) =>
          e.level === "warning" &&
          /unknown|low-confidence|AP manager/i.test(e.message)
      ),
      "unknown vendor must warn that payment stopped"
    );
    assert.equal(
      hasLedgerPostToolCall(events),
      false,
      "unknown must not call post_erp_ledger"
    );
    assert.equal(
      hasPostedLedgerResult(events),
      false,
      "unknown must not post a ledger entry"
    );
    assert.equal(
      hasTerminalAction(events, "POST_TO_ERP_LEDGER"),
      false,
      "unknown must not POST_TO_ERP_LEDGER"
    );
    assert.equal(
      hasTerminalAction(events, "HOLD_OPENED"),
      false,
      "unknown stops before bank hold"
    );
  });
});
