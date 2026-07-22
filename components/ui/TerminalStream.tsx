"use client";

import React, { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

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
}

const LEVEL_STYLES: Record<
  LogEntry["level"],
  { label: string; className: string }
> = {
  info: { label: "INFO", className: "text-accent" },
  tool_call: { label: "CALL", className: "text-accent-deep" },
  tool_result: { label: "RESULT", className: "text-ink" },
  warning: { label: "WARN", className: "text-warn" },
  error: { label: "ERROR", className: "text-danger" },
  success: { label: "OK", className: "text-ok" },
};

export function TerminalStream({
  logs,
  isRunning = false,
  title = "Execution stream",
  onClear,
}: TerminalStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              isRunning ? "bg-accent animate-pulse-line" : "bg-line"
            }`}
            aria-hidden
          />
          <h2 className="font-display text-lg text-ink truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {logs.length} events
          </span>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              disabled={isRunning || logs.length === 0}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-ink disabled:opacity-40 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-0"
      >
        {logs.length === 0 && !isRunning ? (
          <div className="flex h-full min-h-[280px] items-center justify-center px-4">
            <p className="max-w-xs text-center text-sm leading-relaxed text-muted">
              Run a scenario to stream MCP{" "}
              <span className="font-mono text-[12px] text-ink">tools/list</span>{" "}
              and{" "}
              <span className="font-mono text-[12px] text-ink">tools/call</span>{" "}
              events into this receipt.
            </p>
          </div>
        ) : null}

        <ol className="relative border-l border-line ml-2 pl-4 space-y-4">
          {logs.map((log) => {
            const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
            return (
              <li key={log.id} className="animate-log-in relative">
                <span
                  className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border-2 border-surface ${
                    log.level === "error"
                      ? "bg-danger"
                      : log.level === "success"
                        ? "bg-ok"
                        : log.level === "warning"
                          ? "bg-warn"
                          : "bg-accent"
                  }`}
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.08em]">
                  <span className="text-muted">{log.timestamp}</span>
                  <span className={`font-medium ${style.className}`}>
                    {style.label}
                  </span>
                  <span className="normal-case tracking-normal text-muted/80">
                    {log.source}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-ink">
                  {log.message}
                </p>
                {log.data ? (
                  <pre className="mt-2 overflow-x-auto border border-line bg-paper/60 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ol>

        {isRunning ? (
          <p className="mt-4 ml-6 font-mono text-[10px] uppercase tracking-[0.14em] text-accent animate-pulse-line">
            Streaming MCP events
          </p>
        ) : null}
      </div>
    </div>
  );
}
