"use client";

import { useState } from "react";
import { ChevronDown, Database } from "lucide-react";
import type { MemoryEntry, MemoryStats, SharedMemory } from "@/lib/types";

function EntryList({ title, entries }: { title: string; entries: MemoryEntry[] }) {
  const active = entries.filter((e) => e.status === "active");
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-200">{title}</h4>
        <span className="text-xs text-slate-500">{active.length}</span>
      </div>
      {active.length === 0 ? (
        <p className="text-xs text-slate-500">None yet</p>
      ) : (
        <ul className="space-y-1.5">
          {active.slice(0, 8).map((entry) => (
            <li key={entry.id} className="text-xs leading-relaxed text-slate-300">
              <span className="text-violet-300">{entry.source.replace(" Agent", "")}:</span>{" "}
              {entry.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MemoryViewer({
  memory,
  stats,
}: {
  memory: SharedMemory | null;
  stats: MemoryStats | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-sky-300" />
        <h2 className="text-lg font-semibold text-white">Shared Brain</h2>
        {memory ? (
          <span className="ml-auto text-xs text-slate-400">
            v{memory.version} · {memory.project}
          </span>
        ) : null}
      </div>

      {stats ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ["Reads", stats.reads],
            ["Writes", stats.writes],
            ["New", stats.newEntries],
            ["Dupes rejected", stats.duplicatesRejected],
            ["Conflicts", stats.conflictsDetected],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-black/25 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
              <div className="text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {memory ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <EntryList title="Requirements" entries={memory.requirements} />
          <EntryList title="Target Users" entries={memory.targetUsers} />
          <EntryList title="Technical Decisions" entries={memory.technicalDecisions} />
          <EntryList title="Constraints" entries={memory.constraints} />
          <EntryList title="Open Questions" entries={memory.openQuestions} />
          <EntryList title="Conflicts" entries={memory.conflicts} />
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Shared memory appears here during the With Memory workflow.
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 flex items-center gap-2 text-xs text-slate-400 hover:text-white"
      >
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        {open ? "Hide JSON" : "Show JSON"}
      </button>
      {open ? (
        <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] leading-relaxed text-slate-300">
          {JSON.stringify(memory, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
