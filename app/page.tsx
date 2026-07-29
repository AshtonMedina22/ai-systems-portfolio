import Link from "next/link";
import { contactMailto, site } from "@/lib/site";
import { PAYFLOW_FRAMING } from "@/lib/payflow/runtime";
import { MIGRATE_FRAMING } from "@/lib/migrate/runtime";
import { WORKFLOW_FRAMING } from "@/lib/workflow/runtime";
import { PRIVACY_FRAMING } from "@/lib/privacy/runtime";

const PROJECTS = [
  {
    title: "PayFlow",
    mark: "PF",
    accent: "purple" as const,
    framing: PAYFLOW_FRAMING,
    summary: "Vendor and bank verification before an invoice can be paid.",
    outcome: "Changed routing and unknown vendors stop before money moves.",
    tech: ["Python", "FastMCP", "Next.js"],
    demoHref: "/payflow",
  },
  {
    title: "Client Migration Pipeline",
    mark: "CM",
    accent: "teal" as const,
    framing: MIGRATE_FRAMING,
    summary: "A controlled path from messy client files to isolated schemas.",
    outcome: "Bad data is cleaned or held before it can derail onboarding.",
    tech: ["TypeScript", "Next.js", "SSE"],
    demoHref: "/migrate",
  },
  {
    title: "Workflow Governance & Control",
    mark: "WG",
    accent: "shell" as const,
    framing: WORKFLOW_FRAMING,
    summary:
      "Policy before action, human intervention on high-value steps, and a hash-chained audit receipt after.",
    outcome:
      "Routine work continues under policy; over $10,000 holds for manager decision or rollback.",
    tech: ["TypeScript", "Next.js", "SSE"],
    demoHref: "/workflow",
  },
  {
    title: "Data Privacy & Safety Suite",
    mark: "DP",
    accent: "aqua" as const,
    framing: PRIVACY_FRAMING,
    summary:
      "A redaction proxy that scrubs or blocks sensitive tokens before they reach downstream tools or AI.",
    outcome:
      "Clean tickets pass; embedded PII is masked; bulk restricted dumps stop pre-transit.",
    tech: ["TypeScript", "Next.js", "SSE"],
    demoHref: "/privacy",
  },
] as const;

const DELIVER_AREAS = [
  {
    title: "End-to-End Enterprise Operations & ERP Platforms",
    body: "Unify CRM, sales, vendors, payroll, and accounting into one operating platform.",
  },
  {
    title: "Cross-Functional Systems Integration",
    body: "Connect SaaS tools and legacy data so teams work from one source of truth.",
  },
  {
    title: "Data Migration & Multi-Tenant Architecture",
    body: "Move large customer datasets into isolated, scalable environments safely.",
  },
  {
    title: "Governed AI & Workflow Automation",
    body: "Automate routine work while keeping human approval at high-risk decisions.",
  },
  {
    title: "Operational Standardization & Enablement",
    body: "Create reusable SOPs and controls that keep multi-site operations consistent.",
  },
  {
    title: "Operator-Grade System Design",
    body: "Design around how people actually work, not how a process looks on paper.",
  },
] as const;

const accentStyles = {
  purple: {
    mark: "bg-accent-soft text-accent-deep",
    label: "text-accent",
  },
  teal: {
    mark: "bg-ok-soft text-ok",
    label: "text-ok",
  },
  shell: {
    mark: "bg-danger-soft text-danger",
    label: "text-danger",
  },
  aqua: {
    mark: "bg-ok-soft text-opal-aqua",
    label: "text-opal-aqua",
  },
} as const;

export default function HomePage() {
  return (
    <main className="relative z-10">
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-9 sm:px-6 sm:pb-12 sm:pt-16 lg:px-8">
        <div className="grid items-end gap-6 sm:gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
          <div>
            <p className="eyebrow-opal">
              {site.name} - {site.role}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-opal-main sm:mt-4 sm:text-5xl">
              Systems that make complex operations feel simple.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-opal-muted sm:mt-5 sm:text-[17px]">
              I architect ERP platforms, integrations, and governed automation
              that replace fragmented tools with systems people can trust.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-6">
              <a href="#projects" className="btn-primary">
                View selected work
              </a>
              <a
                href={contactMailto}
                className="inline-flex h-9 items-center text-sm font-semibold text-accent-deep underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Start a conversation
              </a>
            </div>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-line border-y border-line py-4 lg:grid-cols-1 lg:divide-x-0 lg:divide-y lg:border-y-0 lg:border-l lg:py-0 lg:pl-7">
            <div className="px-3 first:pl-0 lg:px-0 lg:py-3 lg:first:pt-0">
              <dt className="font-display text-xl font-semibold text-opal-main">
                10 years
              </dt>
              <dd className="mt-0.5 text-xs leading-snug text-opal-muted sm:text-sm">
                building from operational reality
              </dd>
            </div>
            <div className="px-3 lg:px-0 lg:py-3">
              <dt className="font-display text-xl font-semibold text-opal-main">
                4 demos
              </dt>
              <dd className="mt-0.5 text-xs leading-snug text-opal-muted sm:text-sm">
                showing systems, not slides
              </dd>
            </div>
            <div className="px-3 pr-0 lg:px-0 lg:py-3 lg:last:pb-0">
              <dt className="font-display text-xl font-semibold text-opal-main">
                Human-led
              </dt>
              <dd className="mt-0.5 text-xs leading-snug text-opal-muted sm:text-sm">
                controls where risk matters
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        id="projects"
        className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-16 pt-4 sm:px-6 lg:px-8"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-opal">Selected work</p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-opal-main">
              Systems you can explore
            </h2>
          </div>
          <p className="hidden max-w-md text-sm text-opal-muted sm:block">
            Four compact case studies with working demos and source.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PROJECTS.map((project) => {
            const styles = accentStyles[project.accent];
            return (
              <article
                key={project.demoHref}
                className="card-opal card-opal-interactive flex min-h-[285px] flex-col p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[11px] font-semibold ${styles.mark}`}
                    aria-hidden
                  >
                    {project.mark}
                  </span>
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${styles.label}`}
                  >
                    {project.framing}
                  </p>
                </div>

                <h3 className="mt-5 font-display text-xl font-semibold tracking-tight text-opal-main">
                  {project.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-opal-muted">
                  {project.summary}
                </p>

                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-opal-label">
                    Outcome
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-opal-main">
                    {project.outcome}
                  </p>
                </div>

                <div className="mt-auto pt-5">
                  <p className="mb-3 text-xs text-opal-muted">
                    {project.tech.join(", ")}
                  </p>
                  <div className="flex items-center gap-4">
                    <Link
                      href={project.demoHref}
                      className="inline-flex h-9 items-center rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      View demo
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Operator perspective"
        className="mx-auto max-w-6xl px-5 pb-14 sm:px-6 lg:px-8"
      >
        <div className="grid gap-3 border-y border-line py-6 sm:grid-cols-[180px_1fr] sm:items-start">
          <p className="label-opal">Operator perspective</p>
          <p className="max-w-3xl text-[15px] leading-relaxed text-opal-muted">
            Before I architected systems, I ran one - accountable for the people,
            compliance, and numbers, not just the software. I build for the
            people who have to use the system when the day gets messy.
          </p>
        </div>
      </section>

      <section
        id="where-i-deliver"
        className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-20 sm:px-6 lg:px-8"
      >
        <div className="mb-6">
          <p className="label-opal">Capabilities</p>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-opal-main">
            Where I deliver
          </h2>
        </div>

        <div className="grid border-t border-line sm:grid-cols-2">
          {DELIVER_AREAS.map((area, index) => (
            <article
              key={area.title}
              className={`border-b border-line py-5 sm:px-5 ${
                index % 2 === 0 ? "sm:border-r sm:pl-0" : "sm:pr-0"
              }`}
            >
              <h3 className="font-display text-base font-semibold text-opal-main">
                {area.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-opal-muted">
                {area.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
