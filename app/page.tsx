import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  ClipboardCheck,
  Database,
  DollarSign,
  GitBranch,
  Network,
  Plug,
  Quote,
  ShieldCheck,
  Users,
} from "lucide-react";
import { contactMailto, site } from "@/lib/site";
import { PAYFLOW_FRAMING } from "@/lib/payflow/runtime";
import { MIGRATE_FRAMING } from "@/lib/migrate/runtime";
import { WORKFLOW_FRAMING } from "@/lib/workflow/runtime";
import { PRIVACY_FRAMING } from "@/lib/privacy/runtime";

const PROJECTS = [
  {
    title: "PayFlow",
    icon: DollarSign,
    accent: "purple" as const,
    framing: PAYFLOW_FRAMING,
    summary: "Vendor and bank verification before an invoice can be paid.",
    outcome: "Changed routing and unknown vendors stop before money moves.",
    tech: ["Python", "FastMCP", "Next.js"],
    demoHref: "/payflow",
  },
  {
    title: "Client Migration Pipeline",
    icon: Database,
    accent: "teal" as const,
    framing: MIGRATE_FRAMING,
    summary: "A controlled path from messy client files to isolated schemas.",
    outcome: "Bad data is cleaned or held before it can derail onboarding.",
    tech: ["TypeScript", "Next.js", "SSE"],
    demoHref: "/migrate",
  },
  {
    title: "Workflow Governance & Control",
    icon: GitBranch,
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
    icon: ShieldCheck,
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
    stage: "Foundation",
    icon: Building2,
    iconClass: "bg-accent-soft text-accent-deep",
    title: "End-to-End Enterprise Operations & ERP Platforms",
    body: "Unify CRM, sales, vendors, payroll, and accounting into one operating platform.",
  },
  {
    stage: "Connection",
    icon: Plug,
    iconClass: "bg-ok-soft text-ok",
    title: "Cross-Functional Systems Integration",
    body: "Connect SaaS tools and legacy data so teams work from one source of truth.",
  },
  {
    stage: "Data",
    icon: Database,
    iconClass: "bg-opal-aqua/20 text-opal-teal",
    title: "Data Migration & Multi-Tenant Architecture",
    body: "Move large customer datasets into isolated, scalable environments safely.",
  },
  {
    stage: "Automation",
    icon: Bot,
    iconClass: "bg-danger-soft text-danger",
    title: "Governed AI & Workflow Automation",
    body: "Automate routine work while keeping human approval at high-risk decisions.",
  },
  {
    stage: "Enablement",
    icon: ClipboardCheck,
    iconClass: "bg-warn-soft text-warn",
    title: "Operational Standardization & Enablement",
    body: "Create reusable SOPs and controls that keep multi-site operations consistent.",
  },
  {
    stage: "Adoption",
    icon: Users,
    iconClass: "bg-opal-lilac text-opal-violet",
    title: "Operator-Grade System Design",
    body: "Design around how people actually work, not how a process looks on paper.",
  },
] as const;

const accentStyles = {
  purple: {
    card: "border-t-accent",
    side: "border-l-accent",
    mark: "bg-accent text-white",
    label: "text-accent",
    preview:
      "bg-gradient-to-br from-accent-soft via-white/75 to-opal-orchid/20",
    cta: "text-accent-deep",
  },
  teal: {
    card: "border-t-opal-teal",
    side: "border-l-opal-teal",
    mark: "bg-opal-teal text-white",
    label: "text-ok",
    preview: "bg-gradient-to-br from-ok-soft via-white/75 to-opal-aqua/20",
    cta: "text-ok",
  },
  shell: {
    card: "border-t-opal-shell",
    side: "border-l-opal-shell",
    mark: "bg-opal-shell text-white",
    label: "text-danger",
    preview:
      "bg-gradient-to-br from-danger-soft via-white/75 to-opal-shell/20",
    cta: "text-danger",
  },
  aqua: {
    card: "border-t-opal-aqua",
    side: "border-l-opal-aqua",
    mark: "bg-opal-aqua text-opal-main",
    label: "text-opal-aqua",
    preview:
      "bg-gradient-to-br from-opal-aqua/20 via-white/75 to-opal-lilac/45",
    cta: "text-opal-teal",
  },
} as const;

type ProjectAccent = keyof typeof accentStyles;

function ProjectPreview({ accent }: { accent: ProjectAccent }) {
  if (accent === "purple") {
    return (
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
        aria-hidden
      >
        <div className="rounded-xl border border-white/80 bg-white/70 p-3 shadow-sm">
          <p className="font-mono text-[9px] uppercase tracking-wider text-opal-muted">
            Vendor
          </p>
          <p className="mt-1 text-xs font-semibold text-opal-main">
            Identity matched
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-accent" />
        <div className="rounded-xl border border-accent/20 bg-white/80 p-3 shadow-sm">
          <p className="font-mono text-[9px] uppercase tracking-wider text-opal-muted">
            Payment
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-accent-deep">
            <Check className="h-3 w-3" />
            Cleared
          </p>
        </div>
      </div>
    );
  }

  if (accent === "teal") {
    return (
      <div className="flex items-center gap-2" aria-hidden>
        {["Raw files", "Validate", "Tenant DB"].map((step, index) => (
          <div key={step} className="contents">
            <div className="min-w-0 flex-1 rounded-xl border border-white/80 bg-white/75 px-2 py-3 text-center shadow-sm">
              <span className="block font-mono text-[9px] text-opal-muted">
                0{index + 1}
              </span>
              <span className="mt-1 block truncate text-[11px] font-semibold text-opal-main">
                {step}
              </span>
            </div>
            {index < 2 ? (
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-opal-teal" />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (accent === "shell") {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" aria-hidden>
        <div className="rounded-xl border border-white/80 bg-white/75 p-3 shadow-sm">
          <p className="font-mono text-[9px] uppercase tracking-wider text-opal-muted">
            Policy check
          </p>
          <p className="mt-1 text-xs font-semibold text-opal-main">
            Amount over $10K
          </p>
        </div>
        <GitBranch className="h-4 w-4 text-opal-shell" />
        <div className="rounded-xl border border-opal-shell/20 bg-white/80 p-3 shadow-sm">
          <p className="font-mono text-[9px] uppercase tracking-wider text-opal-muted">
            Decision
          </p>
          <p className="mt-1 text-xs font-semibold text-danger">
            Manager review
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/80 bg-white/75 p-3 shadow-sm" aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[9px] uppercase tracking-wider text-opal-muted">
          Outbound payload
        </p>
        <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ok">
          Protected
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-opal-main">
        <span>SSN</span>
        <span className="rounded bg-opal-terminal px-2 py-0.5 text-white">
          ***-**-6789
        </span>
        <span className="text-opal-teal">PII masked</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const featuredProject =
    PROJECTS.find((project) => project.demoHref === "/workflow") ?? PROJECTS[0];
  const secondaryProjects = PROJECTS.filter(
    (project) => project.demoHref !== featuredProject.demoHref
  );
  const featuredStyles = accentStyles[featuredProject.accent];
  const FeaturedIcon = featuredProject.icon;

  return (
    <main className="relative z-10">
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-9 sm:px-6 sm:pb-12 sm:pt-16 lg:px-8">
        <div className="grid items-end gap-6 sm:gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
          <div>
            <p className="eyebrow-opal">
              {site.name} - {site.role}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-opal-main sm:mt-4 sm:text-5xl">
              Turning operational complexity into scalable systems.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-opal-muted sm:mt-5 sm:text-[17px]">
              I design ERP platforms, AI workflows, and business systems that
              replace disconnected processes with scalable, reliable, &amp;
              automated solutions.
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
                operations and systems delivery
              </dd>
            </div>
            <div className="px-3 lg:px-0 lg:py-3">
              <dt className="font-display text-xl font-semibold text-opal-main">
                4 systems
              </dt>
              <dd className="mt-0.5 text-xs leading-snug text-opal-muted sm:text-sm">
                interactive case studies
              </dd>
            </div>
            <div className="px-3 pr-0 lg:px-0 lg:py-3 lg:last:pb-0">
              <dt className="font-display text-xl font-semibold text-opal-main">
                Risk-gated
              </dt>
              <dd className="mt-0.5 text-xs leading-snug text-opal-muted sm:text-sm">
                human review and audit trails
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        id="projects"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-16 pt-6 sm:px-6 sm:pb-20 lg:px-8"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-opal">Selected work</p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-opal-main">
              Built for the way operations actually work
            </h2>
          </div>
          <p className="hidden max-w-md text-sm text-opal-muted sm:block">
            Four interactive case studies showing how I reduce manual work,
            manage exceptions, and keep critical decisions under control.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <article
            className={`card-opal card-opal-interactive flex min-h-[440px] flex-col overflow-hidden border-t-[3px] ${featuredStyles.card}`}
          >
            <div className={`border-b border-line p-5 ${featuredStyles.preview}`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${featuredStyles.mark}`}
                  aria-hidden
                >
                  <FeaturedIcon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${featuredStyles.label}`}
                >
                  {featuredProject.framing}
                </p>
              </div>
              <ProjectPreview accent={featuredProject.accent} />
            </div>

            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-opal-label">
                Featured system
              </p>
              <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight text-opal-main">
                {featuredProject.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-opal-muted">
                {featuredProject.summary}
              </p>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-opal-label">
                  Business outcome
                </p>
                <p className="mt-1.5 text-base leading-relaxed text-opal-main">
                  {featuredProject.outcome}
                </p>
              </div>
              <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                <p className="text-xs text-opal-muted">
                  {featuredProject.tech.join(", ")}
                </p>
                <Link
                  href={featuredProject.demoHref}
                  className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent-deep underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Explore system
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </div>
          </article>

          <div className="flex flex-col gap-3">
            {secondaryProjects.map((project) => {
              const styles = accentStyles[project.accent];
              const Icon = project.icon;
              return (
                <article
                  key={project.demoHref}
                  className={`card-opal card-opal-interactive relative flex flex-1 gap-4 overflow-hidden border-l-[3px] p-4 ${styles.side}`}
                >
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.mark}`}
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className={`text-[9px] font-semibold uppercase tracking-[0.08em] ${styles.label}`}
                        >
                          {project.framing}
                        </p>
                        <h3 className="mt-0.5 font-display text-lg font-semibold leading-snug tracking-tight text-opal-main">
                          {project.title}
                        </h3>
                      </div>
                      <Link
                        href={project.demoHref}
                        className={`group inline-flex shrink-0 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${styles.cta}`}
                      >
                        Explore
                        <ArrowRight
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-opal-muted">
                      {project.outcome}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-label="Operator perspective"
        className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-20 lg:px-8"
      >
        <div className="relative overflow-hidden rounded-2xl border border-line bg-white/45 px-6 py-8 shadow-opal-soft backdrop-blur-xl sm:grid sm:grid-cols-[0.32fr_1.68fr] sm:gap-8 sm:px-8 sm:py-10">
          <div
            className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-accent via-opal-aqua to-opal-shell"
            aria-hidden
          />
          <div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
              <Quote className="h-4 w-4" fill="currentColor" aria-hidden />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-opal-label">
              Operator perspective
            </p>
          </div>
          <blockquote className="mt-6 max-w-4xl sm:mt-0">
            <p className="font-display text-[22px] font-medium leading-snug tracking-[-0.02em] text-opal-main sm:text-2xl lg:text-[27px]">
              I spent years running operations before I designed systems. That
              experience shapes every workflow, automation, and platform I
              build.
            </p>
            <footer className="mt-4 flex items-center gap-3 text-xs text-opal-muted">
              <span className="h-px w-10 bg-accent" aria-hidden />
              Systems shaped by operational reality
            </footer>
          </blockquote>
        </div>
      </section>

      <section
        id="where-i-deliver"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8"
      >
        <div className="mb-6">
          <p className="label-opal">Capabilities</p>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-opal-main">
            What I Build
          </h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-line shadow-opal-soft">
          <div className="flex flex-col gap-3 bg-opal-terminal px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-opal-aqua">
                <Network className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="font-display text-sm font-semibold">
                  Operational core
                </p>
                <p className="text-xs text-white/55">
                  People, process, controls, and data
                </p>
              </div>
            </div>
            <p className="text-xs text-white/50">
              Six connected capabilities, one operating system
            </p>
          </div>

          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {DELIVER_AREAS.map((area) => {
              const Icon = area.icon;
              return (
                <article
                  key={area.title}
                  className="flex gap-3 bg-white/75 p-4 backdrop-blur-lg"
                >
                  <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${area.iconClass}`}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-opal-label">
                      {area.stage}
                    </p>
                    <h3 className="mt-0.5 font-display text-[15px] font-semibold leading-snug text-opal-main">
                      {area.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-opal-muted">
                      {area.body}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
