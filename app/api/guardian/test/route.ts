import { runGuardianDemo } from "@/lib/guardianDemo";
import { withRunLock } from "@/lib/memory";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let projectRequest = "";
  try {
    const body = (await request.json()) as { request?: unknown };
    if (typeof body.request === "string") projectRequest = body.request;
  } catch {
    projectRequest = "";
  }

  try {
    const result = await withRunLock(() => runGuardianDemo(projectRequest));
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Guardian demo failed." },
      { status: 500 },
    );
  }
}
