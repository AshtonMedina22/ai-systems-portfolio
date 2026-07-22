"use client";

import { useState } from "react";
import { GlassBox } from "@/components/ui/GlassBox";
import { TerminalStream } from "@/components/ui/TerminalStream";
import { Activity, ShieldCheck, UserCheck } from "lucide-react";

const SCENARIOS = [
  {
    key: "latency",
    label: "API latency spike",
    detail: "Shows agent debate over cache vs scale remediation",
    icon: <Activity className="h-4 w-4 text-amber-700" />,
  },
  {
    key: "crash",
    label: "Service crash loop",
    detail: "Drafts a rollback plan with manager approval required",
    icon: <ShieldCheck className="h-4 w-4 text-rose-700" />,
  },
  {
    key: "approval",
    label: "Human sign-off gate",
    detail: "Blocks production changes until a manager approves",
    icon: <UserCheck className="h-4 w-4 text-emerald-700" />,
  },
] as const;

export default function SrePage() {
  const [selected, setSelected] = useState<(typeof SCENARIOS)[number]["key"]>(
    "latency"
  );

  return (
    <GlassBox
      title="Self-Healing SRE"
      badge="Project 2 - LangGraph - Autonomous Incident Manager"
      description="Incident triage and recovery with human approval gates. Collaborative agents diagnose crashes and draft repair plans - managers still approve before production changes land."
      controlLabel="Business overview"
      controlHint="Scenario input"
      controlPanel={
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-violet-50/60 px-4 py-3.5 space-y-2">
            <p className="label-opal">Business impact</p>
            <p className="text-sm leading-relaxed text-opal-muted">
              Helps shorten outage response with automated triage and manager
              sign-off before remediation changes are applied.
            </p>
          </div>

          <div>
            <label className="label-opal mb-2.5 block">Select scenario</label>
            <div className="grid grid-cols-1 gap-2.5">
              {SCENARIOS.map((scenario) => {
                const active = selected === scenario.key;
                return (
                  <button
                    key={scenario.key}
                    type="button"
                    onClick={() => setSelected(scenario.key)}
                    className={`flex items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-all ${
                      active
                        ? "border-violet-400 bg-violet-50 text-opal-main shadow-sm ring-1 ring-violet-200"
                        : "border-slate-200/80 bg-white text-opal-muted hover:border-violet-300 hover:bg-violet-50/40"
                    }`}
                  >
                    <span className="mt-0.5">{scenario.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold text-opal-main">
                        {scenario.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-opal-muted">
                        {scenario.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
            <p className="label-opal mb-2">Enterprise connectors</p>
            <p className="text-sm leading-relaxed text-opal-muted">
              LangGraph multi-agent debate - Human-in-the-loop sign-off - AWS
              and enterprise cloud health
            </p>
          </div>

          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-opal-purple/70 px-4 py-3.5 text-sm font-semibold text-white opacity-70 cursor-not-allowed"
          >
            Run incident demo (coming next)
          </button>
        </div>
      }
      streamPanel={
        <TerminalStream
          logs={[]}
          title="Technical execution"
          emptyMessage={
            <p>
              Live LangGraph state transitions and agent debate traces will
              stream here once Project 2 is wired.
            </p>
          }
        />
      }
    />
  );
}
