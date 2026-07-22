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
      "Post an approved invoice to the enterprise accounts-payable ledger.",
  },
] as const;

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

export function toolVerifyVendorEntity(
  id: string | number,
  args: { vendorName: string; taxId: string }
): MCPToolResponse {
  const taxMatch = ERP_VENDOR_REGISTRY.find((v) => v.taxId === args.taxId);
  if (taxMatch) {
    const nameScore = fuzzyNameScore(args.vendorName, taxMatch.officialName);
    return wrapJson(id, {
      status: "MATCH_FOUND",
      vendorId: taxMatch.vendorId,
      officialName: taxMatch.officialName,
      confidenceScore: Math.round(Math.max(0.95, nameScore) * 100) / 100,
      matchMethod: "TAX_ID_EXACT",
      nameSimilarity: Math.round(nameScore * 1000) / 1000,
      registryStatus: taxMatch.status,
    });
  }

  const scored = ERP_VENDOR_REGISTRY.map((v) => ({
    v,
    score: fuzzyNameScore(args.vendorName, v.officialName),
  })).sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (best.score >= FUZZY_NAME_THRESHOLD) {
    return wrapJson(id, {
      status: "MATCH_FOUND",
      vendorId: best.v.vendorId,
      officialName: best.v.officialName,
      confidenceScore: Math.round(best.score * 100) / 100,
      matchMethod: "FUZZY_NAME",
      nameSimilarity: Math.round(best.score * 1000) / 1000,
      registryStatus: best.v.status,
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
    return wrapJson(id, {
      isMatch: true,
      riskLevel: "LOW",
      riskScore: 0.02,
      message: "Bank details match the verified primary enterprise payment profile.",
    });
  }

  return wrapJson(id, {
    isMatch: false,
    riskLevel: "CRITICAL_FRAUD_ALERT",
    riskScore: 0.96,
    expectedRouting: record.approvedRoutingNumber,
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
  }
): MCPToolResponse {
  return wrapJson(id, {
    posted: true,
    action: "POST_TO_ERP_LEDGER",
    ledgerEntryId: `LED-LOCAL-${Date.now()}`,
    invoiceId: args.invoiceId,
    vendorId: args.vendorId,
    amount: args.amount,
    currency: args.currency ?? "USD",
    status: "PAYMENT_SCHEDULED",
    glAccount: "2100-AP-TRADE",
  });
}
