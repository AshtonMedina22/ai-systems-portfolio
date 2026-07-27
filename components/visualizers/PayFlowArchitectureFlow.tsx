import React from "react";

const STEPS = [
  { id: "browser", label: "Browser", detail: "Invoice scenario" },
  { id: "route", label: "Next.js route", detail: "SSE stream" },
  { id: "mcp", label: "FastMCP", detail: "Tool call" },
  { id: "erp", label: "ERP registry", detail: "Vendor lookup" },
  { id: "decision", label: "Decision", detail: "Pass / hold" },
] as const;

/** Compact Opal-styled path for technical reviewers. */
export function PayFlowArchitectureFlow() {
  return (
    <figure
      className="mt-4"
      aria-label="PayFlow architecture flow: Browser to Next.js route and SSE, FastMCP tool call, ERP vendor registry lookup, then pass or hold"
    >
      <ol className="m-0 flex list-none flex-col gap-0 p-0 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-0">
        {STEPS.map((step, index) => (
          <li
            key={step.id}
            className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-stretch"
          >
            <div className="flex flex-1 flex-col justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-opal-label">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-1 text-sm font-semibold text-opal-main">
                {step.label}
              </span>
              <span className="mt-0.5 text-[12px] leading-snug text-opal-muted">
                {step.detail}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <span
                className="flex items-center justify-center px-1 py-1 text-opal-label sm:px-1.5 sm:py-0"
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
      <figcaption className="sr-only">
        Browser posts an invoice to a Next.js route that streams over SSE, calls
        FastMCP tools, looks up the ERP vendor registry, then decides pass or
        hold.
      </figcaption>
    </figure>
  );
}
