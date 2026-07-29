/**
 * Industry-neutral TypeScript migration demo for /migrate.
 * It performs real in-process mapping, normalization, validation, quarantine,
 * and an atomic simulated tenant commit. No production database is connected.
 */
import type { LogEntry } from "@/components/ui/TerminalStream";
import {
  DEMO_TENANT_SCHEMA,
  NEIGHBOR_TENANT_SCHEMA,
  SAMPLE_DATASETS,
  TARGET_FIELDS,
  TARGET_SCHEMA,
  type CanonicalAccount,
  type DatasetKey,
  type DatasetProfile,
  type EntityHealth,
  type MappingChoice,
  type MappingTarget,
  type MigrationReceipt,
  type RawMigrationRow,
} from "./types";
import { DEMO_MODE } from "./runtime";

export type RowFix = Partial<Record<MappingTarget, string>>;

export interface MigrationRunInput {
  datasetKey?: DatasetKey;
  csvText?: string;
  clientName?: string;
  mappingOverrides?: Record<string, MappingChoice>;
  /** 1-based CSV row number (header is row 1) -> field overrides after normalize. */
  rowFixes?: Record<string, RowFix>;
}

export interface QuarantinedRow {
  rowNumber: number;
  accountId: string;
  reasons: string[];
  raw: RawMigrationRow;
  normalized: CanonicalAccount;
  remediableFields: MappingTarget[];
}

export interface MigrationAnalysis {
  mapping: Record<string, MappingTarget>;
  unresolvedColumns: string[];
  missingRequiredFields: MappingTarget[];
  normalizedRows: CanonicalAccount[];
  validRows: CanonicalAccount[];
  quarantinedRows: QuarantinedRow[];
  normalizationCount: number;
  entityHealth: EntityHealth;
  beforeAfter: Array<{
    rowNumber: number;
    raw: RawMigrationRow;
    normalized: CanonicalAccount;
    changes: string[];
  }>;
}

function emptyEntityHealth(): EntityHealth {
  return {
    accounts: { valid: 0, failed: 0 },
    billing: { valid: 0, failed: 0 },
    users: { valid: 0, failed: 0 },
    dependencyBreaks: 0,
  };
}

const COLUMN_ALIASES: Record<string, MappingTarget> = {
  account_id: "account_id",
  customer_id: "account_id",
  customer_number: "account_id",
  cust_id: "account_id",
  "cust #": "account_id",
  account_name: "account_name",
  customer_name: "account_name",
  organization_name: "account_name",
  billing_email: "billing_email",
  billing_contact: "billing_email",
  user_email: "user_email",
  login_email: "user_email",
  primary_user: "user_email",
  start_date: "start_date",
  go_live: "start_date",
  service_start: "start_date",
  status: "status",
  active: "status",
  "active?": "status",
};

function createLogEntry(
  level: LogEntry["level"],
  source: string,
  message: string,
  data?: Record<string, unknown>
): LogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
    level,
    source,
    message,
    data,
  };
}

async function pause(ms: number) {
  if (process.env.MIGRATE_TEST_FAST === "1") return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\s]+/g, "_");
}

/** Parse RFC-4180-style commas, quoted fields, and escaped quotes. */
export function parseCsvText(csvText: string): {
  columns: string[];
  rows: RawMigrationRow[];
} {
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) table.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value !== "")) table.push(row);
  if (table.length < 2) return { columns: [], rows: [] };

  const columns = table[0].map((column) => column.trim());
  const rows = table.slice(1).map((cells) =>
    Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""]))
  );
  return { columns, rows };
}

function resolveProfile(input: MigrationRunInput): DatasetProfile {
  if (input.csvText?.trim()) {
    const parsed = parseCsvText(input.csvText);
    return {
      key: "corrupted",
      label: "Uploaded CSV",
      detail: "Operator-provided account onboarding file",
      sourceFormat: "csv",
      fileName: "uploaded_accounts.csv",
      clientName: input.clientName ?? "Uploaded client",
      tenantId: "uploaded_001",
      rowCount: parsed.rows.length,
      sourceColumns: parsed.columns,
      rows: parsed.rows.map((raw) => ({ raw })),
    };
  }

  return SAMPLE_DATASETS[input.datasetKey ?? "clean"] ?? SAMPLE_DATASETS.clean;
}

function resolveMapping(
  sourceColumns: string[],
  overrides: Record<string, MappingChoice> = {}
): {
  mapping: Record<string, MappingTarget>;
  unresolvedColumns: string[];
  missingRequiredFields: MappingTarget[];
} {
  const mapping: Record<string, MappingTarget> = {};
  const unresolvedColumns: string[] = [];

  for (const sourceColumn of sourceColumns) {
    const override = overrides[sourceColumn];
    if (override === "leave_out") continue;
    if (override) {
      mapping[sourceColumn] = override;
      continue;
    }

    const normalized = normalizeHeader(sourceColumn);
    const target =
      COLUMN_ALIASES[normalized] ??
      COLUMN_ALIASES[normalized.replace(/_/g, " ")];
    if (target) mapping[sourceColumn] = target;
    else unresolvedColumns.push(sourceColumn);
  }

  const mappedTargets = new Set(Object.values(mapping));
  const missingRequiredFields = TARGET_FIELDS.filter(
    (field) => field.required && !mappedTargets.has(field.key)
  ).map((field) => field.key);

  return { mapping, unresolvedColumns, missingRequiredFields };
}

function sourceValue(
  raw: RawMigrationRow,
  mapping: Record<string, MappingTarget>,
  target: MappingTarget
): string {
  const source = Object.keys(mapping).find((column) => mapping[column] === target);
  const value = source ? raw[source] : "";
  return value == null ? "" : String(value);
}

function normalizeName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed);
  if (!match) return trimmed;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function normalizeStatus(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (["yes", "y", "1", "active"].includes(normalized)) return "active";
  if (["no", "n", "0", "inactive"].includes(normalized)) return "inactive";
  return normalized;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

export function analyzeMigration(
  profile: DatasetProfile,
  mappingOverrides: Record<string, MappingChoice> = {},
  rowFixes: Record<string, RowFix> = {}
): MigrationAnalysis {
  const { mapping, unresolvedColumns, missingRequiredFields } = resolveMapping(
    profile.sourceColumns,
    mappingOverrides
  );
  const normalizedRows: CanonicalAccount[] = [];
  const validRows: CanonicalAccount[] = [];
  const quarantinedRows: QuarantinedRow[] = [];
  const beforeAfter: MigrationAnalysis["beforeAfter"] = [];
  const entityHealth = emptyEntityHealth();
  let normalizationCount = 0;

  if (unresolvedColumns.length > 0 || missingRequiredFields.length > 0) {
    return {
      mapping,
      unresolvedColumns,
      missingRequiredFields,
      normalizedRows,
      validRows,
      quarantinedRows,
      normalizationCount,
      entityHealth,
      beforeAfter,
    };
  }

  const seenAccountIds = new Map<string, number>();

  profile.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawValues = {
      account_id: sourceValue(row.raw, mapping, "account_id"),
      account_name: sourceValue(row.raw, mapping, "account_name"),
      billing_email: sourceValue(row.raw, mapping, "billing_email"),
      user_email: sourceValue(row.raw, mapping, "user_email"),
      start_date: sourceValue(row.raw, mapping, "start_date"),
      status: sourceValue(row.raw, mapping, "status"),
    };
    let normalized: CanonicalAccount = {
      account_id: rawValues.account_id.trim().toUpperCase(),
      account_name: normalizeName(rawValues.account_name),
      billing_email: normalizeEmail(rawValues.billing_email),
      user_email: normalizeEmail(rawValues.user_email),
      start_date: normalizeDate(rawValues.start_date),
      status: normalizeStatus(rawValues.status),
    };

    const fix = rowFixes[String(rowNumber)];
    if (fix) {
      (Object.keys(fix) as MappingTarget[]).forEach((field) => {
        const value = fix[field];
        if (value == null) return;
        if (field === "account_id") normalized.account_id = value.trim().toUpperCase();
        if (field === "account_name") normalized.account_name = normalizeName(value);
        if (field === "billing_email") normalized.billing_email = normalizeEmail(value);
        if (field === "user_email") normalized.user_email = normalizeEmail(value);
        if (field === "start_date") normalized.start_date = normalizeDate(value);
        if (field === "status") normalized.status = normalizeStatus(value);
      });
    }

    const changes = (Object.keys(normalized) as MappingTarget[]).filter(
      (field) => rawValues[field] !== normalized[field]
    );
    normalizationCount += changes.length;

    const accountReasons: string[] = [];
    const billingReasons: string[] = [];
    const userReasons: string[] = [];
    const remediable = new Set<MappingTarget>();

    if (!normalized.account_id) {
      accountReasons.push("Account ID is required");
      remediable.add("account_id");
    }
    if (!normalized.account_name) {
      accountReasons.push("Account name is required");
      remediable.add("account_name");
    }
    if (!validDate(normalized.start_date)) {
      accountReasons.push("Service start date is invalid");
      remediable.add("start_date");
    }
    if (!["active", "inactive"].includes(normalized.status)) {
      accountReasons.push("Account status must be active or inactive");
      remediable.add("status");
    }

    const priorRow = seenAccountIds.get(normalized.account_id);
    if (normalized.account_id && priorRow != null) {
      accountReasons.push(
        `Duplicate account ID conflicts with row ${priorRow}`
      );
      remediable.add("account_id");
      entityHealth.dependencyBreaks += 1;
    } else if (normalized.account_id) {
      seenAccountIds.set(normalized.account_id, rowNumber);
    }

    if (!validEmail(normalized.billing_email)) {
      billingReasons.push("Billing email is invalid");
      remediable.add("billing_email");
    }
    if (!validEmail(normalized.user_email)) {
      userReasons.push("Primary user email is invalid");
      remediable.add("user_email");
    }

    const accountFailed = accountReasons.length > 0;
    if (accountFailed) {
      if (billingReasons.length === 0 && validEmail(normalized.billing_email)) {
        billingReasons.push(
          "Billing contact blocked - parent account failed validation"
        );
        entityHealth.dependencyBreaks += 1;
      }
      if (userReasons.length === 0 && validEmail(normalized.user_email)) {
        userReasons.push(
          "Primary user blocked - parent account failed validation"
        );
        entityHealth.dependencyBreaks += 1;
      }
    }

    if (accountFailed) entityHealth.accounts.failed += 1;
    else entityHealth.accounts.valid += 1;
    if (billingReasons.length > 0) entityHealth.billing.failed += 1;
    else entityHealth.billing.valid += 1;
    if (userReasons.length > 0) entityHealth.users.failed += 1;
    else entityHealth.users.valid += 1;

    const reasons = [...accountReasons, ...billingReasons, ...userReasons];
    normalizedRows.push(normalized);
    if (reasons.length > 0) {
      quarantinedRows.push({
        rowNumber,
        accountId: normalized.account_id || "(missing)",
        reasons,
        raw: row.raw,
        normalized,
        remediableFields: [...remediable],
      });
    } else {
      validRows.push(normalized);
    }

    if (beforeAfter.length < 3 && (changes.length > 0 || reasons.length > 0)) {
      beforeAfter.push({
        rowNumber,
        raw: row.raw,
        normalized,
        changes,
      });
    }
  });

  if (beforeAfter.length === 0) {
    beforeAfter.push(
      ...profile.rows.slice(0, 2).map((row, index) => ({
        rowNumber: index + 2,
        raw: row.raw,
        normalized: normalizedRows[index],
        changes: [],
      }))
    );
  }

  return {
    mapping,
    unresolvedColumns,
    missingRequiredFields,
    normalizedRows,
    validRows,
    quarantinedRows,
    normalizationCount,
    entityHealth,
    beforeAfter,
  };
}

function buildReceipt(
  profile: DatasetProfile,
  analysis: MigrationAnalysis,
  mappingOverrides: Record<string, MappingChoice>,
  transaction: MigrationReceipt["transaction"],
  committedRows: number
): MigrationReceipt {
  const leaveOuts = Object.fromEntries(
    Object.entries(mappingOverrides).filter(
      (entry): entry is [string, "leave_out"] => entry[1] === "leave_out"
    )
  );
  return {
    fileName: profile.fileName,
    clientName: profile.clientName,
    mapping: { ...analysis.mapping, ...leaveOuts },
    normalizationCount: analysis.normalizationCount,
    quarantinedCount: analysis.quarantinedRows.length,
    committedRows,
    transaction,
    tenantSchema: DEMO_TENANT_SCHEMA,
    neighborTenant: NEIGHBOR_TENANT_SCHEMA,
    neighborTenantWrites: 0,
    entityHealth: analysis.entityHealth,
  };
}

export async function* runMigrationEngine(
  input: MigrationRunInput = { datasetKey: "clean" }
): AsyncGenerator<LogEntry, void, unknown> {
  const profile = resolveProfile(input);
  const source = "pipeline:migrate";
  const mappingOverrides = input.mappingOverrides ?? {};
  const rowFixes = input.rowFixes ?? {};

  yield createLogEntry(
    "info",
    source,
    `Analyzing ${profile.fileName} for ${profile.clientName}`,
    {
      client: profile.clientName,
      fileName: profile.fileName,
      rowCount: profile.rowCount,
      demoMode: DEMO_MODE,
      stack: ["TypeScript", "Next.js", "SSE"],
    }
  );
  await pause(250);

  yield createLogEntry(
    "tool_result",
    "ingest:parser",
    `Parsed ${profile.rowCount.toLocaleString()} actual rows and ${profile.sourceColumns.length} source columns`,
    {
      status: "INGEST_OK",
      rowCount: profile.rowCount,
      columns: profile.sourceColumns,
    }
  );
  await pause(300);

  const analysis = analyzeMigration(profile, mappingOverrides, rowFixes);
  yield createLogEntry(
    analysis.unresolvedColumns.length > 0 ? "warning" : "tool_result",
    "schema:mapper",
    analysis.unresolvedColumns.length > 0
      ? `${analysis.unresolvedColumns.length} source columns need an operator mapping decision`
      : `${Object.keys(analysis.mapping).length} source columns mapped to the reusable account template`,
    {
      status:
        analysis.unresolvedColumns.length > 0
          ? "MAPPING_REQUIRED"
          : "MAPPING_COMPLETE",
      action:
        analysis.unresolvedColumns.length > 0
          ? "MAPPING_REQUIRED"
          : "MAPPING_COMPLETE",
      mapping: analysis.mapping,
      unresolvedColumns: analysis.unresolvedColumns,
      missingRequiredFields: analysis.missingRequiredFields,
      targetFields: TARGET_FIELDS,
      rowCount: profile.rowCount,
      sourceColumns: profile.sourceColumns,
    }
  );

  if (
    analysis.unresolvedColumns.length > 0 ||
    analysis.missingRequiredFields.length > 0
  ) {
    yield createLogEntry(
      "warning",
      source,
      "Import paused before validation. Map each unknown column or leave it out, then run again.",
      {
        action: "MAPPING_REQUIRED",
        unresolvedColumns: analysis.unresolvedColumns,
        missingRequiredFields: analysis.missingRequiredFields,
        rowCount: profile.rowCount,
        sourceColumns: profile.sourceColumns,
        receipt: buildReceipt(profile, analysis, mappingOverrides, "paused", 0),
      }
    );
    return;
  }

  await pause(350);
  yield createLogEntry(
    "tool_call",
    "normalize:records",
    "Normalizing names, emails, dates, and account status values",
    { method: "deterministic_normalize", rowCount: profile.rowCount }
  );
  await pause(450);

  yield createLogEntry(
    analysis.quarantinedRows.length > 0 ? "warning" : "tool_result",
    "validate:records",
    `${analysis.normalizationCount.toLocaleString()} field values normalized; ${analysis.quarantinedRows.length.toLocaleString()} rows failed validation`,
    {
      status:
        analysis.quarantinedRows.length > 0
          ? "ROWS_QUARANTINED"
          : "VALIDATION_COMPLETE",
      rowCount: profile.rowCount,
      validRecords: analysis.validRows.length,
      issueCount: analysis.quarantinedRows.length,
      normalizationCount: analysis.normalizationCount,
      beforeAfter: analysis.beforeAfter,
      quarantinedRows: analysis.quarantinedRows.slice(0, 8),
      entityHealth: analysis.entityHealth,
    }
  );
  await pause(300);

  yield createLogEntry(
    analysis.entityHealth.dependencyBreaks > 0 ? "warning" : "tool_result",
    "validate:entities",
    `Entity dependency check - accounts ${analysis.entityHealth.accounts.valid}/${profile.rowCount}, billing ${analysis.entityHealth.billing.valid}/${profile.rowCount}, users ${analysis.entityHealth.users.valid}/${profile.rowCount}`,
    {
      status:
        analysis.entityHealth.dependencyBreaks > 0
          ? "DEPENDENCY_BREAKS"
          : "DEPENDENCIES_OK",
      entityHealth: analysis.entityHealth,
      rowCount: profile.rowCount,
    }
  );
  await pause(350);

  yield createLogEntry(
    "tool_result",
    "tenant:boundary",
    `Write boundary locked to ${DEMO_TENANT_SCHEMA}; neighboring tenants are read-only for this run`,
    {
      status: "TENANT_BOUNDARY_VERIFIED",
      tenantSchema: DEMO_TENANT_SCHEMA,
      neighborTenant: NEIGHBOR_TENANT_SCHEMA,
      isolation: "simulated schema-per-tenant boundary",
      neighborTenantWrites: 0,
    }
  );
  await pause(300);

  if (analysis.quarantinedRows.length > 0) {
    const receipt = buildReceipt(
      profile,
      analysis,
      mappingOverrides,
      "rolled_back",
      0
    );
    yield createLogEntry(
      "error",
      "transaction:commit",
      `Atomic commit rejected. ${analysis.quarantinedRows.length.toLocaleString()} invalid rows moved to quarantine; zero rows were written.`,
      {
        action: "CUTOVER_BLOCKED",
        transaction: "rolled_back",
        tenantSchema: DEMO_TENANT_SCHEMA,
        neighborTenant: NEIGHBOR_TENANT_SCHEMA,
        rowCount: profile.rowCount,
        validRecords: analysis.validRows.length,
        issueCount: analysis.quarantinedRows.length,
        quarantinedRows: analysis.quarantinedRows,
        committedRows: 0,
        neighborTenantWrites: 0,
        entityHealth: analysis.entityHealth,
        receipt,
        remediationAvailable: true,
      }
    );
    return;
  }

  yield createLogEntry(
    "tool_call",
    "transaction:commit",
    `Committing ${analysis.validRows.length.toLocaleString()} validated rows as one batch`,
    {
      method: "atomic_batch_commit",
      tenantSchema: DEMO_TENANT_SCHEMA,
      rowCount: analysis.validRows.length,
    }
  );
  await pause(450);

  const receipt = buildReceipt(
    profile,
    analysis,
    mappingOverrides,
    "committed",
    analysis.validRows.length
  );
  yield createLogEntry(
    "success",
    source,
    `Atomic cutover complete. ${analysis.validRows.length.toLocaleString()} rows committed to ${DEMO_TENANT_SCHEMA}.`,
    {
      action: "CUTOVER_COMPLETE",
      transaction: "committed",
      tenantSchema: DEMO_TENANT_SCHEMA,
      neighborTenant: NEIGHBOR_TENANT_SCHEMA,
      rowCount: profile.rowCount,
      validRecords: analysis.validRows.length,
      issueCount: 0,
      normalizationCount: analysis.normalizationCount,
      committedRows: analysis.validRows.length,
      neighborTenantWrites: 0,
      preview: analysis.normalizedRows.slice(0, 3),
      targetTable: TARGET_SCHEMA.table,
      entityHealth: analysis.entityHealth,
      receipt,
    }
  );
}
