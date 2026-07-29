import React from "react";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}

/** Light-surface KPI tile for executive panels. */
export function StatCard({ label, value, hint, className = "" }: StatCardProps) {
  return (
    <div className={`console-panel px-3.5 py-3 ${className}`}>
      <p className="label-opal mb-2">{label}</p>
      <div className="text-sm font-semibold text-opal-main">{value}</div>
      {hint ? (
        <p className="mt-1 truncate text-xs text-opal-muted">{hint}</p>
      ) : null}
    </div>
  );
}
