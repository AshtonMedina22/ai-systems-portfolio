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
} from "@/lib/migrate/types";
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

export default function MigratePage() {
  const [selected, setSelected] = useState<DatasetKey>("clean");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dataset = SAMPLE_DATASETS[selected];
  const kpis = useMemo(() => deriveMigrationKpis(logs), [logs]);
  const showImpact = logs.length > 0 || isRunning;
  const usingUpload = Boolean(csvText);

  const handleSelect = (key: DatasetKey) => {
    setSelected(key);
    setCsvText(null);
    setUploadName(null);
    setLogs([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setUploadName(file.name);
    setLogs([]);
  };

  const handleRun = async () => {
    setIsRunning(true);
    setLogs([]);

    try {
      const response = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          usingUpload
            ? { csvText, clientName: "Mid-West Logistics" }
            : { datasetKey: selected }
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

  return (
    <div className="min-h-screen">
      <GlassBox
        title="Client Migration Pipeline"
        framing={MIGRATE_FRAMING}
        badge="Project 2"
        purpose="Onboarding walkthrough that cleans messy client spreadsheets into an isolated client schema."
        challenge="Messy client spreadsheets break schemas, delay go-live, and leave ops cleaning data by hand."
        solution="A migration walkthrough that validates types, fixes formatting issues, simulates an isolated client schema, and reports success or hold."
        impact="Turns messy client sheets into a controlled cutover path so onboarding does not stall on broken imports."
        architecture="UI picks a dataset or CSV. /api/migrate runs an in-process TypeScript engine and streams steps over SSE. Config scaffolding exists for a live ETL path - not wired on this site."
        tradeoffs={[
          "Mockup runtime on Vercel - fast, free, honest demo. Not a full ETL against a real database.",
          "Config scaffolding shows the production shape without pretending the site runs Pandas or Postgres.",
          "Simulated tenant schema proves the isolation idea; a live cutover would need real DB credentials and batch controls.",
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
                <span className="shrink-0 font-mono text-[11px] font-semibold text-opal-violet">
                  {DEMO_TENANT_SCHEMA}
                </span>
              </div>
              <DetailList
                rows={[
                  { label: "Client", value: "Mid-West Logistics" },
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
                        className={`font-mono text-[12px] ${
                          !usingUpload && selected === "corrupted"
                            ? "text-rose-700"
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
                    ? "border-opal-purple text-opal-main"
                    : "border-slate-300 text-opal-muted hover:border-violet-300 hover:text-opal-main"
                }`}
              >
                <Upload className="h-4 w-4 shrink-0 text-opal-purple" />
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
              label="Run migration"
              busyLabel="Running migration..."
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
            onClear={() => setLogs([])}
          />
        }
      />
    </div>
  );
}
