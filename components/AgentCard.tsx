"use client";

import { Brain, Loader2, Palette, Code2, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { AgentId, AgentOutput, AgentStatus } from "@/lib/types";

const ICONS = {
  research: Brain,
  design: Palette,
  development: Code2,
} as const;

function StatusIcon({ status }: { status: AgentStatus }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-violet-300" />;
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-rose-400" />;
  return <Circle className="h-4 w-4 text-slate-500" />;
}

function formatDuration(ms?: number) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function AgentCard({
  agentId,
  name,
  status,
  result,
}: {
  agentId: AgentId;
  name: string;
  status: AgentStatus;
  result?: AgentOutput;
}) {
  const Icon = ICONS[agentId];
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-violet-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-white">{name}</h3>
            <p className="flex items-center gap-1.5 text-xs capitalize text-slate-400">
              <StatusIcon status={status} />
              {status}
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-500">{formatDuration(result?.durationMs)}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {result?.summary || "Waiting for this agent to run."}
      </p>
    </article>
  );
}
