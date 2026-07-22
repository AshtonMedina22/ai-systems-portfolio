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
}

const LEVEL_STYLES: Record<
  LogEntry["level"],
  { label: string; className: string }
> = {
  info: { label: "INFO", className: "text-violet-300" },
  tool_call: { label: "CALL", className: "text-fuchsia-300" },
  tool_result: { label: "RESULT", className: "text-slate-100" },
  warning: { label: "WARN", className: "text-amber-300" },
  error: { label: "ERROR", className: "text-rose-300" },
  success: { label: "OK", className: "text-emerald-300" },
};

function PayloadDisclosure({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 border border-slate-500/60 bg-slate-950/35">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-slate-300 hover:text-white transition-colors"
      >
        <span>View payload</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <pre className="overflow-x-auto border-t border-slate-500/60 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export function TerminalStream({
  logs,
  isRunning = false,
  title = "Execution stream",
  onClear,
  emptyMessage,
}: TerminalStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-500/50 px-5 py-3.5 bg-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              isRunning ? "bg-violet-400 animate-pulse-line" : "bg-slate-400"
            }`}
            aria-hidden
          />
          <h2 className="font-display text-lg text-white truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="label-console">
            {logs.length} events
          </span>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              disabled={isRunning || logs.length === 0}
              className="inline-flex items-center gap-1 label-console hover:text-white disabled:opacity-40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-5 py-4"
      >
        {logs.length === 0 && !isRunning ? (
          <div className="flex h-full min-h-[280px] items-center justify-center px-4">
            <div className="max-w-sm text-center text-[15px] leading-relaxed text-slate-300">
              {emptyMessage ?? (
                <p>
                  Run a scenario to stream MCP{" "}
                  <span className="font-mono text-[13px] font-medium text-violet-300">
                    tools/list
                  </span>{" "}
                  and{" "}
                  <span className="font-mono text-[13px] font-medium text-violet-300">
                    tools/call
                  </span>{" "}
                  into this console.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <ol className="relative border-l border-slate-500/60 ml-2 pl-4 space-y-4">
          {logs.map((log) => {
            const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
            const resultBadge = resultBadgeForLog(log);
            return (
              <li key={log.id} className="animate-log-in relative">
                <span
                  className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-opal-terminal ${
                    log.level === "error"
                      ? "bg-rose-400"
                      : log.level === "success"
                        ? "bg-emerald-400"
                        : log.level === "warning"
                          ? "bg-amber-400"
                          : "bg-violet-400"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[11px] text-slate-400">
                    {log.timestamp}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${style.className}`}
                  >
                    {style.label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {log.source}
                  </span>
                  {resultBadge ? (
                    <Badge tone={resultBadge.tone} variant="dark">
                      {resultBadge.label}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[14px] leading-snug text-slate-100">
                  {log.message}
                </p>
                {log.data ? <PayloadDisclosure data={log.data} /> : null}
              </li>
            );
          })}
        </ol>

        {isRunning ? (
          <p className="mt-4 ml-6 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-violet-300 animate-pulse-line">
            Streaming MCP events
          </p>
        ) : null}
      </div>
    </div>
  );
}
