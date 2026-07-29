/**
 * Deterministic in-memory PII redaction proxy for /privacy.
 * Synthetic demo payloads only. Not a compliance certification product.
 */

import type { LogEntry } from "@/components/ui/TerminalStream";
import {
  BULK_FINDING_THRESHOLD,
  FINDING_LABELS,
  MAX_PAYLOAD_CHARS,
  PLACEHOLDERS,
  PRIVACY_REVIEWER_ROLE,
  SAMPLE_SCENARIOS,
  type FindingKind,
  type PrivacyFinding,
  type PrivacyOverride,
  type PrivacyReceipt,
  type PrivacyScenarioKey,
  type ProxyDecision,
  type SecurityReviewCase,
} from "./types";
import { DEMO_MODE } from "./runtime";

export interface PrivacyRunInput {
  scenarioKey?: PrivacyScenarioKey;
  sourceText?: string;
  /** Finding kinds suppressed for this run after an operator false-positive release. */
  suppressKinds?: FindingKind[];
  overrideReason?: string;
  actor?: string;
}

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

async function sleep(ms: number) {
  if (process.env.PRIVACY_TEST_FAST === "1") return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function hashPayload(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Luhn check for payment card candidates. */
export function passesLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

interface PatternRule {
  kind: FindingKind;
  regex: RegExp;
  validate?: (match: string) => boolean;
}

const RULES: PatternRule[] = [
  {
    kind: "ssn",
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
  },
  {
    kind: "credit_card",
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    validate: (match) => {
      const digits = match.replace(/\D/g, "");
      return passesLuhn(digits);
    },
  },
  {
    kind: "email",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    kind: "api_key",
    regex:
      /\b(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g,
  },
  {
    kind: "phone",
    regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
  },
];

function previewToken(value: string, kind: FindingKind): string {
  if (kind === "email") {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 1)}***@${domain}`;
  }
  if (kind === "credit_card") {
    const digits = value.replace(/\D/g, "");
    return `****${digits.slice(-4)}`;
  }
  if (kind === "ssn") return "***-**-" + value.slice(-4);
  if (kind === "api_key") return value.slice(0, 7) + "…";
  return value.slice(0, 3) + "…";
}

function findingSummaries(findings: PrivacyFinding[]) {
  return findings.map((f) => ({
    kind: f.kind,
    label: f.label,
    preview: f.preview,
    replacement: f.replacement,
  }));
}

export function scanText(
  sourceText: string,
  options?: { suppressKinds?: FindingKind[] }
): PrivacyFinding[] {
  const findings: PrivacyFinding[] = [];
  const occupied: Array<{ start: number; end: number }> = [];
  const suppressed = new Set(options?.suppressKinds ?? []);

  const overlaps = (start: number, end: number) =>
    occupied.some((span) => start < span.end && end > span.start);

  for (const rule of RULES) {
    if (suppressed.has(rule.kind)) continue;
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sourceText)) !== null) {
      const value = match[0];
      if (rule.validate && !rule.validate(value)) continue;
      const start = match.index;
      const end = start + value.length;
      if (overlaps(start, end)) continue;
      occupied.push({ start, end });
      findings.push({
        kind: rule.kind,
        label: FINDING_LABELS[rule.kind],
        start,
        end,
        preview: previewToken(value, rule.kind),
        replacement: PLACEHOLDERS[rule.kind],
      });
    }
  }

  return findings.sort((a, b) => a.start - b.start);
}

export function redactText(
  sourceText: string,
  findings: PrivacyFinding[]
): string {
  if (findings.length === 0) return sourceText;
  let output = "";
  let cursor = 0;
  for (const finding of findings) {
    output += sourceText.slice(cursor, finding.start);
    output += finding.replacement;
    cursor = finding.end;
  }
  output += sourceText.slice(cursor);
  return output;
}

export function decideProxy(
  findings: PrivacyFinding[],
  scenarioKey?: PrivacyScenarioKey
): { decision: ProxyDecision; exceptionCode: string | null } {
  if (scenarioKey === "bulk_block" || findings.length >= BULK_FINDING_THRESHOLD) {
    return {
      decision: "blocked",
      exceptionCode: "PRIV-BULK-RESTRICTED",
    };
  }
  if (findings.length > 0) {
    return { decision: "sanitized", exceptionCode: null };
  }
  return { decision: "passed", exceptionCode: null };
}

function buildReceipt(input: {
  scenarioKey: PrivacyScenarioKey;
  decision: ProxyDecision;
  findings: PrivacyFinding[];
  exceptionCode: string | null;
  sanitizedText: string;
  securityReview: SecurityReviewCase | null;
  override: PrivacyOverride | null;
}): PrivacyReceipt {
  const kinds = [...new Set(input.findings.map((f) => f.kind))];
  const overrideKey = input.override
    ? `${input.override.suppressedKinds.join(",")}|${input.override.reason}`
    : "";
  const trailHash = hashPayload(
    `${input.scenarioKey}|${input.decision}|${input.findings.length}|${kinds.join(",")}|${input.sanitizedText}|${overrideKey}`
  );
  return {
    receiptId: `priv-${trailHash.slice(0, 8)}`,
    scenario: input.scenarioKey,
    decision: input.decision,
    findingCount: input.findings.length,
    kinds,
    exceptionCode: input.exceptionCode,
    trailHash,
    at: new Date().toISOString(),
    securityReview: input.securityReview,
    override: input.override,
  };
}

function resolveScenario(input: PrivacyRunInput): {
  scenarioKey: PrivacyScenarioKey;
  sourceText: string;
} | { error: string } {
  const hasCustomText = Boolean(input.sourceText?.trim());

  if (input.scenarioKey === "custom" || (!input.scenarioKey && hasCustomText)) {
    if (!hasCustomText) {
      return { error: "Custom payload requires sourceText." };
    }
    return {
      scenarioKey: "custom",
      sourceText: input.sourceText!.trim(),
    };
  }

  const scenarioKey = input.scenarioKey ?? "clean";
  const scenario = SAMPLE_SCENARIOS[scenarioKey];
  if (!scenario) {
    return { error: "Unknown scenario." };
  }

  return {
    scenarioKey,
    sourceText: hasCustomText ? input.sourceText!.trim() : scenario.sourceText,
  };
}

export async function* runPrivacyEngine(
  input: PrivacyRunInput = { scenarioKey: "clean" }
): AsyncGenerator<LogEntry, void, unknown> {
  const resolved = resolveScenario(input);
  if ("error" in resolved) {
    yield createLogEntry("error", "privacy:engine", resolved.error);
    return;
  }

  const { scenarioKey, sourceText } = resolved;
  const suppressKinds = [...new Set(input.suppressKinds ?? [])];
  const actor = input.actor?.trim() || PRIVACY_REVIEWER_ROLE;
  const overrideReason = input.overrideReason?.trim() || "";

  if (suppressKinds.length > 0 && !overrideReason) {
    yield createLogEntry(
      "error",
      "privacy:override",
      "False-positive release requires an override reason."
    );
    return;
  }

  if (sourceText.length > MAX_PAYLOAD_CHARS) {
    yield createLogEntry(
      "error",
      "privacy:gate",
      `Payload rejected - ${sourceText.length} chars exceeds the ${MAX_PAYLOAD_CHARS}-char limit.`,
      {
        action: "PAYLOAD_TOO_LARGE",
        sourceLength: sourceText.length,
        maxChars: MAX_PAYLOAD_CHARS,
        layer: "failure",
      }
    );
    return;
  }

  const override: PrivacyOverride | null =
    suppressKinds.length > 0
      ? {
          suppressedKinds: suppressKinds,
          reason: overrideReason,
          actor,
        }
      : null;

  yield createLogEntry(
    "info",
    "privacy:proxy",
    `Evaluating inbound payload (${sourceText.length} chars).`,
    {
      scenario: scenarioKey,
      demoMode: DEMO_MODE,
      runtime: "in-process",
      sourceLength: sourceText.length,
      suppressKinds,
      note: "Stateless in-memory scan - raw text is not written into the event stream.",
    }
  );
  await sleep(250);

  if (override) {
    yield createLogEntry(
      "warning",
      "privacy:override",
      `Applying false-positive release for ${suppressKinds.join(", ")}.`,
      {
        action: "OVERRIDE_APPLIED",
        suppressedKinds: suppressKinds,
        reason: overrideReason,
        actor,
      }
    );
    await sleep(200);
  }

  yield createLogEntry(
    "tool_call",
    "privacy:scanner",
    "Running deterministic pattern checks for known sensitive formats...",
    {
      method: "deterministic_patterns",
      checks: ["ssn", "credit_card", "email", "api_key", "phone"],
      suppressKinds,
    }
  );
  await sleep(350);

  const findings = scanText(sourceText, { suppressKinds });
  const { decision, exceptionCode } = decideProxy(findings, scenarioKey);
  const sanitizedText =
    decision === "blocked" ? "" : redactText(sourceText, findings);

  let securityReview: SecurityReviewCase | null = null;
  if (decision === "blocked" && exceptionCode) {
    const caseSeed = hashPayload(
      `${scenarioKey}|${exceptionCode}|${findings.length}|${Date.now()}`
    );
    securityReview = {
      caseId: `sec-${caseSeed.slice(0, 8)}`,
      status: "opened",
      exceptionCode,
      findingCount: findings.length,
      kinds: [...new Set(findings.map((f) => f.kind))],
      openedAt: new Date().toISOString(),
    };
  }

  const receipt = buildReceipt({
    scenarioKey,
    decision,
    findings,
    exceptionCode,
    sanitizedText: decision === "blocked" ? "[BLOCKED]" : sanitizedText,
    securityReview,
    override,
  });

  yield createLogEntry(
    findings.length > 0 ? "warning" : "tool_result",
    "privacy:scanner",
    findings.length === 0
      ? "Scan complete - 0 sensitive tokens flagged."
      : `Scan complete - ${findings.length} sensitive token${findings.length === 1 ? "" : "s"} flagged.`,
    {
      action: "SCAN_COMPLETE",
      findingCount: findings.length,
      findings: findingSummaries(findings),
      kinds: [...new Set(findings.map((f) => f.kind))],
      suppressKinds,
    }
  );
  await sleep(300);

  if (decision === "blocked") {
    yield createLogEntry(
      "warning",
      "privacy:review",
      `Security review case ${securityReview?.caseId} opened for oversight.`,
      {
        action: "SECURITY_REVIEW_OPENED",
        review: securityReview,
        exceptionCode,
        findingCount: findings.length,
        layer: "failure",
      }
    );
    await sleep(200);

    yield createLogEntry(
      "error",
      "privacy:gate",
      `Transmission blocked. Exception ${exceptionCode}. Payload was not forwarded downstream.`,
      {
        action: "PAYLOAD_BLOCKED",
        decision,
        exceptionCode,
        findingCount: findings.length,
        sourceLength: sourceText.length,
        sanitizedText: "",
        findings: findingSummaries(findings),
        review: securityReview,
        receipt,
        layer: "failure",
      }
    );
    return;
  }

  if (decision === "sanitized") {
    yield createLogEntry(
      "tool_result",
      "privacy:redactor",
      "Sensitive tokens replaced with placeholders before transit.",
      {
        action: "PAYLOAD_SANITIZED",
        decision,
        findingCount: findings.length,
        sourceLength: sourceText.length,
        sanitizedText,
        findings: findingSummaries(findings),
      }
    );
    await sleep(300);
  }

  yield createLogEntry(
    "success",
    "privacy:proxy",
    decision === "passed"
      ? "Payload cleared for downstream processing."
      : "Sanitized payload cleared for downstream processing.",
    {
      action: "PAYLOAD_CLEARED",
      decision,
      findingCount: findings.length,
      sourceLength: sourceText.length,
      sanitizedText,
      findings: findingSummaries(findings),
      receipt,
      layer: "audit",
    }
  );
}
