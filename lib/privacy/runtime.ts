/**
 * Privacy DEMO_MODE. Site runs the TypeScript mockup in engine.ts.
 */

import type { DemoMode } from "@/lib/demo-runtime";
import { framingLabel, runtimeTag } from "@/lib/demo-runtime";

export const DEMO_MODE: DemoMode = "mockup";

export const PRIVACY_FRAMING = framingLabel(DEMO_MODE);
export const PRIVACY_RUNTIME_TAG = runtimeTag(DEMO_MODE);
