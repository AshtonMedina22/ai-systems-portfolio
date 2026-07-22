import { contactMailto, site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-slate-200/80 bg-white/75 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-sm text-opal-muted">
          &copy; {new Date().getFullYear()} {site.name}
          <span className="text-opal-label"> - {site.role}</span>
        </p>
        <div className="flex flex-wrap items-center gap-5 text-sm font-medium text-opal-label">
          <a
            href={site.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-opal-purple transition-colors"
          >
            GitHub
          </a>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-opal-purple transition-colors"
          >
            LinkedIn
          </a>
          <a
            href={contactMailto}
            className="hover:text-opal-purple transition-colors"
          >
            Email
          </a>
        </div>
      </div>
    </footer>
  );
}
