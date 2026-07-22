"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CompactEventLog,
  OpsConsoleShell,
} from "@/components/ui/OpsConsole";
import { DemoPanelTabs } from "@/components/ui/CodeViewer";
import type { LogEntry } from "@/components/ui/TerminalStream";
import { deriveMigrationKpis } from "@/lib/migrate/executive-summary";
import { MIGRATE_SOURCE_FILES } from "@/lib/portfolio/source-excerpts";
import { DEMO_TENANT_SCHEMA } from "@/lib/migrate/types";

function deriveMigrateConsole(logs: LogEntry[]) {
  let totalRows: number | null = null;
  let autoSanitized = 0;
  let validRecords: number | null = null;
  let tenantSchema: string | null = null;
  let cutover: "none" | "ok" | "blocked" = "none";

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.rowCount === "number") totalRows = data.rowCount;
    if (typeof data.autoSanitized === "number") {
      autoSanitized = data.autoSanitized;
    } else if (typeof data.issueCount === "number") {
      autoSanitized = data.issueCount;
    }
    if (typeof data.validRecords === "number") {
      validRecords = data.validRecords;
    }
    if (typeof data.tenantSchema === "string") tenantSchema = data.tenantSchema;
    if (data.action === "CUTOVER_COMPLETE") cutover = "ok";
    if (data.action === "CUTOVER_BLOCKED") cutover = "blocked";
  }

  const total = totalRows ?? 0;
  const valid =
    validRecords != null ? validRecords : Math.max(0, total - autoSanitized);

  return {
    totalRows,
    autoSanitized,
    tenantSchema,
    cutover,
    valid,
  };
}

export function MigrateOpsConsole({
  logs,
  isRunning,
  onClear,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  onClear?: () => void;
}) {
  const kpis = useMemo(() => deriveMigrationKpis(logs), [logs]);
  const state = useMemo(() => deriveMigrateConsole(logs), [logs]);
  const [displayRow, setDisplayRow] = useState(0);

  const idle = logs.length === 0 && !isRunning;

  useEffect(() => {
    if (idle) {
      setDisplayRow(0);
      return;
    }
    if (!state.totalRows) return;

    if (state.cutover !== "none" || !isRunning) {
      setDisplayRow(state.totalRows);
      return;
    }

    let current = 0;
    setDisplayRow(0);
    const step = Math.max(24, Math.ceil(state.totalRows / 28));
    const id = window.setInterval(() => {
      current = Math.min(state.totalRows!, current + step);
      setDisplayRow(current);
      if (current >= state.totalRows!) window.clearInterval(id);
    }, 90);
    return () => window.clearInterval(id);
  }, [idle, isRunning, state.totalRows, state.cutover, logs.length]);

  const statusTone =
    idle || isRunning
      ? "live"
      : state.cutover === "blocked"
        ? "danger"
        : state.cutover === "ok"
          ? state.autoSanitized > 0
            ? "warn"
            : "ok"
          : "warn";

  const statusLabel = idle
    ? "Live - ready for migration"
    : isRunning
      ? "Live - ETL running"
      : state.cutover === "blocked"
        ? "Cutover held"
        : state.cutover === "ok"
          ? "Cutover complete"
          : "Pipeline finished";

  return (
    <DemoPanelTabs
      sourceFiles={MIGRATE_SOURCE_FILES}
      live={
        <OpsConsoleShell
          title="Operations console"
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRunning={idle || isRunning}
          eventCount={logs.length}
          onClear={onClear}
        >
          <div className="rounded-xl border border-slate-500/50 bg-slate-950/35 px-3.5 py-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Live ETL progress and health
            </p>
            <p className="mt-1 text-[13px] text-slate-300">
              Mid-West Logistics onboarding into{" "}
              <span className="font-mono text-violet-300">
                {state.tenantSchema ?? DEMO_TENANT_SCHEMA}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-500/50 bg-slate-950/35 p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Row progress
            </p>
            <p className="mt-2 font-display text-2xl text-white">
              Processing row{" "}
              <span className="text-violet-300">
                {idle ? "0" : displayRow.toLocaleString()}
              </span>
              {" of "}
              {(state.totalRows ?? 1420).toLocaleString()}
              ...
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700/80">
              <div
                className="h-full rounded-full bg-violet-400 transition-[width] duration-200"
                style={{
                  width: idle
                    ? "0%"
                    : `${Math.min(
                        100,
                        (displayRow / (state.totalRows ?? 1420)) * 100
                      )}%`,
                }}
              />
            </div>
            {idle ? (
              <p className="mt-2 text-[12px] text-slate-400">
                Hit Run migration on the left to start the live row counter and
                health tiles.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-3 py-3 text-center">
              <p className="font-display text-xl text-emerald-300">
                {idle ? "-" : state.valid.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-300">
                Valid records
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-3 text-center">
              <p className="font-display text-xl text-amber-300">
                {idle ? "-" : state.autoSanitized.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-300">
                Auto-sanitized schema warnings
              </p>
            </div>
            <div className="rounded-xl border border-slate-500/40 bg-slate-950/35 px-3 py-3 text-center">
              <p className="font-display text-sm leading-tight text-slate-100 break-all">
                {state.tenantSchema ?? kpis.tenantSchema ?? DEMO_TENANT_SCHEMA}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-300">
                Tenant schema
              </p>
            </div>
          </div>

          {state.cutover === "ok" ? (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/30 px-3.5 py-3 text-[13px] text-emerald-100">
              {state.valid.toLocaleString()} records written to isolated schema{" "}
              <span className="font-mono text-emerald-200">
                {state.tenantSchema ?? DEMO_TENANT_SCHEMA}
              </span>
              {state.autoSanitized > 0
                ? ` with ${state.autoSanitized} auto-sanitized warnings.`
                : "."}
            </div>
          ) : null}

          {state.cutover === "blocked" ? (
            <div className="rounded-xl border border-rose-400/40 bg-rose-950/30 px-3.5 py-3 text-[13px] text-rose-100">
              Cutover held after sanitization -{" "}
              {state.autoSanitized.toLocaleString()} schema warnings still need
              cleanup before writing to production tenant space.
            </div>
          ) : null}

          <CompactEventLog
            logs={logs}
            isRunning={isRunning}
            maxVisible={12}
          />
          {idle ? (
            <div className="rounded-xl border border-slate-500/50 bg-slate-950/40 px-3 py-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Activity log
              </p>
              <p className="mt-2 text-[12px] text-slate-500">
                Color-coded [INFO] / [WARN] / [OK] events will stream here while
                the ETL runs.
              </p>
            </div>
          ) : null}
        </OpsConsoleShell>
      }
    />
  );
}
