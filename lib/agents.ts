import { crusoeChat } from "./crusoe";
import { asDecisions, asString, asStringArray, extractJsonObject } from "./json";
import type {
  AgentId,
  AgentName,
  AgentOutput,
  AgentParsed,
  DesignPayload,
  DevelopmentPayload,
  MemoryUpdates,
  ResearchPayload,
  WorkflowMode,
} from "./types";

const JSON_CONTRACT = `Return ONLY valid JSON. No markdown. No commentary.
If you are unsure, still return JSON with empty arrays rather than prose.`;

export const SYSTEM_PROMPTS: Record<AgentId, string> = {
  research: `You are the Research Agent on an AI product team.
Analyze the project request. Identify requirements, target users, constraints, recommended technologies, and unanswered questions.
${JSON_CONTRACT}
Schema:
{
  "projectTitle": string,
  "summary": string,
  "requirements": string[],
  "targetUsers": string[],
  "constraints": string[],
  "recommendedTechnologies": [{"category": string, "value": string, "rationale": string}],
  "openQuestions": string[]
}
Use technology categories such as frontend, backend, database, auth, hosting, notifications.`,

  design: `You are the Design Agent on an AI product team.
Develop product structure, main features, a UI/UX plan, design decisions, and dependencies.
${JSON_CONTRACT}
Schema:
{
  "summary": string,
  "productStructure": string[],
  "features": string[],
  "uiUxPlan": string[],
  "designDecisions": [{"category": string, "value": string, "rationale": string}],
  "dependencies": string[],
  "openQuestions": string[]
}
Use decision categories such as frontend, navigation, layout, designSystem, accessibility.`,

  development: `You are the Development Agent on an AI product team.
Create a technical implementation plan: architecture, stack, milestones, inconsistencies, and risks.
${JSON_CONTRACT}
Schema:
{
  "summary": string,
  "architecture": string,
  "techStack": [{"category": string, "value": string, "rationale": string}],
  "milestones": string[],
  "implementationSteps": string[],
  "inconsistencies": string[],
  "risks": string[],
  "requirementsAddressed": string[],
  "openQuestions": string[]
}
Use stack categories such as frontend, backend, database, auth, hosting, notifications.
If shared memory already contains a technical decision, follow it unless it is impossible — then list it under inconsistencies instead of silently replacing it.`,
};

function parseResearch(raw: unknown): ResearchPayload {
  const rec = (raw ?? {}) as Record<string, unknown>;
  return {
    projectTitle: asString(rec.projectTitle, "Untitled project"),
    summary: asString(rec.summary),
    requirements: asStringArray(rec.requirements),
    targetUsers: asStringArray(rec.targetUsers),
    constraints: asStringArray(rec.constraints),
    recommendedTechnologies: asDecisions(rec.recommendedTechnologies),
    openQuestions: asStringArray(rec.openQuestions),
  };
}

function parseDesign(raw: unknown): DesignPayload {
  const rec = (raw ?? {}) as Record<string, unknown>;
  return {
    summary: asString(rec.summary),
    productStructure: asStringArray(rec.productStructure),
    features: asStringArray(rec.features),
    uiUxPlan: asStringArray(rec.uiUxPlan),
    designDecisions: asDecisions(rec.designDecisions),
    dependencies: asStringArray(rec.dependencies),
    openQuestions: asStringArray(rec.openQuestions),
  };
}

function parseDevelopment(raw: unknown): DevelopmentPayload {
  const rec = (raw ?? {}) as Record<string, unknown>;
  return {
    summary: asString(rec.summary),
    architecture: asString(rec.architecture),
    techStack: asDecisions(rec.techStack),
    milestones: asStringArray(rec.milestones),
    implementationSteps: asStringArray(rec.implementationSteps),
    inconsistencies: asStringArray(rec.inconsistencies),
    risks: asStringArray(rec.risks),
    requirementsAddressed: asStringArray(rec.requirementsAddressed),
    openQuestions: asStringArray(rec.openQuestions),
  };
}

function parseAgent(agentId: AgentId, text: string): AgentParsed {
  const raw = extractJsonObject(text);
  if (agentId === "research") return { kind: "research", data: parseResearch(raw) };
  if (agentId === "design") return { kind: "design", data: parseDesign(raw) };
  return { kind: "development", data: parseDevelopment(raw) };
}

export function updatesFromParsed(parsed: AgentParsed): MemoryUpdates {
  if (parsed.kind === "research") {
    return {
      requirements: parsed.data.requirements,
      targetUsers: parsed.data.targetUsers,
      constraints: parsed.data.constraints,
      openQuestions: parsed.data.openQuestions,
      technicalDecisions: parsed.data.recommendedTechnologies,
      completedTasks: ["Research analysis recorded"],
    };
  }
  if (parsed.kind === "design") {
    return {
      requirements: parsed.data.features,
      openQuestions: parsed.data.openQuestions,
      technicalDecisions: parsed.data.designDecisions,
      completedTasks: ["Design plan recorded"],
    };
  }
  return {
    openQuestions: parsed.data.openQuestions,
    technicalDecisions: parsed.data.techStack,
    completedTasks: parsed.data.milestones.slice(0, 3),
  };
}

function summaryFromParsed(parsed: AgentParsed): string {
  if (parsed.kind === "research") {
    const d = parsed.data;
    return `${d.requirements.length} requirements, ${d.targetUsers.length} user groups, ${d.recommendedTechnologies.length} tech recommendations.`;
  }
  if (parsed.kind === "design") {
    const d = parsed.data;
    return `${d.features.length} features, ${d.designDecisions.length} design decisions.`;
  }
  const d = parsed.data;
  return `${d.milestones.length} milestones, ${d.techStack.length} stack choices, ${d.risks.length} risks.`;
}

export async function runAgent(options: {
  agentId: AgentId;
  agentName: AgentName;
  mode: WorkflowMode;
  request: string;
  sharedMemoryJson?: string;
}): Promise<AgentOutput> {
  const started = Date.now();
  const memoryBlock =
    options.mode === "with-memory" && options.sharedMemoryJson
      ? `\n\nSHARED PROJECT MEMORY (read this before working; do not contradict active technical decisions):\n${options.sharedMemoryJson}`
      : "";

  const isolationNote =
    options.mode === "without-memory"
      ? "\nYou do not have access to other agents, prior outputs, or shared memory. Work only from the original request."
      : "\nUse the shared memory. Prefer existing decisions. If you would choose a conflicting technology, explain it as an inconsistency instead of overwriting.";

  const user = `PROJECT REQUEST:\n${options.request}${memoryBlock}${isolationNote}`;

  try {
    const result = await crusoeChat({
      system: SYSTEM_PROMPTS[options.agentId],
      user,
    });

    let parsed: AgentParsed | null = null;
    let parseError: string | undefined;
    try {
      parsed = parseAgent(options.agentId, result.content);
    } catch (error) {
      parseError =
        error instanceof Error ? error.message : "Malformed JSON from model";
    }

    return {
      agentId: options.agentId,
      agentName: options.agentName,
      mode: options.mode,
      status: parsed ? "completed" : "failed",
      summary: parsed
        ? summaryFromParsed(parsed)
        : parseError ?? "Failed to parse structured output",
      durationMs: Date.now() - started,
      rawText: result.content,
      parsed,
      parseError,
      usage: result.usage,
      error: parseError,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent call failed";
    return {
      agentId: options.agentId,
      agentName: options.agentName,
      mode: options.mode,
      status: "failed",
      summary: message,
      durationMs: Date.now() - started,
      rawText: "",
      parsed: null,
      usage: { promptTokens: null, completionTokens: null },
      error: message,
    };
  }
}

export function projectTitleFrom(agents: AgentOutput[], fallback: string): string {
  const research = agents.find((a) => a.agentId === "research");
  if (research?.parsed?.kind === "research" && research.parsed.data.projectTitle) {
    return research.parsed.data.projectTitle;
  }
  return fallback.slice(0, 80);
}
