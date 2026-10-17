"use client";

import { Shield } from "lucide-react";
import type { GuardianRecord, MemoryStats } from "@/lib/types";

function resolutionStyle(resolution: GuardianRecord["resolution"], conflictDetected: boolean) {
  if (!conflictDetected) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (resolution === "accept_new") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (resolution === "flag_for_review") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  }
  return "border-rose-400/40 bg-rose-500/10 text-rose-200";
}

function resolutionLabel(record: GuardianRecord) {
  if (!record.conflictDetected) return "compatible";
  if (record.resolution === "accept_new") return "accepted new";
  if (record.resolution === "keep_existing") return "kept existing (rejected proposal)";
  return "flagged for review";
}

export function MemoryGuardianPanel({
  history,
  stats,
}: {
  history: GuardianRecord[];
  stats: MemoryStats | null;
}) {
  const conflicts = history.filter((record) => record.conflictDetected);
  const resolved = conflicts.filter(
    (record) =>
      record.resolution === "keep_existing" || record.resolution === "accept_new",
  );
  const review = conflicts.filter((record) => record.resolution === "flag_for_review");
  const latest = history.at(-1) ?? null;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-amber-300" />
        <h2 className="text-lg font-semibold text-white">Memory Guardian</h2>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Conflicts detected", stats?.conflictsDetected ?? conflicts.length],
          ["Automatically resolved", stats?.conflictsResolved ?? resolved.length],
          ["Needs review", stats?.conflictsFlagged ?? review.length],
          ["History records", history.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-black/25 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="text-lg font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      {latest ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Latest Guardian decision
          </p>
          <p className="mt-1 text-sm text-slate-200">
            {latest.existingDecision} → {latest.proposedDecision} → {resolutionLabel(latest)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{latest.reason}</p>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-400">
          The Guardian evaluates conflicting agent proposals with Crusoe Managed Inference.
        </p>
      )}

      {history.length === 0 ? null : (
        <ul className="space-y-2">
          {history.map((record) => (
            <li
              key={record.id}
              className={`rounded-xl border px-3 py-2 text-sm ${resolutionStyle(record.resolution, record.conflictDetected)}`}
            >
              <p>
                {record.existingDecision} → {record.proposedDecision} →{" "}
                <span className="font-medium">{resolutionLabel(record)}</span>
              </p>
              <p className="mt-1 text-xs opacity-80">
                {record.proposingAgent} · v{record.versionBefore}→v{record.versionAfter} ·{" "}
                {record.confidence} confidence
              </p>
              <p className="mt-1 text-xs opacity-90">{record.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
