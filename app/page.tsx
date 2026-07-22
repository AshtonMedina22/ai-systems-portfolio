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
    eyebrow: "Project 1 - PayFlow",
    title: "Accounts Payable & Anti-Fraud Suite",
    headline: "Automated Invoice Processing & Financial Fraud Shield",
    value:
      "Eliminates manual invoice data entry while verifying vendor credentials against core ledger systems and flagging unauthorized bank routing changes before money leaves company accounts.",
    connectors:
      "Model Context Protocol (FastMCP) | SAP & NetSuite Ledger Integration | Fuzzy Entity Matching | Deterministic Anti-Fraud Rules",
    live: true,
  },
  {
    href: "/sre",
    eyebrow: "Project 2 - Self-Healing SRE",
    title: "Autonomous Incident Manager",
    headline: "24/7 System Downtime Prevention & Incident Recovery",
    value:
      "Reduces software outage downtime from hours to seconds by using collaborative AI agents to diagnose crashes and draft repair plans with mandatory human-manager approval gates.",
    connectors:
      "LangGraph Multi-Agent Debate | Human-in-the-Loop Sign-Off | AWS & Enterprise Cloud Health",
    live: false,
  },
  {
    href: "/guardrails",
    eyebrow: "Project 3 - Enterprise Guardrails",
    title: "Data Privacy & Safety Suite",
    headline: "Automated PII Redaction & AI Quality Inspection",
    value:
      "Protects sensitive customer data by automatically stripping Social Security numbers, credit cards, and confidential records before sending inputs to AI models, guaranteeing 100% regulatory compliance.",
    connectors:
      "Promptfoo Evals | Real-Time PII Sanitizer | HIPAA & GDPR Compliance",
    live: false,
  },
] as const;

const VALUE_POINTS = [
  {
    icon: Lock,
    title: "100% Data Privacy",
    body: "Automated PII redaction ensures sensitive customer records never leak to AI models.",
  },
  {
    icon: Zap,
    title: "Standardized MCP Tools",
    body: "Secure tool connections linking LLMs directly to core business ledger databases.",
  },
  {
    icon: Shield,
    title: "Human-in-the-Loop",
    body: "Mandatory manager authorization before executing financial or infrastructure changes.",
  },
] as const;

const PHILOSOPHY = [
  {
    step: "01",
    title: "Business problem first",
    body: "Identify manual labor bottlenecks and high-cost software risks before writing a line of agent logic.",
  },
  {
    step: "02",
    title: "Deterministic safeguards",
    body: "Enforce strict business rules so AI never makes unvetted financial or infrastructure moves.",
  },
  {
    step: "03",
    title: "Glass-box auditability",
    body: "Stream real-time tool logs and decision metrics so leaders can inspect every step.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative z-10">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
        <p className="font-display text-2xl font-medium tracking-tight text-opal-main sm:text-3xl">
          {site.name}
        </p>
        <p className="mt-2">
          <span className="eyebrow-opal">{site.role}</span>
        </p>

        <div className="mt-8 inline-flex items-center rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-semibold text-opal-purple">
          Enterprise AI Systems & Agentic Architecture
        </div>

        <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-opal-main text-balance sm:text-5xl sm:leading-[1.15]">
          Production-Grade AI Workflows Built with{" "}
          <span className="bg-gradient-to-r from-opal-purple to-opal-violet bg-clip-text text-transparent">
            Governance & Reliability
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-[16px] leading-relaxed text-opal-muted sm:text-lg">
          I build production-ready AI systems that bridge large language models
          with core enterprise software (SAP, NetSuite, Salesforce, Cloud
          Infrastructure). Designed with deterministic safety guardrails,
          automated data privacy, and human oversight.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <a
            href="#projects"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-opal-purple to-opal-violet px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-shadow hover:shadow-violet-500/30 sm:w-auto"
          >
            View Live Interactive Demos
            <ArrowDown className="h-4 w-4" />
          </a>
          <a
            href={site.githubRepo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-opal-label shadow-sm transition-colors hover:border-violet-300 hover:text-opal-purple sm:w-auto"
          >
            GitHub Repository
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        {/* Value banner */}
        <div className="card-opal mt-14 grid grid-cols-1 gap-0 rounded-2xl p-4 text-left sm:p-6 md:grid-cols-3">
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

      {/* Projects */}
      <section id="projects" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight text-opal-main sm:text-3xl">
            Core Enterprise Systems
          </h2>
          <p className="mt-2 text-sm text-opal-muted">
            Interactive glass-box demos combining plain-text business value with
            real-time technical streams.
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
                  <div className="min-w-0">
                    <h3
                      className={`font-display text-2xl text-opal-main ${
                        project.live
                          ? "group-hover:text-opal-violet transition-colors"
                          : ""
                      }`}
                    >
                      {project.title}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-opal-label">
                      {project.headline}
                    </p>
                  </div>
                  {project.live ? (
                    <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-opal-purple transition-transform duration-200 group-hover:translate-x-1" />
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-relaxed text-opal-muted">
                  {project.value}
                </p>

                <div className="mt-5 border-t border-slate-200/80 pt-4">
                  <p className="label-opal mb-2">Key enterprise connectors</p>
                  <p className="text-xs leading-relaxed text-opal-muted sm:text-sm">
                    {project.connectors}
                  </p>
                </div>

                {!project.live ? (
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-opal-purple">
                    Scaffold ready - glass-box demo next
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      {/* How I work */}
      <section
        id="philosophy"
        className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-20 pt-4"
      >
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight text-opal-main sm:text-3xl">
            How I work
          </h2>
          <p className="mt-2 text-sm text-opal-muted">
            Production software for enterprise risk - not one-off AI scripts.
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
