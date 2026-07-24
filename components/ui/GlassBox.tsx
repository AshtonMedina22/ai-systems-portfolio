import React from "react";

export interface GlassBoxProps {
  title: string;
  badge?: string;
  /** From DEMO_MODE: "Interactive demo" | "Live system demo". */
  framing?: string;
  purpose?: string;
  challenge?: string;
  solution?: string;
  impact?: string;
  /** How the system fits together - short, human. */
  architecture?: string;
  /** 2-3 real trade-offs for this project. */
  tradeoffs?: readonly string[];
  stack?: string;
  controlPanel: React.ReactNode;
  streamPanel: React.ReactNode;
  isRunning?: boolean;
  controlLabel?: string;
  /** @deprecated Prefer challenge. */
  problem?: string;
  /** @deprecated Prefer solution. */
  built?: string;
  /** @deprecated Prefer purpose. */
  description?: string;
  /** @deprecated */
  headerExtra?: React.ReactNode;
  /** @deprecated */
  controlHint?: string;
}

/** Project demo shell: brief up top, controls left, console right. */
export function GlassBox({
  title,
  badge,
  framing,
  purpose,
  challenge,
  solution,
  impact,
  architecture,
  tradeoffs,
  stack,
  controlPanel,
  streamPanel,
  isRunning = false,
  controlLabel = "Run demo",
  problem,
  built,
  description,
  headerExtra,
}: GlassBoxProps) {
  const lead = purpose ?? description;
  const challengeText = challenge ?? problem;
  const solutionText = solution ?? built;
  const hasBrief = Boolean(challengeText || solutionText || impact);
  const hasArch = Boolean(architecture || (tradeoffs && tradeoffs.length > 0));

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="max-w-3xl">
        {framing || badge ? (
          <p className="eyebrow-opal mb-3">
            {framing ? framing : null}
            {framing && badge ? " - " : null}
            {badge ? badge : null}
          </p>
        ) : null}
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-opal-main text-balance">
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 text-[15px] leading-relaxed text-opal-muted sm:text-base">
            {lead}
          </p>
        ) : null}
      </header>

      {hasBrief ? (
        <section
          aria-label="Project brief"
          className="mt-8 max-w-4xl border-t border-slate-200 pt-6"
        >
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
            {challengeText ? (
              <div>
                <dt className="label-opal">Challenge</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted">
                  {challengeText}
                </dd>
              </div>
            ) : null}
            {solutionText ? (
              <div>
                <dt className="label-opal">Solution</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted">
                  {solutionText}
                </dd>
              </div>
            ) : null}
            {impact ? (
              <div>
                <dt className="label-opal">Impact</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted">
                  {impact}
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

      {hasArch ? (
        <section
          aria-label="Architecture and trade-offs"
          className="mt-8 max-w-4xl border-t border-slate-200 pt-6"
        >
          <p className="label-opal">Architecture</p>
          {architecture ? (
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-opal-muted">
              {architecture}
            </p>
          ) : null}
          {tradeoffs && tradeoffs.length > 0 ? (
            <div className="mt-5">
              <p className="label-opal">Trade-offs</p>
              <ul className="mt-2 max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-opal-muted">
                {tradeoffs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {headerExtra ? <div className="mt-5 max-w-3xl">{headerExtra}</div> : null}

      <div className="mt-10">
        {framing ? (
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="label-opal">{framing}</p>
            <p className="text-[12px] text-opal-muted">
              Controls left - live run or How it works on the right
            </p>
          </div>
        ) : null}
        <div
          data-running={isRunning}
          className="workspace-shell grid grid-cols-1 overflow-hidden rounded-2xl bg-white lg:grid-cols-12 lg:min-h-[620px]"
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
    </div>
  );
}
