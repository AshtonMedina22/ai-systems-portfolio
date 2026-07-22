import React from "react";
import { ArrowRight } from "lucide-react";

/** Compact scenario row - interaction without card clutter. */
export function ScenarioOption({
  label,
  detail,
  active,
  disabled,
  onClick,
  tone = "default",
}: {
  label: string;
  detail: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone?: "default" | "danger" | "warn";
}) {
  const activeClass =
    tone === "danger"
      ? "border-l-rose-500 bg-rose-50/60"
      : tone === "warn"
        ? "border-l-amber-500 bg-amber-50/60"
        : "border-l-opal-purple bg-violet-50/50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full border-l-2 px-3 py-3 text-left transition-colors disabled:opacity-60 ${
        active
          ? `${activeClass} text-opal-main`
          : "border-l-transparent text-opal-muted hover:bg-slate-50 hover:text-opal-main"
      }`}
    >
      <span className="block text-sm font-semibold text-opal-main">{label}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-opal-muted">
        {detail}
      </span>
    </button>
  );
}

export function ScenarioList({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="label-opal mb-2">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/** Key/value readout without a bordered card. */
export function DetailList({
  rows,
}: {
  rows: Array<{ label: string; value: React.ReactNode; emphasize?: boolean }>;
}) {
  return (
    <dl className="space-y-2 text-[13px]">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className="font-medium text-opal-label">{row.label}</dt>
          <dd
            className={`text-right font-medium ${
              row.emphasize ? "text-opal-violet" : "text-opal-main"
            }`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Post-run outcome strip - only after something happened. */
export function ResultStrip({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-200 pt-4 space-y-2.5">{children}</div>
  );
}

export function ResultRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-opal-label">{label}</span>
      <span className="text-right font-semibold text-opal-main">{value}</span>
    </div>
  );
}

export function DemoPrimaryButton({
  label,
  busyLabel,
  isRunning,
  onClick,
  disabled,
}: {
  label: string;
  busyLabel: string;
  isRunning: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isRunning}
      className="group mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-opal-purple px-4 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-opal-violet disabled:opacity-50"
    >
      <span>{isRunning ? busyLabel : label}</span>
      {!isRunning ? (
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      ) : null}
    </button>
  );
}
