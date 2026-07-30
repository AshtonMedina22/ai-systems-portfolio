import React from "react";

const FLOW_STEPS = [
  {
    number: "01",
    label: "Secure intake",
    detail: "Stage the client export inside an isolated tenant boundary.",
    gate: "No production write",
  },
  {
    number: "02",
    label: "Map and normalize",
    detail: "Profile headers, resolve ambiguity, and reuse approved playbooks.",
    gate: "Operator decision",
  },
  {
    number: "03",
    label: "Validate dependencies",
    detail: "Check account, billing, and user records as one connected batch.",
    gate: "Full-batch gate",
  },
  {
    number: "04",
    label: "Controlled cutover",
    detail: "Commit every verified row together and issue a cutover receipt.",
    gate: "Atomic transaction",
  },
] as const;

const DECISIONS = [
  {
    decision: "Explicit schema mapping",
    why: "Unknown columns cannot silently enter the target model.",
    cost: "Requires an initial operator decision.",
    mitigation: "Approved mappings become reusable client playbooks.",
  },
  {
    decision: "Full-batch transaction",
    why: "Accounts, billing contacts, and users must stay synchronized.",
    cost: "One blocking row pauses the entire cutover.",
    mitigation: "The file is quarantined, remediated, and revalidated.",
  },
  {
    decision: "Tenant-scoped boundary",
    why: "A migration must never affect a neighboring customer.",
    cost: "Isolation adds credential and deployment complexity.",
    mitigation: "Production writes use credentials restricted to one schema.",
  },
  {
    decision: "Safe public runtime",
    why: "Visitors can inspect real parsing and control behavior safely.",
    cost: "The final database transaction is simulated.",
    mitigation: "The UI states the boundary and shows production controls.",
  },
] as const;

export function MigrateArchitectureFlow() {
  return (
    <figure
      aria-label="Client migration system design from secure intake through mapping, validation, quarantine, atomic tenant commit, and cutover receipt."
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-opal">Control flow</p>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-opal-muted">
            Production data remains untouched until mapping, normalization, and
            cross-entity validation all pass.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-accent-deep">
          Verify before write
        </span>
      </div>

      <ol className="mt-4 grid list-none gap-2 p-0 md:grid-cols-4">
        {FLOW_STEPS.map((step, index) => (
          <li key={step.number} className="relative min-w-0">
            <div className="h-full rounded-xl border border-line bg-white/70 p-3.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-opal-label">
                  {step.number}
                </span>
                <span className="rounded-full bg-console-panel px-2 py-0.5 text-[10px] font-semibold text-opal-muted">
                  {step.gate}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-opal-main">
                {step.label}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-opal-muted">
                {step.detail}
              </p>
            </div>
            {index < FLOW_STEPS.length - 1 ? (
              <span
                className="absolute -right-2 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-opal-label md:flex"
                aria-hidden
              >
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-danger">
            Blocking exception
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Quarantine, remediate, revalidate
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-opal-muted">
            No partial records are committed. The full source file remains
            recoverable for an operator-led correction.
          </p>
        </div>
        <div className="rounded-xl border border-ok/20 bg-ok-soft px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ok">
            Verified batch
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Atomic commit and cutover receipt
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-opal-muted">
            Every accepted entity is written together, with tenant and result
            evidence recorded for review.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label-opal">Decision ledger</p>
          <p className="hidden text-xs text-opal-muted sm:block">
            Decision / rationale / cost / mitigation
          </p>
        </div>
        <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white/55">
          {DECISIONS.map((item, index) => (
            <article
              key={item.decision}
              className={`grid gap-2 px-4 py-3.5 lg:grid-cols-[0.72fr_1fr_1.28fr] lg:gap-5 ${
                index > 0 ? "border-t border-line" : ""
              }`}
            >
              <h3 className="text-sm font-semibold text-opal-main">
                {item.decision}
              </h3>
              <p className="text-[13px] leading-relaxed text-opal-muted">
                {item.why}
              </p>
              <p className="text-[13px] leading-relaxed text-opal-muted">
                <span className="font-semibold text-opal-label">Cost: </span>
                {item.cost}{" "}
                <span className="font-semibold text-opal-label">
                  Mitigation:{" "}
                </span>
                {item.mitigation}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-accent/20 bg-accent-soft/60 px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-accent-deep">
          Production boundary
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-opal-muted">
          The public runtime parses and validates real CSV rows and streams real
          control decisions. The final database write is simulated. Production
          deployment would use tenant-scoped credentials and one transaction
          around the full batch.
        </p>
      </div>

      <figcaption className="sr-only">
        The system stages a client export, maps and normalizes its schema,
        validates related entities, quarantines blocking errors, and either
        rolls back or commits the verified batch atomically inside a
        tenant-scoped boundary. A cutover receipt records the result.
      </figcaption>
    </figure>
  );
}
