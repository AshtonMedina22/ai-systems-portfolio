import Link from "next/link";
import { site } from "@/lib/site";

const GITHUB_REPO = site.githubRepo;

const PROJECTS = [
  {
    title: "PayFlow Accounts Payable & Fraud Shield",
    problem:
      "Manually checking vendor invoices takes hours, and altered bank routing numbers on malicious invoices can slip past employees before anyone notices.",
    built: "An automated invoice verification tool that cross-checks incoming bills against historical records using fuzzy text matching and flags mismatched routing numbers before a payout is approved.",
    tech: ["Python", "FastMCP", "PostgreSQL"],
    github: `${GITHUB_REPO}/tree/main/mcp-server`,
    demoHref: "/payflow",
  },
  {
    title: "Client Migration & Onboarding Pipeline",
    problem:
      "When onboarding new clients who provide messy, poorly formatted spreadsheets, data dumps frequently break database schemas and cause delays.",
    built: "An ETL data pipeline that automatically cleans formatting errors, validates data types, and safely organizes client records into secure, isolated database partitions.",
    tech: ["Python", "Pandas", "PostgreSQL"],
    github: `${GITHUB_REPO}/tree/main/lib/migrate`,
    demoHref: "/migrate",
  },
  {
    title: "Enterprise Workflow & Approvals Manager",
    problem:
      "Growing multi-site operations stall out because high-risk transactions or routine purchases get stuck in email chains without proper management oversight.",
    built: "A sequential state machine workflow manager that handles routine tasks automatically while explicitly pausing at high-risk financial thresholds to require a manager's click-to-approve sign-off.",
    tech: ["TypeScript", "Next.js", "State Machines"],
    github: `${GITHUB_REPO}/tree/main/lib/workflow`,
    demoHref: "/workflow",
  },
] as const;

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

        <p className="mx-auto mt-10 max-w-2xl text-[17px] leading-relaxed text-opal-muted sm:text-lg">
          I spent 10 years running multi-site business operations - managing
          day-to-day administrative workflows, compliance, and vendor accounts. I
          lived the everyday pain of messy spreadsheets, slow communication, and
          manual bottlenecks. Today, I build the custom software tools, database
          pipelines, and automated workflows that solve those exact problems.
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
          {PROJECTS.map((project) => (
            <article
              key={project.demoHref}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8"
            >
              <h3 className="font-display text-xl font-medium tracking-tight text-opal-main sm:text-2xl">
                {project.title}
              </h3>

              <dl className="mt-6 space-y-5">
                <div>
                  <dt className="label-opal">Problem</dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted sm:text-base">
                    {project.problem}
                  </dd>
                </div>
                <div>
                  <dt className="label-opal">What I Built</dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-opal-muted sm:text-base">
                    {project.built}
                  </dd>
                </div>
                <div>
                  <dt className="label-opal">Tech Stack</dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-opal-label sm:text-base">
                    {project.tech.join(" · ")}
                  </dd>
                </div>
              </dl>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-opal-purple to-opal-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-shadow hover:shadow-violet-500/30"
                >
                  View Code on GitHub
                </a>
                <Link
                  href={project.demoHref}
                  className="text-sm font-medium text-opal-purple underline-offset-4 hover:underline"
                >
                  Open live demo
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
