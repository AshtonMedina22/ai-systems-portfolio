import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Lock,
  Shield,
  Zap,
} from "lucide-react";
import { site } from "@/lib/site";

const PROJECTS = [
  {
    href: "/payflow",
    eyebrow: "Project 1",
    title: "PayFlow",
    summary:
      "Accounts payable automation that cuts down on manual invoice entry and flags fraudulent vendor bank changes before money leaves the bank. Cross-checks incoming bills against your records with fuzzy matching to catch spoofed invoices.",
    stack: "FastMCP tools - SAP / NetSuite-style ledgers - fraud rules",
    live: true,
  },
  {
    href: "/migrate",
    eyebrow: "Project 2",
    title: "Client Migration & Onboarding",
    summary:
      "Automates bringing new clients onto a software platform. Takes messy legacy spreadsheets, cleans formatting errors, validates data types, and organizes everything into secure, isolated database partitions.",
    stack: "SQL / PostgreSQL mapping - tenant schemas - error logs",
    live: true,
  },
  {
    href: "/workflow",
    eyebrow: "Project 3",
    title: "Workflow & Approval Manager",
    summary:
      "A step-by-step process runner that automates multi-department tasks while keeping people in control. If a request crosses a safe threshold, it pauses and waits for explicit manager sign-off.",
    stack: "Async workflow - state checkpoints - manager review gates",
    live: true,
  },
] as const;

const VALUE_POINTS = [
  {
    icon: Lock,
    title: "Vendor and bank checks",
    body: "Payments only move after the vendor and routing details look right against the ledger.",
  },
  {
    icon: Zap,
    title: "Clear tool access",
    body: "The AI only gets named tools with fixed inputs - not open access to company systems.",
  },
  {
    icon: Shield,
    title: "Manager sign-off",
    body: "Risky money moves can wait for a person to approve them before anything finishes.",
  },
] as const;

const PHILOSOPHY = [
  {
    step: "1",
    title: "Start with the business problem",
    body: "Figure out where people are burning time or taking real risk, then build around that.",
  },
  {
    step: "2",
    title: "Put hard rules around the AI",
    body: "Important checks stay fixed and reviewable. The model does not get free rein on payouts or production changes.",
  },
  {
    step: "3",
    title: "Show the work",
    body: "Leaders can watch the tool calls and decisions as they happen, not after the fact.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative z-10">
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
        <h1 className="font-display text-4xl font-medium tracking-tight text-opal-main sm:text-5xl lg:text-6xl">
          {site.name}
        </h1>
        <p className="mt-3">
          <span className="eyebrow-opal">{site.role}</span>
        </p>

        <p className="mx-auto mt-8 max-w-2xl text-[16px] leading-relaxed text-opal-muted sm:text-lg">
          Hi, I&apos;m Ashton Medina. I combine 10 years of hands-on business
          operations leadership with modern systems architecture. I build
          automated workflows, secure database pipelines, and smart operational
          systems that save companies time, cut manual bottlenecks, and protect
          bottom lines.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <a
            href="#projects"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-opal-purple to-opal-violet px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-shadow hover:shadow-violet-500/30 sm:w-auto"
          >
            See the demos
            <ArrowDown className="h-4 w-4" />
          </a>
          <a
            href={site.githubRepo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-opal-label shadow-sm transition-colors hover:border-violet-300 hover:text-opal-purple sm:w-auto"
          >
            View on GitHub
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <div className="text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight text-opal-main sm:text-3xl text-balance">
            From Multi-Site Operations to Systems Architecture
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-opal-muted sm:text-base">
            After more than a decade running business operations, I know how
            fast inefficient workflows cost a company money. I built these
            systems to handle those routine administrative tasks cleanly and
            securely.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-opal-label">
            Background in multi-site operations, childcare and education ops,
            and logistics - plus an MBA.
          </p>
        </div>

        <div className="card-opal mt-10 grid grid-cols-1 gap-0 rounded-2xl p-4 text-left sm:p-6 md:grid-cols-3">
          {VALUE_POINTS.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className={`p-4 ${
                  index > 0
                    ? "border-t border-slate-200/80 md:border-t-0 md:border-l"
                    : ""
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-opal-purple" aria-hidden />
                  <p className="text-sm font-semibold text-opal-main">
                    {point.title}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-opal-muted">
                  {point.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="projects" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight text-opal-main sm:text-3xl">
            Projects
          </h2>
          <p className="mt-2 text-sm text-opal-muted">
            Business controls on the left. Live tool activity on the right.
          </p>
        </div>

        <div className="space-y-5">
          {PROJECTS.map((project) => {
            const cardClass = project.live
              ? "group card-opal card-opal-interactive block rounded-2xl p-6 sm:p-8"
              : "card-opal block rounded-2xl p-6 sm:p-8 hover:border-violet-300/80 transition-colors";

            return (
              <Link
                key={project.href}
                href={project.href}
                className={cardClass}
              >
                <p className="eyebrow-opal">{project.eyebrow}</p>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <h3
                    className={`font-display text-2xl text-opal-main ${
                      project.live
                        ? "group-hover:text-opal-violet transition-colors"
                        : ""
                    }`}
                  >
                    {project.title}
                  </h3>
                  {project.live ? (
                    <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-opal-purple transition-transform duration-200 group-hover:translate-x-1" />
                  ) : null}
                </div>

                <p className="mt-3 text-sm leading-relaxed text-opal-muted">
                  {project.summary}
                </p>

                <div className="mt-5 border-t border-slate-200/80 pt-4">
                  <p className="label-opal mb-2">Built with</p>
                  <p className="text-sm leading-relaxed text-opal-muted">
                    {project.stack}
                  </p>
                </div>

                {!project.live ? (
                  <p className="mt-4 text-sm font-medium text-opal-purple">
                    Coming next
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section
        id="philosophy"
        className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-20 pt-4"
      >
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight text-opal-main sm:text-3xl">
            How I work
          </h2>
          <p className="mt-2 text-sm text-opal-muted">
            Built for real operations - not throwaway chatbots.
          </p>
        </div>

        <div className="card-opal grid grid-cols-1 gap-0 rounded-2xl md:grid-cols-3">
          {PHILOSOPHY.map((item, index) => (
            <div
              key={item.step}
              className={`p-6 sm:p-8 ${
                index > 0
                  ? "border-t border-slate-200/80 md:border-t-0 md:border-l"
                  : ""
              }`}
            >
              <p className="eyebrow-opal">{item.step}</p>
              <h3 className="mt-3 font-display text-xl text-opal-main">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-opal-muted">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
