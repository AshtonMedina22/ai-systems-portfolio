import { NextRequest } from "next/server";
import { getWorkflowEngine } from "@/lib/workflow/adapter";
import { submitDecision } from "@/lib/workflow/sessions";
import type {
  WorkflowDecision,
  WorkflowScenarioKey,
} from "@/lib/workflow/types";
import { SAMPLE_WORKFLOWS } from "@/lib/workflow/types";

export const dynamic = "force-dynamic";

function isScenarioKey(value: unknown): value is WorkflowScenarioKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(SAMPLE_WORKFLOWS, value)
  );
}

function isDecision(value: unknown): value is WorkflowDecision {
  return value === "approve" || value === "reject";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string | undefined;

    // Resume a paused checkpoint (manager sign-off).
    if (action === "approve" || action === "reject") {
      const sessionId = body.sessionId as string | undefined;
      if (!sessionId || typeof sessionId !== "string") {
        return Response.json(
          { error: "sessionId is required to approve or reject." },
          { status: 400 }
        );
      }
      if (!isDecision(action)) {
        return Response.json({ error: "Invalid decision." }, { status: 400 });
      }

      const result = submitDecision(sessionId, action);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 409 });
      }
      return Response.json({ ok: true, decision: action, sessionId });
    }

    // Start a new workflow and stream state transitions over SSE.
    const scenario = body.scenario as unknown;
    if (!isScenarioKey(scenario)) {
      return Response.json(
        {
          error:
            "Invalid scenario. Use contract_payout or inventory_realloc.",
        },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const logGenerator = getWorkflowEngine().run(scenario);

          for await (const logEntry of logGenerator) {
            const chunk = `data: ${JSON.stringify(logEntry)}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          }

          controller.close();
        } catch (err) {
          console.error("Workflow stream error:", err);
          const errorLog = `data: ${JSON.stringify({
            id: `err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString("en-US", {
              hour12: false,
            }),
            level: "error",
            source: "api:workflow",
            message: "Workflow stream failed.",
          })}\n\n`;
          controller.enqueue(encoder.encode(errorLog));
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
    return Response.json(
      { error: "Malformed request payload." },
      { status: 400 }
    );
  }
}
