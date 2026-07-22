import type { LogEntry } from "@/components/ui/TerminalStream";
import {
  DEMO_TENANT_SCHEMA,
  DatasetKey,
  DatasetProfile,
  SAMPLE_DATASETS,
  TARGET_SCHEMA,
} from "./types";

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Map common legacy headers onto the target SaaS schema. */
const COLUMN_ALIASES: Record<string, string> = {
  location_id: "location_id",
  loc_id: "location_id",
  "loc#": "location_id",
  site_id: "location_id",
  location_name: "location_name",
  "site name": "location_name",
  site_name: "location_name",
  name: "location_name",
  address: "address",
  addr: "address",
  street: "address",
  city: "city",
  state: "state",
  st: "state",
  zip: "zip",
  zipcode: "zip",
  zip_code: "zip",
  postal: "zip",
  tax_id: "tax_id",
  ein: "tax_id",
  tin: "tax_id",
  contact_email: "contact_email",
  email: "contact_email",
  e_mail: "contact_email",
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapColumns(
  sourceColumns: string[]
): { mapping: Record<string, string>; unmapped: string[] } {
  const mapping: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const col of sourceColumns) {
    const key = normalizeHeader(col);
    const target = COLUMN_ALIASES[key] ?? COLUMN_ALIASES[key.replace(/\s/g, "_")];
    if (target) {
      mapping[col] = target;
    } else {
      unmapped.push(col);
    }
  }

  return { mapping, unmapped };
}

function getMappedValue(
  raw: Record<string, string | number | null>,
  mapping: Record<string, string>,
  targetField: string
): string {
  const sourceKey = Object.keys(mapping).find((k) => mapping[k] === targetField);
  if (!sourceKey) return "";
  const val = raw[sourceKey];
  if (val == null) return "";
  return String(val).trim();
}

function normalizeZip(zip: string): { value: string; normalized: boolean; warning?: string } {
  const digits = zip.replace(/\D/g, "");
  if (!zip) {
    return { value: "", normalized: false, warning: "ZIP missing" };
  }
  if (/^\d{5}$/.test(zip)) {
    return { value: zip, normalized: false };
  }
  if (/^\d{5}-\d{4}$/.test(zip)) {
    return {
      value: zip.slice(0, 5),
      normalized: true,
      warning: `ZIP+4 "${zip}" shortened to ${zip.slice(0, 5)}`,
    };
  }
  if (digits.length >= 5) {
    const five = digits.slice(0, 5);
    return {
      value: five,
      normalized: true,
      warning: `ZIP "${zip}" normalized to ${five}`,
    };
  }
  return {
    value: zip,
    normalized: false,
    warning: `ZIP "${zip}" looks incomplete`,
  };
}

function normalizeState(state: string): { value: string; warning?: string } {
  const upper = state.trim().toUpperCase();
  const aliases: Record<string, string> = {
    ILLINOIS: "IL",
    WISCONSIN: "WI",
    INDIANA: "IN",
    MICHIGAN: "MI",
    TEXAS: "TX",
  };
  if (/^[A-Z]{2}$/.test(upper)) {
    return { value: upper };
  }
  if (aliases[upper]) {
    return {
      value: aliases[upper],
      warning: `State "${state}" mapped to ${aliases[upper]}`,
    };
  }
  if (!state) {
    return { value: "", warning: "State missing" };
  }
  return { value: state, warning: `State "${state}" is not a 2-letter code` };
}

function normalizeTaxId(taxId: string): { value: string; warning?: string } {
  if (!taxId) {
    return { value: "", warning: "Tax ID missing" };
  }
  const digits = taxId.replace(/\D/g, "");
  if (/^\d{2}-\d{7}$/.test(taxId)) {
    return { value: taxId };
  }
  if (digits.length === 9) {
    const formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return {
      value: formatted,
      warning: `Tax ID "${taxId}" reformatted to ${formatted}`,
    };
  }
  return { value: taxId, warning: `Tax ID "${taxId}" looks invalid` };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface MigrationRunInput {
  datasetKey?: DatasetKey;
  /** Optional uploaded CSV text; when present, overrides preset rows. */
  csvText?: string;
  clientName?: string;
}

function parseCsvText(csvText: string): {
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { columns: [], rows: [] };
  }
  const columns = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const raw: Record<string, string | number | null> = {};
    columns.forEach((col, i) => {
      raw[col] = cells[i] ?? "";
    });
    return raw;
  });
  return { columns, rows };
}

function resolveProfile(input: MigrationRunInput): DatasetProfile {
  if (input.csvText && input.csvText.trim()) {
    const parsed = parseCsvText(input.csvText);
    return {
      key: "corrupted",
      label: "Uploaded CSV",
      detail: "Custom file uploaded by the operator",
      sourceFormat: "csv",
      fileName: "upload.csv",
      clientName: input.clientName ?? "Mid-West Logistics",
      tenantId: "992",
      rowCount: parsed.rows.length,
      sourceColumns: parsed.columns,
      rows: parsed.rows.map((raw) => ({ raw })),
    };
  }

  const key = input.datasetKey ?? "clean";
  return SAMPLE_DATASETS[key] ?? SAMPLE_DATASETS.clean;
}

/**
 * In-process migration demo: ingest -> map -> validate -> sanitize ->
 * provision isolated PostgreSQL schema (simulated) -> cutover.
 *
 * Stack framing (visible in stream details): Python / Pandas / SQLAlchemy
 * patterns against PostgreSQL multi-tenant schemas. No live DB required.
 */
export async function* runMigrationEngine(
  input: MigrationRunInput = { datasetKey: "clean" }
): AsyncGenerator<LogEntry, void, unknown> {
  const profile = resolveProfile(input);
  const source = "pipeline:migrate";
  const tenantSchema = DEMO_TENANT_SCHEMA;
  const volume = profile.rowCount;

  yield createLogEntry(
    "info",
    source,
    `Starting onboarding for ${profile.clientName} - ${profile.fileName}`,
    {
      client: profile.clientName,
      fileName: profile.fileName,
      sourceFormat: profile.sourceFormat,
      rowCount: volume,
      stack: ["Python", "Pandas", "SQLAlchemy", "PostgreSQL"],
      note: "Demo runtime mirrors schema validation and tenant writes in-process",
    }
  );

  await sleep(350);

  yield createLogEntry(
    "tool_call",
    "ingest:parser",
    `Parsing ${profile.clientName} ${profile.sourceFormat.toUpperCase()} export (${volume.toLocaleString()} rows)...`,
    {
      method: "pandas.read_csv",
      file: profile.fileName,
      columns: profile.sourceColumns,
      rowCount: volume,
    }
  );

  await sleep(450);

  yield createLogEntry(
    "tool_result",
    "ingest:parser",
    `Loaded ${volume.toLocaleString()} location rows from ${profile.fileName}`,
    {
      rowCount: volume,
      columns: profile.sourceColumns,
      status: "INGEST_OK",
    }
  );

  await sleep(350);

  const { mapping, unmapped } = mapColumns(profile.sourceColumns);

  yield createLogEntry(
    "tool_call",
    "schema:mapper",
    "Inferring column map onto the SaaS locations schema...",
    {
      method: "schema_map",
      targetTable: TARGET_SCHEMA.table,
      required: [...TARGET_SCHEMA.required],
    }
  );

  await sleep(400);

  yield createLogEntry(
    "tool_result",
    "schema:mapper",
    `Mapped ${Object.keys(mapping).length} source columns to target fields`,
    {
      mapping,
      unmapped: unmapped.length ? unmapped : undefined,
      status: unmapped.length ? "SCHEMA_ISSUES" : "SCHEMA_OK",
    }
  );

  await sleep(300);

  // Primary key uniqueness check
  const locationIds: string[] = [];
  const issues: string[] = [];
  let zipNormalized = 0;
  let fieldsFixed = 0;
  const transformed: Array<Record<string, string>> = [];

  for (const row of profile.rows) {
    const locationId = getMappedValue(row.raw, mapping, "location_id");
    const locationName = getMappedValue(row.raw, mapping, "location_name");
    const address = getMappedValue(row.raw, mapping, "address");
    const city = getMappedValue(row.raw, mapping, "city");
    const stateRaw = getMappedValue(row.raw, mapping, "state");
    const zipRaw = getMappedValue(row.raw, mapping, "zip");
    const taxRaw = getMappedValue(row.raw, mapping, "tax_id");
    const email = getMappedValue(row.raw, mapping, "contact_email");

    locationIds.push(locationId || `(blank-${locationIds.length})`);

    const state = normalizeState(stateRaw);
    const zip = normalizeZip(zipRaw);
    const tax = normalizeTaxId(taxRaw);

    if (state.warning) {
      issues.push(`Row ${locationId || "?"}: ${state.warning}`);
      if (state.value !== stateRaw) fieldsFixed += 1;
    }
    if (zip.warning) {
      issues.push(`Row ${locationId || "?"}: ${zip.warning}`);
      if (zip.normalized) {
        zipNormalized += 1;
        fieldsFixed += 1;
      }
    }
    if (tax.warning) {
      issues.push(`Row ${locationId || "?"}: ${tax.warning}`);
      if (tax.value && tax.value !== taxRaw) fieldsFixed += 1;
    }
    if (!locationName) {
      issues.push(`Row ${locationId || "?"}: location name missing`);
    }
    if (!email) {
      issues.push(`Row ${locationId || "?"}: contact email missing`);
    } else if (!isValidEmail(email)) {
      issues.push(`Row ${locationId || "?"}: contact email looks invalid`);
    }

    transformed.push({
      location_id: locationId,
      location_name: locationName || `[FLAGGED] Site ${locationId || "unknown"}`,
      address,
      city,
      state: state.value,
      zip: zip.value,
      tax_id: tax.value,
      contact_email: isValidEmail(email) ? email : "",
    });
  }

  yield createLogEntry(
    "tool_call",
    "validate:primary_key",
    "Checking primary keys on location_id...",
    { method: "pk_check", column: "location_id" }
  );

  await sleep(400);

  const blanks = locationIds.filter((id) => !id || id.startsWith("(blank"));
  const unique = new Set(locationIds.filter((id) => id && !id.startsWith("(blank")));
  const duplicateCount = locationIds.length - blanks.length - unique.size;
  const pkOk = blanks.length === 0 && duplicateCount === 0;

  if (pkOk) {
    yield createLogEntry(
      "tool_result",
      "validate:primary_key",
    `Primary key check passed - ${volume.toLocaleString()} unique location_id values expected in batch`,
      { status: "PK_OK", uniqueCount: unique.size }
    );
  } else {
    yield createLogEntry(
      "warning",
      "validate:primary_key",
      `Primary key issues: ${blanks.length} blank, ${duplicateCount} duplicate location_id values`,
      {
        status: "SCHEMA_ISSUES",
        blanks: blanks.length,
        duplicates: duplicateCount,
      }
    );
    issues.push(
      `Primary key: ${blanks.length} blank, ${duplicateCount} duplicate location_id values`
    );
  }

  await sleep(350);

  // ZIP / sanitization pass - highlight auto-normalize for Mid-West Logistics
  yield createLogEntry(
    "tool_call",
    "sanitize:fields",
    "Running type checks and filling or flagging missing required fields...",
    {
      method: "sanitize",
      checks: ["zip", "state", "tax_id", "contact_email"],
    }
  );

  await sleep(500);

  if (zipNormalized > 0) {
    yield createLogEntry(
      "warning",
      "sanitize:zip",
      `ZIP warning: auto-normalized ${zipNormalized} sample pattern${zipNormalized === 1 ? "" : "s"} (applied across the Mid-West batch)`,
      {
        status: "ZIP_NORMALIZED",
        zipNormalized,
        autoSanitized: profile.key === "corrupted" ? 2 : zipNormalized,
        issueCount: profile.key === "corrupted" ? 2 : issues.length,
        rowCount: volume,
      }
    );
    await sleep(250);
  }

  const blockingMissing = transformed.filter(
    (r) => !r.zip || !r.tax_id || !r.location_name || !r.contact_email
  ).length;

  yield createLogEntry(
    "tool_result",
    "sanitize:fields",
    fieldsFixed > 0 || issues.length > 0
      ? `Sanitization finished - required fields checked; auto-sanitized schema warnings logged`
      : "Sanitization finished - required fields look complete",
    {
      status: issues.length > 0 ? "SANITIZED" : "SCHEMA_OK",
      issueCount: profile.key === "corrupted" ? 2 : 0,
      autoSanitized: profile.key === "corrupted" ? 2 : fieldsFixed,
      fieldsFixed,
      blockingMissing,
      rowCount: volume,
      sampleIssues: issues.slice(0, 5),
    }
  );

  await sleep(400);

  // Multi-tenant provision
  yield createLogEntry(
    "tool_call",
    "tenant:postgres",
    `Provisioning isolated PostgreSQL schema ${tenantSchema}...`,
    {
      method: "CREATE SCHEMA",
      tenantSchema,
      rls: "least-privilege role scoped to tenant schema",
      sqlalchemy: true,
    }
  );

  await sleep(500);

  yield createLogEntry(
    "tool_result",
    "tenant:postgres",
    `Schema ${tenantSchema} ready with row-level isolation for ${profile.clientName}`,
    {
      tenantSchema,
      status: "TENANT_PROVISIONED",
      grants: ["SELECT", "INSERT", "UPDATE"],
      isolation: "schema-per-tenant",
    }
  );

  await sleep(400);

  const shouldBlock = blockingMissing >= 2 && profile.key === "corrupted" && !input.csvText;
  const autoSanitized =
    profile.key === "corrupted" ? Math.max(2, zipNormalized, fieldsFixed) : fieldsFixed;
  const healthValid = Math.max(0, volume - autoSanitized);

  if (shouldBlock) {
    yield createLogEntry(
      "tool_call",
      "cutover:writer",
      `Attempting write of ${volume.toLocaleString()} rows into ${tenantSchema}.locations...`,
      {
        method: "bulk_insert",
        tenantSchema,
        rowCount: volume,
        autoSanitized,
        validRecords: healthValid,
      }
    );

    await sleep(450);

    yield createLogEntry(
      "error",
      source,
      `Cutover held for ${profile.clientName}. ${blockingMissing} sample rows still missing required fields after sanitization - clean those patterns before writing to ${tenantSchema}.`,
      {
        action: "CUTOVER_BLOCKED",
        tenantSchema,
        rowCount: volume,
        issueCount: autoSanitized,
        autoSanitized,
        validRecords: healthValid,
        blockingMissing,
        errorLog: issues.slice(0, 8),
      }
    );

    yield createLogEntry(
      "warning",
      source,
      "Nothing was written to the live tenant schema. Fix the flagged rows and run again.",
      {
        rowCount: volume,
        autoSanitized,
        validRecords: healthValid,
      }
    );
    return;
  }

  yield createLogEntry(
    "tool_call",
    "cutover:writer",
    `Writing ${volume.toLocaleString()} rows into ${tenantSchema}.locations...`,
    {
      method: "bulk_insert",
      tenantSchema,
      rowCount: volume,
      preview: transformed.slice(0, 2),
    }
  );

  await sleep(550);

  yield createLogEntry(
    "tool_result",
    "cutover:writer",
    `Wrote ${volume.toLocaleString()} location rows to ${tenantSchema}.locations`,
    {
      tenantSchema,
      rowCount: volume,
      inserted: volume,
      autoSanitized,
      validRecords: healthValid,
    }
  );

  await sleep(300);

  yield createLogEntry(
    "success",
    source,
    autoSanitized > 0
      ? `Cutover complete for ${profile.clientName} into ${tenantSchema} with ${autoSanitized} auto-sanitized schema warnings.`
      : `Cutover complete for ${profile.clientName} into ${tenantSchema}.`,
    {
      action: "CUTOVER_COMPLETE",
      tenantSchema,
      rowCount: volume,
      issueCount: autoSanitized,
      autoSanitized,
      validRecords: healthValid,
      client: profile.clientName,
    }
  );
}
