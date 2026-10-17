import { executeAgentTeam, validateRequest } from "@/lib/run-team";
import { withRunLock } from "@/lib/memory";
import type { RunEvent } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let projectRequest: string;
  try {
    projectRequest = validateRequest(payload);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RunEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await withRunLock(() => executeAgentTeam(projectRequest, send));
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Run failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
