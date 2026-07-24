/**
 * Production config for Client Migration Pipeline.
 * Unused while DEMO_MODE === "mockup". See ARCHITECTURE.md.
 */

export type TenantIsolationStrategy =
  | "schema-per-tenant"
  | "row-level-tenant-id"
  | "database-per-tenant";

export const migrateProductionConfig = {
  databaseUrlEnv: "MIGRATE_DATABASE_URL",
  exampleDatabaseUrl: "postgres://migrate_user:SECRET@db.example:5432/saas_ops",
  tenantIsolation: "schema-per-tenant" as TenantIsolationStrategy,
  defaultTenantSchema: "tenant_id_992",
  etlEntrypoint: "mcp-server/migrate_pipeline.py",
  batchSize: 500,
  maxUploadBytes: 5 * 1024 * 1024,
  targetTable: "locations",
} as const;

export type MigrateProductionConfig = typeof migrateProductionConfig;
