import React from "react";
import Link from "next/link";

export interface GlassBoxProps {
  title: string;
  badge?: string;
  /** From DEMO_MODE: "Interactive demo" | "Live system demo". */
  framing?: string;
  purpose?: string;
  /** One-line business result near the title. */
  valueLine?: string;
  /** Explicit control gate - short, executive-readable. */
  controlStatement?: string;
  challenge?: string;
  solution?: string;
  impact?: string;
  /** Callout for mismatch / hold / review path. */
  whenWrong?: React.ReactNode;
  /**
   * Executive guardrails panel - same three headings on every demo.
   * Answers success metric, access scope, and failure ownership.
   */
  guardrails?: {
    objective: string;
    access: string;
    failure: string;
  };
  /** How the system fits together - short, human. */
  architecture?: string;
  /** Visual flow diagram shown in the architecture section. */
  architectureVisual?: React.ReactNode;
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
  valueLine,
  controlStatement,
  challenge,
  solution,
  impact,
  whenWrong,
  guardrails,
  architecture,
  architectureVisual,
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
  const hasArch = Boolean(
    architecture ||
      architectureVisual ||
      (tradeoffs && tradeoffs.length > 0)
  );

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-opal-muted">
          <li>
            <Link
              href="/#projects"
              className="font-medium text-accent transition-colors hover:text-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Case studies
            </Link>
          </li>
          <li aria-hidden className="text-opal-mist">
            /
          </li>
          <li className="font-medium text-opal-main">{title}</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        {framing || badge ? (
          <p className="eyebrow-opal mb-3">
            {framing ? framing : null}
            {framing && badge ? " - " : null}
            {badge ? badge : null}
          </p>
        ) : null}
        <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-opal-main sm:text-4xl">
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 text-base leading-relaxed text-opal-muted sm:text-[17px]">
            {lead}
          </p>
        ) : null}
        {valueLine ? (
          <p className="mt-3 text-base leading-relaxed text-opal-main sm:text-[17px]">
            {valueLine}
          </p>
        ) : null}
        {controlStatement ? (
          <p className="mt-4 border-l-2 border-line-strong pl-3.5 text-[15px] leading-relaxed text-opal-muted">
            <span className="font-semibold text-opal-main">Control. </span>
            {controlStatement}
          </p>
        ) : null}
      </header>

      {hasBrief ? (
        <section
          aria-label="Project brief"
          className="mt-8 max-w-4xl border-t border-line pt-6"
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
            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="label-opal">Stack</span>
              <span className="text-opal-label">{stack}</span>
            </p>
          ) : null}
        </section>
      ) : stack ? (
        <p className="mt-5 flex max-w-3xl flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="label-opal">Stack</span>
          <span className="text-opal-label">{stack}</span>
        </p>
      ) : null}

      {guardrails ? (
        <section
          aria-label="System Guardrails and Scope"
          className="mt-8 max-w-4xl border-t border-line pt-6"
        >
          <h2 className="label-opal">System Guardrails & Scope</h2>
          <dl className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
            <div>
              <dt className="text-sm font-semibold text-opal-main">
                Primary Objective
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted">
                {guardrails.objective}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-opal-main">
                System Access
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted">
                {guardrails.access}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-opal-main">
                Failure Handling
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted">
                {guardrails.failure}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {whenWrong ? (
        <details className="mt-8 max-w-4xl border-t border-line pt-6 open:pb-0">
          <summary className="cursor-pointer list-none">
            <span className="label-opal">What happens when it is wrong</span>
            <span className="ml-2 text-sm text-opal-muted">
              Hold / review path
            </span>
          </summary>
          <div className="mt-4" aria-label="What happens when it is wrong">
            {whenWrong}
          </div>
        </details>
      ) : null}

      {hasArch ? (
        <details className="mt-8 max-w-4xl border-t border-line pt-6" open>
          <summary className="cursor-pointer list-none">
            <span className="label-opal">Architecture and trade-offs</span>
          </summary>
          <div
            className="mt-4"
            aria-label="Architecture and trade-offs"
          >
            {architectureVisual ? architectureVisual : null}
            {architecture ? (
              <p
                className={`${architectureVisual ? "mt-4" : "mt-2"} max-w-3xl text-[15px] leading-relaxed text-opal-muted`}
              >
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
          </div>
        </details>
      ) : null}

      {headerExtra ? <div className="mt-5 max-w-3xl">{headerExtra}</div> : null}

      <div className="mt-10">
        {framing ? (
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="label-opal">{framing}</p>
            <p className="text-sm text-opal-muted">
              Controls left - live run or How it works on the right
            </p>
          </div>
        ) : null}
        <div
          data-running={isRunning}
          className="workspace-shell grid grid-cols-1 overflow-hidden lg:grid-cols-12 lg:min-h-[620px]"
        >
          <aside className="border-b border-white/60 bg-white/48 p-5 backdrop-blur-xl sm:p-6 lg:col-span-4 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <h2 className="label-opal mb-4">{controlLabel}</h2>
            {controlPanel}
          </aside>

          <section className="console-shell flex min-h-[440px] flex-col overflow-hidden lg:col-span-8">
            {streamPanel}
          </section>
        </div>
      </div>
    </div>
  );
}
