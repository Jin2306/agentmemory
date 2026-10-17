"use client";

import type { ReactNode } from "react";
import { Map } from "lucide-react";
import type { FinalPlan as FinalPlanType } from "@/lib/types";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <h3 className="mb-2 text-sm font-medium text-violet-200">{title}</h3>
      <div className="text-sm leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

export function FinalPlan({ plan }: { plan: FinalPlanType | null }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Map className="h-5 w-5 text-emerald-300" />
        <h2 className="text-lg font-semibold text-white">Final Project Plan</h2>
        <span className="text-xs text-slate-500">from shared-memory workflow</span>
      </div>
      {!plan ? (
        <p className="text-sm text-slate-400">The shared-memory team plan will land here.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Block title="Project overview">
            <p>{plan.overview || "No overview produced."}</p>
          </Block>
          <Block title="Key features">
            {plan.keyFeatures.length ? (
              <ul className="list-disc space-y-1 pl-4">
                {plan.keyFeatures.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              "None listed."
            )}
          </Block>
          <Block title="Architecture">
            <p>{plan.architecture}</p>
          </Block>
          <Block title="Implementation steps">
            {plan.implementationSteps.length ? (
              <ol className="list-decimal space-y-1 pl-4">
                {plan.implementationSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : (
              "None listed."
            )}
          </Block>
          <Block title="Risks">
            {plan.risks.length ? (
              <ul className="list-disc space-y-1 pl-4">
                {plan.risks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              "None listed."
            )}
          </Block>
          <Block title="Unresolved questions">
            {plan.unresolvedQuestions.length ? (
              <ul className="list-disc space-y-1 pl-4">
                {plan.unresolvedQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              "None listed."
            )}
          </Block>
        </div>
      )}
    </section>
  );
}
