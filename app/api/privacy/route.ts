import { NextRequest } from "next/server";
import { getPrivacyEngine } from "@/lib/privacy/adapter";
import {
  isFindingKind,
  isPrivacyScenarioKey,
  type FindingKind,
  type PrivacyScenarioKey,
} from "@/lib/privacy/types";

export const dynamic = "force-dynamic";

function parseSuppressKinds(value: unknown): FindingKind[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isFindingKind))];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scenarioKey = body.scenarioKey as unknown;
    const sourceText =
      typeof body.sourceText === "string" ? body.sourceText : undefined;
    const suppressKinds = parseSuppressKinds(body.suppressKinds);
    const overrideReason =
      typeof body.overrideReason === "string" ? body.overrideReason : undefined;
    const actor = typeof body.actor === "string" ? body.actor : undefined;

    const hasScenario =
      scenarioKey === undefined || isPrivacyScenarioKey(scenarioKey);
    if (!hasScenario) {
      return new Response(
        JSON.stringify({ error: "Unknown scenario." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const key = scenarioKey as PrivacyScenarioKey | undefined;
    const needsText = key === "custom" || key === undefined;
    if (needsText && !sourceText?.trim() && key === "custom") {
      return new Response(
        JSON.stringify({
          error: "Custom payload requires sourceText.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!key && !sourceText?.trim()) {
      return new Response(
        JSON.stringify({
          error: "Pick a scenario or provide sourceText.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (suppressKinds.length > 0 && !overrideReason?.trim()) {
      return new Response(
        JSON.stringify({
          error: "False-positive release requires an override reason.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const logGenerator = getPrivacyEngine().run({
            scenarioKey: key,
            sourceText,
            suppressKinds,
            overrideReason,
            actor,
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
