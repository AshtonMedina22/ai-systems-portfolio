"use client";

import React, { useMemo, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { PayFlowOpsConsole } from "@/components/visualizers/PayFlowOpsConsole";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { SAMPLE_INVOICES, InvoicePayload } from "@/lib/payflow/types";
import {
  deriveExecutiveKpis,
  RiskTone,
} from "@/lib/payflow/executive-summary";
import {
  ShieldAlert,
  CheckCircle2,
  FileText,
  ArrowRight,
  UserX,
  ChevronDown,
} from "lucide-react";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LogEntry } from "@/components/ui/TerminalStream";

type PresetKey = "clean" | "spoofed_bank" | "unknown_vendor";

const PRESETS: Array<{
  key: PresetKey;
  label: string;
  detail: string;
  icon: React.ReactNode;
  activeClass: string;
}> = [
  {
    key: "clean",
    label: "Normal Acme invoice",
    detail: "Vendor and bank details look good - should post to the ledger",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-700" />,
    activeClass:
      "border-violet-400 bg-violet-50 text-opal-main shadow-sm ring-1 ring-violet-200",
  },
  {
    key: "spoofed_bank",
    label: "Suspicious Acme invoice",
    detail: "Slight vendor-name typo and a bank routing number that does not match",
    icon: <ShieldAlert className="h-4 w-4 text-rose-700" />,
    activeClass:
      "border-rose-300 bg-rose-50 text-opal-main shadow-sm ring-1 ring-rose-200",
  },
  {
    key: "unknown_vendor",
    label: "Unknown vendor invoice",
    detail: "Vendor is not in the company registry - payment should stop",
    icon: <UserX className="h-4 w-4 text-amber-700" />,
    activeClass:
      "border-amber-300 bg-amber-50 text-opal-main shadow-sm ring-1 ring-amber-200",
  },
];

const RISK_BADGE: Record<RiskTone, BadgeTone> = {
  pending: "neutral",
  low: "ok",
  high: "danger",
  blocked: "danger",
};

function HowThisWorks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card-opal rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-opal-main">
          What this is (in plain English)
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-opal-label transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-slate-300 px-4 py-3.5 text-sm leading-relaxed text-opal-muted space-y-3">
          <p>
            Businesses burn hours typing vendor invoices and checking bank
            details by hand. Worse, if someone sends an invoice with a slightly
            altered bank routing number, money can get wired to the wrong place
            before anyone notices.
          </p>
          <p>
            This demo is an automated invoice checker. It looks at an incoming
            vendor bill, cross-checks it against your internal vendor list with
            smart text matching, and flags anything suspicious - like a
            mismatched routing number or a typo in a vendor name - before a
            human ever hits approve. The right-hand panel shows each check as
            it runs.
          </p>
          <p>
            Same shape of work as ERP and accounting oversight: vendor
            compliance before money leaves the building.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ExecutiveKpiStrip({
  logs,
  isRunning,
}: {
  logs: LogEntry[];
  isRunning: boolean;
}) {
  const kpis = useMemo(() => deriveExecutiveKpis(logs), [logs]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label="Fraud risk"
        value={<Badge tone={RISK_BADGE[kpis.riskLevel]}>{kpis.riskLabel}</Badge>}
      />
      <StatCard
        label="Vendor confidence"
        value={
          kpis.vendorConfidence ?? (isRunning ? "Checking..." : "Not checked")
        }
        hint={kpis.vendorName ?? undefined}
      />
      <StatCard
        label="Action taken"
        value={kpis.actionLabel ?? (isRunning ? "Running checks..." : "Idle")}
      />
    </div>
  );
}

export default function PayFlowPage() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("clean");
  const [activeInvoice, setActiveInvoice] = useState<InvoicePayload>(
    SAMPLE_INVOICES.clean
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const kpis = useMemo(() => deriveExecutiveKpis(logs), [logs]);
  const showImpact = logs.length > 0 || isRunning;

  const handleSelectPreset = (key: PresetKey) => {
    setSelectedPreset(key);
    setActiveInvoice(SAMPLE_INVOICES[key]);
    setLogs([]);
  };

  const handleRunAgent = async () => {
    setIsRunning(true);
    setLogs([]);

    try {
      const response = await fetch("/api/payflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice: activeInvoice }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to /api/payflow stream endpoint.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              const logEntry: LogEntry = JSON.parse(trimmed.substring(6));
              setLogs((prev) => [...prev, logEntry]);
            } catch (err) {
              console.error("Error parsing SSE log payload:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Stream reader error:", err);
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          source: "client:payflow",
          message:
            "Connection lost or stream interrupted while processing the AP workflow.",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen">
      <GlassBox
        title="PayFlow"
        badge="Project 1 - Automated invoice & vendor verification"
        description="Accounts payable automation that cuts down on manual data entry and flags fraudulent vendor bank changes before money leaves the bank. Cross-checks incoming bills against historical records using fuzzy matching to catch spoofed invoices."
        headerExtra={<HowThisWorks />}
        isRunning={isRunning}
        controlLabel="Try it"
        controlHint="Pick an invoice"
        controlPanel={
          <div className="space-y-6">
            <ExecutiveKpiStrip logs={logs} isRunning={isRunning} />

            <div>
              <label className="label-opal mb-2.5 block">Pick an invoice</label>
              <div className="grid grid-cols-1 gap-2.5">
                {PRESETS.map((preset) => {
                  const active = selectedPreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleSelectPreset(preset.key)}
                      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-all duration-200 ${
                        active
                          ? preset.activeClass
                          : "border-slate-300 bg-white text-opal-muted hover:border-violet-300 hover:bg-violet-50/40 hover:text-opal-main"
                      }`}
                    >
                      <span className="mt-0.5">{preset.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-opal-main">
                          {preset.label}
                        </span>
                        <span className="block text-xs text-opal-muted mt-1 leading-relaxed">
                          {preset.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-opal-label">
                  <FileText className="h-3.5 w-3.5 text-opal-purple" />
                  {activeInvoice.invoiceId}
                </span>
                <span className="font-display text-xl font-medium text-opal-violet">
                  ${activeInvoice.invoiceAmount.toLocaleString()}
                </span>
              </div>

              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-opal-label">Vendor</dt>
                  <dd
                    className={`text-right font-medium ${
                      selectedPreset === "spoofed_bank"
                        ? "text-rose-700"
                        : selectedPreset === "unknown_vendor"
                          ? "text-amber-700"
                          : "text-opal-main"
                    }`}
                  >
                    {activeInvoice.vendorName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-opal-label">Tax ID</dt>
                  <dd
                    className={`font-mono text-[12px] font-semibold ${
                      selectedPreset === "unknown_vendor"
                        ? "text-amber-700"
                        : "text-opal-main"
                    }`}
                  >
                    {activeInvoice.vendorTaxId}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-opal-label">Bank</dt>
                  <dd className="font-medium text-opal-main">
                    {activeInvoice.bankDetails.bankName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-opal-label">Routing</dt>
                  <dd
                    className={`font-mono text-[12px] font-semibold ${
                      selectedPreset === "spoofed_bank"
                        ? "text-rose-700"
                        : "text-opal-main"
                    }`}
                  >
                    {activeInvoice.bankDetails.routingNumber}
                  </dd>
                </div>
              </dl>
            </div>

            {showImpact ? (
              <div className="rounded-xl border border-slate-300 bg-violet-50/50 px-4 py-3.5 space-y-3">
                <p className="label-opal">What happened</p>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Risk</span>
                  <Badge tone={RISK_BADGE[kpis.riskLevel]}>
                    {kpis.riskLabel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">
                    Time this may save
                  </span>
                  <span className="font-semibold text-opal-main">
                    {kpis.timeSavedMinutes != null
                      ? `About ${kpis.timeSavedMinutes} minutes`
                      : isRunning
                        ? "Working..."
                        : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Result</span>
                  <span className="text-right font-semibold text-opal-main">
                    {kpis.statusLabel ?? (isRunning ? "In progress" : "-")}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5">
              <p className="label-opal mb-2">Built with</p>
              <p className="text-sm leading-relaxed text-opal-muted">
                FastMCP (verify_vendor_entity, check_bank_routing,
                post_erp_ledger) - deterministic checks - SSE stream
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunAgent}
              disabled={isRunning}
              className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-opal-purple px-4 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-opal-violet disabled:opacity-50"
            >
              <span>{isRunning ? "Checking invoice..." : "Run invoice check"}</span>
              {!isRunning ? (
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              ) : null}
            </button>
          </div>
        }
        streamPanel={
          <PayFlowOpsConsole
            logs={logs}
            isRunning={isRunning}
            invoice={activeInvoice}
            onClear={() => setLogs([])}
          />
        }
      />
    </div>
  );
}
