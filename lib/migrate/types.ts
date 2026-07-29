export type DatasetKey = "clean" | "corrupted" | "reuse";

export type RawMigrationValue = string | number | null;
export type RawMigrationRow = Record<string, RawMigrationValue>;

export interface LegacyAccountRow {
  raw: RawMigrationRow;
}

export const TARGET_FIELDS = [
  { key: "account_id", label: "Account ID", required: true },
  { key: "account_name", label: "Account name", required: true },
  { key: "billing_email", label: "Billing email", required: true },
  { key: "user_email", label: "Primary user email", required: true },
  { key: "start_date", label: "Service start date", required: true },
  { key: "status", label: "Account status", required: true },
] as const;

export type MappingTarget = (typeof TARGET_FIELDS)[number]["key"];
export type MappingChoice = MappingTarget | "leave_out";

export interface CanonicalAccount {
  account_id: string;
  account_name: string;
  billing_email: string;
  user_email: string;
  start_date: string;
  status: string;
}

export interface EntityBucketHealth {
  valid: number;
  failed: number;
}

export interface EntityHealth {
  accounts: EntityBucketHealth;
  billing: EntityBucketHealth;
  users: EntityBucketHealth;
  dependencyBreaks: number;
}

export interface MigrationReceipt {
  fileName: string;
  clientName: string;
  mapping: Record<string, MappingTarget | "leave_out">;
  normalizationCount: number;
  quarantinedCount: number;
  committedRows: number;
  transaction: "committed" | "rolled_back" | "paused";
  tenantSchema: string;
  neighborTenant: string;
  neighborTenantWrites: number;
  entityHealth: EntityHealth;
}

export interface DatasetProfile {
  key: DatasetKey;
  label: string;
  detail: string;
  sourceFormat: "csv";
  fileName: string;
  clientName: string;
  tenantId: string;
  rowCount: number;
  sourceColumns: string[];
  rows: LegacyAccountRow[];
}

export const TARGET_SCHEMA = {
  table: "accounts",
  required: TARGET_FIELDS.filter((field) => field.required).map(
    (field) => field.key
  ),
  fields: TARGET_FIELDS,
} as const;

export const DEMO_TENANT_SCHEMA = "tenant_northstar_042";
export const NEIGHBOR_TENANT_SCHEMA = "tenant_harbor_017";

function cleanRows(count: number): LegacyAccountRow[] {
  return Array.from({ length: count }, (_, index) => {
    const row = index + 1;
    return {
      raw: {
        account_id: `NS-${String(row).padStart(5, "0")}`,
        account_name: `Northstar Account ${row}`,
        billing_email: `billing${row}@northstar.example`,
        user_email: `user${row}@northstar.example`,
        start_date: "2026-08-01",
        status: row % 9 === 0 ? "inactive" : "active",
      },
    };
  });
}

function legacyRows(
  count: number,
  options: { injectInvalid?: boolean; idPrefix?: string } = {}
): LegacyAccountRow[] {
  const injectInvalid = options.injectInvalid ?? true;
  const idPrefix = options.idPrefix ?? "legacy";
  return Array.from({ length: count }, (_, index) => {
    const row = index + 1;
    const invalidEmail = injectInvalid && row % 211 === 0;
    const invalidDate = injectInvalid && row % 307 === 0;
    return {
      raw: {
        "Cust #": `${idPrefix}-${String(row).padStart(5, "0")}`,
        Customer: `  Northstar account ${row}  `,
        "Billing Contact": `BILLING${row}@NORTHSTAR.EXAMPLE `,
        "Login Email": invalidEmail
          ? "missing-at-sign.example"
          : ` User${row}@Northstar.Example `,
        "Go Live": invalidDate ? "not-a-date" : "8/1/26",
        "Active?": row % 9 === 0 ? "No" : "Yes",
        "Legacy Notes": row % 25 === 0 ? "priority import" : "",
      },
    };
  });
}

const CLEAN_ROWS = cleanRows(1200);
const CORRUPTED_ROWS = legacyRows(1420, { injectInvalid: true });
const REUSE_ROWS = legacyRows(480, {
  injectInvalid: false,
  idPrefix: "batch-b",
});

export const SAMPLE_DATASETS: Record<DatasetKey, DatasetProfile> = {
  clean: {
    key: "clean",
    label: "Mapped account export",
    detail:
      "1,200 account, billing, and user records already aligned to the import template",
    sourceFormat: "csv",
    fileName: "northstar_accounts_ready.csv",
    clientName: "Northstar Services",
    tenantId: "northstar_042",
    rowCount: CLEAN_ROWS.length,
    sourceColumns: Object.keys(CLEAN_ROWS[0].raw),
    rows: CLEAN_ROWS,
  },
  corrupted: {
    key: "corrupted",
    label: "Legacy export with exceptions",
    detail:
      "1,420 records with ambiguous headers, inconsistent formatting, and blocked rows",
    sourceFormat: "csv",
    fileName: "northstar_legacy_export.csv",
    clientName: "Northstar Services",
    tenantId: "northstar_042",
    rowCount: CORRUPTED_ROWS.length,
    sourceColumns: Object.keys(CORRUPTED_ROWS[0].raw),
    rows: CORRUPTED_ROWS,
  },
  reuse: {
    key: "reuse",
    label: "Second legacy batch (same headers)",
    detail:
      "480 records with the same ambiguous headers - apply a saved mapping playbook without remapping",
    sourceFormat: "csv",
    fileName: "northstar_legacy_batch_b.csv",
    clientName: "Northstar Services",
    tenantId: "northstar_042",
    rowCount: REUSE_ROWS.length,
    sourceColumns: Object.keys(REUSE_ROWS[0].raw),
    rows: REUSE_ROWS,
  },
};
