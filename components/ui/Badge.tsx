import React from "react";

export type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "accent";

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: "border-emerald-300 bg-emerald-100 text-emerald-800",
  warn: "border-amber-300 bg-amber-100 text-amber-800",
  danger: "border-rose-300 bg-rose-100 text-rose-800",
  neutral: "border-slate-300 bg-slate-100 text-slate-700",
  accent: "border-violet-300 bg-violet-100 text-violet-800",
};

const TONE_CLASS_DARK: Record<BadgeTone, string> = {
  ok: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  warn: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  danger: "border-rose-400/40 bg-rose-400/15 text-rose-200",
  neutral: "border-slate-400/40 bg-slate-400/15 text-slate-200",
  accent: "border-violet-300/50 bg-violet-400/20 text-violet-100",
};

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  variant?: "light" | "dark";
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
  variant = "light",
}: BadgeProps) {
  const tones = variant === "dark" ? TONE_CLASS_DARK : TONE_CLASS;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] uppercase ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
