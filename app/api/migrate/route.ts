import { NextRequest } from "next/server";
import { getMigrationEngine } from "@/lib/migrate/adapter";
import type { DatasetKey } from "@/lib/migrate/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const datasetKey = body.datasetKey as DatasetKey | undefined;
    const csvText =
      typeof body.csvText === "string" ? body.csvText : undefined;
    const clientName =
      typeof body.clientName === "string" ? body.clientName : undefined;

    if (!datasetKey && !csvText) {
      return new Response(
        JSON.stringify({ error: "Pick a dataset or upload a CSV." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (datasetKey && datasetKey !== "clean" && datasetKey !== "corrupted") {
      return new Response(
        JSON.stringify({ error: "Unknown dataset." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const logGenerator = getMigrationEngine().run({
            datasetKey,
            csvText,
            clientName,
          });

          for await (const logEntry of logGenerator) {
            const chunk = `data: ${JSON.stringify(logEntry)}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          }

          controller.close();
        } catch (err) {
          console.error("Migrate stream error:", err);
          const errorLog = `data: ${JSON.stringify({
            id: `err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: "error",
            source: "api:migrate",
            message: "Migration stream failed.",
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
      JSON.stringify({ error: "Malformed request." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
