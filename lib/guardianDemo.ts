import { MemoryManager, createEmptyMemory, saveMemoryAtomic } from "./memory";
import { guardianMetricsFromMemory } from "./memoryGuardian";
import type { AgentName, GuardianDemoResult } from "./types";

type GuardianDemoCase = {
  name: string;
  description: string;
  agent: AgentName;
  category: string;
  value: string;
  rationale: string;
};

const CASES: GuardianDemoCase[] = [
  {
    name: "seed",
    description: "Establish primary database: PostgreSQL",
    agent: "Research Agent",
    category: "Primary database",
    value: "PostgreSQL",
    rationale: "Relational clinic data: patients, doctors, appointments",
  },
  {
    name: "genuine-conflict",
    description: "Development Agent proposes MongoDB as the primary database",
    agent: "Development Agent",
    category: "Primary database",
    value: "MongoDB",
    rationale: "Flexible document schema",
  },
  {
    name: "compatible-update",
    description: "Design Agent proposes Redis as a cache — complementary, not a replacement",
    agent: "Design Agent",
    category: "cache",
    value: "Redis",
    rationale: "Session and appointment slot caching",
  },
  {
    name: "duplicate-update",
    description: "Research Agent repeats PostgreSQL as the primary database",
    agent: "Research Agent",
    category: "Primary database",
    value: "PostgreSQL",
    rationale: "Same relational store",
  },
];

export async function runGuardianDemo(request: string): Promise<GuardianDemoResult> {
  const trimmed =
    request.trim() ||
    "Create a plan for building an online appointment booking system for a medical clinic. It should support patients, doctors, appointment scheduling, and notifications.";
  const runId = `guardian-demo-${crypto.randomUUID()}`;
  const manager = new MemoryManager(
    createEmptyMemory(runId, "Guardian demo", trimmed),
  );

  const cases: GuardianDemoResult["cases"] = [];
  for (const testCase of CASES) {
    const beforeVersion = manager.memory.version;
    await manager.updateMemory(testCase.agent, {
      technicalDecisions: [
        {
          category: testCase.category,
          value: testCase.value,
          rationale: testCase.rationale,
        },
      ],
    });
    cases.push({
      name: testCase.name,
      description: testCase.description,
      beforeVersion,
      afterVersion: manager.memory.version,
      activeDecisions: manager.memory.technicalDecisions
        .filter((entry) => entry.status === "active")
        .map((entry) => ({
          category: entry.category ?? "",
          value: entry.value ?? entry.content,
        })),
    });
  }

  await saveMemoryAtomic(manager.memory);
  return {
    runId,
    isolated: true,
    request: trimmed,
    cases,
    memory: manager.memory,
    stats: manager.stats,
    metrics: guardianMetricsFromMemory(manager.memory),
  };
}
