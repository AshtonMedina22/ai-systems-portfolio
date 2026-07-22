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
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
      : statusTone === "ok"
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
        : statusTone === "warn"
          ? "bg-amber-500/15 text-amber-300 ring-amber-500/40"
          : statusTone === "danger"
            ? "bg-rose-500/15 text-rose-300 ring-rose-500/40"
            : "bg-slate-500/20 text-slate-300 ring-slate-500/40";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-500/50 px-5 py-3.5 bg-slate-800/80">
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                isRunning || statusTone === "live"
                  ? "bg-emerald-400 animate-pulse-line"
                  : statusTone === "danger"
                    ? "bg-rose-400"
                    : statusTone === "warn"
                      ? "bg-amber-400"
                      : statusTone === "ok"
                        ? "bg-emerald-400"
                        : "bg-slate-400"
              }`}
              aria-hidden
            />
            <h2 className="font-display text-lg text-white truncate">{title}</h2>
          </div>
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${toneClass}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="label-console">{eventCount} events</span>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              disabled={isRunning || eventCount === 0}
              className="inline-flex items-center gap-1 label-console hover:text-white disabled:opacity-40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

const LEVEL_STYLES: Record<
  LogEntry["level"],
  { label: string; className: string }
> = {
  info: { label: "INFO", className: "text-violet-300" },
  tool_call: { label: "CALL", className: "text-fuchsia-300" },
  tool_result: { label: "RESULT", className: "text-slate-200" },
  warning: { label: "WARN", className: "text-amber-300" },
  error: { label: "ERROR", className: "text-rose-300" },
  success: { label: "OK", className: "text-emerald-300" },
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
    <div className="rounded-xl border border-slate-500/50 bg-slate-950/40 overflow-hidden">
      <div className="border-b border-slate-500/40 px-3 py-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Activity log
        </p>
      </div>
      <div ref={scrollRef} className="max-h-44 overflow-y-auto px-3 py-2 space-y-2">
        {visible.map((log) => {
          const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
          return (
            <div key={log.id} className="animate-log-in flex gap-2 text-[12px] leading-snug">
              <span className={`shrink-0 font-mono text-[10px] font-semibold ${style.className}`}>
                [{style.label}]
              </span>
              <span className="text-slate-200">{log.message}</span>
            </div>
          );
        })}
        {isRunning ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-violet-300 animate-pulse-line">
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
      ? "bg-rose-400"
      : tone === "warn"
        ? "bg-amber-400"
        : tone === "neutral"
          ? "bg-slate-400"
          : "bg-emerald-400";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono font-semibold text-white">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-700/80">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
