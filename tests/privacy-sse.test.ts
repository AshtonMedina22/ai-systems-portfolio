/**
 * SSE tests for POST /api/privacy.
 */
process.env.PRIVACY_TEST_FAST = "1";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { SAMPLE_SCENARIOS } from "@/lib/privacy/types";

type SseLogEntry = {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  data?: Record<string, unknown>;
};

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

async function postPrivacy(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/privacy/route");
  const req = new NextRequest("http://localhost/api/privacy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  return res;
}

describe("POST /api/privacy", () => {
  it("streams a clean pass without raw sourceText", async () => {
    const res = await postPrivacy({ scenarioKey: "clean" });
    assert.equal(res.status, 200);
    assert.match(
      res.headers.get("Content-Type") ?? "",
      /text\/event-stream/
    );
    const events = parseSseLogEntries(await res.text());
    assert.ok(events.length > 0);
    assert.ok(events.some((e) => e.data?.action === "PAYLOAD_CLEARED"));
    for (const event of events) {
      assert.equal(event.data?.sourceText, undefined);
    }
  });

  it("streams sanitize path for embedded PII", async () => {
    const res = await postPrivacy({ scenarioKey: "embedded_pii" });
    assert.equal(res.status, 200);
    const events = parseSseLogEntries(await res.text());
    assert.ok(events.some((e) => e.data?.action === "PAYLOAD_SANITIZED"));
    assert.ok(events.some((e) => e.data?.action === "PAYLOAD_CLEARED"));
    const cleared = events.find((e) => e.data?.action === "PAYLOAD_CLEARED");
    assert.match(String(cleared?.data?.sanitizedText ?? ""), /\[REDACTED_/);
    assert.doesNotMatch(
      String(cleared?.data?.sanitizedText ?? ""),
      /078-05-1120/
    );
  });

  it("streams block + security review for bulk payloads", async () => {
    const res = await postPrivacy({ scenarioKey: "bulk_block" });
    assert.equal(res.status, 200);
    const events = parseSseLogEntries(await res.text());
    assert.ok(
      events.some((e) => e.data?.action === "SECURITY_REVIEW_OPENED")
    );
    assert.ok(events.some((e) => e.data?.action === "PAYLOAD_BLOCKED"));
    const receipt = events.find((e) => e.data?.action === "PAYLOAD_BLOCKED")
      ?.data?.receipt as { securityReview?: { caseId?: string } } | undefined;
    assert.ok(receipt?.securityReview?.caseId);
  });

  it("accepts custom sourceText with custom scenario", async () => {
    const res = await postPrivacy({
      scenarioKey: "custom",
      sourceText: SAMPLE_SCENARIOS.clean.sourceText,
    });
    assert.equal(res.status, 200);
    const events = parseSseLogEntries(await res.text());
    const receipt = events.find((e) => e.data?.action === "PAYLOAD_CLEARED")
      ?.data?.receipt as { scenario?: string } | undefined;
    assert.equal(receipt?.scenario, "custom");
  });

  it("rejects custom without sourceText", async () => {
    const res = await postPrivacy({ scenarioKey: "custom" });
    assert.equal(res.status, 400);
  });

  it("rejects override without reason", async () => {
    const res = await postPrivacy({
      scenarioKey: "embedded_pii",
      suppressKinds: ["email"],
    });
    assert.equal(res.status, 400);
  });
});
