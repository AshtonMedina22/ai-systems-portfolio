"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GlassBox } from "@/components/ui/GlassBox";
import { TerminalStream, LogEntry } from "@/components/ui/TerminalStream";
import { SAMPLE_INVOICES, InvoicePayload } from "@/lib/payflow/types";
import {
  ShieldAlert,
  CheckCircle2,
  FileText,
  ArrowRight,
  UserX,
} from "lucide-react";

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
    label: "Clean invoice",
    detail: "Approve + post ledger",
    icon: <CheckCircle2 className="h-4 w-4 text-ok" />,
    activeClass: "border-accent bg-accent-soft/60 text-ink",
  },
  {
    key: "spoofed_bank",
    label: "Spoofed bank",
    detail: "Unauthorized routing",
    icon: <ShieldAlert className="h-4 w-4 text-danger" />,
    activeClass: "border-danger/50 bg-danger/5 text-ink",
  },
  {
    key: "unknown_vendor",
    label: "Unknown vendor",
    detail: "Unregistered entity",
    icon: <UserX className="h-4 w-4 text-warn" />,
    activeClass: "border-warn/50 bg-warn/5 text-ink",
  },
];

export default function PayFlowPage() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("clean");
  const [activeInvoice, setActiveInvoice] = useState<InvoicePayload>(
    SAMPLE_INVOICES.clean
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

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
            "Connection lost or stream interrupted while processing AP Agent workflow.",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <Link
          href="/"
          className="inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-accent transition-colors"
        >
          Back to portfolio
        </Link>
      </div>

      <GlassBox
        title="PayFlow"
        badge="Project 1 - FastMCP"
        description="Select an AP invoice scenario. The right panel streams MCP tools/list and tools/call for vendor checks, bank anti-fraud, and ledger posting."
        isRunning={isRunning}
        controlPanel={
          <div className="space-y-6">
            <div>
              <label className="mb-2.5 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                Scenario
              </label>
              <div className="grid grid-cols-1 gap-2">
                {PRESETS.map((preset) => {
                  const active = selectedPreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleSelectPreset(preset.key)}
                      className={`flex items-start gap-3 border px-3.5 py-3 text-left transition-colors duration-200 ${
                        active
                          ? preset.activeClass
                          : "border-line bg-white/40 text-muted hover:border-accent/40 hover:text-ink"
                      }`}
                    >
                      <span className="mt-0.5">{preset.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">
                          {preset.label}
                        </span>
                        <span className="block text-xs text-muted mt-0.5">
                          {preset.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border border-line bg-white/50 px-4 py-3.5">
              <div className="flex items-center justify-between border-b border-line pb-2.5 mb-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                  <FileText className="h-3.5 w-3.5" />
                  {activeInvoice.invoiceId}
                </span>
                <span className="font-display text-lg text-accent-deep">
                  ${activeInvoice.invoiceAmount.toLocaleString()}
                </span>
              </div>

              <dl className="space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted shrink-0">Vendor</dt>
                  <dd className="text-right text-ink">
                    {activeInvoice.vendorName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Tax ID</dt>
                  <dd
                    className={`font-mono text-[12px] ${
                      selectedPreset === "unknown_vendor"
                        ? "text-warn font-medium"
                        : "text-ink"
                    }`}
                  >
                    {activeInvoice.vendorTaxId}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Bank</dt>
                  <dd className="text-ink">
                    {activeInvoice.bankDetails.bankName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Routing</dt>
                  <dd
                    className={`font-mono text-[12px] ${
                      selectedPreset === "spoofed_bank"
                        ? "text-danger font-medium"
                        : "text-ink"
                    }`}
                  >
                    {activeInvoice.bankDetails.routingNumber}
                  </dd>
                </div>
              </dl>
            </div>

            <button
              type="button"
              onClick={handleRunAgent}
              disabled={isRunning}
              className="group w-full inline-flex items-center justify-center gap-2 bg-accent px-4 py-3.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
            >
              <span>
                {isRunning ? "Running MCP tools…" : "Run PayFlow agent"}
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
            title="MCP receipt"
            onClear={() => setLogs([])}
          />
        }
      />
    </div>
  );
}
