"use client";

import React, { useMemo, useRef, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { MigrateOpsConsole } from "@/components/visualizers/MigrateOpsConsole";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import {
  SAMPLE_DATASETS,
  DEMO_TENANT_SCHEMA,
  type DatasetKey,
} from "@/lib/migrate/types";
import { deriveMigrationKpis } from "@/lib/migrate/executive-summary";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LogEntry } from "@/components/ui/TerminalStream";
import {
  ArrowRight,
  ChevronDown,
  Database,
  FileWarning,
  Upload,
} from "lucide-react";

const PRESETS: Array<{
  key: DatasetKey;
  label: string;
  detail: string;
  icon: React.ReactNode;
  activeClass: string;
}> = [
  {
    key: "clean",
    label: SAMPLE_DATASETS.clean.label,
    detail: SAMPLE_DATASETS.clean.detail,
    icon: <Database className="h-4 w-4 text-emerald-700" />,
    activeClass:
      "border-violet-400 bg-violet-50 text-opal-main shadow-sm ring-1 ring-violet-200",
  },
  {
    key: "corrupted",
    label: SAMPLE_DATASETS.corrupted.label,
    detail: SAMPLE_DATASETS.corrupted.detail,
    icon: <FileWarning className="h-4 w-4 text-rose-700" />,
    activeClass:
      "border-rose-300 bg-rose-50 text-opal-main shadow-sm ring-1 ring-rose-200",
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

function HowThisWorks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card-opal rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-opal-main">
          What this is (in plain English)
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-opal-label transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-slate-300 px-4 py-3.5 text-sm leading-relaxed text-opal-muted space-y-3">
          <p>
            When companies onboard hundreds or thousands of new clients,
            migrating old spreadsheets, messy data dumps, and legacy records
            into a new platform is a real administrative headache - delays,
            formatting errors, and sync mistakes that drag on for weeks.
          </p>
          <p>
            This demo takes a raw customer data file (like a CSV with
            inconsistent formatting or missing fields), cleans and validates
            it, sorts it into an isolated database partition for that client (
            {DEMO_TENANT_SCHEMA}), and shows a clear success or hold report.
            The right panel streams each step. Same kind of work as large
            multi-site SaaS onboarding and schema migrations.
          </p>
        </div>
      ) : null}
    </div>
  );
}

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
        title="Client Migration & Onboarding Pipeline"
        badge="Project 2 - Multi-tenant client onboarding"
        description="Automates bringing new clients onto a software platform. Takes messy legacy spreadsheets, cleans up formatting errors, validates data types, and safely organizes everything into secure, isolated database partitions."
        headerExtra={<HowThisWorks />}
        isRunning={isRunning}
        controlLabel="Try it"
        controlHint="Pick a dataset"
        controlPanel={
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label="Cutover status"
                value={
                  <Badge tone={STATUS_BADGE[kpis.status]}>
                    {kpis.statusLabel}
                  </Badge>
                }
              />
              <StatCard
                label="Rows processed"
                value={
                  kpis.rowsProcessed != null
                    ? String(kpis.rowsProcessed)
                    : isRunning
                      ? "Working..."
                      : "-"
                }
              />
              <StatCard
                label="Issues logged"
                value={
                  kpis.issuesFound != null
                    ? String(kpis.issuesFound)
                    : isRunning
                      ? "Checking..."
                      : "-"
                }
                hint={kpis.tenantSchema ?? undefined}
              />
            </div>

            <div>
              <label className="label-opal mb-2.5 block">Pick a dataset</label>
              <div className="grid grid-cols-1 gap-2.5">
                {PRESETS.map((preset) => {
                  const active = !usingUpload && selected === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleSelect(preset.key)}
                      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-all ${
                        active
                          ? preset.activeClass
                          : "border-slate-300 bg-white text-opal-muted hover:border-violet-300 hover:bg-violet-50/40"
                      }`}
                    >
                      <span className="mt-0.5">{preset.icon}</span>
                      <span>
                        <span className="block text-sm font-semibold text-opal-main">
                          {preset.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-opal-muted">
                          {preset.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-opal-label">
                  <Database className="h-3.5 w-3.5 text-opal-purple" />
                  {usingUpload ? uploadName : dataset.fileName}
                </span>
                <span className="font-mono text-[12px] font-semibold text-opal-violet">
                  {DEMO_TENANT_SCHEMA}
                </span>
              </div>
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-opal-label">Client</dt>
                  <dd className="text-right font-medium text-opal-main">
                    Mid-West Logistics
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-opal-label">Rows</dt>
                  <dd className="font-medium text-opal-main">
                    {usingUpload
                      ? "From upload"
                      : dataset.rowCount.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-opal-label">Format</dt>
                  <dd
                    className={`font-mono text-[12px] font-semibold ${
                      !usingUpload && selected === "corrupted"
                        ? "text-rose-700"
                        : "text-opal-main"
                    }`}
                  >
                    {usingUpload
                      ? "csv (upload)"
                      : dataset.sourceFormat.toUpperCase()}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <label className="label-opal mb-2.5 block">
                Or upload a CSV (optional)
              </label>
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
                className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3.5 py-3.5 text-left transition-colors ${
                  usingUpload
                    ? "border-violet-400 bg-violet-50 text-opal-main ring-1 ring-violet-200"
                    : "border-slate-300 bg-white text-opal-muted hover:border-violet-300 hover:bg-violet-50/40"
                }`}
              >
                <Upload className="h-4 w-4 shrink-0 text-opal-purple" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-opal-main">
                    {usingUpload ? uploadName : "Choose a CSV file"}
                  </span>
                  <span className="block text-xs text-opal-muted mt-1">
                    Headers are mapped the same way as the presets
                  </span>
                </span>
              </label>
            </div>

            {showImpact ? (
              <div className="rounded-xl border border-slate-300 bg-violet-50/50 px-4 py-3.5 space-y-3">
                <p className="label-opal">What happened</p>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Status</span>
                  <Badge tone={STATUS_BADGE[kpis.status]}>
                    {kpis.statusLabel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Tenant</span>
                  <span className="font-mono text-xs font-semibold text-opal-main">
                    {kpis.tenantSchema ?? (isRunning ? "Provisioning..." : "-")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Result</span>
                  <span className="text-right font-semibold text-opal-main">
                    {kpis.actionLabel ?? (isRunning ? "In progress" : "-")}
                  </span>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning}
              className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-opal-purple px-4 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-opal-violet disabled:opacity-50"
            >
              <span>{isRunning ? "Running migration..." : "Run migration"}</span>
              {!isRunning ? (
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              ) : null}
            </button>
          </div>
        }
        streamPanel={
          <MigrateOpsConsole
            logs={logs}
            isRunning={isRunning}
            onClear={() => setLogs([])}
          />
        }
      />
    </div>
  );
}
