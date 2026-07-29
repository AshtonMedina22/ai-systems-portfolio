"use client";

import React, { useMemo, useRef, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { MigrateOpsConsole } from "@/components/visualizers/MigrateOpsConsole";
import { Badge } from "@/components/ui/Badge";
import {
  DemoPrimaryButton,
  DetailList,
  ResultRow,
  ResultStrip,
  ScenarioList,
  ScenarioOption,
} from "@/components/ui/DemoControls";
import {
  SAMPLE_DATASETS,
  DEMO_TENANT_SCHEMA,
  type DatasetKey,
  type MappingChoice,
  type MappingTarget,
} from "@/lib/migrate/types";
import type { MappingPlaybook } from "@/lib/migrate/playbook";
import { MIGRATE_FRAMING } from "@/lib/migrate/runtime";
import { deriveMigrationKpis } from "@/lib/migrate/executive-summary";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LogEntry } from "@/components/ui/TerminalStream";
import { Upload } from "lucide-react";

const PRESETS: Array<{
  key: DatasetKey;
  label: string;
  detail: string;
  tone: "default" | "danger";
}> = [
  {
    key: "clean",
    label: SAMPLE_DATASETS.clean.label,
    detail: SAMPLE_DATASETS.clean.detail,
    tone: "default",
  },
  {
    key: "corrupted",
    label: SAMPLE_DATASETS.corrupted.label,
    detail: SAMPLE_DATASETS.corrupted.detail,
    tone: "danger",
  },
  {
    key: "reuse",
    label: SAMPLE_DATASETS.reuse.label,
    detail: SAMPLE_DATASETS.reuse.detail,
    tone: "default",
  },
];

const STATUS_BADGE: Record<
  ReturnType<typeof deriveMigrationKpis>["status"],
  BadgeTone
> = {
  pending: "neutral",
  ok: "ok",
  warnings: "warn",
  blocked: "danger",
};

type RowFixMap = Record<string, Partial<Record<MappingTarget, string>>>;

interface QuarantinePayload {
  rowNumber: number;
  reasons: string[];
  normalized?: Record<string, string>;
  remediableFields?: MappingTarget[];
}

function buildRemediationFixes(
  logs: LogEntry[],
  drafts: RowFixMap
): RowFixMap {
  const blocked = [...logs]
    .reverse()
    .find((log) => log.data?.action === "CUTOVER_BLOCKED");
  const rows = Array.isArray(blocked?.data?.quarantinedRows)
    ? (blocked?.data?.quarantinedRows as QuarantinePayload[])
    : [];
  const fixes: RowFixMap = { ...drafts };

  for (const row of rows) {
    const key = String(row.rowNumber);
    const next = { ...(fixes[key] ?? {}) };
    const fields =
      row.remediableFields && row.remediableFields.length > 0
        ? row.remediableFields
        : (["user_email", "start_date"] as MappingTarget[]);

    for (const field of fields) {
      if (next[field]) continue;
      if (field === "user_email") {
        next.user_email = `user${row.rowNumber - 1}@northstar.example`;
      } else if (field === "billing_email") {
        next.billing_email = `billing${row.rowNumber - 1}@northstar.example`;
      } else if (field === "start_date") {
        next.start_date = "2026-08-01";
      } else if (field === "status") {
        next.status = "active";
      } else if (field === "account_name") {
        next.account_name =
          row.normalized?.account_name || `Northstar Account ${row.rowNumber - 1}`;
      } else if (field === "account_id") {
        next.account_id =
          row.normalized?.account_id || `LEGACY-${row.rowNumber - 1}`;
      }
    }
    fixes[key] = next;
  }

  return fixes;
}

export default function MigratePage() {
  const [selected, setSelected] = useState<DatasetKey>("clean");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mappingOverrides, setMappingOverrides] = useState<
    Record<string, MappingChoice>
  >({});
  const [rowFixes, setRowFixes] = useState<RowFixMap>({});
  const [isRunning, setIsRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dataset = SAMPLE_DATASETS[selected];
  const kpis = useMemo(() => deriveMigrationKpis(logs), [logs]);
  const showImpact = logs.length > 0 || isRunning;
  const usingUpload = Boolean(csvText);
  const mappingRequired = logs.some(
    (log) => log.data?.action === "MAPPING_REQUIRED"
  );
  const cutoverBlocked = logs.some(
    (log) => log.data?.action === "CUTOVER_BLOCKED"
  );

  const handleSelect = (key: DatasetKey) => {
    setSelected(key);
    setCsvText(null);
    setUploadName(null);
    setLogs([]);
    setMappingOverrides({});
    setRowFixes({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setUploadName(file.name);
    setLogs([]);
    setMappingOverrides({});
    setRowFixes({});
  };

  const handleMappingChange = (
    sourceColumn: string,
    target: MappingChoice | ""
  ) => {
    setMappingOverrides((current) => {
      if (!target) {
        const next = { ...current };
        delete next[sourceColumn];
        return next;
      }
      return { ...current, [sourceColumn]: target };
    });
  };

  const handleApplyPlaybook = (playbook: MappingPlaybook) => {
    setMappingOverrides(playbook.mappings);
  };

  const handleRowFixChange = (
    rowNumber: number,
    field: MappingTarget,
    value: string
  ) => {
    setRowFixes((current) => ({
      ...current,
      [String(rowNumber)]: {
        ...(current[String(rowNumber)] ?? {}),
        [field]: value,
      },
    }));
  };

  const runPipeline = async (fixes: RowFixMap = rowFixes) => {
    setIsRunning(true);
    setLogs([]);

    try {
      const response = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          usingUpload
            ? {
                csvText,
                clientName: "Uploaded client",
                mappingOverrides,
                rowFixes: Object.keys(fixes).length > 0 ? fixes : undefined,
              }
            : {
                datasetKey: selected,
                mappingOverrides,
                rowFixes: Object.keys(fixes).length > 0 ? fixes : undefined,
              }
        ),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to /api/migrate stream.");
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
          if (trimmed.startsWith("data: ")) {
            try {
              const logEntry: LogEntry = JSON.parse(trimmed.substring(6));
              setLogs((prev) => [...prev, logEntry]);
            } catch (err) {
              console.error("Error parsing migrate SSE:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Migrate stream error:", err);
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          source: "client:migrate",
          message: "Connection lost or stream interrupted during migration.",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRun = () => {
    void runPipeline(rowFixes);
  };

  const handleRemediate = () => {
    const fixes = buildRemediationFixes(logs, rowFixes);
    setRowFixes(fixes);
    void runPipeline(fixes);
  };

  return (
    <main className="min-h-screen">
      <GlassBox
        title="Client Migration Pipeline"
        framing={MIGRATE_FRAMING}
        badge="Project 2"
        purpose="Reusable onboarding pipeline for mapping, validating, and loading account data without cross-tenant writes."
        challenge="Client exports arrive with different headers and formatting. Manual fixes slow onboarding, and partial imports can leave billing and user records out of sync."
        solution="A reusable import template pauses on ambiguous columns, lets an operator map or leave them out, normalizes every row, checks account-billing-user dependencies, and rejects the full batch when blocking errors remain. Quarantined fields can be remediated and revalidated before commit."
        impact="The operating model behind this demo supported 3,000+ customer onboardings and reduced implementation timelines by 30% through reusable mapping templates and playbooks."
        guardrails={{
          objective:
            "Standardize inbound client data to prevent messy CSVs from breaking schemas, contributing to a historical 30% reduction in onboarding time.",
          access:
            "Validates and stages data in isolated, client-specific schemas. Does not write directly to the multi-tenant production core until verified.",
          failure:
            "Row-level formatting errors reject the atomic batch, quarantining the inbound file so production data remains intact.",
        }}
        architecture="Next.js sends a preset or uploaded CSV to /api/migrate. A TypeScript engine parses actual rows, applies operator mappings or a saved playbook, normalizes and validates related entities, then streams mapping, quarantine, remediation, receipt, and atomic commit evidence over SSE."
        tradeoffs={[
          "The public demo performs real in-process parsing and validation but simulates the final database transaction.",
          "Strict reusable templates require upfront mapping decisions; that work prevents repeated manual cleanup on every onboarding.",
          "Production isolation would use tenant-scoped database credentials and a transaction around the full batch; the demo visualizes that boundary without claiming a live PostgreSQL write.",
        ]}
        stack="TypeScript, Next.js, SSE"
        isRunning={isRunning}
        controlLabel="Scenario"
        controlPanel={
          <div className="flex flex-col gap-6">
            <ScenarioList label="Pick a dataset">
              {PRESETS.map((preset) => (
                <ScenarioOption
                  key={preset.key}
                  label={preset.label}
                  detail={preset.detail}
                  active={!usingUpload && selected === preset.key}
                  onClick={() => handleSelect(preset.key)}
                  tone={preset.tone}
                />
              ))}
            </ScenarioList>

            <div>
              <p className="label-opal mb-3">Selected</p>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="truncate font-mono text-[12px] font-semibold text-opal-label">
                  {usingUpload ? uploadName : dataset.fileName}
                </span>
                <span className="shrink-0 font-mono text-[11px] font-semibold text-accent-deep">
                  {DEMO_TENANT_SCHEMA}
                </span>
              </div>
              <DetailList
                rows={[
                  {
                    label: "Client",
                    value: usingUpload ? "Uploaded client" : dataset.clientName,
                  },
                  {
                    label: "Rows",
                    value: usingUpload
                      ? "From upload"
                      : dataset.rowCount.toLocaleString(),
                  },
                  {
                    label: "Format",
                    value: (
                      <span
                        className={`font-mono text-xs ${
                          !usingUpload && selected === "corrupted"
                            ? "text-danger"
                            : ""
                        }`}
                      >
                        {usingUpload
                          ? "csv (upload)"
                          : dataset.sourceFormat.toUpperCase()}
                      </span>
                    ),
                  },
                ]}
              />
            </div>

            <div>
              <p className="label-opal mb-2">Optional upload</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="sr-only"
                id="migrate-csv-upload"
              />
              <label
                htmlFor="migrate-csv-upload"
                className={`flex cursor-pointer items-center gap-2.5 border-b border-dashed py-3 text-sm transition-colors ${
                  usingUpload
                    ? "border-accent text-opal-main"
                    : "border-line text-opal-muted hover:border-accent/50 hover:text-opal-main"
                }`}
              >
                <Upload className="h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0 truncate font-medium">
                  {usingUpload ? uploadName : "Choose a CSV file"}
                </span>
              </label>
            </div>

            {showImpact ? (
              <ResultStrip>
                <p className="label-opal mb-1">Result</p>
                <ResultRow
                  label="Status"
                  value={
                    <Badge tone={STATUS_BADGE[kpis.status]}>
                      {kpis.statusLabel}
                    </Badge>
                  }
                />
                <ResultRow
                  label="Rows"
                  value={
                    kpis.rowsProcessed != null
                      ? String(kpis.rowsProcessed)
                      : isRunning
                        ? "Working..."
                        : "-"
                  }
                />
                <ResultRow
                  label="Issues"
                  value={
                    kpis.issuesFound != null
                      ? String(kpis.issuesFound)
                      : isRunning
                        ? "Checking..."
                        : "-"
                  }
                />
              </ResultStrip>
            ) : null}

            <DemoPrimaryButton
              label={
                mappingRequired
                  ? "Apply mapping and validate"
                  : cutoverBlocked
                    ? "Re-run after remediating"
                    : "Analyze migration"
              }
              busyLabel="Running pipeline..."
              isRunning={isRunning}
              onClick={handleRun}
            />
          </div>
        }
        streamPanel={
          <MigrateOpsConsole
            logs={logs}
            isRunning={isRunning}
            liveLabel={MIGRATE_FRAMING}
            mappingOverrides={mappingOverrides}
            onMappingChange={handleMappingChange}
            onApplyPlaybook={handleApplyPlaybook}
            rowFixes={rowFixes}
            onRowFixChange={handleRowFixChange}
            onRemediate={cutoverBlocked ? handleRemediate : undefined}
            onClear={() => {
              setLogs([]);
              setRowFixes({});
            }}
          />
        }
      />
    </main>
  );
}
