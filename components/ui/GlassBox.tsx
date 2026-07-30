import React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

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
  /** Optional exception section heading. */
  exceptionLabel?: string;
  /** Optional supporting line beneath the exception heading. */
  exceptionKicker?: string;
  /** Keep the exception model visible instead of placing it in a disclosure. */
  exceptionMode?: "collapsible" | "expanded";
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
  /** Optional architecture section heading. */
  architectureLabel?: string;
  /** Optional supporting line beneath the architecture heading. */
  architectureKicker?: string;
  /** Keep the architecture visible instead of placing it in a disclosure. */
  architectureMode?: "collapsible" | "expanded";
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
  exceptionLabel = "Exception path",
  exceptionKicker,
  exceptionMode = "collapsible",
  guardrails,
  architecture,
  architectureVisual,
  architectureLabel = "Architecture and trade-offs",
  architectureKicker,
  architectureMode = "collapsible",
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
  const architectureBody = hasArch ? (
    <div
      className={`grid gap-5 ${
        architectureVisual && (architecture || tradeoffs?.length)
          ? "lg:grid-cols-[1.1fr_0.9fr]"
          : ""
      }`}
      aria-label={architectureLabel}
    >
      {architectureVisual ? architectureVisual : null}
      {architecture || (tradeoffs && tradeoffs.length > 0) ? (
        <div>
          {architecture ? (
            <p className="text-[14px] leading-relaxed text-opal-muted">
              {architecture}
            </p>
          ) : null}
          {tradeoffs && tradeoffs.length > 0 ? (
            <div className={architecture ? "mt-4" : ""}>
              <p className="label-opal">Trade-offs</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-opal-muted">
                {tradeoffs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4">
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

      <header className="max-w-4xl">
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
          <p className="mt-2 text-base leading-relaxed text-opal-main sm:text-[17px]">
            {valueLine}
          </p>
        ) : null}
        {controlStatement ? (
          <p className="mt-3 border-l-2 border-accent/45 pl-3.5 text-[15px] leading-relaxed text-opal-muted">
            <span className="font-semibold text-opal-main">Control. </span>
            {controlStatement}
          </p>
        ) : null}
        {stack ? (
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="label-opal">Stack</span>
            <span className="text-opal-label">{stack}</span>
          </p>
        ) : null}
      </header>

      {hasBrief || guardrails ? (
        <section
          aria-label="System brief"
          className="mt-6 max-w-6xl border-t border-line pt-5"
        >
          <div className="grid gap-6 lg:grid-cols-[1.45fr_0.75fr] lg:gap-8">
            {hasBrief ? (
              <div>
                <h2 className="label-opal">System brief</h2>
                <dl className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2">
                  {challengeText ? (
                    <div>
                      <dt className="text-sm font-semibold text-opal-main">
                        Challenge
                      </dt>
                      <dd className="mt-1.5 text-[14px] leading-relaxed text-opal-muted">
                        {challengeText}
                      </dd>
                    </div>
                  ) : null}
                  {solutionText ? (
                    <div>
                      <dt className="text-sm font-semibold text-opal-main">
                        Solution
                      </dt>
                      <dd className="mt-1.5 text-[14px] leading-relaxed text-opal-muted">
                        {solutionText}
                      </dd>
                    </div>
                  ) : null}
                  {impact ? (
                    <div className="border-l-2 border-opal-aqua pl-3.5 md:col-span-2">
                      <dt className="text-sm font-semibold text-opal-main">
                        Business impact
                      </dt>
                      <dd className="mt-1 text-[14px] leading-relaxed text-opal-muted">
                        {impact}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            {guardrails ? (
              <aside className="border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <h2 className="label-opal">Guardrails</h2>
                <dl className="mt-3 space-y-3">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.07em] text-opal-label">
                      Objective
                    </dt>
                    <dd className="mt-0.5 text-[13px] leading-relaxed text-opal-muted">
                      {guardrails.objective}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.07em] text-opal-label">
                      System access
                    </dt>
                    <dd className="mt-0.5 text-[13px] leading-relaxed text-opal-muted">
                      {guardrails.access}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.07em] text-opal-label">
                      Failure owner
                    </dt>
                    <dd className="mt-0.5 text-[13px] leading-relaxed text-opal-muted">
                      {guardrails.failure}
                    </dd>
                  </div>
                </dl>
              </aside>
            ) : null}
          </div>
        </section>
      ) : null}

      {whenWrong && exceptionMode === "expanded" ? (
        <section
          aria-labelledby="exception-heading"
          className="mt-5 max-w-6xl overflow-hidden rounded-2xl border border-line bg-white/45 shadow-opal-soft backdrop-blur-xl"
        >
          <header className="border-b border-line bg-white/45 px-4 py-4 sm:px-5">
            <h2 id="exception-heading" className="label-opal">
              {exceptionLabel}
            </h2>
            {exceptionKicker ? (
              <p className="mt-1 text-sm leading-relaxed text-opal-muted">
                {exceptionKicker}
              </p>
            ) : null}
          </header>
          <div className="px-4 py-5 sm:px-5">{whenWrong}</div>
        </section>
      ) : whenWrong ? (
        <details className="group mt-5 max-w-6xl overflow-hidden rounded-xl border border-line bg-white/35 shadow-sm backdrop-blur-xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
            <span>
              <span className="block label-opal">{exceptionLabel}</span>
              <span className="mt-1 block text-sm text-opal-muted">
                {exceptionKicker ?? "Hold / review"}
              </span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-opal-muted transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div
            className="border-t border-line px-4 py-4 sm:px-5"
            aria-label="What happens when it is wrong"
          >
            {whenWrong}
          </div>
        </details>
      ) : null}

      {hasArch && architectureMode === "expanded" ? (
        <section
          aria-labelledby="architecture-heading"
          className="mt-5 max-w-6xl overflow-hidden rounded-2xl border border-line bg-white/45 shadow-opal-soft backdrop-blur-xl"
        >
          <header className="border-b border-line bg-white/45 px-4 py-4 sm:px-5">
            <h2 id="architecture-heading" className="label-opal">
              {architectureLabel}
            </h2>
            {architectureKicker ? (
              <p className="mt-1 text-sm leading-relaxed text-opal-muted">
                {architectureKicker}
              </p>
            ) : null}
          </header>
          <div className="px-4 py-5 sm:px-5">{architectureBody}</div>
        </section>
      ) : hasArch ? (
        <details className="group mt-5 max-w-6xl overflow-hidden rounded-xl border border-line bg-white/35 shadow-sm backdrop-blur-xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
            <span>
              <span className="block label-opal">{architectureLabel}</span>
              {architectureKicker ? (
                <span className="mt-1 block text-sm leading-relaxed text-opal-muted">
                  {architectureKicker}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-opal-muted transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="border-t border-line px-4 py-4 sm:px-5">
            {architectureBody}
          </div>
        </details>
      ) : null}

      {headerExtra ? <div className="mt-5 max-w-3xl">{headerExtra}</div> : null}

      <div className="mt-7">
        {framing ? (
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="label-opal">{framing}</p>
            <p className="text-sm text-opal-muted">
              1 Choose a scenario · 2 Run the system · 3 Inspect how it works
            </p>
          </div>
        ) : null}
        <div
          data-running={isRunning}
          className="workspace-shell grid grid-cols-1 overflow-hidden lg:min-h-[560px] lg:grid-cols-12"
        >
          <aside className="border-b border-white/60 bg-white/48 backdrop-blur-xl lg:col-span-4 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div className="opal-chrome border-b border-console-border px-2 py-2 sm:px-3">
              <div className="flex min-h-10 items-center gap-2.5 rounded-lg border border-line-strong bg-white/60 px-3 py-2 shadow-sm">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                  1
                </span>
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-opal-main">
                    Choose {controlLabel.toLowerCase()}
                  </span>
                  <span className="block text-[10px] text-opal-muted">
                    Select an input, then use the run button
                  </span>
                </span>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <h2 className="sr-only">{controlLabel}</h2>
              {controlPanel}
            </div>
          </aside>

          <section className="console-shell flex min-h-[360px] flex-col overflow-hidden sm:min-h-[400px] lg:col-span-8 lg:min-h-0">
            {streamPanel}
          </section>
        </div>
      </div>
    </div>
  );
}
