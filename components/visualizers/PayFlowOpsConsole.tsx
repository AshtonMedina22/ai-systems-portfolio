"use client";

import React, { useMemo, useState } from "react";
import {
  CompactEventLog,
  OpsConsoleShell,
  ProgressBar,
} from "@/components/ui/OpsConsole";
import { DemoPanelTabs } from "@/components/ui/CodeViewer";
import type { LogEntry } from "@/components/ui/TerminalStream";
import type { InvoicePayload } from "@/lib/payflow/types";
import { deriveExecutiveKpis } from "@/lib/payflow/executive-summary";
import { PAYFLOW_SOURCE_FILES } from "@/lib/portfolio/source-excerpts";
import { ChevronDown, ShieldAlert } from "lucide-react";

function derivePayFlowConsole(logs: LogEntry[]) {
  let nameSimilarity: number | null = null;
  let officialName: string | null = null;
  let expectedRouting: string | null = null;
  let expectedAccount: string | null = null;
  let bankMatch: boolean | null = null;
  let vendorStatus: string | null = null;
  let escalated = false;
  let posted = false;
  let blockedUnknown = false;
  let holdId: string | null = null;
  let holdReleased = false;
  let holdRejected = false;
  let storageNote: string | null = null;
  let vendorId: string | null = null;

  for (const log of logs) {
    const data = log.data ?? {};
    if (typeof data.nameSimilarity === "number") {
      nameSimilarity = Math.round(Number(data.nameSimilarity) * 100);
    }
    if (typeof data.officialName === "string") officialName = data.officialName;
    if (typeof data.closestCandidate === "string" && !officialName) {
      officialName = data.closestCandidate;
    }
    if (typeof data.expectedRouting === "string") {
      expectedRouting = data.expectedRouting;
    }
    if (typeof data.expectedAccount === "string") {
      expectedAccount = data.expectedAccount;
    }
    if (typeof data.vendorId === "string") vendorId = data.vendorId;
    if (data.status === "MATCH_FOUND") vendorStatus = "matched";
    if (data.status === "UNREGISTERED_ENTITY") {
      vendorStatus = "unknown";
      blockedUnknown = true;
    }
    if (typeof data.isMatch === "boolean") bankMatch = data.isMatch;
    if (
      data.action === "HOLD_OPENED" ||
      data.action === "ESCALATE_TO_COMPLIANCE" ||
      data.isMatch === false
    ) {
      escalated = true;
    }
    if (typeof data.holdId === "string") holdId = data.holdId;
    if (typeof data.storageNote === "string") storageNote = data.storageNote;
    if (data.action === "HOLD_RELEASED") {
      holdReleased = true;
      posted = true;
      escalated = false;
    }
    if (data.action === "HOLD_REJECTED") {
      holdRejected = true;
      escalated = false;
    }
    if (data.action === "POST_TO_ERP_LEDGER") posted = true;
  }

  const holdOpen = Boolean(holdId) && !holdReleased && !holdRejected && escalated;

  return {
    nameSimilarity,
    officialName,
    expectedRouting,
    expectedAccount,
    bankMatch,
    vendorStatus,
    escalated,
    posted,
    blockedUnknown,
    holdId,
    holdOpen,
    holdReleased,
    holdRejected,
    storageNote,
    vendorId,
  };
}

export function PayFlowOpsConsole({
  logs,
  isRunning,
  invoice,
  liveLabel,
  onClear,
  onAppendLogs,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  invoice: InvoicePayload;
  liveLabel?: string;
  onClear?: () => void;
  onAppendLogs?: (entries: LogEntry[]) => void;
}) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(true);
  const [reason, setReason] = useState("");
  const [useApprovedRouting, setUseApprovedRouting] = useState(true);
  const [busyAction, setBusyAction] = useState<"release" | "reject" | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const kpis = useMemo(() => deriveExecutiveKpis(logs), [logs]);
  const consoleState = useMemo(() => derivePayFlowConsole(logs), [logs]);

  const idle = logs.length === 0 && !isRunning;

  const statusTone =
    idle || isRunning
      ? "live"
      : consoleState.holdRejected || consoleState.blockedUnknown
        ? "danger"
        : consoleState.holdOpen
          ? "danger"
          : consoleState.posted
            ? "ok"
            : "warn";

  const statusLabel = idle
    ? "Ready for invoices"
    : isRunning
      ? "Checking invoice"
      : consoleState.blockedUnknown
        ? "Unknown vendor blocked"
        : consoleState.holdRejected
          ? "Hold rejected by AP manager"
          : consoleState.holdOpen
            ? "Held - AP manager review"
            : consoleState.holdReleased || consoleState.posted
              ? "Cleared for ledger"
              : "Checks finished";

  const similarityValue = consoleState.nameSimilarity ?? 0;
  const similarityReady = consoleState.nameSimilarity != null;

  const readSseLogs = async (response: Response): Promise<LogEntry[]> => {
    if (!response.body) return [];
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const entries: LogEntry[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            entries.push(JSON.parse(trimmed.substring(6)) as LogEntry);
          } catch {
            // skip malformed chunk
          }
        }
      }
    }
    return entries;
  };

  const handleReject = async () => {
    if (!consoleState.holdId || busyAction) return;
    setActionError(null);
    setBusyAction("reject");
    try {
      const response = await fetch("/api/payflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_hold",
          holdId: consoleState.holdId,
          reason: reason || "Rejected by AP manager after review.",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionError(
          typeof body.error === "string"
            ? body.error
            : "Could not reject hold."
        );
        return;
      }
      if (Array.isArray(body.logs)) {
        onAppendLogs?.(body.logs as LogEntry[]);
      }
    } catch {
      setActionError("Failed to reach the PayFlow API for reject.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRelease = async () => {
    if (!consoleState.holdId || busyAction) return;
    if (!useApprovedRouting || !consoleState.expectedRouting) {
      setActionError(
        "Select the approved profile routing. Casual approval cannot bypass the bank control."
      );
      return;
    }
    setActionError(null);
    setBusyAction("release");
    try {
      const response = await fetch("/api/payflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release_hold",
          holdId: consoleState.holdId,
          reason:
            reason ||
            "AP manager verified correction against approved payment profile.",
          correctedRouting: consoleState.expectedRouting,
          correctedAccount: consoleState.expectedAccount ?? undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setActionError(
          typeof body.error === "string"
            ? body.error
            : "Could not release hold."
        );
        return;
      }

      const entries = await readSseLogs(response);
      if (entries.length) onAppendLogs?.(entries);
    } catch {
      setActionError("Failed to reach the PayFlow API for release.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <DemoPanelTabs
      liveLabel={liveLabel}
      sourceFiles={PAYFLOW_SOURCE_FILES}
      live={
        <OpsConsoleShell
          title="Operations console"
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRunning={idle || isRunning || busyAction !== null}
          eventCount={logs.length}
          onClear={onClear}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="console-panel p-3.5">
              <p className="label-console mb-2">Incoming invoice</p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-opal-muted">Vendor</dt>
                  <dd className="text-right font-medium text-opal-main">
                    {invoice.vendorName}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-opal-muted">Tax ID</dt>
                  <dd className="font-mono text-xs text-opal-main">
                    {invoice.vendorTaxId}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-opal-muted">Routing</dt>
                  <dd
                    className={`font-mono text-xs font-semibold ${
                      consoleState.bankMatch === false
                        ? "text-danger"
                        : "text-opal-main"
                    }`}
                  >
                    {invoice.bankDetails.routingNumber}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-opal-muted">Amount</dt>
                  <dd className="font-semibold text-opal-main">
                    ${invoice.invoiceAmount.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="console-panel p-3.5">
              <p className="label-console mb-2">Master vendor profile</p>
              {consoleState.vendorStatus === "unknown" ? (
                <p className="text-sm leading-relaxed text-warn">
                  No match in the company vendor list for this tax ID / name.
                </p>
              ) : consoleState.officialName || consoleState.expectedRouting ? (
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-opal-muted">Official name</dt>
                    <dd className="text-right font-medium text-ok">
                      {consoleState.officialName ?? "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-opal-muted">Approved routing</dt>
                    <dd className="font-mono text-xs text-ok">
                      {consoleState.expectedRouting ?? "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-opal-muted">Bank check</dt>
                    <dd
                      className={`font-semibold ${
                        consoleState.bankMatch === false
                          ? "text-danger"
                          : consoleState.bankMatch === true
                            ? "text-ok"
                            : "text-opal-muted"
                      }`}
                    >
                      {consoleState.bankMatch === false
                        ? "Mismatch"
                        : consoleState.bankMatch === true
                          ? "Match"
                          : "Pending"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <dl className="space-y-1.5 text-sm text-opal-muted">
                  <div className="flex justify-between gap-2">
                    <dt>Official name</dt>
                    <dd className="text-right">Waiting for check...</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Approved routing</dt>
                    <dd className="font-mono text-xs">-</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Bank check</dt>
                    <dd>Pending</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>

          <div className="console-panel p-3.5">
            <ProgressBar
              value={similarityValue}
              label={
                similarityReady
                  ? `Name similarity${
                      similarityValue >= 90 ? " - Match" : " - Review"
                    }`
                  : "Name similarity - waiting for match"
              }
              tone={
                !similarityReady
                  ? "neutral"
                  : similarityValue >= 90
                    ? "ok"
                    : similarityValue >= 70
                      ? "warn"
                      : "danger"
              }
            />
            {idle ? (
              <p className="mt-2 text-sm text-opal-muted">
                Pick an invoice on the left and hit Run invoice check to fill
                the match score and security banners.
              </p>
            ) : null}
          </div>

          {consoleState.holdOpen || consoleState.escalated ? (
            <div className="space-y-3 rounded-xl border border-danger/25 bg-danger-soft p-3.5">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-semibold text-danger">
                    Intercepted: routing number mismatch
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-opal-muted">
                    Invoice routing does not match the approved payment profile.
                    Payment is held for AP manager review.
                  </p>
                  {consoleState.holdId ? (
                    <p className="mt-1 font-mono text-xs text-opal-mist">
                      Hold {consoleState.holdId}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoticeOpen((v) => !v)}
                className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-danger/20 bg-white px-3 py-2.5 text-left text-sm font-medium text-opal-main hover:bg-console-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span>View AP manager escalation notice</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${noticeOpen ? "rotate-180" : ""}`}
                />
              </button>
              {noticeOpen ? (
                <div className="space-y-2 rounded-lg border border-line bg-white px-3 py-3 text-sm leading-relaxed text-opal-muted">
                  <p>
                    <span className="font-semibold text-opal-main">Notice: </span>
                    Unauthorized bank routing change on {invoice.invoiceId} for{" "}
                    {invoice.vendorName}.
                  </p>
                  <p>
                    Submitted routing{" "}
                    <span className="font-mono text-danger">
                      {invoice.bankDetails.routingNumber}
                    </span>
                    {consoleState.expectedRouting ? (
                      <>
                        {" "}
                        vs approved{" "}
                        <span className="font-mono text-ok">
                          {consoleState.expectedRouting}
                        </span>
                      </>
                    ) : null}
                    .
                  </p>
                  <p>
                    Recommended action: hold payout and confirm bank details with
                    the vendor through a known channel. To release, apply the
                    approved profile routing and re-run both checks.
                  </p>
                  {consoleState.storageNote ? (
                    <p className="text-xs text-opal-mist">
                      {consoleState.storageNote}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {consoleState.holdOpen ? (
                <div className="space-y-3 rounded-lg border border-line bg-white p-3">
                  <button
                    type="button"
                    onClick={() => setReviewOpen((v) => !v)}
                    className="inline-flex w-full items-center justify-between text-left text-sm font-semibold text-opal-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span>AP manager review</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${reviewOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {reviewOpen ? (
                    <div className="space-y-3">
                      <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-opal-label">
                          Resolution reason
                        </span>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                          placeholder="Document why the hold is released or rejected..."
                          className="w-full rounded-lg border border-line bg-console-panel px-3 py-2 text-sm text-opal-main placeholder:text-opal-mist focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                      </label>
                      <label className="flex items-start gap-2.5 rounded-lg border border-line bg-console-panel px-3 py-2.5 text-sm text-opal-main">
                        <input
                          type="checkbox"
                          checked={useApprovedRouting}
                          onChange={(e) =>
                            setUseApprovedRouting(e.target.checked)
                          }
                          className="mt-0.5"
                        />
                        <span>
                          Apply approved profile routing{" "}
                          <span className="font-mono text-ok">
                            {consoleState.expectedRouting ?? "(unavailable)"}
                          </span>{" "}
                          and re-run both checks before posting. Required to
                          release.
                        </span>
                      </label>
                      {actionError ? (
                        <p className="text-sm text-danger">{actionError}</p>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          disabled={busyAction !== null || isRunning}
                          onClick={handleRelease}
                          className="flex-1 rounded-lg border border-ok/30 bg-ok-soft px-3 py-2.5 text-sm font-semibold text-ok hover:bg-ok/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                        >
                          {busyAction === "release"
                            ? "Re-checking and posting..."
                            : "Release with corrected routing"}
                        </button>
                        <button
                          type="button"
                          disabled={busyAction !== null || isRunning}
                          onClick={handleReject}
                          className="flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold text-opal-main hover:bg-console-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                        >
                          {busyAction === "reject"
                            ? "Rejecting..."
                            : "Reject hold"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {consoleState.blockedUnknown ? (
            <div className="rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-3 text-sm leading-relaxed text-warn">
              Payment blocked - unknown or low-confidence vendor is not in the
              company registry.
            </div>
          ) : null}

          {consoleState.holdRejected ? (
            <div className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm leading-relaxed text-danger">
              AP manager rejected the hold. Nothing posted to the ledger.
            </div>
          ) : null}

          {consoleState.posted ? (
            <div className="rounded-xl border border-ok/25 bg-ok-soft px-3.5 py-3 text-sm leading-relaxed text-ok">
              Vendor and bank checks cleared with verification evidence. Invoice
              posted to the AP ledger
              {kpis.statusLabel ? ` - ${kpis.statusLabel.toLowerCase()}.` : "."}
            </div>
          ) : null}

          <CompactEventLog logs={logs} isRunning={isRunning || busyAction !== null} />
        </OpsConsoleShell>
      }
    />
  );
}
