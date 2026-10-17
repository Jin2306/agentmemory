"use client";

import { BarChart3 } from "lucide-react";
import type { Metrics } from "@/lib/types";

function formatTokens(value: number | null) {
  return value == null ? "Unavailable" : value.toLocaleString();
}

function formatCoverage(metrics: Metrics) {
  if (metrics.requirementsTotal === 0) return "0% (0/0)";
  return `${Math.round(metrics.requirementCoverage * 100)}% (${metrics.requirementsCovered}/${metrics.requirementsTotal})`;
}

function formatConsistency(value: number | null) {
  if (value == null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function barWidth(a: number, b: number) {
  const max = Math.max(a, b, 1);
  return `${Math.round((a / max) * 100)}%`;
}

function TokenBar({
  label,
  without,
  withMemory,
}: {
  label: string;
  without: number | null;
  withMemory: number | null;
}) {
  if (without == null && withMemory == null) {
    return (
      <div>
        <p className="mb-1 text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-500">Unavailable</p>
      </div>
    );
  }
  const a = without ?? 0;
  const b = withMemory ?? 0;
  return (
    <div>
      <p className="mb-2 text-xs text-slate-400">{label}</p>
      <div className="space-y-1.5">
        <div className="h-2 rounded-full bg-white/5">
          <div
            className="h-2 rounded-full bg-slate-500"
            style={{ width: barWidth(a, b) }}
          />
        </div>
        <div className="h-2 rounded-full bg-white/5">
          <div
            className="h-2 rounded-full bg-violet-500"
            style={{ width: barWidth(b, a) }}
          />
        </div>
      </div>
    </div>
  );
}

export function ComparisonDashboard({
  without,
  withMemory,
  summary,
}: {
  without: Metrics | null;
  withMemory: Metrics | null;
  summary: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-sky-300" />
        <h2 className="text-lg font-semibold text-white">Performance Comparison</h2>
      </div>

      <div className="mb-4 flex gap-4 text-xs">
        <span className="flex items-center gap-2 text-slate-400">
          <span className="h-2 w-2 rounded-full bg-slate-500" /> Without memory
        </span>
        <span className="flex items-center gap-2 text-slate-400">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> With memory
        </span>
      </div>

      {without && withMemory ? (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <TokenBar
              label="Input tokens"
              without={without.inputTokens}
              withMemory={withMemory.inputTokens}
            />
            <TokenBar
              label="Output tokens"
              without={without.outputTokens}
              withMemory={withMemory.outputTokens}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Metric</th>
                  <th className="pb-2">Without Memory</th>
                  <th className="pb-2">With Memory</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                <tr className="border-t border-white/5">
                  <td className="py-2">Input tokens</td>
                  <td>{formatTokens(without.inputTokens)}</td>
                  <td>{formatTokens(withMemory.inputTokens)}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-2">Output tokens</td>
                  <td>{formatTokens(without.outputTokens)}</td>
                  <td>{formatTokens(withMemory.outputTokens)}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-2">Duplicate findings</td>
                  <td>{without.duplicateFindings}</td>
                  <td>{withMemory.duplicateFindings}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-2">Conflicting decisions</td>
                  <td>{without.conflictingDecisions}</td>
                  <td>{withMemory.conflictingDecisions}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-2">Requirement coverage</td>
                  <td>{formatCoverage(without)}</td>
                  <td>{formatCoverage(withMemory)}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-2">Conflicts detected</td>
                  <td>{without.guardianConflictsDetected}</td>
                  <td>{withMemory.guardianConflictsDetected}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-2">Conflicts resolved</td>
                  <td>{without.guardianConflictsResolved}</td>
                  <td>{withMemory.guardianConflictsResolved}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-2">Unresolved conflicts</td>
                  <td>{without.guardianUnresolved}</td>
                  <td>{withMemory.guardianUnresolved}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-2">Active memory consistency</td>
                  <td>{formatConsistency(without.memoryConsistency)}</td>
                  <td>{formatConsistency(withMemory.memoryConsistency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">{summary}</p>
        </>
      ) : (
        <p className="text-sm text-slate-400">
          Metrics appear after both workflows finish. Values come from actual agent outputs — never hardcoded.
        </p>
      )}
    </section>
  );
}
