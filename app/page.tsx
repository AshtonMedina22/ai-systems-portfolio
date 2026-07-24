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
      "Catches bad routing and vendor mismatches before money moves, and gives AP a clear hold path instead of hoping someone notices.",
    tech: ["Python", "FastMCP", "Next.js"],
    demoHref: "/payflow",
    cta: "Open live demo",
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
    cta: "Open demo",
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
    cta: "Open demo",
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
        <h1 className="font-display text-4xl font-medium tracking-tight text-opal-main sm:text-5xl lg:text-6xl">
          {site.name}
        </h1>
        <p className="mt-4">
          <span className="eyebrow-opal">
            Systems Architect &amp; Operations Consultant
          </span>
        </p>

        <p className="mx-auto mt-8 max-w-2xl text-[17px] leading-relaxed text-opal-main sm:text-lg">
          Ops mind, systems build - I design the tools that take the grind out
          of day-to-day admin.
        </p>

        <p className="mt-6">
          <a
            href={contactMailto}
            className="text-[15px] font-medium text-opal-violet underline-offset-4 hover:underline sm:text-base"
          >
            {site.email}
          </a>
        </p>

        <p className="mx-auto mt-10 max-w-2xl text-[15px] leading-relaxed text-opal-muted sm:text-base">
          Ten years running multi-site operations - workflows, compliance,
          vendor accounts - then building the software, pipelines, and
          automation that fix those bottlenecks.
        </p>
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

                <div className="mt-8">
                  <Link
                    href={project.demoHref}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-opal-purple to-opal-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-shadow hover:shadow-violet-500/30"
                  >
                    {project.cta}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
