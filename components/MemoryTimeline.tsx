"use client";

import { Clock } from "lucide-react";
import type { MemoryActivity } from "@/lib/types";

export function MemoryTimeline({ events }: { events: MemoryActivity[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-violet-300" />
        <h2 className="text-lg font-semibold text-white">Memory Timeline</h2>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">Activity from the shared-memory run will appear here.</p>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
              <div>
                <p className="text-sm text-slate-200">
                  <span className="font-medium text-violet-200">{event.actor}</span>{" "}
                  <span className="text-slate-400">→</span> {event.detail}
                </p>
                <p className="text-[11px] text-slate-500">
                  {new Date(event.timestamp).toLocaleTimeString()} · {event.action}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
