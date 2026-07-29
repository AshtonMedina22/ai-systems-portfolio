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
  liveLabel,
  onClear,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  liveLabel?: string;
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
    ? "Ready for migration"
    : isRunning
      ? "Migration running"
      : state.cutover === "blocked"
        ? "Cutover held"
        : state.cutover === "ok"
          ? "Cutover complete"
          : "Pipeline finished";

  return (
    <DemoPanelTabs
      liveLabel={liveLabel}
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
          <div className="console-panel px-3.5 py-3">
            <p className="label-console">Migration progress</p>
            <p className="mt-1 text-sm text-opal-muted">
              Mid-West Logistics onboarding into{" "}
              <span className="font-mono text-accent-deep">
                {state.tenantSchema ?? DEMO_TENANT_SCHEMA}
              </span>{" "}
              (simulated tenant space)
            </p>
          </div>

          <div className="console-panel p-4">
            <p className="label-console">Row progress</p>
            <p className="mt-2 font-display text-2xl font-semibold text-opal-main">
              Processing row{" "}
              <span className="text-accent">
                {idle ? "0" : displayRow.toLocaleString()}
              </span>
              {" of "}
              {(state.totalRows ?? 1420).toLocaleString()}
              ...
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
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
              <p className="mt-2 text-sm text-opal-muted">
                Hit Run migration on the left to start the row counter and
                health tiles.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-ok/20 bg-ok-soft px-3 py-3 text-center">
              <p className="font-display text-xl font-semibold text-ok">
                {idle ? "-" : state.valid.toLocaleString()}
              </p>
              <p className="mt-1 text-xs leading-snug text-opal-muted">
                Valid records
              </p>
            </div>
            <div className="rounded-xl border border-warn/20 bg-warn-soft px-3 py-3 text-center">
              <p className="font-display text-xl font-semibold text-warn">
                {idle ? "-" : state.autoSanitized.toLocaleString()}
              </p>
              <p className="mt-1 text-xs leading-snug text-opal-muted">
                Auto-sanitized schema warnings
              </p>
            </div>
            <div className="console-panel px-3 py-3 text-center">
              <p className="break-all font-display text-sm font-semibold leading-tight text-opal-main">
                {state.tenantSchema ?? kpis.tenantSchema ?? DEMO_TENANT_SCHEMA}
              </p>
              <p className="mt-1 text-xs leading-snug text-opal-muted">
                Tenant schema
              </p>
            </div>
          </div>

          {state.cutover === "ok" ? (
            <div className="rounded-xl border border-ok/25 bg-ok-soft px-3.5 py-3 text-sm text-ok">
              {state.valid.toLocaleString()} records written to isolated schema{" "}
              <span className="font-mono font-semibold">
                {state.tenantSchema ?? DEMO_TENANT_SCHEMA}
              </span>
              {state.autoSanitized > 0
                ? ` with ${state.autoSanitized} auto-sanitized warnings.`
                : "."}
            </div>
          ) : null}

          {state.cutover === "blocked" ? (
            <div className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger">
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
            <div className="console-panel px-3 py-3">
              <p className="label-console">Activity log</p>
              <p className="mt-2 text-sm text-opal-muted">
                Color-coded [INFO] / [WARN] / [OK] events will stream here while
                the migration runs.
              </p>
            </div>
          ) : null}
        </OpsConsoleShell>
      }
    />
  );
}
