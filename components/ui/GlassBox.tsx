import React from "react";

export interface GlassBoxProps {
  title: string;
  badge?: string;
  /** One-line purpose under the title. */
  purpose?: string;
  /** Case-study brief: the operational problem. */
  problem?: string;
  /** Case-study brief: what the system does. */
  built?: string;
  /** Quiet tech line, e.g. "Python · FastMCP · PostgreSQL". */
  stack?: string;
  controlPanel: React.ReactNode;
  streamPanel: React.ReactNode;
  isRunning?: boolean;
  controlLabel?: string;
  /** @deprecated Prefer purpose; kept for gradual callers. */
  description?: string;
  /** @deprecated Accordion chrome removed from shell. */
  headerExtra?: React.ReactNode;
  /** @deprecated Hint moved into control content. */
  controlHint?: string;
}

/**
 * Executive project-demo shell.
 * Case-study brief up top; lean controls left; live console dominates.
 */
export function GlassBox({
  title,
  badge,
  purpose,
  problem,
  built,
  stack,
  controlPanel,
  streamPanel,
  isRunning = false,
  controlLabel = "Run demo",
  description,
  headerExtra,
}: GlassBoxProps) {
  const lead = purpose ?? description;

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="max-w-3xl">
        {badge ? <p className="eyebrow-opal mb-3">{badge}</p> : null}
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-opal-main text-balance">
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 text-[15px] leading-relaxed text-opal-muted sm:text-base">
            {lead}
          </p>
        ) : null}
      </header>

      {problem || built ? (
        <section
          aria-label="Project brief"
          className="mt-8 max-w-4xl border-t border-slate-200 pt-6"
        >
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-10">
            {problem ? (
              <div>
                <dt className="label-opal">Problem</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted">
                  {problem}
                </dd>
              </div>
            ) : null}
            {built ? (
              <div>
                <dt className="label-opal">What I built</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted">
                  {built}
                </dd>
              </div>
            ) : null}
          </dl>
          {stack ? (
            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
              <span className="label-opal">Stack</span>
              <span className="text-opal-label">{stack}</span>
            </p>
          ) : null}
        </section>
      ) : stack ? (
        <p className="mt-5 flex max-w-3xl flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
          <span className="label-opal">Stack</span>
          <span className="text-opal-label">{stack}</span>
        </p>
      ) : null}

      {headerExtra ? <div className="mt-5 max-w-3xl">{headerExtra}</div> : null}

      <div
        data-running={isRunning}
        className="workspace-shell mt-10 grid grid-cols-1 overflow-hidden rounded-2xl bg-white lg:grid-cols-12 lg:min-h-[620px]"
      >
        <aside className="border-b border-slate-300 bg-white p-5 sm:p-6 lg:col-span-4 lg:border-b-0 lg:border-r lg:overflow-y-auto">
          <h2 className="label-opal mb-4">{controlLabel}</h2>
          {controlPanel}
        </aside>

        <section className="flex min-h-[440px] flex-col console-shell overflow-hidden lg:col-span-8">
          {streamPanel}
        </section>
      </div>
    </div>
  );
}
