import { NextRequest } from "next/server";
import { getMigrationEngine } from "@/lib/migrate/adapter";
import {
  TARGET_FIELDS,
  type DatasetKey,
  type MappingChoice,
  type MappingTarget,
} from "@/lib/migrate/types";

export const dynamic = "force-dynamic";

const DATASET_KEYS = new Set<DatasetKey>(["clean", "corrupted", "reuse"]);
const TARGET_KEYS = new Set<string>(TARGET_FIELDS.map((field) => field.key));

function parseRowFixes(
  value: unknown
): Record<string, Partial<Record<MappingTarget, string>>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const fixes: Record<string, Partial<Record<MappingTarget, string>>> = {};
  for (const [rowKey, fields] of Object.entries(value)) {
    if (!/^\d+$/.test(rowKey) || !fields || typeof fields !== "object") continue;
    const next: Partial<Record<MappingTarget, string>> = {};
    for (const [field, fieldValue] of Object.entries(fields)) {
      if (TARGET_KEYS.has(field) && typeof fieldValue === "string") {
        next[field as MappingTarget] = fieldValue;
      }
    }
    if (Object.keys(next).length > 0) fixes[rowKey] = next;
  }
  return Object.keys(fixes).length > 0 ? fixes : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const datasetKey = body.datasetKey as DatasetKey | undefined;
    const csvText =
      typeof body.csvText === "string" ? body.csvText : undefined;
    const clientName =
      typeof body.clientName === "string" ? body.clientName : undefined;
    const validMappingChoices = new Set<string>([
      ...TARGET_FIELDS.map((field) => field.key),
      "leave_out",
    ]);
    const mappingOverrides =
      body.mappingOverrides &&
      typeof body.mappingOverrides === "object" &&
      !Array.isArray(body.mappingOverrides)
        ? Object.fromEntries(
            Object.entries(body.mappingOverrides).filter(
              (entry): entry is [string, MappingChoice] =>
                typeof entry[1] === "string" &&
                validMappingChoices.has(entry[1])
            )
          )
        : undefined;
    const rowFixes = parseRowFixes(body.rowFixes);

    if (!datasetKey && !csvText) {
      return new Response(
        JSON.stringify({ error: "Pick a dataset or upload a CSV." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (datasetKey && !DATASET_KEYS.has(datasetKey)) {
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
            mappingOverrides,
            rowFixes,
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
