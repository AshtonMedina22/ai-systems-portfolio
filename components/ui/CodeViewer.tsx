"use client";

import React, { useId, useState } from "react";
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
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border border-console-border bg-console-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-console-border px-2 py-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Source files">
          {files.map((f, index) => {
            const selected = index === active;
            return (
              <button
                key={f.name}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(index)}
                className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected
                    ? "bg-accent-soft text-accent-deep ring-1 ring-accent/30"
                    : "text-opal-muted hover:bg-white/55 hover:text-opal-main"
                }`}
              >
                {f.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {file.kind === "illustrative" ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-warn">
              Demo sample
            </span>
          ) : null}
          {file.kind === "config" ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
              Config (not wired)
            </span>
          ) : null}
          <span className="font-mono text-[11px] uppercase tracking-wide text-opal-mist">
            {languageLabel(file.language)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-opal-muted hover:bg-white/55 hover:text-opal-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-ok" />
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
      <pre className="flex-1 overflow-auto bg-white/48 px-4 py-3 font-mono text-[13px] leading-relaxed text-opal-main backdrop-blur-xl">
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
  const baseId = useId();
  const liveTabId = `${baseId}-live-tab`;
  const sourceTabId = `${baseId}-source-tab`;
  const livePanelId = `${baseId}-live-panel`;
  const sourcePanelId = `${baseId}-source-panel`;

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div
        className="opal-chrome flex items-stretch gap-1 border-b border-console-border px-2 py-2 sm:px-3"
        role="tablist"
        aria-label="Demo and how it works"
      >
        <button
          type="button"
          role="tab"
          id={liveTabId}
          aria-controls={livePanelId}
          aria-selected={tab === "live"}
          onClick={() => setTab("live")}
          className={`flex-1 rounded-lg px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            tab === "live"
              ? "bg-accent-soft text-accent-deep ring-1 ring-accent/30"
              : "text-opal-muted hover:bg-white/55 hover:text-opal-main"
          }`}
        >
          {liveLabel}
        </button>
        <button
          type="button"
          role="tab"
          id={sourceTabId}
          aria-controls={sourcePanelId}
          aria-selected={tab === "source"}
          onClick={() => setTab("source")}
          className={`flex-1 rounded-lg px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            tab === "source"
              ? "bg-accent-soft text-accent-deep ring-1 ring-accent/30"
              : "text-opal-muted hover:bg-white/55 hover:text-opal-main"
          }`}
        >
          How it works
        </button>
      </div>
      <div
        className="min-h-0 flex-1"
        role="tabpanel"
        id={tab === "live" ? livePanelId : sourcePanelId}
        aria-labelledby={tab === "live" ? liveTabId : sourceTabId}
      >
        {tab === "live" ? (
          live
        ) : (
          <div className="h-full space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            <p className="text-sm leading-relaxed text-opal-muted">
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
