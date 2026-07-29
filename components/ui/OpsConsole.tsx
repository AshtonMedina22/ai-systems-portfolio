"use client";

import React, { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import type { LogEntry } from "@/components/ui/TerminalStream";

export function OpsConsoleShell({
  title,
  statusLabel,
  statusTone = "idle",
  isRunning = false,
  eventCount,
  onClear,
  children,
}: {
  title: string;
  statusLabel: string;
  statusTone?: "idle" | "live" | "ok" | "warn" | "danger";
  isRunning?: boolean;
  eventCount: number;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  const toneClass =
    statusTone === "live"
      ? "bg-ok-soft text-ok ring-ok/30"
      : statusTone === "ok"
        ? "bg-ok-soft text-ok ring-ok/30"
        : statusTone === "warn"
          ? "bg-warn-soft text-warn ring-warn/30"
          : statusTone === "danger"
            ? "bg-danger-soft text-danger ring-danger/30"
            : "bg-console-panel text-opal-muted ring-line";

  const dotClass =
    isRunning || statusTone === "live"
      ? "bg-ok animate-pulse-line"
      : statusTone === "danger"
        ? "bg-danger"
        : statusTone === "warn"
          ? "bg-warn"
          : statusTone === "ok"
            ? "bg-ok"
            : "bg-opal-mist";

  return (
    <div className="flex h-full min-h-0 flex-col bg-console-bg text-console-fg">
      <div className="opal-chrome flex items-center justify-between gap-3 border-b border-console-border px-5 py-3.5">
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
              aria-hidden
            />
            <h2 className="truncate font-display text-lg font-semibold text-opal-main">
              {title}
            </h2>
          </div>
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${toneClass}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="label-console">{eventCount} events</span>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              disabled={isRunning || eventCount === 0}
              className="label-console inline-flex items-center gap-1 transition-colors hover:text-opal-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {children}
      </div>
    </div>
  );
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

/** Compact color-coded event list - no JSON dump by default. */
export function CompactEventLog({
  logs,
  isRunning,
  maxVisible = 8,
}: {
  logs: LogEntry[];
  isRunning?: boolean;
  maxVisible?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = logs.slice(-maxVisible);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  if (logs.length === 0 && !isRunning) return null;

  return (
    <div className="console-panel overflow-hidden">
      <div className="border-b border-console-border px-3 py-2">
        <p className="label-console">Activity log</p>
      </div>
      <div
        ref={scrollRef}
        className="max-h-44 space-y-2 overflow-y-auto px-3 py-2"
      >
        {visible.map((log) => {
          const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
          return (
            <div
              key={log.id}
              className="animate-log-in flex gap-2 text-sm leading-snug"
            >
              <span
                className={`shrink-0 font-mono text-[11px] font-semibold ${style.className}`}
              >
                [{style.label}]
              </span>
              <span className="text-opal-main">{log.message}</span>
            </div>
          );
        })}
        {isRunning ? (
          <p className="animate-pulse-line font-mono text-[11px] uppercase tracking-wide text-accent">
            Streaming...
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  tone = "ok",
}: {
  value: number;
  label: string;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  const pct = Math.max(0, Math.min(100, value));
  const bar =
    tone === "danger"
      ? "bg-danger"
      : tone === "warn"
        ? "bg-warn"
        : tone === "neutral"
          ? "bg-opal-mist"
          : "bg-ok";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="text-opal-muted">{label}</span>
        <span className="font-mono text-sm font-semibold text-opal-main">
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
