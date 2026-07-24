/**
 * Workflow DEMO_MODE. Site runs the TypeScript mockup in state-machine.ts.
 * Live LangGraph wiring lives in config.ts (unused while mockup).
 */

import type { DemoMode } from "@/lib/demo-runtime";
import { framingLabel, runtimeTag } from "@/lib/demo-runtime";

export const DEMO_MODE: DemoMode = "mockup";

export const WORKFLOW_FRAMING = framingLabel(DEMO_MODE);
export const WORKFLOW_RUNTIME_TAG = runtimeTag(DEMO_MODE);
