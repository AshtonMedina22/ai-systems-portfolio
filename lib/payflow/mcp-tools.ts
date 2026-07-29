// In-project MCP tool runtime - mirrors mcp-server/erp_registry.py.
// Used for hosted demos (Vercel) and when the live FastMCP HTTP server is down.

import { MCPToolResponse } from "./types";

/** Same tool surface as the Python FastMCP server (for tools/list in embedded mode). */
export const DEMO_MCP_TOOLS = [
  {
    name: "verify_vendor_entity",
    description:
      "Resolve vendor identity against the enterprise vendor registry (exact tax ID + fuzzy name).",
  },
  {
    name: "check_bank_routing",
    description:
      "Compare submitted bank details to the authorized enterprise payment profile.",
  },
  {
    name: "post_erp_ledger",
    description:
      "Post an invoice to the AP ledger only with valid, bound, single-use check evidence.",
  },
] as const;

export const EVIDENCE_TTL_SECONDS = 300;

const ERP_VENDOR_REGISTRY = [
  {
    vendorId: "VEND-001",
    officialName: "Acme Global Enterprise Inc.",
    taxId: "XX-XXX4910",
    approvedRoutingNumber: "021000021",
    approvedAccountNumber: "*****4321",
    status: "ACTIVE_VERIFIED",
  },
  {
    vendorId: "VEND-002",
    officialName: "Nexus Logistics Corp",
    taxId: "XX-XXX8812",
    approvedRoutingNumber: "121000358",
    approvedAccountNumber: "*****1102",
    status: "ACTIVE_VERIFIED",
  },
];

const FUZZY_NAME_THRESHOLD = 0.82;

type EvidenceKind = "vendor" | "bank";

interface EvidenceRecord {
  token: string;
  kind: EvidenceKind;
  passed: boolean;
  bound: Record<string, string>;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __payflowEvidence: Map<string, EvidenceRecord> | undefined;
  // eslint-disable-next-line no-var
  var __payflowLedger: Array<Record<string, unknown>> | undefined;
}

function getEvidenceStore(): Map<string, EvidenceRecord> {
  if (!globalThis.__payflowEvidence) {
    globalThis.__payflowEvidence = new Map();
  }
  return globalThis.__payflowEvidence;
}

function getLedgerStore(): Array<Record<string, unknown>> {
  if (!globalThis.__payflowLedger) {
    globalThis.__payflowLedger = [];
  }
  return globalThis.__payflowLedger;
}

function fuzzyNameScore(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1;
  // Dice coefficient on bigrams (approximate fuzzy match)
  const bigrams = (s: string) => {
    const grams: string[] = [];
    for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
    return grams;
  };
  const aGrams = bigrams(shorter);
  const bGrams = bigrams(longer);
  if (aGrams.length === 0 || bGrams.length === 0) {
    return longer.includes(shorter) ? shorter.length / longer.length : 0;
  }
  let matches = 0;
  const bCopy = [...bGrams];
  for (const g of aGrams) {
    const idx = bCopy.indexOf(g);
    if (idx >= 0) {
      matches += 1;
      bCopy.splice(idx, 1);
    }
  }
  return (2 * matches) / (aGrams.length + bGrams.length);
}

function wrapJson(
  id: string | number,
  json: Record<string, unknown>
): MCPToolResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "json", json }],
    },
  };
}

function wrapError(
  id: string | number,
  message: string,
  code = -32000
): MCPToolResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

function issueEvidence(
  kind: EvidenceKind,
  passed: boolean,
  bound: Record<string, string>
): string {
  const token = `ev_${kind}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
  const now = Date.now();
  getEvidenceStore().set(token, {
    token,
    kind,
    passed,
    bound: { ...bound },
    createdAt: now,
    expiresAt: now + EVIDENCE_TTL_SECONDS * 1000,
    consumed: false,
  });
  return token;
}

function validateEvidence(
  token: string | undefined | null,
  expectedKind: EvidenceKind,
  requiredBound: Record<string, string>
): { ok: true } | { ok: false; code: string; message: string; field?: string } {
  if (!token) {
    return {
      ok: false,
      code: "EVIDENCE_ABSENT",
      message: `Ledger post rejected: missing ${expectedKind} verification evidence. Both vendor and bank checks must pass on the server before posting.`,
    };
  }

  const record = getEvidenceStore().get(token);
  if (!record) {
    return {
      ok: false,
      code: "EVIDENCE_UNKNOWN",
      message: "Ledger post rejected: verification evidence is unknown.",
    };
  }

  if (record.kind !== expectedKind) {
    return {
      ok: false,
      code: "EVIDENCE_KIND_MISMATCH",
      message: `Ledger post rejected: expected ${expectedKind} evidence, got ${record.kind}.`,
    };
  }

  if (!record.passed) {
    return {
      ok: false,
      code: "EVIDENCE_FAILED_CHECK",
      message: "Ledger post rejected: evidence belongs to a failed check.",
    };
  }

  if (record.consumed) {
    return {
      ok: false,
      code: "EVIDENCE_REPLAY",
      message: "Ledger post rejected: verification evidence was already used.",
    };
  }

  if (Date.now() > record.expiresAt) {
    return {
      ok: false,
      code: "EVIDENCE_STALE",
      message: "Ledger post rejected: verification evidence has expired.",
    };
  }

  for (const [key, expected] of Object.entries(requiredBound)) {
    if (record.bound[key] !== expected) {
      return {
        ok: false,
        code: "EVIDENCE_DATA_MISMATCH",
        message: `Ledger post rejected: evidence does not bind to the submitted ${key}.`,
        field: key,
      };
    }
  }

  return { ok: true };
}

export function getVendorApprovedProfile(vendorId: string) {
  const record = ERP_VENDOR_REGISTRY.find((v) => v.vendorId === vendorId);
  if (!record) return null;
  return {
    vendorId: record.vendorId,
    officialName: record.officialName,
    approvedRoutingNumber: record.approvedRoutingNumber,
    approvedAccountNumber: record.approvedAccountNumber,
    status: record.status,
  };
}

export function toolVerifyVendorEntity(
  id: string | number,
  args: { vendorName: string; taxId: string }
): MCPToolResponse {
  const taxMatch = ERP_VENDOR_REGISTRY.find((v) => v.taxId === args.taxId);
  if (taxMatch) {
    const nameScore = fuzzyNameScore(args.vendorName, taxMatch.officialName);
    const evidenceToken = issueEvidence("vendor", true, {
      vendorName: args.vendorName,
      taxId: args.taxId,
      vendorId: taxMatch.vendorId,
    });
    return wrapJson(id, {
      status: "MATCH_FOUND",
      vendorId: taxMatch.vendorId,
      officialName: taxMatch.officialName,
      confidenceScore: Math.round(Math.max(0.95, nameScore) * 100) / 100,
      matchMethod: "TAX_ID_EXACT",
      nameSimilarity: Math.round(nameScore * 1000) / 1000,
      registryStatus: taxMatch.status,
      evidenceToken,
      evidenceKind: "vendor",
      evidenceExpiresInSeconds: EVIDENCE_TTL_SECONDS,
    });
  }

  const scored = ERP_VENDOR_REGISTRY.map((v) => ({
    v,
    score: fuzzyNameScore(args.vendorName, v.officialName),
  })).sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (best.score >= FUZZY_NAME_THRESHOLD) {
    const evidenceToken = issueEvidence("vendor", true, {
      vendorName: args.vendorName,
      taxId: args.taxId,
      vendorId: best.v.vendorId,
    });
    return wrapJson(id, {
      status: "MATCH_FOUND",
      vendorId: best.v.vendorId,
      officialName: best.v.officialName,
      confidenceScore: Math.round(best.score * 100) / 100,
      matchMethod: "FUZZY_NAME",
      nameSimilarity: Math.round(best.score * 1000) / 1000,
      registryStatus: best.v.status,
      evidenceToken,
      evidenceKind: "vendor",
      evidenceExpiresInSeconds: EVIDENCE_TTL_SECONDS,
    });
  }

  return wrapJson(id, {
    status: "UNREGISTERED_ENTITY",
    confidenceScore: Math.round(best.score * 100) / 100,
    matchMethod: "NO_MATCH",
    nameSimilarity: Math.round(best.score * 1000) / 1000,
    closestCandidate: best.v.officialName,
    recommendation: "REJECT_PAYMENT_AND_FLAG",
  });
}

export function toolCheckBankRouting(
  id: string | number,
  args: {
    vendorId: string;
    routingNumber: string;
    accountNumber: string;
  }
): MCPToolResponse {
  const record = ERP_VENDOR_REGISTRY.find((v) => v.vendorId === args.vendorId);

  if (!record) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32602,
        message: `Vendor ID ${args.vendorId} not found in the enterprise registry.`,
      },
    };
  }

  const isRoutingMatch =
    record.approvedRoutingNumber === args.routingNumber;
  const isAccountMatch =
    record.approvedAccountNumber === args.accountNumber;

  if (isRoutingMatch && isAccountMatch) {
    const evidenceToken = issueEvidence("bank", true, {
      vendorId: args.vendorId,
      routingNumber: args.routingNumber,
      accountNumber: args.accountNumber,
    });
    return wrapJson(id, {
      isMatch: true,
      riskLevel: "LOW",
      riskScore: 0.02,
      message: "Bank details match the verified primary enterprise payment profile.",
      evidenceToken,
      evidenceKind: "bank",
      evidenceExpiresInSeconds: EVIDENCE_TTL_SECONDS,
    });
  }

  return wrapJson(id, {
    isMatch: false,
    riskLevel: "CRITICAL_FRAUD_ALERT",
    riskScore: 0.96,
    expectedRouting: record.approvedRoutingNumber,
    expectedAccount: record.approvedAccountNumber,
    providedRouting: args.routingNumber,
    message:
      "UNAUTHORIZED BANK ROUTING DETECTED: Bank routing number does not match registered vendor profile.",
  });
}

export function toolPostErpLedger(
  id: string | number,
  args: {
    invoiceId: string;
    vendorId: string;
    amount: number;
    currency?: string;
    vendorEvidenceToken?: string;
    bankEvidenceToken?: string;
    vendorName?: string;
    taxId?: string;
    routingNumber?: string;
    accountNumber?: string;
  }
): MCPToolResponse {
  if (
    !args.vendorName ||
    !args.taxId ||
    !args.routingNumber ||
    !args.accountNumber
  ) {
    return wrapError(
      id,
      "Ledger post rejected: invoice, vendor, and bank fields are required so evidence can be bound to the submitted data."
    );
  }

  const vendorCheck = validateEvidence(args.vendorEvidenceToken, "vendor", {
    vendorName: args.vendorName,
    taxId: args.taxId,
    vendorId: args.vendorId,
  });
  if (!vendorCheck.ok) {
    return wrapError(id, vendorCheck.message);
  }

  const bankCheck = validateEvidence(args.bankEvidenceToken, "bank", {
    vendorId: args.vendorId,
    routingNumber: args.routingNumber,
    accountNumber: args.accountNumber,
  });
  if (!bankCheck.ok) {
    return wrapError(id, bankCheck.message);
  }

  const vendorToken = args.vendorEvidenceToken as string;
  const bankToken = args.bankEvidenceToken as string;
  const vendorRecord = getEvidenceStore().get(vendorToken);
  const bankRecord = getEvidenceStore().get(bankToken);
  if (vendorRecord) vendorRecord.consumed = true;
  if (bankRecord) bankRecord.consumed = true;

  const ledger = getLedgerStore();
  const entry = {
    posted: true,
    action: "POST_TO_ERP_LEDGER",
    ledgerEntryId: `LED-LOCAL-${Date.now()}`,
    invoiceId: args.invoiceId,
    vendorId: args.vendorId,
    amount: args.amount,
    currency: args.currency ?? "USD",
    status: "PAYMENT_SCHEDULED",
    glAccount: "2100-AP-TRADE",
    evidenceConsumed: {
      vendor: vendorToken,
      bank: bankToken,
    },
  };
  ledger.push(entry);
  return wrapJson(id, entry);
}

/** Test helpers - not used by the demo UI. */
export function resetPayflowStoresForTests() {
  getEvidenceStore().clear();
  getLedgerStore().length = 0;
}

export function expireEvidenceForTests(token: string) {
  const record = getEvidenceStore().get(token);
  if (record) record.expiresAt = Date.now() - 1;
}
