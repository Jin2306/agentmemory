import { projectTitleFrom, runAgent, updatesFromParsed } from "./agents";
import { isCrusoeConfigured, missingConfigMessage } from "./crusoe";
import {
  buildComparisonSummary,
  buildFinalPlan,
  evaluateWorkflow,
  extractReferenceRequirements,
} from "./evaluation";
import {
  MemoryManager,
  createEmptyMemory,
  saveMemoryAtomic,
  saveRunResult,
} from "./memory";
import {
  AGENT_ORDER,
  type AgentOutput,
  type RunEvent,
  type RunResult,
  type WorkflowMode,
} from "./types";

export async function executeAgentTeam(
  request: string,
  emit: (event: RunEvent) => void,
): Promise<RunResult> {
  if (!isCrusoeConfigured()) {
    throw new Error(missingConfigMessage());
  }

  const trimmed = request.trim();
  if (trimmed.length < 20) {
    throw new Error(
      "Please describe the project in at least 20 characters so the agents have something to work with.",
    );
  }

  const runId = crypto.randomUUID();
  emit({ type: "run-start", runId, request: trimmed });

  const withoutAgents: AgentOutput[] = [];
  emit({ type: "mode-start", mode: "without-memory" });
  for (const agent of AGENT_ORDER) {
    emit({
      type: "agent-status",
      mode: "without-memory",
      agentId: agent.id,
      status: "running",
    });
    const output = await runAgent({
      agentId: agent.id,
      agentName: agent.name,
      mode: "without-memory",
      request: trimmed,
    });
    withoutAgents.push(output);
    emit({ type: "agent-result", mode: "without-memory", agent: output });
  }

  const reference = extractReferenceRequirements(withoutAgents);
  const projectTitle = projectTitleFrom(withoutAgents, trimmed.slice(0, 72));

  const manager = new MemoryManager(
    createEmptyMemory(runId, projectTitle, trimmed),
  );
  await saveMemoryAtomic(manager.memory);
  emit({ type: "memory", memory: manager.memory, stats: manager.stats });

  const withAgents: AgentOutput[] = [];
  emit({ type: "mode-start", mode: "with-memory" });
  for (const agent of AGENT_ORDER) {
    const knowledge = manager.selectRelevantKnowledge();
    emit({ type: "memory", memory: manager.memory, stats: manager.stats });
    emit({
      type: "agent-status",
      mode: "with-memory",
      agentId: agent.id,
      status: "running",
    });
    const output = await runAgent({
      agentId: agent.id,
      agentName: agent.name,
      mode: "with-memory",
      request: trimmed,
      sharedMemoryJson: knowledge,
    });
    withAgents.push(output);
    emit({ type: "agent-result", mode: "with-memory", agent: output });

    if (output.parsed) {
      manager.updateMemory(agent.name, updatesFromParsed(output.parsed));
      await saveMemoryAtomic(manager.memory);
      emit({ type: "memory", memory: manager.memory, stats: manager.stats });
    }
  }

  const withoutMetrics = evaluateWorkflow(withoutAgents, reference);
  const withMetrics = evaluateWorkflow(withAgents, reference);
  const result: RunResult = {
    runId,
    request: trimmed,
    projectTitle,
    withoutMemory: { agents: withoutAgents, metrics: withoutMetrics },
    withMemory: {
      agents: withAgents,
      metrics: withMetrics,
      memory: manager.memory,
      stats: manager.stats,
    },
    comparisonSummary: buildComparisonSummary(withoutMetrics, withMetrics),
    finalPlan: buildFinalPlan(withAgents, trimmed),
  };

  await saveRunResult(runId, result);
  emit({ type: "complete", result });
  return result;
}

export function validateRequest(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object with a `request` string.");
  }
  const request = (body as { request?: unknown }).request;
  if (typeof request !== "string") {
    throw new Error("`request` must be a string.");
  }
  return request;
}
