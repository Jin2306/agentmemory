"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, Shield, Sparkles } from "lucide-react";
import { AgentCard } from "@/components/AgentCard";
import { ComparisonDashboard } from "@/components/ComparisonDashboard";
import { FinalPlan } from "@/components/FinalPlan";
import { MemoryGuardianPanel } from "@/components/MemoryGuardian";
import { MemoryTimeline } from "@/components/MemoryTimeline";
import { MemoryViewer } from "@/components/MemoryViewer";
import type {
  AgentId,
  AgentOutput,
  AgentStatus,
  GuardianDemoResult,
  MemoryStats,
  RunEvent,
  RunResult,
  SharedMemory,
  WorkflowMode,
} from "@/lib/types";

const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "Medical Clinic Website",
    text: "Create a plan for building an online appointment booking system for a medical clinic. It should support patients, doctors, appointment scheduling, and notifications.",
  },
  {
    label: "AI Study Planner",
    text: "Create a plan for an AI study planner that helps students set goals, generate weekly schedules, track progress, and adapt based on exam dates and energy levels.",
  },
  {
    label: "E-commerce Store",
    text: "Create a plan for a small e-commerce store for handmade goods, including catalog, cart, checkout, inventory, and order notifications.",
  },
];

const AGENTS: { id: AgentId; name: string }[] = [
  { id: "research", name: "Research Agent" },
  { id: "design", name: "Design Agent" },
  { id: "development", name: "Development Agent" },
];

type StatusMap = Record<AgentId, AgentStatus>;

const idleStatus = (): StatusMap => ({
  research: "waiting",
  design: "waiting",
  development: "waiting",
});

export default function Home() {
  const [request, setRequest] = useState(EXAMPLES[0].text);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<WorkflowMode | null>(null);
  const [withoutStatus, setWithoutStatus] = useState<StatusMap>(idleStatus);
  const [withStatus, setWithStatus] = useState<StatusMap>(idleStatus);
  const [withoutResults, setWithoutResults] = useState<Partial<Record<AgentId, AgentOutput>>>({});
  const [withResults, setWithResults] = useState<Partial<Record<AgentId, AgentOutput>>>({});
  const [memory, setMemory] = useState<SharedMemory | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [guardianTesting, setGuardianTesting] = useState(false);
  const [guardianDemo, setGuardianDemo] = useState<GuardianDemoResult | null>(null);
  const [guardianError, setGuardianError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) setHealth(data.hint ?? "Crusoe API key is missing.");
        else setHealth(`Ready · ${data.crusoe.model}`);
      })
      .catch(() => setHealth("Health check failed."));
  }, []);

  const applyEvent = (event: RunEvent) => {
    if (event.type === "run-start") {
      setRunId(event.runId);
      return;
    }
    if (event.type === "mode-start") {
      setActiveMode(event.mode);
      if (event.mode === "without-memory") setWithoutStatus(idleStatus());
      else setWithStatus(idleStatus());
      return;
    }
    if (event.type === "agent-status") {
      const setter = event.mode === "without-memory" ? setWithoutStatus : setWithStatus;
      setter((prev) => ({ ...prev, [event.agentId]: event.status }));
      return;
    }
    if (event.type === "agent-result") {
      const setter = event.mode === "without-memory" ? setWithoutResults : setWithResults;
      const statusSetter = event.mode === "without-memory" ? setWithoutStatus : setWithStatus;
      setter((prev) => ({ ...prev, [event.agent.agentId]: event.agent }));
      statusSetter((prev) => ({ ...prev, [event.agent.agentId]: event.agent.status }));
      return;
    }
    if (event.type === "memory") {
      setMemory(event.memory);
      setStats(event.stats);
      return;
    }
    if (event.type === "complete") {
      setResult(event.result);
      setMemory(event.result.withMemory.memory);
      setStats(event.result.withMemory.stats);
      return;
    }
    if (event.type === "error") {
      setError(event.message);
    }
  };

  const runTeam = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setMemory(null);
    setStats(null);
    setWithoutResults({});
    setWithResults({});
    setWithoutStatus(idleStatus());
    setWithStatus(idleStatus());
    setActiveMode("without-memory");

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Run failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          applyEvent(JSON.parse(line) as RunEvent);
        }
      }
      if (buffer.trim()) applyEvent(JSON.parse(buffer) as RunEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed.");
    } finally {
      setRunning(false);
      setActiveMode(null);
    }
  };

  const testGuardian = async () => {
    setGuardianTesting(true);
    setGuardianError(null);
    try {
      const response = await fetch("/api/guardian/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `Guardian test failed (${response.status})`);
      }
      setGuardianDemo(data as GuardianDemoResult);
    } catch (err) {
      setGuardianError(err instanceof Error ? err.message : "Guardian test failed.");
    } finally {
      setGuardianTesting(false);
    }
  };

  const timeline = useMemo(() => memory?.activityLog ?? [], [memory]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950/80 via-slate-950 to-sky-950/70 p-8">
        <div className="flex items-center gap-2 text-violet-300">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm uppercase tracking-[0.2em]">Shared Brain</span>
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          AgentMemory
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-300">
          One shared brain. Smarter AI teams.
        </p>
        <p className="mt-1 text-sm text-slate-400">
          AI agents that remember, collaborate, and improve.
        </p>
        {health ? (
          <p className="mt-4 text-xs text-slate-400">{health}</p>
        ) : null}
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold text-white">Project Request</h2>
        <p className="mb-3 text-sm text-slate-400">
          What project should your AI team work on?
        </p>
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none ring-violet-500/40 focus:ring-2"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => setRequest(example.text)}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-violet-400/40 hover:text-white"
            >
              {example.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runTeam}
            disabled={running || guardianTesting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running agent team…" : "Run Agent Team"}
          </button>
          <button
            type="button"
            onClick={testGuardian}
            disabled={running || guardianTesting}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-5 py-2.5 text-sm font-semibold text-amber-100 disabled:opacity-60"
          >
            {guardianTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {guardianTesting ? "Testing Guardian…" : "Test Memory Guardian"}
          </button>
        </div>
        {runId ? (
          <p className="mt-2 text-xs text-slate-500">Run ID: {runId}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        {guardianError ? <p className="mt-3 text-sm text-rose-300">{guardianError}</p> : null}
        {guardianDemo ? (
          <p className="mt-2 text-xs text-slate-500">
            Isolated Guardian demo {guardianDemo.runId} — project memory was not overwritten.
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Without Shared Memory</h2>
          {activeMode === "without-memory" ? (
            <span className="text-xs text-sky-300">Running independently</span>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {AGENTS.map((agent) => (
            <AgentCard
              key={`a-${agent.id}`}
              agentId={agent.id}
              name={agent.name}
              status={withoutStatus[agent.id]}
              result={withoutResults[agent.id]}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">With Shared Memory</h2>
          {activeMode === "with-memory" ? (
            <span className="text-xs text-violet-300">Reading and writing the shared brain</span>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {AGENTS.map((agent) => (
            <AgentCard
              key={`b-${agent.id}`}
              agentId={agent.id}
              name={agent.name}
              status={withStatus[agent.id]}
              result={withResults[agent.id]}
            />
          ))}
        </div>
      </section>

      <MemoryViewer memory={memory} stats={stats} />
      <MemoryGuardianPanel
        history={
          (memory?.guardianHistory?.length
            ? memory.guardianHistory
            : guardianDemo?.memory.guardianHistory) ?? []
        }
        stats={memory ? stats : guardianDemo?.stats ?? stats}
      />
      {guardianDemo ? (
        <section className="rounded-2xl border border-amber-400/20 bg-slate-900/70 p-5">
          <h2 className="mb-3 text-lg font-semibold text-white">Guardian test run</h2>
          <ol className="space-y-2 text-sm text-slate-300">
            {guardianDemo.cases.map((item) => (
              <li key={item.name}>
                <span className="font-medium text-amber-200">{item.name}:</span> {item.description}
                <div className="text-xs text-slate-500">
                  v{item.beforeVersion}→v{item.afterVersion} · active:{" "}
                  {item.activeDecisions.map((d) => `${d.category}=${d.value}`).join(", ") || "none"}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <MemoryTimeline events={timeline} />
      <ComparisonDashboard
        without={result?.withoutMemory.metrics ?? null}
        withMemory={result?.withMemory.metrics ?? null}
        summary={result?.comparisonSummary ?? ""}
      />
      <FinalPlan plan={result?.finalPlan ?? null} />
    </main>
  );
}
