import { contactMailto, site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative z-10">
      <div className="bg-opal-terminal text-white">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center sm:py-16">
          <h2 className="font-display text-2xl font-medium tracking-tight text-balance sm:text-3xl">
            Let&apos;s Talk
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-300 sm:text-base">
            If you&apos;re looking for someone who understands both the
            operational side of a business and how to build the software systems
            that run it, let&apos;s connect. I&apos;m always open to discussing
            new opportunities or consulting projects.
          </p>

          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              Email
            </p>
            <a
              href={contactMailto}
              className="mt-2 inline-block text-base font-semibold text-white underline-offset-4 transition-colors hover:text-violet-200 hover:underline sm:text-lg"
            >
              {site.email}
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
