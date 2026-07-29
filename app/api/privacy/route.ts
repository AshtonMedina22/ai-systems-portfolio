import { NextRequest } from "next/server";
import { getPrivacyEngine } from "@/lib/privacy/adapter";
import {
  SAMPLE_SCENARIOS,
  type PrivacyScenarioKey,
} from "@/lib/privacy/types";

export const dynamic = "force-dynamic";

function isScenarioKey(value: unknown): value is PrivacyScenarioKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(SAMPLE_SCENARIOS, value)
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scenarioKey = body.scenarioKey as unknown;
    const sourceText =
      typeof body.sourceText === "string" ? body.sourceText : undefined;

    if (!isScenarioKey(scenarioKey) && !sourceText?.trim()) {
      return new Response(
        JSON.stringify({
          error: "Pick a scenario or provide sourceText.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (scenarioKey && !isScenarioKey(scenarioKey)) {
      return new Response(
        JSON.stringify({ error: "Unknown scenario." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const logGenerator = getPrivacyEngine().run({
            scenarioKey: isScenarioKey(scenarioKey) ? scenarioKey : undefined,
            sourceText,
          });

          for await (const logEntry of logGenerator) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(logEntry)}\n\n`)
            );
          }
          controller.close();
        } catch (err) {
          console.error("Privacy stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                id: `err-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                level: "error",
                source: "api:privacy",
                message: "Privacy stream failed.",
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Malformed request." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
