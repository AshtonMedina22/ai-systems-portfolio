/**
 * PayFlow DEMO_MODE = live MCP (embedded on Vercel, or HTTP to local FastMCP).
 */

import type { DemoMode } from "@/lib/demo-runtime";
import { framingLabel, runtimeTag } from "@/lib/demo-runtime";

export const DEMO_MODE: DemoMode = "live";

export const PAYFLOW_FRAMING = framingLabel(DEMO_MODE);
export const PAYFLOW_RUNTIME_TAG = runtimeTag(DEMO_MODE);
