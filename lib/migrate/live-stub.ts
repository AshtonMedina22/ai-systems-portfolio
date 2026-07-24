/**
 * Live MigrationEngine stub. Returns NOT_WIRED until a real ETL bridge exists.
 * See config.ts and mcp-server/migrate_pipeline.py.
 */

import type { LogEntry } from "@/components/ui/TerminalStream";
import { migrateProductionConfig } from "./config";
import type { MigrationRunInput } from "./engine";

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

export async function* runLiveMigrationStub(
  _input: MigrationRunInput = { datasetKey: "clean" }
): AsyncGenerator<LogEntry, void, unknown> {
  // Future: spawnPythonNdjson(migrateProductionConfig.etlEntrypoint, ...)

  yield createLogEntry(
    "error",
    "migrate:live-stub",
    "Live migration adapter is not connected. Site runs DEMO_MODE=mockup (TypeScript engine).",
    {
      demoMode: "live",
      status: "NOT_WIRED",
      intendedEntrypoint: migrateProductionConfig.etlEntrypoint,
      config: {
        tenantIsolation: migrateProductionConfig.tenantIsolation,
        batchSize: migrateProductionConfig.batchSize,
        databaseUrlEnv: migrateProductionConfig.databaseUrlEnv,
      },
      hint: "Wire the Python ETL bridge, then set DEMO_MODE=live in runtime.ts.",
    }
  );
}
