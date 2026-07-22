import Link from "next/link";

export default function EvalsPage() {
  return (
    <main className="relative z-10 min-h-screen px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-accent"
      >
        Back to portfolio
      </Link>
      <h1 className="mt-6 font-display text-3xl text-ink">
        AI Safety & Quality Gate
      </h1>
      <p className="mt-2 text-muted text-sm">Coming soon (Promptfoo).</p>
    </main>
  );
}
