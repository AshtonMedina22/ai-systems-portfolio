import Link from "next/link";
import { site } from "@/lib/site";

const GITHUB_REPO = site.githubRepo;

const PROJECTS = [
  {
    title: "PayFlow",
    problem:
      "Manual invoice checks take hours, and a slightly altered routing number can send money to the wrong account before anyone catches it.",
    built:
      "An invoice verification tool that matches vendors to the company registry, checks bank routing against approved profiles, and holds mismatched payouts.",
    tech: ["Python", "FastMCP", "PostgreSQL"],
    github: `${GITHUB_REPO}/tree/main/mcp-server`,
    demoHref: "/payflow",
  },
  {
    title: "Client Migration Pipeline",
    problem:
      "Messy client spreadsheets break database schemas, delay go-live, and leave ops teams cleaning data by hand.",
    built:
      "A migration pipeline that validates types, fixes formatting issues, loads records into an isolated client schema, and reports success or hold.",
    tech: ["Python", "Pandas", "PostgreSQL"],
    github: `${GITHUB_REPO}/tree/main/lib/migrate`,
    demoHref: "/migrate",
  },
  {
    title: "Workflow & Approvals",
    problem:
      "Multi-site requests stall in email chains, and high-value steps can move forward without a clear manager sign-off.",
    built:
      "A step-by-step runner that handles routine work, then pauses above $10,000 until a manager approves or rejects.",
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
                  <dt className="label-opal">What I built</dt>
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
