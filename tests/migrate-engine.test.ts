import assert from "node:assert/strict";
import test from "node:test";
import type { LogEntry } from "../components/ui/TerminalStream";
import {
  analyzeMigration,
  parseCsvText,
  runMigrationEngine,
  type MigrationRunInput,
} from "../lib/migrate/engine";
import { SAMPLE_DATASETS } from "../lib/migrate/types";

process.env.MIGRATE_TEST_FAST = "1";

async function collect(input: MigrationRunInput): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];
  for await (const entry of runMigrationEngine(input)) logs.push(entry);
  return logs;
}

const LEGACY_MAP = {
  Customer: "account_name" as const,
  "Legacy Notes": "leave_out" as const,
};

test("clean preset validates and atomically commits every actual row", async () => {
  const analysis = analyzeMigration(SAMPLE_DATASETS.clean);
  assert.equal(analysis.unresolvedColumns.length, 0);
  assert.equal(analysis.quarantinedRows.length, 0);
  assert.equal(analysis.validRows.length, 1200);
  assert.equal(analysis.entityHealth.accounts.valid, 1200);
  assert.equal(analysis.entityHealth.dependencyBreaks, 0);

  const logs = await collect({ datasetKey: "clean" });
  const terminal = logs.find(
    (entry) => entry.data?.action === "CUTOVER_COMPLETE"
  );
  assert.equal(terminal?.data?.committedRows, 1200);
  assert.equal(terminal?.data?.neighborTenantWrites, 0);
  assert.equal(
    (terminal?.data?.receipt as { transaction?: string } | undefined)
      ?.transaction,
    "committed"
  );
});

test("legacy preset pauses for operator mapping decisions", async () => {
  const logs = await collect({ datasetKey: "corrupted" });
  const mappingEvent = logs.find(
    (entry) => entry.data?.action === "MAPPING_REQUIRED"
  );
  assert.deepEqual(mappingEvent?.data?.unresolvedColumns, [
    "Customer",
    "Legacy Notes",
  ]);
  assert.equal(
    logs.some((entry) => entry.data?.action === "CUTOVER_COMPLETE"),
    false
  );
});

test("resolved legacy mappings normalize rows then roll back invalid batch", async () => {
  const input: MigrationRunInput = {
    datasetKey: "corrupted",
    mappingOverrides: LEGACY_MAP,
  };
  const analysis = analyzeMigration(
    SAMPLE_DATASETS.corrupted,
    input.mappingOverrides
  );

  assert.equal(analysis.unresolvedColumns.length, 0);
  assert.equal(analysis.validRows.length, 1410);
  assert.equal(analysis.quarantinedRows.length, 10);
  assert.ok(analysis.normalizationCount > 0);
  assert.ok(analysis.entityHealth.users.failed > 0);
  assert.ok(analysis.entityHealth.accounts.failed > 0);

  const logs = await collect(input);
  const terminal = logs.find(
    (entry) => entry.data?.action === "CUTOVER_BLOCKED"
  );
  assert.equal(terminal?.data?.committedRows, 0);
  assert.equal(terminal?.data?.neighborTenantWrites, 0);
  assert.equal(terminal?.data?.issueCount, 10);
  assert.equal(
    (terminal?.data?.receipt as { transaction?: string } | undefined)
      ?.transaction,
    "rolled_back"
  );
});

test("row remediation clears quarantine and commits the batch", async () => {
  const analysis = analyzeMigration(SAMPLE_DATASETS.corrupted, LEGACY_MAP);
  const rowFixes = Object.fromEntries(
    analysis.quarantinedRows.map((row) => {
      const fix: Record<string, string> = {};
      for (const field of row.remediableFields) {
        if (field === "user_email") {
          fix.user_email = `user${row.rowNumber - 1}@northstar.example`;
        } else if (field === "start_date") {
          fix.start_date = "2026-08-01";
        } else if (field === "billing_email") {
          fix.billing_email = `billing${row.rowNumber - 1}@northstar.example`;
        }
      }
      return [String(row.rowNumber), fix];
    })
  );

  const remediated = analyzeMigration(
    SAMPLE_DATASETS.corrupted,
    LEGACY_MAP,
    rowFixes
  );
  assert.equal(remediated.quarantinedRows.length, 0);
  assert.equal(remediated.validRows.length, 1420);

  const logs = await collect({
    datasetKey: "corrupted",
    mappingOverrides: LEGACY_MAP,
    rowFixes,
  });
  const terminal = logs.find(
    (entry) => entry.data?.action === "CUTOVER_COMPLETE"
  );
  assert.equal(terminal?.data?.committedRows, 1420);
});

test("second legacy batch commits after the same mapping playbook", async () => {
  const analysis = analyzeMigration(SAMPLE_DATASETS.reuse, LEGACY_MAP);
  assert.equal(analysis.unresolvedColumns.length, 0);
  assert.equal(analysis.quarantinedRows.length, 0);
  assert.equal(analysis.validRows.length, 480);

  const logs = await collect({
    datasetKey: "reuse",
    mappingOverrides: LEGACY_MAP,
  });
  const terminal = logs.find(
    (entry) => entry.data?.action === "CUTOVER_COMPLETE"
  );
  assert.equal(terminal?.data?.committedRows, 480);
});

test("CSV parser preserves commas and escaped quotes inside quoted fields", () => {
  const parsed = parseCsvText(
    'account_id,account_name,status\r\nA-1,"Example, ""North"" Division",active'
  );
  assert.equal(parsed.rows.length, 1);
  assert.equal(
    parsed.rows[0].account_name,
    'Example, "North" Division'
  );
});

test("invalid uploaded CSV is quarantined and never partially committed", async () => {
  const csvText = [
    "account_id,account_name,billing_email,user_email,start_date,status",
    'A-1,"Example, LLC",billing@example.com,invalid-email,2026-08-01,active',
    "A-2,Example West,billing2@example.com,user2@example.com,2026-08-01,active",
  ].join("\n");
  const logs = await collect({ csvText, clientName: "Uploaded client" });
  const terminal = logs.find(
    (entry) => entry.data?.action === "CUTOVER_BLOCKED"
  );

  assert.equal(terminal?.data?.rowCount, 2);
  assert.equal(terminal?.data?.committedRows, 0);
  assert.equal(terminal?.data?.issueCount, 1);
});
