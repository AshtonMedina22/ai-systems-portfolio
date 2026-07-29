import React from "react";
import { BULK_FINDING_THRESHOLD } from "@/lib/privacy/types";

/** Compact Opal-styled path for technical reviewers. */
export function PrivacyArchitectureFlow() {
  return (
    <figure
      className="mt-4"
      aria-label="Privacy proxy architecture: inbound payload to deterministic scan to pass, sanitize, or block before downstream transit, with a privacy receipt."
    >
      <ol className="m-0 flex list-none flex-col gap-2 p-0 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-0">
        {[
          {
            id: "inbound",
            n: "01",
            label: "Inbound",
            detail: "App / ticket text",
          },
          {
            id: "scan",
            n: "02",
            label: "Scan",
            detail: "Deterministic patterns",
          },
          {
            id: "decide",
            n: "03",
            label: "Decide",
            detail: "Pass / sanitize / block",
          },
        ].map((step, index, arr) => (
          <li
            key={step.id}
            className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-stretch"
          >
            <div className="card-opal flex flex-1 flex-col justify-center rounded-xl px-3.5 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-opal-label">
                {step.n}
              </span>
              <span className="mt-1 text-sm font-semibold text-opal-main">
                {step.label}
              </span>
              <span className="mt-0.5 text-sm leading-snug text-opal-muted">
                {step.detail}
              </span>
            </div>
            {index < arr.length - 1 ? (
              <span
                className="flex items-center justify-center px-1 py-1 text-opal-mist sm:px-1.5 sm:py-0"
                aria-hidden="true"
              >
                <svg
                  className="h-4 w-4 rotate-90 sm:rotate-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-ok/20 bg-ok-soft px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ok">
            Pass
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Zero flags
          </p>
          <p className="mt-0.5 text-sm leading-snug text-opal-muted">
            Payload clears for downstream processing unchanged.
          </p>
        </div>
        <div className="rounded-xl border border-warn/20 bg-warn-soft px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warn">
            Sanitize
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Placeholders in transit
          </p>
          <p className="mt-0.5 text-sm leading-snug text-opal-muted">
            Sensitive tokens replaced before the payload continues.
          </p>
        </div>
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-danger">
            Block
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Bulk restricted
          </p>
          <p className="mt-0.5 text-sm leading-snug text-opal-muted">
            At {BULK_FINDING_THRESHOLD}+ findings, nothing is forwarded and a
            security review case opens.
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-snug text-opal-muted">
        Public runtime: TypeScript in-process proxy with deterministic pattern
        checks and a privacy receipt. Pattern coverage is finite - not a claim
        of full regulatory certification.
      </p>

      <figcaption className="sr-only">
        Browser starts a scenario on a Next.js SSE route. A TypeScript privacy
        proxy scans inbound text with deterministic patterns for SSN, payment
        card, email, API key, and phone formats. Clean payloads pass. Detected
        tokens are replaced with placeholders before downstream transit. Bulk
        restricted payloads are blocked and logged with an exception code. A
        privacy receipt records decision, finding kinds, and a trail hash.
      </figcaption>
    </figure>
  );
}
