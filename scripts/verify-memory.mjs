import { MemoryManager, createEmptyMemory, normalizeText } from "../lib/memory.ts";
import { countConflictingDecisions, countDuplicateFindings } from "../lib/evaluation.ts";

const mgr = new MemoryManager(createEmptyMemory("run-test", "Clinic", "Build a clinic booking app"));
mgr.readMemory();
mgr.selectRelevantKnowledge();
await mgr.updateMemory("Research Agent", {
  requirements: ["Patients can book appointments", "Doctors manage availability"],
  technicalDecisions: [{ category: "frontend", value: "Next.js", rationale: "SSR" }],
});
await mgr.updateMemory("Design Agent", {
  requirements: ["Patients can book appointments"],
  technicalDecisions: [{ category: "frontend", value: "Vue", rationale: "SPA" }],
});

if (mgr.stats.duplicatesRejected < 1) throw new Error("expected duplicate rejection");
if (mgr.stats.conflictsDetected < 1) throw new Error("expected conflict");
const kept = mgr.memory.technicalDecisions.find((e) => e.status === "active" && e.category === "frontend");
if (kept?.value !== "Next.js") throw new Error("existing decision must be preserved");
if (!mgr.getMemoryHistory().length) throw new Error("expected history");

const agents = [
  {
    agentId: "research",
    parsed: {
      kind: "research",
      data: {
        recommendedTechnologies: [
          { category: "db", value: "Postgres" },
        ],
        requirements: ["book", "notify"],
        targetUsers: [],
        constraints: [],
        openQuestions: [],
        projectTitle: "x",
        summary: "",
      },
    },
  },
  {
    agentId: "development",
    parsed: {
      kind: "development",
      data: {
        techStack: [{ category: "db", value: "Mongo" }],
        milestones: ["book"],
        implementationSteps: ["notify"],
        architecture: "",
        inconsistencies: [],
        risks: [],
        requirementsAddressed: [],
        openQuestions: [],
        summary: "",
      },
    },
  },
];

if (countConflictingDecisions(agents) < 1) throw new Error("expected decision conflict");
if (normalizeText("Hello, World!") !== "hello world") throw new Error("normalize");
if (countDuplicateFindings(agents) < 0) throw new Error("dupes");

console.log("memory+eval checks passed", {
  duplicateRejected: mgr.stats.duplicatesRejected,
  conflicts: mgr.stats.conflictsDetected,
  reads: mgr.stats.reads,
  writes: mgr.stats.writes,
});
