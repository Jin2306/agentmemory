import { loadMemory } from "@/lib/memory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId")?.trim();
  if (!runId) {
    return Response.json(
      { error: "Query parameter runId is required." },
      { status: 400 },
    );
  }
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) {
    return Response.json({ error: "Invalid runId." }, { status: 400 });
  }

  try {
    const memory = await loadMemory(runId);
    return Response.json({ memory, history: memory.activityLog });
  } catch {
    return Response.json(
      { error: `No saved memory found for run ${runId}.` },
      { status: 404 },
    );
  }
}
