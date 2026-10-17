import { MemoryManager, createEmptyMemory } from "../lib/memory.ts";

const mgr = new MemoryManager(
  createEmptyMemory(
    "guardian-unit",
    "Clinic",
    "Create a plan for building an online appointment booking system for a medical clinic with patients, doctors, appointments, and notifications.",
  ),
);

await mgr.updateMemory("Research Agent", {
  technicalDecisions: [{ category: "Primary database", value: "PostgreSQL" }],
});

await mgr.updateMemory("Development Agent", {
  technicalDecisions: [{ category: "database", value: "MongoDB" }],
});
const conflict = mgr.memory.guardianHistory.at(-1);
if (!conflict?.conflictDetected) throw new Error("expected genuine conflict");
const activeDb = mgr.memory.technicalDecisions.find(
  (e) => e.status === "active" && /postgres|mongo/i.test(e.value ?? ""),
);
if (!activeDb) throw new Error("expected an active database decision");
if (conflict.resolution === "keep_existing" && activeDb.value !== "PostgreSQL") {
  throw new Error("keep_existing must leave PostgreSQL active");
}
if (conflict.resolution === "accept_new" && activeDb.value !== "MongoDB") {
  throw new Error("accept_new must make MongoDB active");
}
if (conflict.resolution === "flag_for_review") {
  const postgres = mgr.memory.technicalDecisions.find(
    (e) => e.status === "active" && e.value === "PostgreSQL",
  );
  if (!postgres) throw new Error("flag_for_review must preserve existing PostgreSQL");
}

await mgr.updateMemory("Design Agent", {
  technicalDecisions: [{ category: "cache", value: "Redis" }],
});
const redis = mgr.memory.technicalDecisions.find(
  (e) => e.status === "active" && e.value === "Redis",
);
if (!redis) throw new Error("expected compatible Redis cache to be added");

const beforeDupes = mgr.stats.duplicatesRejected;
await mgr.updateMemory("Research Agent", {
  technicalDecisions: [{ category: "Primary database", value: "PostgreSQL" }],
});
if (mgr.stats.duplicatesRejected <= beforeDupes) {
  throw new Error("expected duplicate PostgreSQL to be rejected");
}

console.log("guardian checks passed", {
  conflictsDetected: mgr.stats.conflictsDetected,
  conflictsResolved: mgr.stats.conflictsResolved,
  conflictsFlagged: mgr.stats.conflictsFlagged,
  duplicatesRejected: mgr.stats.duplicatesRejected,
  history: mgr.memory.guardianHistory.map((h) => h.resolution),
  active: mgr.memory.technicalDecisions
    .filter((e) => e.status === "active")
    .map((e) => `${e.category}=${e.value}`),
});
