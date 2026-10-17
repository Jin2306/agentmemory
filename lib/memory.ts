import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  canonicalCategory,
  evaluateConflict,
  looksLikeDuplicate,
} from "./memoryGuardian";
import type {
  AgentName,
  GuardianRecord,
  GuardianVerdict,
  MemoryActivity,
  MemoryEntry,
  MemoryStats,
  MemoryUpdates,
  SharedMemory,
  TechDecision,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "runs");

export function createEmptyMemory(
  runId: string,
  project: string,
  request: string,
): SharedMemory {
  return {
    project,
    version: 1,
    runId,
    request,
    requirements: [],
    targetUsers: [],
    technicalDecisions: [],
    constraints: [],
    completedTasks: [],
    openQuestions: [],
    conflicts: [],
    activityLog: [],
    guardianHistory: [],
  };
}

export function createStats(): MemoryStats {
  return {
    reads: 0,
    writes: 0,
    newEntries: 0,
    duplicatesRejected: 0,
    conflictsDetected: 0,
    conflictsResolved: 0,
    conflictsFlagged: 0,
  };
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function now(): string {
  return new Date().toISOString();
}

function makeEntry(
  content: string,
  source: AgentName | "Memory Manager" | "Memory Guardian",
  extra?: { category?: string; value?: string; status?: MemoryEntry["status"] },
): MemoryEntry {
  return {
    id: newId("mem"),
    content: content.trim(),
    source,
    timestamp: now(),
    status: extra?.status ?? "active",
    category: extra?.category,
    value: extra?.value,
  };
}

function log(
  memory: SharedMemory,
  actor: string,
  action: string,
  detail: string,
): void {
  const event: MemoryActivity = {
    id: newId("evt"),
    timestamp: now(),
    actor,
    action,
    detail,
  };
  memory.activityLog.push(event);
}

function isDuplicate(existing: MemoryEntry[], content: string): boolean {
  const needle = normalizeText(content);
  if (!needle) return true;
  return existing.some(
    (entry) =>
      entry.status !== "rejected-duplicate" &&
      normalizeText(entry.content) === needle,
  );
}

export class MemoryManager {
  memory: SharedMemory;
  stats: MemoryStats;

  constructor(memory: SharedMemory, stats = createStats()) {
    this.memory = memory;
    this.stats = stats;
  }

  readMemory(): SharedMemory {
    this.stats.reads += 1;
    log(
      this.memory,
      "Memory Manager",
      "read",
      `Returned shared memory v${this.memory.version}`,
    );
    return this.memory;
  }

  selectRelevantKnowledge(): string {
    this.stats.reads += 1;
    const active = (entries: MemoryEntry[]) =>
      entries.filter((e) => e.status === "active").map((e) => e.content);
    const decisions = this.memory.technicalDecisions
      .filter((e) => e.status === "active")
      .map((e) =>
        e.category ? `${e.category}: ${e.value ?? e.content}` : e.content,
      );
    const conflicts = this.memory.conflicts.map((e) => e.content);

    const snapshot = {
      project: this.memory.project,
      version: this.memory.version,
      requirements: active(this.memory.requirements),
      targetUsers: active(this.memory.targetUsers),
      constraints: active(this.memory.constraints),
      technicalDecisions: decisions,
      openQuestions: active(this.memory.openQuestions),
      conflictsFlaggedForReview: conflicts,
    };

    const counts = [
      snapshot.requirements.length,
      snapshot.targetUsers.length,
      snapshot.technicalDecisions.length,
      snapshot.constraints.length,
      snapshot.openQuestions.length,
    ];
    log(
      this.memory,
      "Memory Manager",
      "select",
      `Selected ${counts.reduce((a, b) => a + b, 0)} active knowledge items`,
    );
    return JSON.stringify(snapshot, null, 2);
  }

  async updateMemory(agentName: AgentName, updates: MemoryUpdates): Promise<void> {
    const added: string[] = [];

    const appendList = (
      key: keyof Pick<
        SharedMemory,
        | "requirements"
        | "targetUsers"
        | "constraints"
        | "openQuestions"
        | "completedTasks"
      >,
      items: string[] | undefined,
      label: string,
    ) => {
      if (!items?.length) return;
      let count = 0;
      for (const item of items) {
        const content = item.trim();
        if (!content) continue;
        if (isDuplicate(this.memory[key], content)) {
          this.stats.duplicatesRejected += 1;
          const rejected = makeEntry(content, agentName, {
            status: "rejected-duplicate",
          });
          this.memory[key].push(rejected);
          log(
            this.memory,
            "Memory Manager",
            "deduplicate",
            `Rejected duplicate ${label}: ${content}`,
          );
          continue;
        }
        this.memory[key].push(makeEntry(content, agentName));
        this.stats.newEntries += 1;
        count += 1;
      }
      if (count) added.push(`${count} ${label}`);
    };

    appendList("requirements", updates.requirements, "requirements");
    appendList("targetUsers", updates.targetUsers, "target users");
    appendList("constraints", updates.constraints, "constraints");
    appendList("openQuestions", updates.openQuestions, "open questions");
    appendList("completedTasks", updates.completedTasks, "completed tasks");

    if (updates.technicalDecisions?.length) {
      const { addedCount, conflictCount } = await this.mergeDecisions(
        agentName,
        updates.technicalDecisions,
      );
      if (addedCount) added.push(`${addedCount} technical decisions`);
      if (conflictCount) {
        added.push(`flagged ${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`);
      }
    }

    this.memory.version += 1;
    this.stats.writes += 1;
    log(
      this.memory,
      agentName,
      "update",
      added.length ? `Added ${added.join(", ")}` : "No new unique entries",
    );
  }

  async mergeDecisions(agentName: AgentName, decisions: TechDecision[]) {
    let addedCount = 0;
    let conflictCount = 0;

    for (const decision of decisions) {
      const category = decision.category.trim();
      const value = decision.value.trim();
      if (!category || !value) continue;
      const content = `${category}: ${value}${
        decision.rationale ? ` — ${decision.rationale}` : ""
      }`;

      const existing = this.memory.technicalDecisions.find(
        (entry) =>
          entry.status === "active" &&
          canonicalCategory(entry.category ?? "") === canonicalCategory(category),
      );

      if (existing) {
        const sameValue = looksLikeDuplicate(existing.value ?? existing.content, value);
        if (sameValue || isDuplicate(this.memory.technicalDecisions, content)) {
          this.stats.duplicatesRejected += 1;
          this.memory.technicalDecisions.push(
            makeEntry(content, agentName, {
              category,
              value,
              status: "rejected-duplicate",
            }),
          );
          log(
            this.memory,
            "Memory Manager",
            "deduplicate",
            `Rejected duplicate decision for ${category}`,
          );
          continue;
        }

        const versionBefore = this.memory.version;
        const verdict = await evaluateConflict({
          memory: this.memory,
          category,
          existing: {
            category: existing.category ?? category,
            value: existing.value ?? existing.content,
          },
          proposed: decision,
        });
        if (verdict.conflictDetected) {
          conflictCount += 1;
          this.stats.conflictsDetected += 1;
        }
        this.applyGuardianVerdict(agentName, existing, decision, content, verdict, versionBefore);
        continue;
      }

      this.memory.technicalDecisions.push(
        makeEntry(content, agentName, { category, value }),
      );
      this.stats.newEntries += 1;
      addedCount += 1;
    }

    return { addedCount, conflictCount };
  }

  applyGuardianVerdict(
    agentName: AgentName,
    existing: MemoryEntry,
    proposed: TechDecision,
    content: string,
    verdict: GuardianVerdict,
    versionBefore: number,
  ): void {
    const category = proposed.category.trim();
    const value = proposed.value.trim();

    if (!verdict.conflictDetected) {
      this.memory.technicalDecisions.push(
        makeEntry(content, agentName, { category, value }),
      );
      this.stats.newEntries += 1;
      this.recordGuardian(agentName, category, verdict, versionBefore, {
        action: "compatible",
        detail: `Guardian treated ${value} as complementary to ${existing.value}: ${verdict.reason}`,
      });
      return;
    }

    if (verdict.resolution === "accept_new") {
      existing.status = "superseded";
      this.memory.technicalDecisions.push(
        makeEntry(content, agentName, { category, value, status: "active" }),
      );
      this.stats.newEntries += 1;
      this.stats.conflictsResolved += 1;
      this.recordGuardian(agentName, category, verdict, versionBefore, {
        action: "accept",
        detail: `Guardian accepted ${value} over ${existing.value}: ${verdict.reason}`,
      });
      return;
    }

    if (verdict.resolution === "keep_existing") {
      this.memory.technicalDecisions.push(
        makeEntry(content, agentName, {
          category,
          value,
          status: "rejected-guardian",
        }),
      );
      this.stats.conflictsResolved += 1;
      this.recordGuardian(agentName, category, verdict, versionBefore, {
        action: "preserve",
        detail: `Guardian kept ${existing.value} and rejected ${value}: ${verdict.reason}`,
      });
      return;
    }

    this.memory.technicalDecisions.push(
      makeEntry(content, agentName, {
        category,
        value,
        status: "flagged-conflict",
      }),
    );
    this.memory.conflicts.push(
      makeEntry(
        `Review needed: ${existing.category}="${existing.value}" vs proposed ${value} from ${agentName}. ${verdict.reason}`,
        "Memory Guardian",
        { category, value, status: "flagged-conflict" },
      ),
    );
    this.stats.conflictsFlagged += 1;
    this.recordGuardian(agentName, category, verdict, versionBefore, {
      action: "flag",
      detail: `Guardian flagged ${category} conflict for review: ${verdict.reason}`,
    });
  }

  recordGuardian(
    agentName: AgentName,
    category: string,
    verdict: GuardianVerdict,
    versionBefore: number,
    event: { action: string; detail: string },
  ): void {
    const versionAfter = versionBefore + 1;
    const record: GuardianRecord = {
      id: newId("grd"),
      timestamp: now(),
      proposingAgent: agentName,
      category,
      versionBefore,
      versionAfter,
      ...verdict,
    };
    this.memory.guardianHistory.push(record);
    log(this.memory, "Memory Guardian", event.action, event.detail);
    if (verdict.conflictDetected) {
      log(this.memory, agentName, "conflict", `Detected 1 conflict on ${category}`);
    }
  }

  getMemoryHistory(): MemoryActivity[] {
    return [...this.memory.activityLog].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
  }
}

function runDir(runId: string): string {
  return path.join(DATA_DIR, runId);
}

export async function saveMemoryAtomic(memory: SharedMemory): Promise<void> {
  const dir = runDir(memory.runId);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, "memory.json");
  const temp = path.join(dir, `memory.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temp, JSON.stringify(memory, null, 2), "utf8");
  await rename(temp, target);
}

export async function loadMemory(runId: string): Promise<SharedMemory> {
  const file = path.join(runDir(runId), "memory.json");
  const raw = await readFile(file, "utf8");
  const memory = JSON.parse(raw) as SharedMemory;
  if (!memory.guardianHistory) memory.guardianHistory = [];
  return memory;
}

export async function saveRunResult(runId: string, payload: unknown): Promise<void> {
  const dir = runDir(runId);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, "result.json");
  const temp = path.join(dir, `result.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temp, JSON.stringify(payload, null, 2), "utf8");
  await rename(temp, target);
}

let runLock: Promise<void> = Promise.resolve();

export async function withRunLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void = () => {};
  const previous = runLock;
  runLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
