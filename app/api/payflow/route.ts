import { NextRequest } from "next/server";
import {
  rejectPayFlowHold,
  releasePayFlowHold,
  runPayFlowAgentEngine,
} from "@/lib/payflow/agent-engine";
import { getHold } from "@/lib/payflow/holds";
import { InvoicePayload } from "@/lib/payflow/types";

export const dynamic = "force-dynamic";

function sseResponse(
  generator: AsyncGenerator<unknown, unknown, unknown>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const logEntry of generator) {
          const chunk = `data: ${JSON.stringify(logEntry)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        console.error("PayFlow stream error:", err);
        const errorLog = `data: ${JSON.stringify({
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          source: "api:payflow",
          message: "Agent stream failed.",
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
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "run";

    if (action === "get_hold") {
      const holdId = body.holdId as string | undefined;
      if (!holdId) {
        return Response.json(
          { error: "holdId is required." },
          { status: 400 }
        );
      }
      const hold = getHold(holdId);
      if (!hold) {
        return Response.json(
          { error: "Hold not found in demo/session storage." },
          { status: 404 }
        );
      }
      return Response.json({ hold });
    }

    if (action === "reject_hold") {
      const holdId = body.holdId as string | undefined;
      const reason = typeof body.reason === "string" ? body.reason : "";
      if (!holdId) {
        return Response.json(
          { error: "holdId is required." },
          { status: 400 }
        );
      }
      const result = rejectPayFlowHold(holdId, reason);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({
        ok: true,
        hold: result.hold,
        logs: result.logs,
      });
    }

    if (action === "release_hold") {
      const holdId = body.holdId as string | undefined;
      const reason = typeof body.reason === "string" ? body.reason : "";
      const correctedRouting =
        typeof body.correctedRouting === "string"
          ? body.correctedRouting
          : "";
      const correctedAccount =
        typeof body.correctedAccount === "string"
          ? body.correctedAccount
          : undefined;

      if (!holdId) {
        return Response.json(
          { error: "holdId is required." },
          { status: 400 }
        );
      }

      return sseResponse(
        releasePayFlowHold({
          holdId,
          reason,
          correctedRouting,
          correctedAccount,
        })
      );
    }

    const invoicePayload = body.invoice as InvoicePayload;

    if (!invoicePayload || !invoicePayload.invoiceId) {
      return new Response(
        JSON.stringify({ error: "Invalid invoice payload." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return sseResponse(runPayFlowAgentEngine(invoicePayload));
  } catch {
    return new Response(
      JSON.stringify({ error: "Malformed request payload." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
