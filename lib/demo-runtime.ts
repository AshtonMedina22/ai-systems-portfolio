/**
 * Demo mode helpers shared by project pages.
 *
 * mockup - in-process TypeScript simulation (Migrate, Workflow)
 * live   - real integration path (PayFlow MCP)
 */

export type DemoMode = "mockup" | "live";

export function framingLabel(mode: DemoMode): string {
  return mode === "live" ? "Live system demo" : "Interactive demo";
}

export function runtimeTag(mode: DemoMode): string {
  return mode === "live" ? "RUNTIME: live" : "RUNTIME: mockup";
}
