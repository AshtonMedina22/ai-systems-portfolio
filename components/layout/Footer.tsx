import Image from "next/image";
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { contactMailto, site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative z-10 overflow-hidden bg-[#17182e] text-white">
      <div
        className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-opal-orchid/15 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-opal-aqua/15 blur-3xl"
        aria-hidden
      />

      <section
        className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.25fr_0.75fr] lg:items-center lg:gap-20 lg:px-8 lg:py-24"
        aria-labelledby="contact-heading"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-opal-aqua">
            Have a system to fix or scale?
          </p>
          <h2
            id="contact-heading"
            className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl"
          >
            Let&apos;s build the system your operations need next.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
            If you&apos;re building or modernizing business systems, I&apos;d
            welcome the opportunity to discuss how I can help.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={contactMailto}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-opal-main transition-colors hover:bg-opal-lilac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opal-aqua focus-visible:ring-offset-2 focus-visible:ring-offset-[#17182e]"
            >
              Start a conversation
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={site.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 px-1 text-sm font-semibold text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opal-aqua"
            >
              Connect on LinkedIn
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/45">
            How I approach the work
          </p>
          <ol className="mt-5 space-y-4">
            {[
              ["01", "Understand how the operation really runs"],
              ["02", "Design the workflows and control points"],
              ["03", "Build for adoption, reliability, and scale"],
            ].map(([number, label]) => (
              <li
                key={number}
                className="flex items-center gap-4 border-t border-white/10 pt-4 first:border-t-0 first:pt-0"
              >
                <span className="font-mono text-xs text-opal-aqua">
                  {number}
                </span>
                <span className="text-sm leading-relaxed text-white/75">
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="relative border-t border-white/10 bg-black/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <a
            href="/"
            className="group flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opal-aqua"
            aria-label={`${site.name} home`}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
              <Image
                src="/am-logo.png"
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-contain"
                aria-hidden
              />
            </span>
            <span>
              <span className="block font-display text-sm font-semibold text-white transition-colors group-hover:text-opal-aqua">
                {site.name}
              </span>
              <span className="block text-xs text-white/45">{site.role}</span>
            </span>
          </a>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
            <nav className="flex items-center gap-4" aria-label="Social links">
              <a
                href={site.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opal-aqua"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden />
                LinkedIn
              </a>
              <a
                href={contactMailto}
                className="inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opal-aqua"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Email
              </a>
            </nav>
            <p className="text-xs text-white/35">
              &copy; {new Date().getFullYear()} {site.name}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
