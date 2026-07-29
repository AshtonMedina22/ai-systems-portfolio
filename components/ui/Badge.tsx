import React from "react";

export type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "accent";

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: "border-ok/25 bg-ok-soft text-ok",
  warn: "border-warn/25 bg-warn-soft text-warn",
  danger: "border-danger/25 bg-danger-soft text-danger",
  neutral: "border-line bg-console-panel text-opal-label",
  accent: "border-accent/25 bg-accent-soft text-accent-deep",
};

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  /** @deprecated Dark variant removed - light Opal console only. */
  variant?: "light" | "dark";
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold tracking-wide ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
