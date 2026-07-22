import type { LogEntry } from "@/components/ui/TerminalStream";
import {
  DatasetKey,
  DatasetProfile,
  SAMPLE_DATASETS,
  TARGET_SCHEMA,
} from "./types";

export type MigrationStatus =
  | "pending"
  | "ok"
  | "warnings"
  | "blocked";

export interface MigrationKpis {
  status: MigrationStatus;
  statusLabel: string;
  rowsProcessed: number | null;
  issuesFound: number | null;
  actionLabel: string | null;
  tenantSchema: string | null;
}

const EMPTY: MigrationKpis = {
  status: "pending",
  statusLabel: "Pending",
  rowsProcessed: null,
  issuesFound: null,
  actionLabel: null,
  tenantSchema: null,
};

/** Plain-language KPIs for the left panel from stream events. */
export function deriveMigrationKpis(logs: LogEntry[]): MigrationKpis {
  if (logs.length === 0) return EMPTY;

  let status: MigrationStatus = "pending";
  let statusLabel = "Running...";
  let rowsProcessed: number | null = null;
  let issuesFound: number | null = null;
  let actionLabel: string | null = null;
  let tenantSchema: string | null = null;

  for (const log of logs) {
    const data = log.data ?? {};

    if (typeof data.rowCount === "number") {
      rowsProcessed = data.rowCount;
    }
    if (typeof data.issueCount === "number") {
      issuesFound = data.issueCount;
    }
    if (typeof data.tenantSchema === "string") {
      tenantSchema = data.tenantSchema;
    }

    if (data.action === "CUTOVER_COMPLETE") {
      status = issuesFound && issuesFound > 0 ? "warnings" : "ok";
      statusLabel = status === "warnings" ? "Cut over with fixes" : "Cut over";
      actionLabel = "Wrote into isolated tenant schema";
    }

    if (data.action === "CUTOVER_BLOCKED") {
      status = "blocked";
      statusLabel = "Held for cleanup";
      actionLabel = "Cutover paused - fix flagged rows first";
    }

    if (data.status === "SANITIZED" && status === "pending") {
      status = "warnings";
      statusLabel = "Cleaning fields...";
    }
  }

  if (status === "pending" && logs.some((l) => l.level === "success")) {
    status = "ok";
    statusLabel = "Cut over";
  }

  return {
    status,
    statusLabel,
    rowsProcessed,
    issuesFound,
    actionLabel,
    tenantSchema,
  };
}

/** Extend terminal badges for migrate stream events. */
export function migrateResultBadgeForLog(log: LogEntry): {
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral" | "accent";
} | null {
  const data = log.data ?? {};

  if (log.level === "tool_call") {
    return { label: "Running", tone: "accent" };
  }
  if (data.action === "CUTOVER_COMPLETE") {
    return { label: "Written", tone: "ok" };
  }
  if (data.action === "CUTOVER_BLOCKED") {
    return { label: "Held", tone: "danger" };
  }
  if (data.status === "SCHEMA_OK" || data.status === "PK_OK") {
    return { label: "Pass", tone: "ok" };
  }
  if (data.status === "SCHEMA_ISSUES" || data.status === "SANITIZED") {
    return { label: "Fixed", tone: "warn" };
  }
  if (data.status === "ZIP_NORMALIZED") {
    return { label: "Normalized", tone: "warn" };
  }
  if (log.level === "success") {
    return { label: "Done", tone: "ok" };
  }
  if (log.level === "error") {
    return { label: "Blocked", tone: "danger" };
  }
  if (log.level === "warning") {
    return { label: "Warning", tone: "warn" };
  }
  return null;
}

export { SAMPLE_DATASETS, TARGET_SCHEMA };
export type { DatasetKey, DatasetProfile };
