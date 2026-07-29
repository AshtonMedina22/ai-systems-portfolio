"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CompactEventLog,
  OpsConsoleShell,
  ProgressBar,
} from "@/components/ui/OpsConsole";
import { DemoPanelTabs } from "@/components/ui/CodeViewer";
import type { LogEntry } from "@/components/ui/TerminalStream";
import { MIGRATE_SOURCE_FILES } from "@/lib/portfolio/source-excerpts";
import {
  loadPlaybook,
  playbookMatches,
  savePlaybook,
  type MappingPlaybook,
} from "@/lib/migrate/playbook";
import {
  DEMO_TENANT_SCHEMA,
  NEIGHBOR_TENANT_SCHEMA,
  TARGET_FIELDS,
  type CanonicalAccount,
  type EntityHealth,
  type MappingChoice,
  type MappingTarget,
  type MigrationReceipt,
  type RawMigrationRow,
} from "@/lib/migrate/types";

interface BeforeAfterPreview {
  rowNumber: number;
  raw: RawMigrationRow;
  normalized: CanonicalAccount;
  changes: MappingTarget[];
}

interface QuarantinePreview {
  rowNumber: number;
  accountId: string;
  reasons: string[];
  normalized?: CanonicalAccount;
  remediableFields?: MappingTarget[];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function deriveConsole(logs: LogEntry[]) {
  let rowCount = 0;
  let validRecords = 0;
  let issueCount = 0;
  let normalizationCount = 0;
  let committedRows = 0;
  let neighborTenantWrites = 0;
  let mapping: Record<string, MappingTarget> = {};
  let unresolvedColumns: string[] = [];
  let sourceColumns: string[] = [];
  let beforeAfter: BeforeAfterPreview[] = [];
  let quarantinedRows: QuarantinePreview[] = [];
  let entityHealth: EntityHealth | null = null;
  let receipt: MigrationReceipt | null = null;
  let cutover: "none" | "mapping" | "blocked" | "committed" = "none";

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.rowCount === "number") rowCount = data.rowCount;
    if (typeof data.validRecords === "number") validRecords = data.validRecords;
    if (typeof data.issueCount === "number") issueCount = data.issueCount;
    if (typeof data.normalizationCount === "number") {
      normalizationCount = data.normalizationCount;
    }
    if (typeof data.committedRows === "number") committedRows = data.committedRows;
    if (typeof data.neighborTenantWrites === "number") {
      neighborTenantWrites = data.neighborTenantWrites;
    }

    const eventMapping = recordValue(data.mapping);
    if (eventMapping) {
      mapping = Object.fromEntries(
        Object.entries(eventMapping).filter(
          (entry): entry is [string, MappingTarget] =>
            typeof entry[1] === "string" &&
            TARGET_FIELDS.some((field) => field.key === entry[1])
        )
      );
    }

    const unresolved = stringArray(data.unresolvedColumns);
    if (unresolved.length > 0) unresolvedColumns = unresolved;
    const columns = stringArray(data.sourceColumns);
    if (columns.length > 0) sourceColumns = columns;

    if (Array.isArray(data.beforeAfter)) {
      beforeAfter = data.beforeAfter as BeforeAfterPreview[];
    }
    if (Array.isArray(data.quarantinedRows)) {
      quarantinedRows = data.quarantinedRows as QuarantinePreview[];
    }

    const health = recordValue(data.entityHealth);
    if (health) entityHealth = health as unknown as EntityHealth;

    const eventReceipt = recordValue(data.receipt);
    if (eventReceipt) receipt = eventReceipt as unknown as MigrationReceipt;

    if (data.action === "MAPPING_REQUIRED") cutover = "mapping";
    if (data.action === "CUTOVER_BLOCKED") cutover = "blocked";
    if (data.action === "CUTOVER_COMPLETE") cutover = "committed";
  }

  return {
    rowCount,
    validRecords,
    issueCount,
    normalizationCount,
    committedRows,
    neighborTenantWrites,
    mapping,
    unresolvedColumns,
    sourceColumns,
    beforeAfter,
    quarantinedRows,
    entityHealth,
    receipt,
    cutover,
  };
}

function PreviewValues({
  values,
  changedFields = [],
}: {
  values: object;
  changedFields?: string[];
}) {
  return (
    <dl className="space-y-1.5">
      {Object.entries(values)
        .slice(0, 6)
        .map(([key, value]) => (
          <div
            key={key}
            className={`grid grid-cols-[minmax(90px,0.8fr)_minmax(0,1.2fr)] gap-2 rounded-md px-2 py-1.5 ${
              changedFields.includes(key) ? "bg-warn-soft" : "bg-console-panel"
            }`}
          >
            <dt className="truncate font-mono text-[10px] text-opal-label">
              {key}
            </dt>
            <dd className="truncate font-mono text-[11px] font-medium text-opal-main">
              {String(value || "(blank)")}
            </dd>
          </div>
        ))}
    </dl>
  );
}

function EntityHealthPanel({ health }: { health: EntityHealth }) {
  const buckets = [
    { key: "accounts", label: "Accounts", value: health.accounts },
    { key: "billing", label: "Billing", value: health.billing },
    { key: "users", label: "Users", value: health.users },
  ] as const;

  return (
    <section className="console-panel p-4" aria-label="Entity dependency check">
      <div className="mb-3">
        <p className="label-console">Multi-entity dependency check</p>
        <p className="mt-1 text-sm text-opal-muted">
          Accounts, billing contacts, and primary users must stay consistent
          before commit. Failed parents block dependent records.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="rounded-lg border border-console-border bg-console-panel px-3 py-2.5"
          >
            <p className="text-xs text-opal-muted">{bucket.label}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-opal-main">
              {bucket.value.valid.toLocaleString()} ok
            </p>
            <p
              className={`mt-0.5 font-mono text-xs ${
                bucket.value.failed > 0 ? "text-danger" : "text-ok"
              }`}
            >
              {bucket.value.failed.toLocaleString()} failed
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-xs text-opal-muted">
        Dependency breaks: {health.dependencyBreaks.toLocaleString()}
      </p>
    </section>
  );
}

function MigrationReceiptCard({ receipt }: { receipt: MigrationReceipt }) {
  const mappingEntries = Object.entries(receipt.mapping);
  return (
    <section
      className="rounded-xl border border-accent/25 bg-accent-soft p-4"
      aria-label="Migration receipt"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-accent-deep">
            Migration receipt
          </p>
          <p className="mt-1 text-xs leading-relaxed text-opal-muted">
            Final artifact for this run - mappings, norms, rejects, transaction,
            and tenant boundary.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold text-white ${
            receipt.transaction === "committed"
              ? "bg-ok"
              : receipt.transaction === "rolled_back"
                ? "bg-danger"
                : "bg-warn"
          }`}
        >
          {receipt.transaction}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          ["File", receipt.fileName],
          ["Client", receipt.clientName],
          ["Normalized fields", String(receipt.normalizationCount)],
          ["Quarantined", String(receipt.quarantinedCount)],
          ["Committed", String(receipt.committedRows)],
          ["Neighbor writes", String(receipt.neighborTenantWrites)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-console-border bg-white/70 px-3 py-2"
          >
            <dt className="text-[10px] uppercase tracking-wide text-opal-label">
              {label}
            </dt>
            <dd className="mt-0.5 truncate font-mono text-xs font-semibold text-opal-main">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <p className="mb-2 text-xs font-semibold text-opal-main">
          Applied mappings ({mappingEntries.length})
        </p>
        <div className="max-h-28 space-y-1 overflow-y-auto">
          {mappingEntries.map(([source, target]) => (
            <p
              key={source}
              className="truncate font-mono text-[11px] text-opal-muted"
            >
              {source} -&gt; {target}
            </p>
          ))}
        </div>
      </div>
      <p className="mt-3 break-all font-mono text-[11px] text-opal-muted">
        {receipt.tenantSchema} | neighbor {receipt.neighborTenant}
      </p>
    </section>
  );
}

export function MigrateOpsConsole({
  logs,
  isRunning,
  liveLabel,
  mappingOverrides,
  onMappingChange,
  onApplyPlaybook,
  onClear,
  rowFixes,
  onRowFixChange,
  onRemediate,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  liveLabel?: string;
  mappingOverrides: Record<string, MappingChoice>;
  onMappingChange: (sourceColumn: string, target: MappingChoice | "") => void;
  onApplyPlaybook?: (playbook: MappingPlaybook) => void;
  onClear?: () => void;
  rowFixes: Record<string, Partial<Record<MappingTarget, string>>>;
  onRowFixChange: (
    rowNumber: number,
    field: MappingTarget,
    value: string
  ) => void;
  onRemediate?: () => void;
}) {
  const state = useMemo(() => deriveConsole(logs), [logs]);
  const [playbook, setPlaybook] = useState<MappingPlaybook | null>(null);
  const [playbookNotice, setPlaybookNotice] = useState<string | null>(null);

  useEffect(() => {
    setPlaybook(loadPlaybook());
  }, []);

  const idle = logs.length === 0 && !isRunning;
  const preview = state.beforeAfter[0];
  const mappedColumns = Object.entries(state.mapping);
  const resolvedMappingCount =
    mappedColumns.length +
    state.unresolvedColumns.filter((column) => mappingOverrides[column]).length;
  const mappingTotal = mappedColumns.length + state.unresolvedColumns.length;
  const mappingPercent =
    mappingTotal === 0 ? 0 : Math.round((resolvedMappingCount / mappingTotal) * 100);

  const mappingComplete =
    state.unresolvedColumns.length === 0 && mappedColumns.length > 0;
  const canSavePlaybook =
    mappingComplete &&
    (state.sourceColumns.length > 0 || mappedColumns.length > 0);
  const playbookCompatible = playbookMatches(
    playbook,
    state.sourceColumns.length > 0
      ? state.sourceColumns
      : Object.keys(state.mapping)
  );

  const statusTone =
    state.cutover === "blocked"
      ? "danger"
      : state.cutover === "mapping"
        ? "warn"
        : state.cutover === "committed"
          ? "ok"
          : "live";
  const statusLabel = idle
    ? "Ready for analysis"
    : isRunning
      ? "Pipeline running"
      : state.cutover === "mapping"
        ? "Mapping decision required"
        : state.cutover === "blocked"
          ? "Atomic commit rejected"
          : state.cutover === "committed"
            ? "Atomic commit complete"
            : "Analysis complete";

  const handleSavePlaybook = () => {
    const columns =
      state.sourceColumns.length > 0
        ? state.sourceColumns
        : Object.keys(state.mapping);
    const mappings: Record<string, MappingChoice> = {
      ...state.mapping,
      ...mappingOverrides,
    };
    const next: MappingPlaybook = {
      name: "Northstar legacy headers",
      sourceSignature: columns,
      mappings,
      savedAt: new Date().toISOString(),
    };
    savePlaybook(next);
    setPlaybook(next);
    setPlaybookNotice("Saved mapping playbook for matching header sets.");
  };

  return (
    <DemoPanelTabs
      liveLabel={liveLabel}
      sourceFiles={MIGRATE_SOURCE_FILES}
      live={
        <OpsConsoleShell
          title="Migration control room"
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRunning={idle || isRunning}
          eventCount={logs.length}
          onClear={onClear}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="console-panel px-3 py-3">
              <p className="label-console">Rows analyzed</p>
              <p className="mt-1 font-display text-xl font-semibold text-opal-main">
                {idle ? "-" : state.rowCount.toLocaleString()}
              </p>
            </div>
            <div className="console-panel px-3 py-3">
              <p className="label-console">Fields normalized</p>
              <p className="mt-1 font-display text-xl font-semibold text-warn">
                {idle ? "-" : state.normalizationCount.toLocaleString()}
              </p>
            </div>
            <div className="console-panel px-3 py-3">
              <p className="label-console">Rows committed</p>
              <p
                className={`mt-1 font-display text-xl font-semibold ${
                  state.cutover === "blocked" ? "text-danger" : "text-ok"
                }`}
              >
                {idle ? "-" : state.committedRows.toLocaleString()}
              </p>
            </div>
          </div>

          {(mappedColumns.length > 0 || state.unresolvedColumns.length > 0) && (
            <section className="console-panel p-4" aria-label="Schema mapper">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="label-console">Reusable schema mapper</p>
                  <p className="mt-1 text-sm text-opal-muted">
                    Source headers are matched to the account import template.
                    Unknown columns require an operator decision.
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold text-accent-deep">
                  {resolvedMappingCount}/{mappingTotal}
                </span>
              </div>
              <ProgressBar
                value={mappingPercent}
                label="Mapping decisions complete"
                tone={mappingPercent === 100 ? "ok" : "warn"}
              />

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {mappedColumns.map(([source, target]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between gap-3 rounded-lg border border-console-border bg-console-panel px-3 py-2"
                  >
                    <span className="truncate font-mono text-[11px] text-opal-muted">
                      {source}
                    </span>
                    <span className="text-opal-mist">-&gt;</span>
                    <span className="truncate font-mono text-[11px] font-semibold text-opal-main">
                      {target}
                    </span>
                  </div>
                ))}
              </div>

              {state.unresolvedColumns.length > 0 ? (
                <div className="mt-4 rounded-xl border border-warn/25 bg-warn-soft p-3.5">
                  <p className="text-sm font-semibold text-warn">
                    Resolve ambiguous columns
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {state.unresolvedColumns.map((column) => (
                      <label key={column} className="block">
                        <span className="mb-1.5 block font-mono text-[11px] font-semibold text-opal-main">
                          {column}
                        </span>
                        <select
                          aria-label={`Map ${column}`}
                          value={mappingOverrides[column] ?? ""}
                          onChange={(event) =>
                            onMappingChange(
                              column,
                              event.target.value as MappingChoice | ""
                            )
                          }
                          className="h-9 w-full rounded-lg border border-line bg-white px-2.5 text-xs text-opal-main outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        >
                          <option value="">Choose destination...</option>
                          {TARGET_FIELDS.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                          <option value="leave_out">Leave out</option>
                        </select>
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-opal-muted">
                    Choose a destination or leave the source column out, then run
                    the pipeline again.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {canSavePlaybook ? (
                  <button
                    type="button"
                    onClick={handleSavePlaybook}
                    className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-deep transition hover:border-accent"
                  >
                    Save mapping playbook
                  </button>
                ) : null}
                {playbook && playbookCompatible && onApplyPlaybook ? (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyPlaybook(playbook);
                      setPlaybookNotice(
                        `Applied playbook "${playbook.name}" to this file.`
                      );
                    }}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-opal-main transition hover:border-accent/40"
                  >
                    Apply saved playbook
                  </button>
                ) : null}
                {playbook && !playbookCompatible ? (
                  <span className="text-xs text-opal-muted">
                    Saved playbook headers do not match this file.
                  </span>
                ) : null}
              </div>
              {playbookNotice ? (
                <p className="mt-2 text-xs text-ok">{playbookNotice}</p>
              ) : null}
            </section>
          )}

          {preview ? (
            <section className="console-panel p-4" aria-label="Before and after normalization">
              <div className="mb-3">
                <p className="label-console">Before and after normalization</p>
                <p className="mt-1 text-sm text-opal-muted">
                  Representative row {preview.rowNumber}. Highlighted output
                  fields changed before validation.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold text-danger">
                    Raw source record
                  </p>
                  <PreviewValues values={preview.raw} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-ok">
                    Normalized account record
                  </p>
                  <PreviewValues
                    values={preview.normalized}
                    changedFields={preview.changes}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {state.entityHealth && state.cutover !== "mapping" ? (
            <EntityHealthPanel health={state.entityHealth} />
          ) : null}

          {state.cutover === "blocked" ? (
            <section
              className="rounded-xl border border-danger/25 bg-danger-soft p-4"
              aria-label="Quarantine vault"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-danger">
                    Quarantine vault
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-opal-muted">
                    {state.issueCount.toLocaleString()} rows failed validation.
                    Edit remediable fields, then revalidate the full batch.
                  </p>
                </div>
                <span className="rounded-full bg-danger px-2.5 py-1 font-mono text-[11px] font-semibold text-white">
                  0 committed
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {state.quarantinedRows.slice(0, 3).map((row) => {
                  const fields =
                    row.remediableFields && row.remediableFields.length > 0
                      ? row.remediableFields
                      : (["user_email", "start_date"] as MappingTarget[]);
                  return (
                    <div
                      key={`${row.rowNumber}-${row.accountId}`}
                      className="rounded-lg border border-danger/15 bg-white/70 px-3 py-2.5"
                    >
                      <p className="font-mono text-[11px] font-semibold text-opal-main">
                        Row {row.rowNumber} - {row.accountId}
                      </p>
                      <p className="mt-1 text-xs text-danger">
                        {row.reasons.join("; ")}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {fields.map((field) => (
                          <label key={field} className="block">
                            <span className="mb-1 block font-mono text-[10px] text-opal-label">
                              {field}
                            </span>
                            <input
                              aria-label={`Fix ${field} on row ${row.rowNumber}`}
                              value={
                                rowFixes[String(row.rowNumber)]?.[field] ??
                                row.normalized?.[field] ??
                                ""
                              }
                              onChange={(event) =>
                                onRowFixChange(
                                  row.rowNumber,
                                  field,
                                  event.target.value
                                )
                              }
                              className="h-8 w-full rounded-md border border-line bg-white px-2 font-mono text-[11px] text-opal-main outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {onRemediate ? (
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={onRemediate}
                  className="mt-3 rounded-lg bg-opal-main px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  Apply fixes and revalidate
                </button>
              ) : null}
            </section>
          ) : null}

          {!idle && state.cutover !== "mapping" ? (
            <section className="console-panel p-4" aria-label="Tenant write boundary">
              <p className="label-console">Tenant write boundary</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-accent/20 bg-accent-soft px-3 py-2.5">
                  <p className="text-xs text-opal-muted">Target tenant</p>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-accent-deep">
                    {DEMO_TENANT_SCHEMA}
                  </p>
                  <p className="mt-1 text-xs text-opal-main">
                    {state.cutover === "committed"
                      ? `${state.committedRows.toLocaleString()} rows committed`
                      : "Transaction rolled back"}
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-console-panel px-3 py-2.5">
                  <p className="text-xs text-opal-muted">Neighbor tenant</p>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-opal-main">
                    {NEIGHBOR_TENANT_SCHEMA}
                  </p>
                  <p className="mt-1 text-xs text-opal-main">
                    {state.neighborTenantWrites} writes - unchanged
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-opal-muted">
                This public demo simulates the schema boundary. Production
                enforcement would use database credentials scoped to one tenant
                schema and a transaction around the full batch.
              </p>
            </section>
          ) : null}

          {state.receipt &&
          (state.cutover === "blocked" || state.cutover === "committed") ? (
            <MigrationReceiptCard receipt={state.receipt} />
          ) : null}

          <CompactEventLog
            logs={logs}
            isRunning={isRunning}
            maxVisible={10}
          />

          {idle ? (
            <div className="console-panel px-3 py-3">
              <p className="label-console">What this run proves</p>
              <p className="mt-2 text-sm leading-relaxed text-opal-muted">
                Start with the legacy export to map columns, save a playbook,
                quarantine bad rows, remediate, and review the cutover receipt.
              </p>
            </div>
          ) : null}
        </OpsConsoleShell>
      }
    />
  );
}
