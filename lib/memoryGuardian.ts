import { crusoeChat, isCrusoeConfigured } from "./crusoe";
import { asString, extractJsonObject } from "./json";
import type {
  GuardianConfidence,
  GuardianResolution,
  GuardianVerdict,
  Metrics,
  SharedMemory,
  TechDecision,
} from "./types";

const SYSTEM_PROMPT = `You are the Memory Guardian for a multi-agent project brain.
You decide whether a proposed technical decision contradicts an existing one.

Rules:
- Complementary technologies are NOT conflicts. Example: PostgreSQL (primary database) and Redis (cache) can coexist.
- Incompatible choices for the SAME role ARE conflicts. Example: PostgreSQL vs MongoDB as the primary database.
- Never invent project facts. Use the provided requirements and constraints.
- If you are not confident, use flag_for_review.
- Do not silently overwrite. Resolutions: keep_existing, accept_new, flag_for_review.

Return ONLY JSON:
{
  "conflictDetected": boolean,
  "existingDecision": string,
  "proposedDecision": string,
  "resolution": "keep_existing" | "accept_new" | "flag_for_review",
  "reason": string,
  "confidence": "low" | "medium" | "high"
}`;

const ROLE_ALIASES: Record<string, string> = {
  database: "database",
  db: "database",
  datastore: "database",
  "data store": "database",
  "primary database": "database",
  "primary db": "database",
  frontend: "frontend",
  ui: "frontend",
  client: "frontend",
  backend: "backend",
  api: "backend",
  server: "backend",
  cache: "cache",
  caching: "cache",
  redis: "cache",
  auth: "auth",
  authentication: "auth",
  hosting: "hosting",
  deploy: "hosting",
  notifications: "notifications",
  notify: "notifications",
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalCategory(category: string): string {
  const normalized = normalize(category);
  return ROLE_ALIASES[normalized] ?? normalized;
}

export function looksLikeDuplicate(existingValue: string, proposedValue: string): boolean {
  return normalize(existingValue) === normalize(proposedValue);
}

function parseResolution(value: string): GuardianResolution {
  if (value === "accept_new" || value === "keep_existing" || value === "flag_for_review") {
    return value;
  }
  return "flag_for_review";
}

function parseConfidence(value: string): GuardianConfidence {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "low";
}

function fallbackVerdict(
  existing: string,
  proposed: string,
  reason: string,
): GuardianVerdict {
  return {
    conflictDetected: true,
    existingDecision: existing,
    proposedDecision: proposed,
    resolution: "flag_for_review",
    reason,
    confidence: "low",
  };
}

export function guardianMetricsFromMemory(memory: SharedMemory): Pick<
  Metrics,
  | "guardianConflictsDetected"
  | "guardianConflictsResolved"
  | "guardianUnresolved"
  | "memoryConsistency"
> {
  const history = memory.guardianHistory ?? [];
  const conflicts = history.filter((record) => record.conflictDetected);
  const resolved = conflicts.filter(
    (record) =>
      record.resolution === "keep_existing" || record.resolution === "accept_new",
  );
  const unresolved = conflicts.filter(
    (record) => record.resolution === "flag_for_review",
  );
  const active = memory.technicalDecisions.filter((entry) => entry.status === "active");
  const uniqueRoles = new Set(
    active.map((entry) => canonicalCategory(entry.category ?? entry.content)),
  );
  const memoryConsistency = active.length === 0 ? 1 : uniqueRoles.size / active.length;
  return {
    guardianConflictsDetected: conflicts.length,
    guardianConflictsResolved: resolved.length,
    guardianUnresolved: unresolved.length,
    memoryConsistency,
  };
}

export async function evaluateConflict(options: {
  memory: SharedMemory;
  category: string;
  existing: TechDecision;
  proposed: TechDecision;
}): Promise<GuardianVerdict> {
  const existingLabel = `${options.existing.category}: ${options.existing.value}`;
  const proposedLabel = `${options.proposed.category}: ${options.proposed.value}`;

  if (!isCrusoeConfigured()) {
    return fallbackVerdict(
      existingLabel,
      proposedLabel,
      "Guardian could not call Crusoe Managed Inference (missing API key), so the proposal was flagged for review instead of being overwritten.",
    );
  }

  const requirements = options.memory.requirements
    .filter((e) => e.status === "active")
    .map((e) => e.content);
  const constraints = options.memory.constraints
    .filter((e) => e.status === "active")
    .map((e) => e.content);

  const user = JSON.stringify(
    {
      project: options.memory.project,
      request: options.memory.request,
      requirements,
      constraints,
      existingDecision: {
        category: options.existing.category,
        value: options.existing.value,
        rationale: options.existing.rationale,
      },
      proposedDecision: {
        category: options.proposed.category,
        value: options.proposed.value,
        rationale: options.proposed.rationale,
      },
    },
    null,
    2,
  );

  try {
    const result = await crusoeChat({
      system: SYSTEM_PROMPT,
      user: `Evaluate this memory update:\n${user}`,
      temperature: 0.1,
    });
    const raw = extractJsonObject(result.content) as Record<string, unknown>;
    const resolution = parseResolution(asString(raw.resolution, "flag_for_review"));
    const conflictDetected = Boolean(raw.conflictDetected);
    return {
      conflictDetected,
      existingDecision: asString(raw.existingDecision, existingLabel),
      proposedDecision: asString(raw.proposedDecision, proposedLabel),
      resolution: conflictDetected ? resolution : "accept_new",
      reason:
        asString(raw.reason) ||
        "Guardian returned structured JSON without a reason.",
      confidence: parseConfidence(asString(raw.confidence, "low")),
    };
  } catch (error) {
    return fallbackVerdict(
      existingLabel,
      proposedLabel,
      `Guardian evaluation failed (${error instanceof Error ? error.message : "unknown error"}); flagged for review.`,
    );
  }
}
