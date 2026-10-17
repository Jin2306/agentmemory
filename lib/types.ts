export type AgentId = "research" | "design" | "development";
export type AgentName = "Research Agent" | "Design Agent" | "Development Agent";
export type WorkflowMode = "without-memory" | "with-memory";
export type AgentStatus = "waiting" | "running" | "completed" | "failed";
export type EntryStatus =
  | "active"
  | "flagged-conflict"
  | "rejected-duplicate"
  | "rejected-guardian"
  | "superseded";
export type GuardianResolution = "keep_existing" | "accept_new" | "flag_for_review";
export type GuardianConfidence = "low" | "medium" | "high";

export type MemoryEntry = {
  id: string;
  content: string;
  source: AgentName | "Memory Manager" | "Memory Guardian";
  timestamp: string;
  status: EntryStatus;
  category?: string;
  value?: string;
};

export type MemoryActivity = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
};

export type SharedMemory = {
  project: string;
  version: number;
  runId: string;
  request: string;
  requirements: MemoryEntry[];
  targetUsers: MemoryEntry[];
  technicalDecisions: MemoryEntry[];
  constraints: MemoryEntry[];
  completedTasks: MemoryEntry[];
  openQuestions: MemoryEntry[];
  conflicts: MemoryEntry[];
  activityLog: MemoryActivity[];
  guardianHistory: GuardianRecord[];
};

export type MemoryStats = {
  reads: number;
  writes: number;
  newEntries: number;
  duplicatesRejected: number;
  conflictsDetected: number;
  conflictsResolved: number;
  conflictsFlagged: number;
};

export type GuardianVerdict = {
  conflictDetected: boolean;
  existingDecision: string;
  proposedDecision: string;
  resolution: GuardianResolution;
  reason: string;
  confidence: GuardianConfidence;
};

export type GuardianRecord = GuardianVerdict & {
  id: string;
  timestamp: string;
  proposingAgent: AgentName | "Memory Guardian";
  category: string;
  versionBefore: number;
  versionAfter: number;
};

export type TokenUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
};

export type TechDecision = {
  category: string;
  value: string;
  rationale?: string;
};

export type MemoryUpdates = {
  requirements?: string[];
  targetUsers?: string[];
  constraints?: string[];
  openQuestions?: string[];
  completedTasks?: string[];
  technicalDecisions?: TechDecision[];
};

export type ResearchPayload = {
  projectTitle: string;
  summary: string;
  requirements: string[];
  targetUsers: string[];
  constraints: string[];
  recommendedTechnologies: TechDecision[];
  openQuestions: string[];
};

export type DesignPayload = {
  summary: string;
  productStructure: string[];
  features: string[];
  uiUxPlan: string[];
  designDecisions: TechDecision[];
  dependencies: string[];
  openQuestions: string[];
};

export type DevelopmentPayload = {
  summary: string;
  architecture: string;
  techStack: TechDecision[];
  milestones: string[];
  implementationSteps: string[];
  inconsistencies: string[];
  risks: string[];
  requirementsAddressed: string[];
  openQuestions: string[];
};

export type AgentParsed =
  | { kind: "research"; data: ResearchPayload }
  | { kind: "design"; data: DesignPayload }
  | { kind: "development"; data: DevelopmentPayload };

export type AgentOutput = {
  agentId: AgentId;
  agentName: AgentName;
  mode: WorkflowMode;
  status: AgentStatus;
  summary: string;
  durationMs: number;
  rawText: string;
  parsed: AgentParsed | null;
  parseError?: string;
  usage: TokenUsage;
  error?: string;
};

export type Metrics = {
  inputTokens: number | null;
  outputTokens: number | null;
  duplicateFindings: number;
  conflictingDecisions: number;
  requirementCoverage: number;
  requirementsCovered: number;
  requirementsTotal: number;
  guardianConflictsDetected: number;
  guardianConflictsResolved: number;
  guardianUnresolved: number;
  memoryConsistency: number | null;
};

export type FinalPlan = {
  overview: string;
  keyFeatures: string[];
  architecture: string;
  implementationSteps: string[];
  risks: string[];
  unresolvedQuestions: string[];
};

export type RunResult = {
  runId: string;
  request: string;
  projectTitle: string;
  withoutMemory: {
    agents: AgentOutput[];
    metrics: Metrics;
  };
  withMemory: {
    agents: AgentOutput[];
    metrics: Metrics;
    memory: SharedMemory;
    stats: MemoryStats;
  };
  comparisonSummary: string;
  finalPlan: FinalPlan;
};

export type RunEvent =
  | { type: "run-start"; runId: string; request: string }
  | { type: "mode-start"; mode: WorkflowMode }
  | { type: "agent-status"; mode: WorkflowMode; agentId: AgentId; status: AgentStatus }
  | { type: "agent-result"; mode: WorkflowMode; agent: AgentOutput }
  | { type: "memory"; memory: SharedMemory; stats: MemoryStats }
  | { type: "complete"; result: RunResult }
  | { type: "error"; message: string };

export type GuardianDemoCaseResult = {
  name: string;
  description: string;
  beforeVersion: number;
  afterVersion: number;
  activeDecisions: { category: string; value: string }[];
};

export type GuardianDemoResult = {
  runId: string;
  isolated: true;
  request: string;
  cases: GuardianDemoCaseResult[];
  memory: SharedMemory;
  stats: MemoryStats;
  metrics: Pick<
    Metrics,
    | "guardianConflictsDetected"
    | "guardianConflictsResolved"
    | "guardianUnresolved"
    | "memoryConsistency"
  >;
};

export const AGENT_ORDER: { id: AgentId; name: AgentName }[] = [
  { id: "research", name: "Research Agent" },
  { id: "design", name: "Design Agent" },
  { id: "development", name: "Development Agent" },
];
