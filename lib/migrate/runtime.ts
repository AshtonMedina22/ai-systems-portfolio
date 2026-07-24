/**
 * Migrate DEMO_MODE. Site runs the TypeScript mockup in engine.ts.
 * Live Postgres / pandas wiring lives in config.ts (unused while mockup).
 */

import type { DemoMode } from "@/lib/demo-runtime";
import { framingLabel, runtimeTag } from "@/lib/demo-runtime";

export const DEMO_MODE: DemoMode = "mockup";

export const MIGRATE_FRAMING = framingLabel(DEMO_MODE);
export const MIGRATE_RUNTIME_TAG = runtimeTag(DEMO_MODE);
