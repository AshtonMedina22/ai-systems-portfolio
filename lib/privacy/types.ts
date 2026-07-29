export type PrivacyScenarioKey =
  | "clean"
  | "embedded_pii"
  | "bulk_block"
  | "custom";

export type FindingKind =
  | "ssn"
  | "credit_card"
  | "email"
  | "api_key"
  | "phone";

export type ProxyDecision = "passed" | "sanitized" | "blocked";

export interface PrivacyFinding {
  kind: FindingKind;
  label: string;
  start: number;
  end: number;
  preview: string;
  replacement: string;
}

export interface SecurityReviewCase {
  caseId: string;
  status: "opened" | "acknowledged";
  exceptionCode: string;
  findingCount: number;
  kinds: FindingKind[];
  openedAt: string;
  acknowledgedAt?: string;
  actor?: string;
}

export interface PrivacyOverride {
  suppressedKinds: FindingKind[];
  reason: string;
  actor: string;
}

export interface PrivacyReceipt {
  receiptId: string;
  scenario: PrivacyScenarioKey;
  decision: ProxyDecision;
  findingCount: number;
  kinds: FindingKind[];
  exceptionCode: string | null;
  trailHash: string;
  at: string;
  securityReview: SecurityReviewCase | null;
  override: PrivacyOverride | null;
}

export interface PrivacyScenario {
  key: Exclude<PrivacyScenarioKey, "custom">;
  label: string;
  detail: string;
  tone: "default" | "danger";
  sourceText: string;
}

/** Synthetic demo payloads only - no real customer data. */
export const SAMPLE_SCENARIOS: Record<
  Exclude<PrivacyScenarioKey, "custom">,
  PrivacyScenario
> = {
  clean: {
    key: "clean",
    label: "Clean support ticket",
    detail:
      "Standard operational text with no sensitive tokens - should pass with zero flags",
    tone: "default",
    sourceText:
      "Customer called about cooler unit delivery timing for the Dallas warehouse. Please summarize the open ticket and confirm the next follow-up date.",
  },
  embedded_pii: {
    key: "embedded_pii",
    label: "Ticket with embedded PII",
    detail:
      "Contains a test SSN, card number, email, and API key - should sanitize before transit",
    tone: "danger",
    sourceText:
      "Caller Jane Doe verified identity with SSN 078-05-1120 and card 4111-1111-1111-1111. Contact jane.doe@example.com if needed. Temporary key sk_test_PortfolioDemoKeyAAA001 was pasted into notes by mistake.",
  },
  bulk_block: {
    key: "bulk_block",
    label: "Bulk restricted export",
    detail:
      "Many sensitive tokens in one payload - should block pre-transit and open a security review case",
    tone: "danger",
    sourceText: [
      "Bulk export request for overnight processing:",
      "078-05-1120, 219-09-9999, 457-55-5462",
      "4111-1111-1111-1111, 5500-0000-0000-0004, 6011-0009-9013-9424",
      "a@example.com, b@example.com, c@example.com, d@example.com",
      "sk_test_PortfolioDemoKeyBBB002, sk_live_PortfolioDemoKeyCCC003, ghp_FakeGitHubToken0123456789",
      "Please send full dump to external summarizer API.",
    ].join("\n"),
  },
};

export const FINDING_LABELS: Record<FindingKind, string> = {
  ssn: "Social Security number",
  credit_card: "Payment card number",
  email: "Email address",
  api_key: "API / secret key",
  phone: "Phone number",
};

export const PLACEHOLDERS: Record<FindingKind, string> = {
  ssn: "[REDACTED_SSN]",
  credit_card: "[REDACTED_CC]",
  email: "[REDACTED_EMAIL]",
  api_key: "[REDACTED_KEY]",
  phone: "[REDACTED_PHONE]",
};

/** Block when finding count reaches this threshold (bulk restricted). */
export const BULK_FINDING_THRESHOLD = 8;

/** Reject oversized inbound payloads before scanning. */
export const MAX_PAYLOAD_CHARS = 4000;

export const PRIVACY_REVIEWER_ROLE = "Security reviewer";

export const FINDING_KINDS: FindingKind[] = [
  "ssn",
  "credit_card",
  "email",
  "api_key",
  "phone",
];

export function isFindingKind(value: unknown): value is FindingKind {
  return (
    typeof value === "string" &&
    (FINDING_KINDS as string[]).includes(value)
  );
}

export function isPresetScenarioKey(
  value: unknown
): value is Exclude<PrivacyScenarioKey, "custom"> {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(SAMPLE_SCENARIOS, value)
  );
}

export function isPrivacyScenarioKey(
  value: unknown
): value is PrivacyScenarioKey {
  return value === "custom" || isPresetScenarioKey(value);
}
