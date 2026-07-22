"use client";

import React, { useMemo, useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { TerminalStream, LogEntry } from "@/components/ui/TerminalStream";
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
    label: "Standard clean invoice (Acme Corp)",
    detail: "Clean path - vendor match, bank OK, auto-post to AP ledger",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-700" />,
    activeClass:
      "border-violet-400 bg-violet-50 text-opal-main shadow-sm ring-1 ring-violet-200",
  },
  {
    key: "spoofed_bank",
    label: "Spoofed fraud invoice (Acme Enterprize)",
    detail:
      "Fraud path - subtle vendor-name typo plus unauthorized bank routing change",
    icon: <ShieldAlert className="h-4 w-4 text-rose-700" />,
    activeClass:
      "border-rose-300 bg-rose-50 text-opal-main shadow-sm ring-1 ring-rose-200",
  },
  {
    key: "unknown_vendor",
    label: "Unregistered vendor invoice",
    detail:
      "Identity path - blocks payment when the enterprise registry has no match",
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
          How this works for your business
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-opal-label transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-slate-300 px-4 py-3.5 text-sm leading-relaxed text-opal-muted space-y-3">
          <p>
            Accounts payable teams burn hours keying invoices, verifying vendor
            records, and checking bank routing details by hand. That slow process
            leaves companies open to invoice spoofing and fraudulent bank account
            changes before payouts go out.
          </p>
          <p>
            PayFlow is an automated AP agent with financial safeguards - not an
            unsupervised AI that decides payouts alone. Model Context Protocol
            (MCP) exposes secure tools over JSON-RPC to enterprise ledgers (SAP,
            NetSuite, Salesforce finance). Every run verifies the vendor, checks
            bank routing, then posts to the AP ledger only if both checks pass.
            Anything unusual is halted and escalated for manager review.
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
        title="PayFlow AP & Fraud Prevention"
        badge="Project 1 - Enterprise Accounts Payable Automation & Anti-Fraud Suite"
        description="Eliminates manual invoice entry, validates vendors against core ledger systems in real time, and flags fraudulent routing changes before money leaves company accounts."
        headerExtra={<HowThisWorks />}
        isRunning={isRunning}
        controlLabel="User action"
        controlHint="Select invoice payload"
        controlPanel={
          <div className="space-y-6">
            <ExecutiveKpiStrip logs={logs} isRunning={isRunning} />

            <div>
              <label className="label-opal mb-2.5 block">
                Select invoice payload
              </label>
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
                <p className="label-opal">Business impact summary</p>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Risk level</span>
                  <Badge tone={RISK_BADGE[kpis.riskLevel]}>
                    {kpis.riskLabel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Time saved</span>
                  <span className="font-semibold text-opal-main">
                    {kpis.timeSavedMinutes != null
                      ? `~${kpis.timeSavedMinutes} minutes`
                      : isRunning
                        ? "Calculating..."
                        : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-opal-label">Status</span>
                  <span className="text-right font-semibold text-opal-main">
                    {kpis.statusLabel ?? (isRunning ? "In progress" : "-")}
                  </span>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleRunAgent}
              disabled={isRunning}
              className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-opal-purple px-4 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-opal-violet disabled:opacity-50"
            >
              <span>
                {isRunning
                  ? "Running AP verification..."
                  : "Run Automated AP Verification"}
              </span>
              {!isRunning ? (
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              ) : null}
            </button>
          </div>
        }
        streamPanel={
          <TerminalStream
            logs={logs}
            isRunning={isRunning}
            title="Live glass-box MCP terminal"
            onClear={() => setLogs([])}
            emptyMessage={
              <p>
                Run Automated AP Verification to stream MCP{" "}
                <span className="font-mono text-[13px] font-medium text-violet-300">
                  tools/list
                </span>
                ,{" "}
                <span className="font-mono text-[13px] font-medium text-violet-300">
                  tools/call
                </span>
                , fuzzy match scores, and fraud escalations here.
              </p>
            }
          />
        }
      />
    </div>
  );
}
