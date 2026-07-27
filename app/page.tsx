import Link from "next/link";
import { contactMailto, site } from "@/lib/site";
import { PAYFLOW_FRAMING } from "@/lib/payflow/runtime";
import { MIGRATE_FRAMING } from "@/lib/migrate/runtime";
import { WORKFLOW_FRAMING } from "@/lib/workflow/runtime";

const PROJECTS = [
  {
    title: "PayFlow",
    mark: "PF",
    accent: "purple" as const,
    framing: PAYFLOW_FRAMING,
    challenge:
      "Manual invoice checks take hours, and a slightly altered routing number can send money to the wrong account before anyone catches it.",
    solution:
      "An invoice verification path that matches vendors to the registry, checks bank routing against approved profiles, and holds mismatched payouts.",
    impact:
      "Replaces manual keying of every invoice check - bad vendor or routing is held before money moves, with a clear path for AP review.",
    tech: ["Python", "FastMCP", "Next.js"],
    demoHref: "/payflow",
    codeHref: `${site.githubRepo}/blob/main/mcp-server/payflow_server.py`,
  },
  {
    title: "Client Migration Pipeline",
    mark: "CM",
    accent: "amber" as const,
    framing: MIGRATE_FRAMING,
    challenge:
      "Messy client spreadsheets break schemas, delay go-live, and leave ops cleaning data by hand.",
    solution:
      "A migration walkthrough that validates types, fixes formatting issues, simulates an isolated client schema, and reports success or hold.",
    impact:
      "Turns messy client sheets into a controlled cutover path so onboarding does not stall on broken imports.",
    tech: ["TypeScript", "Next.js", "SSE"],
    demoHref: "/migrate",
    codeHref: `${site.githubRepo}/blob/main/lib/migrate/engine.ts`,
  },
  {
    title: "Workflow & Approvals",
    mark: "WA",
    accent: "rose" as const,
    framing: WORKFLOW_FRAMING,
    challenge:
      "Multi-site requests stall in email, and high-value steps can move without a clear manager sign-off.",
    solution:
      "A step-by-step runner that handles routine work, then pauses above $10,000 until a manager approves or rejects.",
    impact:
      "Routine work proceeds; high-risk spend stops for an explicit manager decision instead of dying in email.",
    tech: ["TypeScript", "Next.js", "SSE"],
    demoHref: "/workflow",
    codeHref: `${site.githubRepo}/blob/main/lib/workflow/state-machine.ts`,
  },
] as const;

const DELIVER_AREAS = [
  {
    title: "End-to-End Enterprise Operations & ERP Platforms",
    body: "Owning the complete digital core - CRM, sales, vendor pipelines, payroll, and accounting - replacing fragmented spreadsheets with unified platforms that scale operating capacity (e.g., 2.5x capacity with zero headcount expansion).",
  },
  {
    title: "Cross-Functional Systems Integration",
    body: "Connecting disconnected SaaS tools and legacy data streams so marketing, finance, and operations all run on a single source of truth.",
  },
  {
    title: "Data Migration & Multi-Tenant Architecture",
    body: "Leading massive migrations and onboarding pipelines (such as 3,000+ customer onboardings and thousands of enterprise accounts) without service disruption.",
  },
  {
    title: "Governed AI & Workflow Automation",
    body: "Deploying AI and automated workflows with built-in safety rails - such as mandatory manager sign-offs and auditable trails - so automation solves problems instead of creating risks.",
  },
  {
    title: "Operational Standardization & Enablement",
    body: "Building the reusable SOP libraries, templates, and compliance frameworks that keep multi-site operations (across 400+ locations) consistent and inspection-ready.",
  },
  {
    title: "Operator-Grade System Design",
    body: "Building software from firsthand experience running physical operations, managing compliance, and handling day-to-day team usage - so the systems actually hold up when real people use them.",
  },
] as const;

const accentStyles = {
  purple: {
    border: "border-l-opal-purple",
    mark: "bg-violet-50 text-opal-purple",
    label: "text-opal-purple",
  },
  amber: {
    border: "border-l-opal-amber",
    mark: "bg-amber-50 text-opal-amber",
    label: "text-opal-amber",
  },
  rose: {
    border: "border-l-opal-rose",
    mark: "bg-rose-50 text-opal-rose",
    label: "text-opal-rose",
  },
} as const;

export default function HomePage() {
  return (
    <main className="relative z-10">
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-20 text-center sm:pt-28 sm:pb-24">
        <p>
          <span className="eyebrow-opal">{site.role}</span>
        </p>

        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-opal-main sm:text-5xl lg:text-6xl">
          {site.name}
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-[17px] leading-relaxed text-opal-main sm:text-lg">
          I build the business systems companies run on - ERP platforms,
          integrations, and automated workflows, with AI built in where it
          earns its place under human oversight. Ten years turning fragmented
          tools and manual process into platforms people trust.
        </p>

        <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-opal-muted sm:text-base">
          Before I architected systems, I ran one - every day, on the ground,
          accountable for the people, the compliance, and the numbers, not just
          the software. That&apos;s the difference you can feel in what I build:
          it&apos;s made by someone who&apos;s had to actually use it.
        </p>

        <p className="mt-8">
          <a
            href={contactMailto}
            className="text-[15px] font-medium text-opal-violet underline-offset-4 hover:underline sm:text-base"
          >
            {site.email}
          </a>
        </p>
      </section>

      <section
        id="where-i-deliver"
        className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-20 sm:pb-24"
      >
        <div className="mb-12 text-center sm:text-left">
          <h2 className="font-display text-2xl font-medium tracking-tight text-opal-main sm:text-3xl">
            Where I Deliver
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {DELIVER_AREAS.map((area) => (
            <article
              key={area.title}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7"
            >
              <h3 className="font-display text-lg font-medium tracking-tight text-opal-main sm:text-xl">
                {area.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-opal-muted sm:text-base">
                {area.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="projects"
        className="mx-auto max-w-3xl scroll-mt-24 px-6 pb-28"
      >
        <div className="mb-12">
          <p className="label-opal">Selected work</p>
          <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-opal-main sm:text-3xl">
            Case Studies
          </h2>
        </div>

        <div className="flex flex-col gap-10">
          {PROJECTS.map((project) => {
            const styles = accentStyles[project.accent];
            return (
              <article
                key={project.demoHref}
                className={`rounded-2xl border border-slate-200/90 border-l-4 ${styles.border} bg-white p-6 shadow-sm sm:p-8`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold tracking-wide ${styles.mark}`}
                    aria-hidden
                  >
                    {project.mark}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${styles.label}`}
                    >
                      {project.framing}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-medium tracking-tight text-opal-main sm:text-2xl">
                      {project.title}
                    </h3>
                  </div>
                </div>

                <dl className="mt-6 space-y-5">
                  <div>
                    <dt className="label-opal">Challenge</dt>
                    <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted sm:text-base">
                      {project.challenge}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-opal">Solution</dt>
                    <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted sm:text-base">
                      {project.solution}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-opal">Impact</dt>
                    <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted sm:text-base">
                      {project.impact}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-opal">Tech Stack</dt>
                    <dd className="mt-2 text-[15px] leading-relaxed text-opal-label sm:text-base">
                      {project.tech.join(", ")}
                    </dd>
                  </div>
                </dl>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href={project.demoHref}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-opal-purple to-opal-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-shadow hover:shadow-violet-500/30"
                  >
                    Open the demo
                  </Link>
                  <a
                    href={project.codeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-opal-purple/40 bg-white px-6 py-3 text-sm font-semibold text-opal-purple transition-colors hover:border-opal-purple hover:bg-violet-50"
                  >
                    Read the code
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
