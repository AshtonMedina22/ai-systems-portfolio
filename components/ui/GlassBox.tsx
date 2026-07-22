import React from "react";

export interface GlassBoxProps {
  title: string;
  badge?: string;
  description?: string;
  controlPanel: React.ReactNode;
  streamPanel: React.ReactNode;
  isRunning?: boolean;
}

/** Split workspace: operator controls on the left, live stream on the right. */
export function GlassBox({
  title,
  badge,
  description,
  controlPanel,
  streamPanel,
  isRunning = false,
}: GlassBoxProps) {
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="mb-8 max-w-3xl">
        {badge ? (
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            {badge}
          </p>
        ) : null}
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-ink text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-[15px] leading-relaxed text-muted max-w-2xl">
            {description}
          </p>
        ) : null}
      </header>

      <div
        data-running={isRunning}
        className="workspace-shell grid grid-cols-1 lg:grid-cols-2 min-h-[640px] bg-surface/80 backdrop-blur-[2px] border border-line"
      >
        <section className="p-5 sm:p-6 lg:border-r border-line border-b lg:border-b-0">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg text-ink">Control</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Operator input
            </span>
          </div>
          {controlPanel}
        </section>

        <section className="flex min-h-[420px] flex-col bg-white/50">
          {streamPanel}
        </section>
      </div>
    </div>
  );
}
