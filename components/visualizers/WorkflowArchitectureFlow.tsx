import React from "react";
import { FINANCIAL_THRESHOLD_USD } from "@/lib/workflow/types";

/** Compact Opal-styled path for technical reviewers. */
export function WorkflowArchitectureFlow() {
  return (
    <figure
      className="mt-4"
      aria-label={`Workflow architecture: Intake to compliance to threshold decision. At or below $${FINANCIAL_THRESHOLD_USD.toLocaleString()} continues to final execution. Above threshold pauses for operations manager approve to resume or reject to stop. Public page uses a TypeScript state machine with in-memory checkpoint.`}
    >
      <ol className="m-0 flex list-none flex-col gap-2 p-0 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-0">
        {[
          { id: "intake", n: "01", label: "Intake", detail: "Request packet" },
          {
            id: "compliance",
            n: "02",
            label: "Compliance",
            detail: "Policy and required fields",
          },
          {
            id: "threshold",
            n: "03",
            label: "Threshold",
            detail: `Gate at $${FINANCIAL_THRESHOLD_USD.toLocaleString()}`,
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

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-ok/20 bg-ok-soft px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ok">
            At or below threshold
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Final execution
          </p>
          <p className="mt-0.5 text-sm leading-snug text-opal-muted">
            Routine path continues without an operations manager pause.
          </p>
        </div>
        <div className="rounded-xl border border-warn/20 bg-warn-soft px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warn">
            Above threshold
          </p>
          <p className="mt-1 text-sm font-semibold text-opal-main">
            Pause - operations manager
          </p>
          <p className="mt-0.5 text-sm leading-snug text-opal-muted">
            Approve resumes to final execution. Reject stops downstream steps.
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-snug text-opal-muted">
        Public runtime: TypeScript state machine with an in-memory checkpoint.
        LangGraph and Postgres checkpoint config in the repo is reference only
        for this hosted demo.
      </p>

      <figcaption className="sr-only">
        Browser starts a scenario on a Next.js SSE route. A TypeScript state
        machine runs intake, compliance, and a financial threshold decision. At
        or below the threshold, final execution continues. Above the threshold,
        the run pauses for operations manager approval to resume or reject to
        stop. Audit events are a session trail in memory, not an immutable
        store. LangGraph with Postgres checkpointing is config and reference
        only, not the public runtime.
      </figcaption>
    </figure>
  );
}
