"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { contactMailto, site } from "@/lib/site";

const navLinkClass =
  "rounded-lg px-2.5 py-1.5 text-sm font-medium text-opal-muted transition-colors hover:bg-accent-soft hover:text-opal-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="relative z-20 border-b border-white/60 bg-white/55 shadow-[0_10px_35px_-30px_rgba(62,66,120,0.6)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => setOpen(false)}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-opal-aqua shadow-[0_0_12px_rgba(126,177,212,0.5)]"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block font-display text-[15px] font-semibold tracking-tight text-opal-main transition-colors group-hover:text-opal-violet sm:text-base">
              {site.name}
            </span>
            <span className="block text-[11px] font-medium text-opal-muted sm:text-xs">
              {site.role}
            </span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 sm:flex sm:gap-2 md:gap-3"
          aria-label="Primary"
        >
          <a href="/#projects" className={navLinkClass}>
            Projects
          </a>
          <a
            href={site.github}
            target="_blank"
            rel="noopener noreferrer"
            className={navLinkClass}
          >
            GitHub
          </a>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className={navLinkClass}
          >
            LinkedIn
          </a>
          <a href={contactMailto} className="btn-primary ml-1 px-3.5 py-2">
            Get in Touch
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <a href={contactMailto} className="btn-primary px-2.5 py-1.5 text-xs">
            Contact
          </a>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-opal-main transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="flex flex-col gap-1.5">
              <span
                className={`block h-0.5 w-4 bg-opal-main transition-transform ${
                  open ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`block h-0.5 w-4 bg-opal-main transition-opacity ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block h-0.5 w-4 bg-opal-main transition-transform ${
                  open ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id={menuId}
          className="border-t border-white/60 bg-white/70 px-4 py-3 backdrop-blur-2xl"
          aria-label="Mobile"
        >
          <div className="flex flex-col gap-1">
            <a
              href="/#projects"
              className={`${navLinkClass} block`}
              onClick={() => setOpen(false)}
            >
              Projects
            </a>
            <a
              href={site.github}
              target="_blank"
              rel="noopener noreferrer"
              className={`${navLinkClass} block`}
              onClick={() => setOpen(false)}
            >
              GitHub
            </a>
            <a
              href={site.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className={`${navLinkClass} block`}
              onClick={() => setOpen(false)}
            >
              LinkedIn
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
