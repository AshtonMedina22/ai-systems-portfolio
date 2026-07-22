import type { InvoicePayload } from "./types";
import type { LogEntry } from "@/components/ui/TerminalStream";

export async function streamPayflowAgent(
  invoice: InvoicePayload,
  onLog: (entry: LogEntry) => void
): Promise<void> {
  const response = await fetch("/api/payflow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Failed to connect to /api/payflow stream endpoint.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const entry = JSON.parse(trimmed.slice(6)) as LogEntry;
      onLog(entry);
    }
  }
}
