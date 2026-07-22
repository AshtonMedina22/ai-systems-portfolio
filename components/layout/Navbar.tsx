import Link from "next/link";
import { contactMailto, site } from "@/lib/site";

export function Navbar() {
  return (
    <header className="relative z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-opal-purple to-opal-violet"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block font-display text-[15px] font-medium tracking-tight text-opal-main group-hover:text-opal-violet transition-colors sm:text-base">
              {site.name}
            </span>
            <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-opal-label sm:text-[11px]">
              {site.role}
            </span>
          </span>
        </Link>

        <nav
          className="flex items-center gap-1 sm:gap-3"
          aria-label="Primary"
        >
          <a
            href="/#projects"
            className="hidden rounded-lg px-2.5 py-1.5 text-sm font-medium text-opal-muted hover:bg-violet-50 hover:text-opal-purple transition-colors sm:inline-flex"
          >
            Projects
          </a>
          <a
            href={site.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg px-2.5 py-1.5 text-sm font-medium text-opal-muted hover:bg-violet-50 hover:text-opal-purple transition-colors sm:inline-flex"
          >
            GitHub
          </a>
          <a
            href={contactMailto}
            className="inline-flex items-center rounded-xl bg-opal-purple px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-opal-violet transition-colors sm:text-sm"
          >
            Get in Touch
          </a>
        </nav>
      </div>
    </header>
  );
}
