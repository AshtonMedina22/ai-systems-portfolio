import { NextRequest } from "next/server";
import { runPayFlowAgentEngine } from "@/lib/payflow/agent-engine";
import { InvoicePayload } from "@/lib/payflow/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const invoicePayload = body.invoice as InvoicePayload;

    if (!invoicePayload || !invoicePayload.invoiceId) {
      return new Response(
        JSON.stringify({ error: "Invalid invoice payload." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const logGenerator = runPayFlowAgentEngine(invoicePayload);

          for await (const logEntry of logGenerator) {
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
  } catch {
    return new Response(
      JSON.stringify({ error: "Malformed request payload." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
