"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

export type SourceFile = {
  name: string;
  language: "python" | "typescript" | "sql";
  code: string;
  /**
   * runtime      - code the page runs
   * illustrative - sample snippet
   * config       - prod shape; not wired in mockup
   */
  kind?: "runtime" | "illustrative" | "config";
};

function languageLabel(language: SourceFile["language"]) {
  if (language === "python") return "Python";
  if (language === "sql") return "SQL";
  return "TypeScript";
}

export function CodeViewer({ files }: { files: SourceFile[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const file = files[Math.min(active, files.length - 1)];

  if (!file) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(file.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border border-slate-500/50 bg-slate-950/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-500/40 px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {files.map((f, index) => {
            const selected = index === active;
            return (
              <button
                key={f.name}
                type="button"
                onClick={() => setActive(index)}
                className={`rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-medium transition-colors ${
                  selected
                    ? "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {f.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {file.kind === "illustrative" ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-amber-400/90">
              Demo sample
            </span>
          ) : null}
          {file.kind === "config" ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-sky-400/90">
              Config (not wired)
            </span>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            {languageLabel(file.language)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-200">
        <code>{file.code}</code>
      </pre>
    </div>
  );
}

export function DemoPanelTabs({
  live,
  sourceFiles,
  liveLabel = "Live demo",
}: {
  live: React.ReactNode;
  sourceFiles: SourceFile[];
  /** Matches project framing when useful (Live system demo / Interactive demo). */
  liveLabel?: string;
}) {
  const [tab, setTab] = useState<"live" | "source">("live");

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div
        className="flex items-stretch gap-1 border-b border-slate-500/50 bg-slate-900/70 px-2 py-2 sm:px-3"
        role="tablist"
        aria-label="Demo and how it works"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "live"}
          onClick={() => setTab("live")}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            tab === "live"
              ? "bg-violet-500/25 text-white ring-1 ring-violet-400/40"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          {liveLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "source"}
          onClick={() => setTab("source")}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            tab === "source"
              ? "bg-violet-500/25 text-white ring-1 ring-violet-400/40"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          How it works
        </button>
      </div>
      <div className="flex-1 min-h-0" role="tabpanel">
        {tab === "live" ? (
          live
        ) : (
          <div className="h-full overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
            <p className="text-[13px] leading-relaxed text-slate-400">
              Code that matches what you just ran. Config (not wired) tabs are
              prod shapes only. Demo sample is illustrative.
            </p>
            <CodeViewer files={sourceFiles} />
          </div>
        )}
      </div>
    </div>
  );
}
