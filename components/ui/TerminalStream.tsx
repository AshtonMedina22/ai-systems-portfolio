"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { resultBadgeForLog } from "@/lib/payflow/executive-summary";

export interface LogEntry {
  id: string;
  timestamp: string;
  level:
    | "info"
    | "tool_call"
    | "tool_result"
    | "warning"
    | "error"
    | "success";
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface TerminalStreamProps {
  logs: LogEntry[];
  isRunning?: boolean;
  title?: string;
  onClear?: () => void;
  emptyMessage?: React.ReactNode;
  /** Label shown while the stream is active */
  runningLabel?: string;
}

const LEVEL_STYLES: Record<
  LogEntry["level"],
  { label: string; className: string }
> = {
  info: { label: "INFO", className: "text-accent-deep" },
  tool_call: { label: "CALL", className: "text-opal-periwinkle" },
  tool_result: { label: "RESULT", className: "text-opal-muted" },
  warning: { label: "WARN", className: "text-warn" },
  error: { label: "ERROR", className: "text-danger" },
  success: { label: "OK", className: "text-ok" },
};

function PayloadDisclosure({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-line bg-console-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left font-mono text-[11px] font-medium uppercase tracking-wide text-opal-muted transition-colors hover:text-opal-main"
      >
        <span>View details</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <pre className="overflow-x-auto border-t border-line bg-white px-2.5 py-2 font-mono text-[11px] leading-relaxed text-opal-main">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export function TerminalStream({
  logs,
  isRunning = false,
  title = "Live tool activity",
  onClear,
  emptyMessage,
  runningLabel = "What's running",
}: TerminalStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="flex h-full min-h-[420px] flex-col bg-console-bg text-console-fg">
      <div className="opal-chrome flex items-center justify-between gap-3 border-b border-console-border px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              isRunning ? "bg-accent animate-pulse-line" : "bg-opal-mist"
            }`}
            aria-hidden
          />
          <h2 className="truncate font-display text-lg font-semibold text-opal-main">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="label-console">{logs.length} events</span>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              disabled={isRunning || logs.length === 0}
              className="label-console inline-flex items-center gap-1 transition-colors hover:text-opal-main disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {logs.length === 0 && !isRunning ? (
          <div className="flex h-full min-h-[280px] items-center justify-center px-4">
            <div className="max-w-sm text-center text-[15px] leading-relaxed text-opal-muted">
              {emptyMessage ?? (
                <p>
                  Run a scenario to stream MCP{" "}
                  <span className="font-mono text-sm font-medium text-accent-deep">
                    tools/list
                  </span>{" "}
                  and{" "}
                  <span className="font-mono text-sm font-medium text-accent-deep">
                    tools/call
                  </span>{" "}
                  into this console.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <ol className="relative ml-2 space-y-4 border-l border-line pl-4">
          {logs.map((log) => {
            const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
            const resultBadge = resultBadgeForLog(log);
            return (
              <li key={log.id} className="animate-log-in relative">
                <span
                  className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    log.level === "error"
                      ? "bg-danger"
                      : log.level === "success"
                        ? "bg-ok"
                        : log.level === "warning"
                          ? "bg-warn"
                          : "bg-accent"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[11px] text-opal-mist">
                    {log.timestamp}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-semibold uppercase tracking-wide ${style.className}`}
                  >
                    {style.label}
                  </span>
                  <span className="font-mono text-[11px] text-opal-mist">
                    {log.source}
                  </span>
                  {resultBadge ? (
                    <Badge tone={resultBadge.tone}>
                      {resultBadge.label}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-snug text-opal-main">
                  {log.message}
                </p>
                {log.data ? <PayloadDisclosure data={log.data} /> : null}
              </li>
            );
          })}
        </ol>

        {isRunning ? (
          <p className="ml-6 mt-4 animate-pulse-line font-mono text-[11px] font-medium uppercase tracking-wide text-accent">
            {runningLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
