import React from "react";

export interface GlassBoxProps {
  title: string;
  badge?: string;
  description?: string;
  headerExtra?: React.ReactNode;
  controlPanel: React.ReactNode;
  streamPanel: React.ReactNode;
  isRunning?: boolean;
  controlLabel?: string;
  controlHint?: string;
}

/** Split workspace: executive controls (light) + engineering console (slate). */
export function GlassBox({
  title,
  badge,
  description,
  headerExtra,
  controlPanel,
  streamPanel,
  isRunning = false,
  controlLabel = "Control",
  controlHint = "Operator input",
}: GlassBoxProps) {
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="mb-8 max-w-3xl">
        {badge ? <p className="eyebrow-opal mb-3">{badge}</p> : null}
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-opal-main text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-[15px] leading-relaxed text-opal-muted max-w-2xl">
            {description}
          </p>
        ) : null}
        {headerExtra ? <div className="mt-5">{headerExtra}</div> : null}
      </header>

      <div
        data-running={isRunning}
        className="workspace-shell grid grid-cols-1 lg:grid-cols-2 min-h-[640px] overflow-hidden rounded-2xl bg-white"
      >
        <section className="bg-white p-5 sm:p-6 lg:border-r border-slate-300 border-b lg:border-b-0">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-opal-main">
              {controlLabel}
            </h2>
            <span className="label-opal shrink-0">{controlHint}</span>
          </div>
          {controlPanel}
        </section>

        <section className="flex min-h-[420px] flex-col console-shell overflow-hidden">
          {streamPanel}
        </section>
      </div>
    </div>
  );
}
