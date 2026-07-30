import React from "react";
import {
  BULK_FINDING_THRESHOLD,
  MAX_PAYLOAD_CHARS,
} from "@/lib/privacy/types";

const EXCEPTION_PATHS = [
  {
    path: "Detection gap",
    tone: "border-warn/25 bg-warn-soft",
    badge: "text-warn",
    trigger: "A novel encoding or free-form secret is identified after review.",
    system: "The unknown format may pass because coverage is intentionally finite.",
    operator: "Contain the downstream item, add a detector, and run regression tests.",
    evidence: "Updated detector suite and policy record",
  },
  {
    path: "Over-mask",
    tone: "border-accent/20 bg-accent-soft/60",
    badge: "text-accent-deep",
    trigger: "Useful operational text is classified as a sensitive format.",
    system: "The token stays masked until an operator reviews the finding.",
    operator: "Release one finding kind for one run with a required reason.",
    evidence: "Override reason, actor, and receipt",
  },
  {
    path: "Bulk restricted",
    tone: "border-danger/25 bg-danger-soft",
    badge: "text-danger",
    trigger: `${BULK_FINDING_THRESHOLD}+ findings indicate a possible restricted export.`,
    system: "Forwarding stops and a security review case opens.",
    operator: "Acknowledge the case and investigate the source workflow.",
    evidence: "PRIV-BULK-RESTRICTED and case ID",
  },
  {
    path: "Oversized payload",
    tone: "border-line-strong bg-console-panel",
    badge: "text-opal-label",
    trigger: `Inbound text exceeds the ${MAX_PAYLOAD_CHARS.toLocaleString()}-character boundary.`,
    system: "The payload is rejected before pattern scanning begins.",
    operator: "Split the content or route it through a bounded batch process.",
    evidence: "Payload-size gate event",
  },
] as const;

export function PrivacyExceptionRecovery() {
  return (
    <div aria-label="Privacy exception and recovery model">
      <div className="hidden grid-cols-[0.65fr_1fr_1fr_1fr_0.9fr] gap-4 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-opal-label lg:grid">
        <span>Path</span>
        <span>Trigger</span>
        <span>System action</span>
        <span>Operator action</span>
        <span>Evidence</span>
      </div>

      <div className="space-y-2">
        {EXCEPTION_PATHS.map((item) => (
          <article
            key={item.path}
            className={`grid gap-3 rounded-xl border px-4 py-3.5 lg:grid-cols-[0.65fr_1fr_1fr_1fr_0.9fr] lg:gap-4 ${item.tone}`}
          >
            <h3 className={`text-sm font-semibold ${item.badge}`}>
              {item.path}
            </h3>
            <div>
              <p className="label-opal lg:hidden">Trigger</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-opal-muted lg:mt-0">
                {item.trigger}
              </p>
            </div>
            <div>
              <p className="label-opal lg:hidden">System action</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-opal-muted lg:mt-0">
                {item.system}
              </p>
            </div>
            <div>
              <p className="label-opal lg:hidden">Operator action</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-opal-muted lg:mt-0">
                {item.operator}
              </p>
            </div>
            <div>
              <p className="label-opal lg:hidden">Evidence</p>
              <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-opal-label lg:mt-0">
                {item.evidence}
              </p>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-opal-muted">
        These are bounded operational controls, not a claim of complete secret
        detection or regulatory certification.
      </p>
    </div>
  );
}
