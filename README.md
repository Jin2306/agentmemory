# AgentMemory

A hackathon MVP for the Crusoe × Cerebral Valley Recursive Agents Hackathon **Shared Brain** track.

> Every new agent on a team starts from zero and pays again for the same context. Build a shared memory layer for an agent team on Crusoe Managed Inference: a living project that every agent reads before it works and updates afterward.

## Problem

Specialist agents (research, design, development) usually run in isolation. They re-discover the same requirements, pick incompatible stacks, and cannot see what teammates already decided. That wastes tokens and produces conflicting plans.

## Solution

AgentMemory runs the same three-agent team twice on one project request:

1. **Without shared memory** — each agent sees only the original request.
2. **With shared memory** — agents run sequentially, read a persistent JSON brain first, then write structured updates.

A comparison dashboard measures token usage, duplicate findings, conflicting decisions, and requirement coverage from the actual outputs of that run.

## Architecture

```
Browser dashboard (Next.js App Router)
        │
        ▼
POST /api/run  →  sequential Crusoe chat calls
        │
        ├── Mode A: isolated agents
        └── Mode B: MemoryManager JSON file per runId
                    data/runs/<runId>/memory.json
```

- UI: Next.js, TypeScript, Tailwind CSS, Lucide React
- Inference: Crusoe Managed Inference (OpenAI-compatible)
- Persistence: one JSON memory file per project run (no database)

## Crusoe Managed Inference

All agent calls go through `lib/crusoe.ts` on the server. The client never sees the API key.

- Endpoint: `https://api.inference.crusoecloud.com/v1`
- Path: `/v1/chat/completions`
- Auth: `Authorization: Bearer $CRUSOE_API_KEY`
- Default model: `nvidia/nemotron-3.5-lightning-30b-a3b` (confirm with `GET /v1/models`; IDs are case-sensitive)

Get a key: [Crusoe Intelligence Foundry](https://console.crusoecloud.com/request-foundry)

Official hackathon examples: [crusoe-developer-hub](https://github.com/crusoecloud/crusoe-developer-hub/tree/main/examples/hackathons/crusoe-cv-recursive-agents-hackathon)

## Shared memory

`lib/memory.ts` implements:

- `readMemory()` / `selectRelevantKnowledge()` — injects active memory into the next agent prompt
- `updateMemory(agentName, updates)` — merges structured findings
- `deduplicateMemory` — normalized-text duplicate rejection
- `detectConflicts` / `resolveConflicts` — same technology category, incompatible values; **existing decision is preserved** and the proposal is flagged
- `getMemoryHistory()` — chronological activity log

Memory is saved atomically (`write` + `rename`) under `data/runs/<runId>/`.

## Agent workflow

1. Research Agent — requirements, users, constraints, tech recommendations
2. Design Agent — structure, features, UI/UX, design decisions
3. Development Agent — architecture, milestones, risks, inconsistencies

Mode A runs all three independently. Mode B runs the same order, passing shared memory into each prompt and merging JSON updates afterward.

## Evaluation methodology

Metrics are computed from real agent JSON (and Crusoe `usage` when present):

| Metric | How it is computed |
|---|---|
| Input / output tokens | Sum of Crusoe `usage.prompt_tokens` / `completion_tokens`. Shown as Unavailable if missing. |
| Duplicate findings | Normalized string matches across agent outputs; extras beyond the first occurrence. |
| Conflicting decisions | Same decision category with more than one distinct value. |
| Requirement coverage | Research requirements from Mode A (fixed reference) vs each workflow’s development plan. |

The auto-generated summary describes **this run only**. It does not claim a general improvement.

## Installation

```bash
npm install
cp .env.example .env.local
# edit .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

```
CRUSOE_API_KEY=          # required; wrap in single quotes in a shell if it contains $
CRUSOE_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
CRUSOE_BASE_URL=https://api.inference.crusoecloud.com/v1
```

`GET /api/health` reports whether the key is present. It never returns the secret.

## Demo (under two minutes)

1. Open the dashboard and pick an example project (or paste your own).
2. Click **Run Agent Team**.
3. Watch Mode A: three agents run independently.
4. Watch Mode B: Shared Brain fills in; later agents read earlier knowledge.
5. Scroll the Memory Timeline for real read/write/conflict events.
6. Compare metrics. Differences are from this run’s actual outputs.
7. Read the Final Project Plan from the shared-memory workflow.

## API

- `POST /api/run` — NDJSON stream of agent/memory events, then a `complete` payload
- `GET /api/memory?runId=...` — saved memory for a run
- `GET /api/health` — Crusoe config presence (no secrets)

## Limitations

- Sequential execution (six Crusoe calls per demo) — not a recursive sub-agent swarm
- Heuristic coverage and conflict detection, not an LLM judge
- JSON parsing depends on the model following the schema
- Local filesystem persistence only
- Default model ID should be confirmed against `/v1/models` for your project

## Future improvements

- Recursive planner that spawns specialist sub-agents against the same brain
- Prefix-cache-friendly prompt layout for Crusoe MemoryAlloy
- Human conflict-resolution UI
- Longer-lived project memory across sessions and teams
