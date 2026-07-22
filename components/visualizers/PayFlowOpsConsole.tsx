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
  let bankMatch: boolean | null = null;
  let vendorStatus: string | null = null;
  let escalated = false;
  let posted = false;
  let blockedUnknown = false;

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
    if (data.status === "MATCH_FOUND") vendorStatus = "matched";
    if (data.status === "UNREGISTERED_ENTITY") {
      vendorStatus = "unknown";
      blockedUnknown = true;
    }
    if (typeof data.isMatch === "boolean") bankMatch = data.isMatch;
    if (data.action === "ESCALATE_TO_COMPLIANCE" || data.isMatch === false) {
      escalated = true;
    }
    if (data.action === "POST_TO_ERP_LEDGER") posted = true;
  }

  return {
    nameSimilarity,
    officialName,
    expectedRouting,
    bankMatch,
    vendorStatus,
    escalated,
    posted,
    blockedUnknown,
  };
}

export function PayFlowOpsConsole({
  logs,
  isRunning,
  invoice,
  onClear,
}: {
  logs: LogEntry[];
  isRunning: boolean;
  invoice: InvoicePayload;
  onClear?: () => void;
}) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const kpis = useMemo(() => deriveExecutiveKpis(logs), [logs]);
  const consoleState = useMemo(() => derivePayFlowConsole(logs), [logs]);

  const idle = logs.length === 0 && !isRunning;

  const statusTone = idle || isRunning
    ? "live"
    : consoleState.escalated || consoleState.blockedUnknown
      ? "danger"
      : consoleState.posted
        ? "ok"
        : "warn";

  const statusLabel = idle
    ? "Live - listening for invoices"
    : isRunning
      ? "Live - checking invoice"
      : consoleState.blockedUnknown
        ? "Unknown vendor blocked"
        : consoleState.escalated
          ? "Intercepted - payment held"
          : consoleState.posted
            ? "Cleared for ledger"
            : "Checks finished";

  const similarityValue = consoleState.nameSimilarity ?? 0;
  const similarityReady = consoleState.nameSimilarity != null;

  return (
    <DemoPanelTabs
      sourceFiles={PAYFLOW_SOURCE_FILES}
      live={
        <OpsConsoleShell
          title="Live Visual Console"
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRunning={idle || isRunning}
          eventCount={logs.length}
          onClear={onClear}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-500/50 bg-slate-950/35 p-3.5">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Incoming invoice
              </p>
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Vendor</dt>
                  <dd className="text-right font-medium text-white">
                    {invoice.vendorName}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Tax ID</dt>
                  <dd className="font-mono text-[12px] text-slate-100">
                    {invoice.vendorTaxId}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Routing</dt>
                  <dd
                    className={`font-mono text-[12px] font-semibold ${
                      consoleState.bankMatch === false
                        ? "text-rose-300"
                        : "text-slate-100"
                    }`}
                  >
                    {invoice.bankDetails.routingNumber}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Amount</dt>
                  <dd className="font-semibold text-white">
                    ${invoice.invoiceAmount.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-500/50 bg-slate-950/35 p-3.5">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Master vendor profile
              </p>
              {consoleState.vendorStatus === "unknown" ? (
                <p className="text-[13px] leading-relaxed text-amber-200">
                  No match in the company vendor list for this tax ID / name.
                </p>
              ) : consoleState.officialName || consoleState.expectedRouting ? (
                <dl className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Official name</dt>
                    <dd className="text-right font-medium text-emerald-300">
                      {consoleState.officialName ?? "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Approved routing</dt>
                    <dd className="font-mono text-[12px] text-emerald-300">
                      {consoleState.expectedRouting ?? "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Bank check</dt>
                    <dd
                      className={`font-semibold ${
                        consoleState.bankMatch === false
                          ? "text-rose-300"
                          : consoleState.bankMatch === true
                            ? "text-emerald-300"
                            : "text-slate-300"
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
                <dl className="space-y-1.5 text-[13px] text-slate-400">
                  <div className="flex justify-between gap-2">
                    <dt>Official name</dt>
                    <dd className="text-right">Waiting for check...</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Approved routing</dt>
                    <dd className="font-mono text-[12px]">-</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Bank check</dt>
                    <dd>Pending</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-500/50 bg-slate-950/35 p-3.5">
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
              <p className="mt-2 text-[12px] text-slate-400">
                Pick an invoice on the left and hit Run invoice check to fill
                the match score and security banners.
              </p>
            ) : null}
          </div>

          {consoleState.escalated ? (
            <div className="rounded-xl border border-rose-400/60 bg-rose-950/50 p-3.5 space-y-3 shadow-[0_0_0_1px_rgba(251,113,133,0.25)]">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-rose-100">
                    Intercepted: routing number mismatch
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-rose-200/90">
                    Invoice routing does not match the approved payment profile.
                    Payment is paused for manager review.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoticeOpen((v) => !v)}
                className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-rose-400/40 bg-rose-900/40 px-3 py-2.5 text-left text-sm font-medium text-rose-50 hover:bg-rose-900/60"
              >
                <span>View manager escalation notice</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${noticeOpen ? "rotate-180" : ""}`}
                />
              </button>
              {noticeOpen ? (
                <div className="rounded-lg border border-rose-400/30 bg-slate-950/50 px-3 py-3 text-[13px] leading-relaxed text-slate-200 space-y-2">
                  <p>
                    <span className="font-semibold text-white">Notice: </span>
                    Unauthorized bank routing change on {invoice.invoiceId} for{" "}
                    {invoice.vendorName}.
                  </p>
                  <p>
                    Submitted routing{" "}
                    <span className="font-mono text-rose-300">
                      {invoice.bankDetails.routingNumber}
                    </span>
                    {consoleState.expectedRouting ? (
                      <>
                        {" "}
                        vs approved{" "}
                        <span className="font-mono text-emerald-300">
                          {consoleState.expectedRouting}
                        </span>
                      </>
                    ) : null}
                    .
                  </p>
                  <p className="text-slate-400">
                    Recommended action: hold payout and confirm bank details with
                    the vendor through a known channel.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {consoleState.blockedUnknown ? (
            <div className="rounded-xl border border-amber-400/40 bg-amber-950/30 px-3.5 py-3 text-[13px] leading-relaxed text-amber-100">
              Payment blocked - vendor is not in the company registry.
            </div>
          ) : null}

          {consoleState.posted ? (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/30 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-100">
              Vendor and bank checks cleared. Invoice posted to the AP ledger
              {kpis.statusLabel ? ` - ${kpis.statusLabel.toLowerCase()}.` : "."}
            </div>
          ) : null}

          <CompactEventLog logs={logs} isRunning={isRunning} />
        </OpsConsoleShell>
      }
    />
  );
}
