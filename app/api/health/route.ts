import { getCrusoeConfig } from "@/lib/crusoe";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getCrusoeConfig();
  const apiKeyPresent = Boolean(config.apiKey);
  return Response.json({
    ok: apiKeyPresent,
    service: "AgentMemory",
    crusoe: {
      apiKeyPresent,
      model: config.model,
      baseUrl: config.baseUrl,
    },
    hint: apiKeyPresent
      ? "Crusoe configuration looks present. Keys are never returned by this endpoint."
      : "Set CRUSOE_API_KEY in .env.local. Get a key at https://console.crusoecloud.com/request-foundry",
  });
}
