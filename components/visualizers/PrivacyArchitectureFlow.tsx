import React from "react";
import {
  BULK_FINDING_THRESHOLD,
  MAX_PAYLOAD_CHARS,
} from "@/lib/privacy/types";

const FLOW_STEPS = [
  {
    number: "01",
    label: "Client boundary",
    detail: "Raw operational text remains owned by the calling interface.",
    gate: "No SSE echo",
  },
  {
    number: "02",
    label: "Payload gate",
    detail: `Reject content above ${MAX_PAYLOAD_CHARS.toLocaleString()} characters before scanning.`,
    gate: "Bounded input",
  },
  {
    number: "03",
    label: "Sensitive-data scan",
    detail: "Check five known formats with deterministic rules and Luhn validation.",
    gate: "Explainable findings",
  },
  {
    number: "04",
    label: "Policy decision",
    detail: "Pass clean text, sanitize findings, or block restricted density.",
    gate: "Fail closed",
  },
  {
    number: "05",
    label: "Control evidence",
    detail: "Return safe output, finding metadata, and a hash-linked receipt.",
    gate: "Reviewable result",
  },
] as const;

const DECISIONS = [
  {
    decision: "Deterministic detectors",
    why: "Findings are fast, explainable, and easy to test.",
    cost: "Coverage is finite and can miss novel encodings.",
    mitigation: "Expand detector regressions and route uncertain cases to review.",
  },
  {
    decision: "Fail-closed bulk gate",
    why: "Dump-style payloads should never rely on partial masking.",
    cost: "Dense legitimate content can be interrupted.",
    mitigation: "Open a review case with a clear exception code and actor action.",
  },
  {
    decision: "Client-owned raw text",
    why: "Unmasked input never enters the server event stream.",
    cost: "The interface must render its own inbound comparison.",
    mitigation: "SSE returns only safe output, findings, and receipt metadata.",
  },
  {
    decision: "One-run override",
    why: "Operators can recover useful text after an over-mask.",
    cost: "A temporary exception increases operational risk.",
    mitigation: "Require a reason and record actor, scope, and result on the receipt.",
  },
] as const;

export function PrivacyArchitectureFlow() {
  return (
    <figure aria-label="Sensitive data redaction gateway control flow and engineering decision ledger.">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-opal">Control flow</p>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-opal-muted">
            Sensitive text is bounded, inspected, and governed before any safe
            output is released to a downstream processor.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-accent-deep">
          Protect before transit
        </span>
      </div>

      <ol className="mt-4 grid list-none gap-2 p-0 md:grid-cols-3 xl:grid-cols-5">
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
                className="absolute -right-2 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-opal-label xl:flex"
                aria-hidden
              >
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-ok/20 bg-ok-soft px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ok">
            Pass
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Forward unchanged
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-opal-muted">
            Zero findings. Safe text continues with a decision receipt.
          </p>
        </div>
        <div className="rounded-xl border border-warn/20 bg-warn-soft px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-warn">
            Sanitize
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Replace and review
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-opal-muted">
            Findings become placeholders. A reasoned one-run release handles
            over-masking.
          </p>
        </div>
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-danger">
            Block
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Stop and open review
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-opal-muted">
            At {BULK_FINDING_THRESHOLD}+ findings, nothing is forwarded and a
            security case opens.
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
          The public runtime performs real bounded scans, redaction decisions,
          overrides, and review-case generation in process. A production gateway
          would add centrally managed policies, durable case storage, encrypted
          audit shipping, and deployment at the edge or API boundary.
        </p>
      </div>

      <figcaption className="sr-only">
        Raw text remains client-owned. The gateway enforces a size boundary,
        scans five known sensitive formats, chooses pass, sanitize, or block,
        and returns safe output with findings and a hash-linked receipt. Bulk
        findings open a security review case. Over-masking can be released for
        one run with an audited reason.
      </figcaption>
    </figure>
  );
}
