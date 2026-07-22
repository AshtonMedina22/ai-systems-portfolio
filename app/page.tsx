import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative z-10 min-h-screen px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
          AI Systems Portfolio
        </p>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl font-medium tracking-tight text-ink text-balance">
          Glass-box enterprise AI
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Controls on the left. Live tool calls, state changes, and protocol
          traces on the right.
        </p>

        <div className="mt-12 border-t border-line pt-8">
          <Link
            href="/payflow"
            className="group block max-w-xl transition-colors"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Project 1 - FastMCP
            </p>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl text-ink group-hover:text-accent-deep transition-colors">
                PayFlow AP Agent
              </h2>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Invoice verification, ERP vendor match, anti-fraud routing, and
              ledger posting over a live FastMCP server.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
