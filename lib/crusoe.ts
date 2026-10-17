import OpenAI, { APIError } from "openai";

export const DEFAULT_CRUSOE_BASE_URL =
  "https://api.inference.crusoecloud.com/v1";
export const DEFAULT_CRUSOE_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

/** Comparable output budget for both workflows. Reasoning models need headroom. */
export const AGENT_MAX_TOKENS = 2048;

export type CrusoeConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

export type ChatResult = {
  content: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
  };
};

export function getCrusoeConfig(): CrusoeConfig {
  const apiKey = process.env.CRUSOE_API_KEY?.trim() ?? "";
  const model = process.env.CRUSOE_MODEL?.trim() || DEFAULT_CRUSOE_MODEL;
  const baseUrl =
    process.env.CRUSOE_BASE_URL?.trim() || DEFAULT_CRUSOE_BASE_URL;
  return { apiKey, model, baseUrl };
}

export function isCrusoeConfigured(): boolean {
  return Boolean(getCrusoeConfig().apiKey);
}

export function missingConfigMessage(): string {
  return [
    "Crusoe Managed Inference is not configured.",
    "Create an Intelligence Foundry API key at https://console.crusoecloud.com/request-foundry",
    "then set CRUSOE_API_KEY in .env.local (use single quotes in a shell if the key contains $).",
    `Optional: CRUSOE_MODEL (default ${DEFAULT_CRUSOE_MODEL})`,
    `Optional: CRUSOE_BASE_URL (default ${DEFAULT_CRUSOE_BASE_URL})`,
    "Confirm the exact model id with GET /v1/models — ids are case-sensitive.",
  ].join(" ");
}

function createClient(config: CrusoeConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl.replace(/\/+$/, ""),
  });
}

function isTransientError(error: unknown): boolean {
  if (error instanceof APIError) {
    return error.status === 429 || error.status === 503 || error.status === 502;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("fetch failed") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("network")
    );
  }
  return false;
}

export async function crusoeChat(options: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<ChatResult> {
  const config = getCrusoeConfig();
  if (!config.apiKey) {
    throw new Error(missingConfigMessage());
  }

  const client = createClient(config);
  const request = () =>
    client.chat.completions.create({
      model: config.model,
      temperature: options.temperature ?? 0.3,
      max_tokens: AGENT_MAX_TOKENS,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    });

  let response: OpenAI.Chat.Completions.ChatCompletion;
  try {
    response = await request();
  } catch (error) {
    if (!isTransientError(error)) {
      throw wrapCrusoeError(error);
    }
    await sleep(1200);
    try {
      response = await request();
    } catch (retryError) {
      throw wrapCrusoeError(retryError);
    }
  }

  const message = response.choices[0]?.message;
  const dump =
    message && "model_dump" in message && typeof message.model_dump === "function"
      ? (message.model_dump() as Record<string, unknown>)
      : (message as unknown as Record<string, unknown> | undefined);

  const content =
    (typeof message?.content === "string" ? message.content : "") ||
    (typeof dump?.content === "string" ? dump.content : "") ||
    (typeof dump?.reasoning_content === "string" ? dump.reasoning_content : "");

  const usage = response.usage;
  return {
    content: content.trim(),
    usage: {
      promptTokens:
        typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
      completionTokens:
        typeof usage?.completion_tokens === "number"
          ? usage.completion_tokens
          : null,
    },
  };
}

function wrapCrusoeError(error: unknown): Error {
  if (error instanceof APIError) {
    return new Error(
      `Crusoe API error (${error.status ?? "unknown"}): ${error.message}`,
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Unknown Crusoe API error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
