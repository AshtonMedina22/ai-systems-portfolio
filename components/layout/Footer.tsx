import { contactMailto, site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative z-10">
      <div className="bg-opal-terminal text-white">
        <div className="mx-auto max-w-5xl px-6 py-12 text-center sm:py-14">
          <p className="font-display text-xl font-medium tracking-tight text-balance sm:text-2xl">
            Looking to streamline your operations or hire an AI Solutions
            Architect?
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-300 sm:text-base">
            Let&apos;s talk about your systems.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-3">
            <a
              href={contactMailto}
              className="inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-opal-terminal transition-colors hover:bg-violet-100 sm:w-auto"
            >
              Email Ashton
            </a>
            <span
              className="hidden text-slate-500 sm:inline"
              aria-hidden
            >
              |
            </span>
            <a
              href={site.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-500 bg-transparent px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-violet-300 hover:bg-white/10 sm:w-auto"
            >
              Connect on LinkedIn
            </a>
            <span
              className="hidden text-slate-500 sm:inline"
              aria-hidden
            >
              |
            </span>
            <a
              href={site.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-500 bg-transparent px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-violet-300 hover:bg-white/10 sm:w-auto"
            >
              View GitHub Repo
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} {site.name}
            <span className="text-slate-500"> - {site.role}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
