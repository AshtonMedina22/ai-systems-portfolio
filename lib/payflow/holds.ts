/**
 * Demo/session hold store for PayFlow AP manager review.
 * In-memory only - resets on serverless cold start / process restart.
 */

import type { InvoicePayload } from "./types";

export type HoldStatus = "open" | "released" | "rejected";

export interface HoldAuditEntry {
  at: string;
  actor: "system" | "AP manager";
  action: string;
  detail: string;
}

export interface PayFlowHold {
  id: string;
  status: HoldStatus;
  createdAt: string;
  updatedAt: string;
  reviewerRole: "AP manager";
  reasonCode: "UNAUTHORIZED_BANK_ROUTING_CHANGE";
  invoice: InvoicePayload;
  vendorId: string;
  officialName: string;
  expectedRouting: string;
  expectedAccount: string;
  submittedRouting: string;
  submittedAccount: string;
  resolutionReason?: string;
  correctedRouting?: string;
  correctedAccount?: string;
  ledgerEntryId?: string;
  audit: HoldAuditEntry[];
  /** Demo/session storage note for UI. */
  storageNote: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __payflowHolds: Map<string, PayFlowHold> | undefined;
}

const STORAGE_NOTE =
  "Demo/session storage (in-memory). Holds do not survive serverless cold starts.";

function getStore(): Map<string, PayFlowHold> {
  if (!globalThis.__payflowHolds) {
    globalThis.__payflowHolds = new Map();
  }
  return globalThis.__payflowHolds;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createBankMismatchHold(input: {
  invoice: InvoicePayload;
  vendorId: string;
  officialName: string;
  expectedRouting: string;
  expectedAccount: string;
}): PayFlowHold {
  const id = `hold-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const createdAt = nowIso();
  const hold: PayFlowHold = {
    id,
    status: "open",
    createdAt,
    updatedAt: createdAt,
    reviewerRole: "AP manager",
    reasonCode: "UNAUTHORIZED_BANK_ROUTING_CHANGE",
    invoice: structuredClone(input.invoice),
    vendorId: input.vendorId,
    officialName: input.officialName,
    expectedRouting: input.expectedRouting,
    expectedAccount: input.expectedAccount,
    submittedRouting: input.invoice.bankDetails.routingNumber,
    submittedAccount: input.invoice.bankDetails.accountNumber,
    audit: [
      {
        at: createdAt,
        actor: "system",
        action: "HOLD_OPENED",
        detail:
          "Bank routing mismatch. Payment held for AP manager review.",
      },
    ],
    storageNote: STORAGE_NOTE,
  };
  getStore().set(id, hold);
  return hold;
}

export function getHold(id: string): PayFlowHold | undefined {
  return getStore().get(id);
}

export function listOpenHolds(): PayFlowHold[] {
  return [...getStore().values()].filter((h) => h.status === "open");
}

export function rejectHold(
  holdId: string,
  reason: string
): { ok: true; hold: PayFlowHold } | { ok: false; error: string } {
  const hold = getHold(holdId);
  if (!hold) {
    return { ok: false, error: "Hold not found in demo/session storage." };
  }
  if (hold.status !== "open") {
    return { ok: false, error: `Hold is already ${hold.status}.` };
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "A rejection reason is required." };
  }

  const at = nowIso();
  hold.status = "rejected";
  hold.updatedAt = at;
  hold.resolutionReason = trimmed;
  hold.audit.push({
    at,
    actor: "AP manager",
    action: "HOLD_REJECTED",
    detail: trimmed,
  });
  return { ok: true, hold };
}

/**
 * Mark hold released after corrected routing rechecked and posted.
 * Caller must re-run both checks and post with fresh evidence first.
 */
export function markHoldReleased(
  holdId: string,
  input: {
    reason: string;
    correctedRouting: string;
    correctedAccount: string;
    ledgerEntryId: string;
  }
): { ok: true; hold: PayFlowHold } | { ok: false; error: string } {
  const hold = getHold(holdId);
  if (!hold) {
    return { ok: false, error: "Hold not found in demo/session storage." };
  }
  if (hold.status !== "open") {
    return { ok: false, error: `Hold is already ${hold.status}.` };
  }

  const at = nowIso();
  hold.status = "released";
  hold.updatedAt = at;
  hold.resolutionReason = input.reason.trim();
  hold.correctedRouting = input.correctedRouting;
  hold.correctedAccount = input.correctedAccount;
  hold.ledgerEntryId = input.ledgerEntryId;
  hold.invoice = {
    ...hold.invoice,
    bankDetails: {
      ...hold.invoice.bankDetails,
      routingNumber: input.correctedRouting,
      accountNumber: input.correctedAccount,
    },
  };
  hold.audit.push({
    at,
    actor: "AP manager",
    action: "ROUTING_CORRECTED",
    detail: `Corrected routing to ${input.correctedRouting}; both checks re-run.`,
  });
  hold.audit.push({
    at,
    actor: "AP manager",
    action: "HOLD_RELEASED",
    detail: `${input.reason.trim()} Posted ledger entry ${input.ledgerEntryId}.`,
  });
  return { ok: true, hold };
}

export function resetHoldsForTests() {
  getStore().clear();
}
