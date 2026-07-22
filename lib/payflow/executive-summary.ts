import type { LogEntry } from "@/components/ui/TerminalStream";

export type RiskTone = "pending" | "low" | "high" | "blocked";

export interface ExecutiveKpis {
  riskLevel: RiskTone;
  riskLabel: string;
  vendorConfidence: string | null;
  vendorName: string | null;
  actionLabel: string | null;
  timeSavedMinutes: number | null;
  statusLabel: string | null;
}

const EMPTY: ExecutiveKpis = {
  riskLevel: "pending",
  riskLabel: "Pending",
  vendorConfidence: null,
  vendorName: null,
  actionLabel: null,
  timeSavedMinutes: null,
  statusLabel: null,
};

/** Translate stream events into plain-language business KPIs. */
export function deriveExecutiveKpis(logs: LogEntry[]): ExecutiveKpis {
  if (logs.length === 0) return EMPTY;

  let vendorConfidence: string | null = null;
  let vendorName: string | null = null;
  let riskLevel: RiskTone = "pending";
  let riskLabel = "Checking...";
  let actionLabel: string | null = null;
  let timeSavedMinutes: number | null = null;
  let statusLabel: string | null = "In progress";

  for (const log of logs) {
    const data = log.data ?? {};

    if (data.status === "MATCH_FOUND") {
      const score = Number(data.confidenceScore ?? 0);
      vendorConfidence = `${Math.round(score * 100)}% match`;
      vendorName =
        typeof data.officialName === "string" ? data.officialName : null;
      if (riskLevel === "pending") {
        riskLevel = "low";
        riskLabel = "Low";
      }
    }

    if (data.status === "UNREGISTERED_ENTITY") {
      riskLevel = "blocked";
      riskLabel = "Blocked";
      vendorConfidence = "No registry match";
      actionLabel = "Payment blocked - unknown vendor";
      statusLabel = "Rejected";
      timeSavedMinutes = 8;
    }

    if (data.isMatch === true) {
      riskLevel = "low";
      riskLabel = "Low";
    }

    if (data.isMatch === false || data.riskLevel === "CRITICAL_FRAUD_ALERT") {
      riskLevel = "high";
      riskLabel = "High - needs review";
      actionLabel = "Payment held for review";
      statusLabel = "Held";
      timeSavedMinutes = 15;
    }

    if (data.action === "POST_TO_ERP_LEDGER" || log.level === "success") {
      riskLevel = "low";
      riskLabel = "Low";
      actionLabel = "Posted to the ledger";
      statusLabel = "Ready for payment";
      timeSavedMinutes = 12;
    }

    if (data.action === "ESCALATE_TO_COMPLIANCE") {
      riskLevel = "high";
      riskLabel = "High - needs review";
      actionLabel = "Payment held for review";
      statusLabel = "Held";
      timeSavedMinutes = 15;
    }
  }

  return {
    riskLevel,
    riskLabel,
    vendorConfidence,
    vendorName,
    actionLabel,
    timeSavedMinutes,
    statusLabel,
  };
}

export function resultBadgeForLog(log: LogEntry): {
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral" | "accent";
} | null {
  const data = log.data ?? {};

  if (log.level === "tool_call") {
    return { label: "Running", tone: "accent" };
  }

  if (data.status === "MATCH_FOUND") {
    return { label: "Pass", tone: "ok" };
  }
  if (data.status === "UNREGISTERED_ENTITY") {
    return { label: "Fail", tone: "danger" };
  }
  if (data.isMatch === true) {
    return { label: "Pass", tone: "ok" };
  }
  if (data.isMatch === false) {
    return { label: "Fail", tone: "danger" };
  }
  if (data.posted === true || data.action === "POST_TO_ERP_LEDGER") {
    return { label: "Posted", tone: "ok" };
  }
  if (data.action === "ESCALATE_TO_COMPLIANCE") {
    return { label: "Escalated", tone: "danger" };
  }

  // Migration pipeline events (shared terminal)
  if (data.action === "CUTOVER_COMPLETE") {
    return { label: "Written", tone: "ok" };
  }
  if (data.action === "CUTOVER_BLOCKED") {
    return { label: "Held", tone: "danger" };
  }
  if (data.status === "SCHEMA_OK" || data.status === "PK_OK") {
    return { label: "Pass", tone: "ok" };
  }
  if (data.status === "SANITIZED" || data.status === "ZIP_NORMALIZED") {
    return { label: "Fixed", tone: "warn" };
  }
  if (data.status === "TENANT_PROVISIONED" || data.status === "INGEST_OK") {
    return { label: "Ok", tone: "ok" };
  }

  if (log.level === "success") {
    return { label: "Pass", tone: "ok" };
  }
  if (log.level === "error") {
    return { label: "Blocked", tone: "danger" };
  }
  if (log.level === "warning") {
    return { label: "Alert", tone: "warn" };
  }

  return null;
}
