import { normalizeText } from "./memory";
import type {
  AgentOutput,
  FinalPlan,
  Metrics,
  TechDecision,
} from "./types";

function collectFindings(agents: AgentOutput[]): string[] {
  const findings: string[] = [];
  for (const agent of agents) {
    const parsed = agent.parsed;
    if (!parsed) continue;
    if (parsed.kind === "research") {
      findings.push(
        ...parsed.data.requirements,
        ...parsed.data.targetUsers,
        ...parsed.data.constraints,
        ...parsed.data.recommendedTechnologies.map(
          (d) => `${d.category}:${d.value}`,
        ),
      );
    } else if (parsed.kind === "design") {
      findings.push(
        ...parsed.data.features,
        ...parsed.data.productStructure,
        ...parsed.data.designDecisions.map((d) => `${d.category}:${d.value}`),
      );
    } else {
      findings.push(
        ...parsed.data.milestones,
        ...parsed.data.implementationSteps,
        ...parsed.data.techStack.map((d) => `${d.category}:${d.value}`),
        ...parsed.data.requirementsAddressed,
      );
    }
  }
  return findings.map(normalizeText).filter(Boolean);
}

export function countDuplicateFindings(agents: AgentOutput[]): number {
  const findings = collectFindings(agents);
  const counts = new Map<string, number>();
  for (const item of findings) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let extras = 0;
  for (const count of counts.values()) {
    if (count > 1) extras += count - 1;
  }
  return extras;
}

function collectDecisions(agents: AgentOutput[]): TechDecision[] {
  const decisions: TechDecision[] = [];
  for (const agent of agents) {
    const parsed = agent.parsed;
    if (!parsed) continue;
    if (parsed.kind === "research") {
      decisions.push(...parsed.data.recommendedTechnologies);
    } else if (parsed.kind === "design") {
      decisions.push(...parsed.data.designDecisions);
    } else {
      decisions.push(...parsed.data.techStack);
    }
  }
  return decisions;
}

export function countConflictingDecisions(agents: AgentOutput[]): number {
  const byCategory = new Map<string, Set<string>>();
  for (const decision of collectDecisions(agents)) {
    const category = normalizeText(decision.category);
    const value = normalizeText(decision.value);
    if (!category || !value) continue;
    const set = byCategory.get(category) ?? new Set<string>();
    set.add(value);
    byCategory.set(category, set);
  }
  let conflicts = 0;
  for (const values of byCategory.values()) {
    if (values.size > 1) conflicts += values.size - 1;
  }
  return conflicts;
}

export function extractReferenceRequirements(agents: AgentOutput[]): string[] {
  const research = agents.find((a) => a.agentId === "research");
  if (research?.parsed?.kind === "research") {
    return research.parsed.data.requirements.map(normalizeText).filter(Boolean);
  }
  return [];
}

function developmentCorpus(agents: AgentOutput[]): string {
  const development = agents.find((a) => a.agentId === "development");
  if (development?.parsed?.kind !== "development") {
    return normalizeText(development?.rawText ?? "");
  }
  const d = development.parsed.data;
  return normalizeText(
    [
      d.architecture,
      ...d.milestones,
      ...d.implementationSteps,
      ...d.requirementsAddressed,
      ...d.techStack.map((t) => `${t.category} ${t.value} ${t.rationale ?? ""}`),
    ].join(" "),
  );
}

export function requirementCoverage(
  agents: AgentOutput[],
  reference: string[],
): { covered: number; total: number; ratio: number } {
  const total = reference.length;
  if (total === 0) {
    return { covered: 0, total: 0, ratio: 0 };
  }
  const corpus = developmentCorpus(agents);
  let covered = 0;
  for (const req of reference) {
    const tokens = req.split(" ").filter((t) => t.length > 3);
    if (tokens.length === 0) {
      if (corpus.includes(req)) covered += 1;
      continue;
    }
    const hits = tokens.filter((token) => corpus.includes(token)).length;
    if (hits / tokens.length >= 0.5) covered += 1;
  }
  return { covered, total, ratio: covered / total };
}

export function sumTokens(agents: AgentOutput[]): {
  input: number | null;
  output: number | null;
} {
  let input = 0;
  let output = 0;
  let inputOk = true;
  let outputOk = true;
  for (const agent of agents) {
    if (agent.usage.promptTokens == null) inputOk = false;
    else input += agent.usage.promptTokens;
    if (agent.usage.completionTokens == null) outputOk = false;
    else output += agent.usage.completionTokens;
  }
  return {
    input: inputOk ? input : null,
    output: outputOk ? output : null,
  };
}

export function evaluateWorkflow(
  agents: AgentOutput[],
  referenceRequirements: string[],
): Metrics {
  const tokens = sumTokens(agents);
  const coverage = requirementCoverage(agents, referenceRequirements);
  return {
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    duplicateFindings: countDuplicateFindings(agents),
    conflictingDecisions: countConflictingDecisions(agents),
    requirementCoverage: coverage.ratio,
    requirementsCovered: coverage.covered,
    requirementsTotal: coverage.total,
  };
}

export function buildComparisonSummary(
  without: Metrics,
  withMemory: Metrics,
): string {
  const parts: string[] = [];

  const compare = (
    label: string,
    a: number | null,
    b: number | null,
    better: "lower" | "higher",
  ) => {
    if (a == null || b == null) {
      parts.push(`${label}: unavailable for at least one workflow.`);
      return;
    }
    if (a === b) {
      parts.push(`${label}: both workflows measured ${a}.`);
      return;
    }
    const winner = better === "lower" ? (b < a ? "with" : "without") : b > a ? "with" : "without";
    parts.push(
      `${label}: without memory ${a}, with memory ${b} (${winner} memory is better on this run).`,
    );
  };

  compare("Input tokens", without.inputTokens, withMemory.inputTokens, "lower");
  compare("Output tokens", without.outputTokens, withMemory.outputTokens, "lower");
  compare(
    "Duplicate findings",
    without.duplicateFindings,
    withMemory.duplicateFindings,
    "lower",
  );
  compare(
    "Conflicting decisions",
    without.conflictingDecisions,
    withMemory.conflictingDecisions,
    "lower",
  );
  compare(
    "Requirement coverage",
    Number(without.requirementCoverage.toFixed(2)),
    Number(withMemory.requirementCoverage.toFixed(2)),
    "higher",
  );

  parts.push(
    "This is a single-run comparison, not a general proof that shared memory always improves agent teams.",
  );
  return parts.join(" ");
}

export function buildFinalPlan(agents: AgentOutput[], request: string): FinalPlan {
  const research = agents.find((a) => a.agentId === "research")?.parsed;
  const design = agents.find((a) => a.agentId === "design")?.parsed;
  const development = agents.find((a) => a.agentId === "development")?.parsed;

  const overviewParts = [
    research?.kind === "research" ? research.data.summary : "",
    design?.kind === "design" ? design.data.summary : "",
    development?.kind === "development" ? development.data.summary : "",
  ].filter(Boolean);

  const features =
    design?.kind === "design"
      ? design.data.features
      : research?.kind === "research"
        ? research.data.requirements
        : [];

  const architecture =
    development?.kind === "development"
      ? development.data.architecture
      : "Architecture was not produced in this run.";

  const steps =
    development?.kind === "development"
      ? development.data.implementationSteps.length
        ? development.data.implementationSteps
        : development.data.milestones
      : [];

  const risks =
    development?.kind === "development" ? development.data.risks : [];

  const questions = [
    ...(research?.kind === "research" ? research.data.openQuestions : []),
    ...(design?.kind === "design" ? design.data.openQuestions : []),
    ...(development?.kind === "development" ? development.data.openQuestions : []),
  ];

  return {
    overview: overviewParts.join(" ") || request,
    keyFeatures: features,
    architecture,
    implementationSteps: steps,
    risks,
    unresolvedQuestions: questions,
  };
}
