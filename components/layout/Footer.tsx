import { contactMailto, site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative z-10">
      <div className="bg-opal-terminal text-white">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Let&apos;s Talk
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/70 sm:text-base">
            If you need someone who understands operations and can build the
            systems that run them, email me.
          </p>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/50">
              Email
            </p>
            <a
              href={contactMailto}
              className="mt-2 inline-block text-base font-semibold text-white underline-offset-4 transition-colors hover:text-white/90 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:text-lg"
            >
              {site.email}
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#1b1d35]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-xs text-white/45">
            &copy; {new Date().getFullYear()} {site.name}
            <span className="text-white/35"> - {site.role}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
